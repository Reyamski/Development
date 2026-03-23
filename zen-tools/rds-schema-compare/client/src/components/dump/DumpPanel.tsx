import { useState, useEffect, useRef } from 'react';
import { useComparisonStore } from '../../store/comparison-store';
import { getTeleportStatus, listTeleportDatabases, startDump } from '../../api/client';

const inputClass =
  'w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500';

function formatExpiry(expires?: string): string {
  if (!expires) return '';
  const exp = new Date(expires);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  if (diffMs <= 0) return '(expired)';
  const hours = Math.floor(diffMs / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);
  return hours > 0 ? `expires ${hours}h ${mins}m` : `expires ${mins}m`;
}

const isS3 = (p: string) => p.startsWith('s3://');

export default function DumpPanel() {
  const [expanded, setExpanded] = useState(false);

  const proxy = useComparisonStore((s) => s.dumpProxy);
  const setProxy = useComparisonStore((s) => s.setDumpProxy);
  const outputBase = useComparisonStore((s) => s.dumpOutputBase);
  const setOutputBase = useComparisonStore((s) => s.setDumpOutputBase);
  const stagingPath = useComparisonStore((s) => s.dumpStagingPath);
  const setStagingPath = useComparisonStore((s) => s.setDumpStagingPath);
  const autoUpload = useComparisonStore((s) => s.dumpAutoUploadToS3);
  const setAutoUpload = useComparisonStore((s) => s.setDumpAutoUploadToS3);
  const status = useComparisonStore((s) => s.dumpStatus);
  const setStatus = useComparisonStore((s) => s.setDumpStatus);
  const databases = useComparisonStore((s) => s.dumpDatabases);
  const setDatabases = useComparisonStore((s) => s.setDumpDatabases);
  const selectedDbs = useComparisonStore((s) => s.dumpSelectedDbs);
  const toggleDb = useComparisonStore((s) => s.toggleDumpDb);
  const checkingStatus = useComparisonStore((s) => s.dumpCheckingStatus);
  const setCheckingStatus = useComparisonStore((s) => s.setDumpCheckingStatus);
  const loadingDbs = useComparisonStore((s) => s.dumpLoadingDbs);
  const setLoadingDbs = useComparisonStore((s) => s.setDumpLoadingDbs);
  const loggingIn = useComparisonStore((s) => s.dumpLoggingIn);
  const setLoggingIn = useComparisonStore((s) => s.setDumpLoggingIn);
  const running = useComparisonStore((s) => s.dumpRunning);
  const setRunning = useComparisonStore((s) => s.setDumpRunning);
  const logs = useComparisonStore((s) => s.dumpLogs);
  const appendLog = useComparisonStore((s) => s.appendDumpLog);
  const clearLogs = useComparisonStore((s) => s.clearDumpLogs);
  const dumpError = useComparisonStore((s) => s.dumpError);
  const setDumpError = useComparisonStore((s) => s.setDumpError);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  async function handleCheckStatus() {
    setCheckingStatus(true);
    setDumpError(null);
    try {
      const result = await getTeleportStatus(proxy);
      setStatus(result);
    } catch (e: any) {
      setDumpError(e.message || 'Failed to check status');
      setStatus(null);
    } finally {
      setCheckingStatus(false);
    }
  }

  function handleLogin() {
    if (loggingIn || !proxy) return;
    clearLogs();
    setDumpError(null);
    setLoggingIn(true);

    const es = new EventSource(`/api/dump/tsh-login/stream?proxy=${encodeURIComponent(proxy)}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'log') {
          appendLog(msg.message);
        } else if (msg.type === 'done') {
          setLoggingIn(false);
          es.close();
          handleCheckStatus();
        } else if (msg.type === 'error') {
          setDumpError(msg.message);
          setLoggingIn(false);
          es.close();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      setDumpError('Login stream connection lost');
      setLoggingIn(false);
      es.close();
    };
  }

  async function handleListDatabases() {
    setLoadingDbs(true);
    setDumpError(null);
    try {
      const dbs = await listTeleportDatabases(proxy);
      setDatabases(dbs);
    } catch (e: any) {
      setDumpError(e.message || 'Failed to list databases');
    } finally {
      setLoadingDbs(false);
    }
  }

  async function handleDump() {
    if (!status?.loggedIn || selectedDbs.size === 0 || running) return;
    clearLogs();
    setDumpError(null);
    setRunning(true);

    try {
      const { jobId } = await startDump({
        proxy,
        databases: Array.from(selectedDbs),
        outputBase,
        stagingPath: isS3(outputBase) ? stagingPath : undefined,
        autoUploadToS3: isS3(outputBase) ? autoUpload : undefined,
      });

      const es = new EventSource(`/api/dump/stream/${jobId}`);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'log') {
            appendLog(msg.message);
          } else if (msg.type === 'done') {
            appendLog(`Done — ${msg.files} files written`);
            setRunning(false);
            es.close();
          } else if (msg.type === 'error') {
            setDumpError(msg.message);
            setRunning(false);
            es.close();
          }
        } catch { /* ignore */ }
      };

      es.onerror = () => {
        setDumpError('Connection to dump stream lost');
        setRunning(false);
        es.close();
      };
    } catch (e: any) {
      setDumpError(e.message || 'Failed to start dump');
      setRunning(false);
    }
  }

  const canDump = status?.loggedIn && selectedDbs.size > 0 && !running;

  return (
    <div className="space-y-3 border-t border-gray-800 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-xs font-medium text-gray-400 uppercase tracking-wider"
      >
        <span>Schema Dump</span>
        <span className="text-gray-600">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="space-y-3">
          {/* Proxy + Check */}
          <div className="space-y-1">
            <label className="block text-xs text-gray-400">Teleport Proxy</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={proxy}
                onChange={(e) => setProxy(e.target.value)}
                placeholder="par-nonprod.teleport.sh"
                className={inputClass}
              />
              <button
                onClick={handleCheckStatus}
                disabled={checkingStatus || !proxy}
                className="shrink-0 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-gray-200 text-xs font-medium py-1.5 px-3 rounded transition-colors"
              >
                {checkingStatus ? '...' : 'Check'}
              </button>
            </div>
          </div>

          {/* Login status */}
          {status && (
            <div className="text-xs">
              {status.loggedIn ? (
                <span className="text-green-400">
                  ● Logged in as {status.user}
                  {status.expires ? ` (${formatExpiry(status.expires)})` : ''}
                </span>
              ) : (
                <div className="space-y-1.5">
                  <span className="text-red-400">○ Not logged in</span>
                  <button
                    onClick={handleLogin}
                    disabled={loggingIn || !proxy}
                    className="w-full bg-indigo-700 hover:bg-indigo-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-xs font-medium py-1.5 px-3 rounded transition-colors"
                  >
                    {loggingIn ? 'Logging in…' : `Login to ${proxy}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* List Databases */}
          <button
            onClick={handleListDatabases}
            disabled={loadingDbs || !status?.loggedIn}
            className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-gray-200 text-xs font-medium py-1.5 px-4 rounded transition-colors"
          >
            {loadingDbs ? 'Loading...' : 'List Databases'}
          </button>

          {/* Database selection */}
          {databases.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {databases.map((db) => (
                <label
                  key={db.name}
                  className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-gray-100 py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={selectedDbs.has(db.name)}
                    onChange={() => toggleDb(db.name)}
                    className="accent-blue-500"
                  />
                  <span className="flex-1 font-mono">{db.name}</span>
                  <span className="text-gray-600 shrink-0">{db.region}</span>
                </label>
              ))}
            </div>
          )}

          {/* Output path */}
          <div className="space-y-1">
            <label className="block text-xs text-gray-400">Output Path</label>
            <input
              type="text"
              value={outputBase}
              onChange={(e) => setOutputBase(e.target.value)}
              placeholder="/SchemaDump or s3://bucket/path"
              className={inputClass}
            />
          </div>

          {/* S3 staging options — shown only when output is s3:// */}
          {isS3(outputBase) && (
            <div className="space-y-2 pl-2 border-l-2 border-gray-700">
              <div className="space-y-1">
                <label className="block text-xs text-gray-400">Local Staging Path</label>
                <input
                  type="text"
                  value={stagingPath}
                  onChange={(e) => setStagingPath(e.target.value)}
                  placeholder="/tmp/SchemaDump"
                  className={inputClass}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoUpload}
                  onChange={(e) => setAutoUpload(e.target.checked)}
                  className="accent-blue-500"
                />
                Auto-upload to S3 after dump
              </label>
            </div>
          )}

          {/* Dump button */}
          <button
            onClick={handleDump}
            disabled={!canDump}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium py-1.5 px-4 rounded transition-colors"
          >
            {running ? 'Dumping...' : `Dump Selected (${selectedDbs.size})`}
          </button>

          {/* Error */}
          {dumpError && (
            <div className="text-xs text-red-400">{dumpError}</div>
          )}

          {/* Progress log */}
          {logs.length > 0 && (
            <div className="bg-gray-800 rounded p-2 max-h-48 overflow-y-auto">
              {logs.map((line, i) => (
                <div key={i} className="font-mono text-xs text-gray-300 leading-5">
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
