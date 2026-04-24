import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/app-store';
import {
  teleportClusters, teleportLoginStatus, teleportLogin,
  teleportInstances, teleportDatabases, teleportConnect, teleportDisconnect,
} from '../api/client';

export function ConnectionPanel() {
  const {
    selectedCluster, setSelectedCluster,
    selectedInstance, setSelectedInstance,
    selectedDatabase, setSelectedDatabase,
    selectedDatabases, setSelectedDatabases,
    connectionResult, setConnectionResult,
  } = useAppStore();

  const [clusters, setClusters] = useState<string[]>([]);
  const [loginStatus, setLoginStatus] = useState<{ loggedIn: boolean; username?: string } | null>(null);
  const [instances, setInstances] = useState<string[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load clusters on mount
  useEffect(() => {
    teleportClusters().then(({ clusters: c }) => setClusters(c)).catch(() => setError('Failed to load clusters'));
  }, []);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  async function selectCluster(cluster: string) {
    stopPoll();
    setSelectedCluster(cluster);
    setInstances([]);
    setDatabases([]);
    setSelectedInstance('');
    setSelectedDatabase('');
    setSelectedDatabases([]);
    setConnectionResult(null);
    if (!cluster) return;
    try {
      const status = await teleportLoginStatus(cluster);
      setLoginStatus(status);
      if (status.loggedIn) loadInstances(cluster);
    } catch { /* ignore */ }
  }

  async function loadInstances(cluster: string) {
    setLoading('instances');
    try {
      const { instances: list } = await teleportInstances(cluster);
      type RawInstance = string | { name?: string; metadata?: { name?: string } };
      setInstances(
        (list as RawInstance[]).map((i) =>
          typeof i === 'string' ? i : i.name ?? i.metadata?.name ?? String(i)
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load instances');
    } finally { setLoading(''); }
  }

  async function handleLogin() {
    if (!selectedCluster) return;
    setLoggingIn(true);
    setError('');
    try {
      await teleportLogin(selectedCluster);
      pollRef.current = setInterval(async () => {
        try {
          const status = await teleportLoginStatus(selectedCluster);
          setLoginStatus(status);
          if (status.loggedIn && pollRef.current) {
            stopPoll();
            setLoggingIn(false);
            loadInstances(selectedCluster);
          }
        } catch { /* ignore */ }
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setLoggingIn(false);
    }
  }

  async function selectInstance(instance: string) {
    setSelectedInstance(instance);
    setDatabases([]);
    setSelectedDatabase('');
    setSelectedDatabases([]);
    setConnectionResult(null);
    if (!instance) return;
    setLoading('databases');
    try {
      const { databases: dbs } = await teleportDatabases(selectedCluster, instance);
      setDatabases(dbs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load databases');
    } finally { setLoading(''); }
  }

  async function handleConnect() {
    if (!selectedCluster || !selectedInstance || selectedDatabases.length === 0) return;
    setLoading('connect');
    setError('');
    try {
      const firstDb = selectedDatabases[0];
      const result = await teleportConnect(selectedCluster, selectedInstance, firstDb);
      setConnectionResult({ connected: true, instance: selectedInstance, database: firstDb, dbUser: result.dbUser });
      setSelectedDatabase(firstDb);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed');
    } finally { setLoading(''); }
  }

  async function handleDisconnect() {
    try { await teleportDisconnect(); } catch { /* ignore */ }
    setConnectionResult(null);
    setSelectedDatabase('');
    setSelectedDatabases([]);
  }

  const connected = !!connectionResult?.connected;

  return (
    <div className="flex flex-col gap-3 text-sm">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>}

      {/* Cluster */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Cluster</label>
        <select
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          value={selectedCluster}
          onChange={(e) => selectCluster(e.target.value)}
          disabled={connected}
        >
          <option value="">— select cluster —</option>
          {clusters.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Login */}
      {selectedCluster && loginStatus && !loginStatus.loggedIn && (
        <button
          onClick={handleLogin}
          disabled={loggingIn}
          className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {loggingIn ? 'Opening SSO browser…' : 'Login via SSO'}
        </button>
      )}

      {/* Instance */}
      {loginStatus?.loggedIn && (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Instance</label>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            value={selectedInstance}
            onChange={(e) => selectInstance(e.target.value)}
            disabled={connected || loading === 'databases'}
          >
            <option value="">— select instance —</option>
            {instances.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          {loading === 'instances' && <p className="text-[11px] text-slate-400 mt-1">Loading instances…</p>}
        </div>
      )}

      {/* Database - Multi-select */}
      {selectedInstance && databases.length > 0 && (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
            Database{selectedDatabases.length > 0 && ` (${selectedDatabases.length} selected)`}
          </label>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
            {databases.map((db) => (
              <label key={db} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDatabases.includes(db)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedDatabases([...selectedDatabases, db]);
                    } else {
                      setSelectedDatabases(selectedDatabases.filter(d => d !== db));
                    }
                  }}
                  disabled={connected}
                  className="w-4 h-4 text-violet-600 rounded focus:ring-2 focus:ring-violet-400"
                />
                <span className="text-sm text-slate-700">{db}</span>
              </label>
            ))}
          </div>
          {loading === 'databases' && <p className="text-[11px] text-slate-400 mt-1">Loading databases…</p>}
        </div>
      )}

      {/* Connect / Disconnect */}
      {selectedDatabases.length > 0 && !connected && (
        <button
          onClick={handleConnect}
          disabled={loading === 'connect'}
          className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {loading === 'connect' ? 'Connecting…' : `Connect to ${selectedDatabases.length} database${selectedDatabases.length !== 1 ? 's' : ''}`}
        </button>
      )}

      {connected && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-[11px] font-bold text-emerald-800">Connected</p>
          <p className="text-[11px] text-emerald-700">{connectionResult!.instance} · {connectionResult!.database}</p>
          <button onClick={handleDisconnect} className="mt-2 text-[11px] text-slate-500 hover:text-red-600 transition-colors">Disconnect</button>
        </div>
      )}
    </div>
  );
}
