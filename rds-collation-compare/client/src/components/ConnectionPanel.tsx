import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '../store/app-store';
import {
  teleportClusters, teleportLoginStatus, teleportLogin,
  teleportInstances, teleportDatabases, teleportConnect, teleportDisconnect,
} from '../api/client';

export function ConnectionPanel() {
  const {
    selectedCluster, setSelectedCluster,
    selectedInstance, setSelectedInstance,
    selectedDatabases, setSelectedDatabases,
    connectionResult, setConnectionResult,
  } = useAppStore();

  const [clusters, setClusters] = useState<string[]>([]);
  const [loginStatus, setLoginStatus] = useState<{ loggedIn: boolean; username?: string } | null>(null);
  const [instances, setInstances] = useState<string[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [dbFilter, setDbFilter] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    teleportClusters().then(({ clusters: c }) => setClusters(c)).catch(() => setError('Failed to load clusters'));
  }, []);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const filteredDatabases = useMemo(() => {
    const q = dbFilter.trim().toLowerCase();
    if (!q) return databases;
    return databases.filter((d) => d.toLowerCase().includes(q));
  }, [databases, dbFilter]);

  async function selectCluster(cluster: string) {
    stopPoll();
    setSelectedCluster(cluster);
    setInstances([]);
    setDatabases([]);
    setDbFilter('');
    setSelectedInstance('');
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
    setDbFilter('');
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
      setConnectionResult({
        connected: true,
        instance: selectedInstance,
        databases: [...selectedDatabases],
        dbUser: result.dbUser,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed');
    } finally { setLoading(''); }
  }

  async function handleDisconnect() {
    try { await teleportDisconnect(); } catch { /* ignore */ }
    setConnectionResult(null);
    setSelectedDatabases([]);
  }

  function selectAll() { setSelectedDatabases([...databases]); }
  function selectNone() { setSelectedDatabases([]); }
  function selectFiltered() {
    const union = new Set([...selectedDatabases, ...filteredDatabases]);
    setSelectedDatabases(Array.from(union));
  }

  const connected = !!connectionResult?.connected;

  return (
    <div className="flex flex-col gap-3 text-sm">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>}

      {/* Cluster */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Cluster</label>
        <select
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
          className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {loggingIn ? 'Opening SSO browser…' : 'Login via SSO'}
        </button>
      )}

      {/* Instance */}
      {loginStatus?.loggedIn && (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Instance</label>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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

      {/* Database picker */}
      {selectedInstance && databases.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Databases {selectedDatabases.length > 0 && `(${selectedDatabases.length}/${databases.length})`}
            </label>
            <div className="flex gap-2 text-[10px]">
              <button
                type="button"
                onClick={selectAll}
                className="text-blue-600 hover:text-blue-800 font-semibold uppercase tracking-wide"
              >All</button>
              <button
                type="button"
                onClick={selectNone}
                className="text-slate-500 hover:text-slate-800 font-semibold uppercase tracking-wide"
              >None</button>
            </div>
          </div>

          <input
            type="text"
            placeholder="Filter databases…"
            value={dbFilter}
            onChange={(e) => setDbFilter(e.target.value)}
            className="w-full mb-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {dbFilter && filteredDatabases.length > 0 && (
            <button
              type="button"
              onClick={selectFiltered}
              className="mb-2 text-[10px] text-blue-600 hover:text-blue-800 font-semibold uppercase tracking-wide"
            >
              + Select {filteredDatabases.length} filtered
            </button>
          )}

          <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
            {filteredDatabases.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-2">No match</p>
            ) : filteredDatabases.map((db) => (
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
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-sm text-slate-700 truncate">{db}</span>
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
          className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {loading === 'connect'
            ? 'Connecting…'
            : `Connect (${selectedDatabases.length} db${selectedDatabases.length !== 1 ? 's' : ''})`}
        </button>
      )}

      {connected && connectionResult && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-[11px] font-bold text-emerald-800">Connected · Read-only analysis</p>
          <p className="text-[11px] text-emerald-700 truncate">{connectionResult.instance}</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">
            {selectedDatabases.length} database{selectedDatabases.length !== 1 ? 's' : ''} in scope
          </p>
          <button onClick={handleDisconnect} className="mt-2 text-[11px] text-slate-500 hover:text-red-600 transition-colors">Disconnect</button>
        </div>
      )}
    </div>
  );
}
