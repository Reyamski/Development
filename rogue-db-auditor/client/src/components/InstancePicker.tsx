import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/app-store';
import {
  getTshStatus,
  getClusters,
  getLoginStatus,
  startLogin,
  getInstances,
} from '../api/client';

export function InstancePicker() {
  const {
    tshAvailable, setTshAvailable,
    clusters, setClusters,
    selectedCluster, setSelectedCluster,
    loginStatus, setLoginStatus,
    instances, setInstances,
    selectedInstance, setSelectedInstance,
    loading, setLoading,
    error, setError,
  } = useAppStore();

  const [loggingIn, setLoggingIn] = useState(false);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const loginPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount: check tsh + load clusters
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { available } = await getTshStatus();
        setTshAvailable(available);
        if (available) {
          const { clusters: cls } = await getClusters();
          setClusters(cls);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // When cluster changes: check login status
  useEffect(() => {
    if (!selectedCluster) return;
    (async () => {
      try {
        const status = await getLoginStatus(selectedCluster);
        setLoginStatus(status);
        if (status.loggedIn) {
          await loadInstances();
        }
      } catch (err: any) {
        setError(err.message);
      }
    })();
  }, [selectedCluster]);

  async function loadInstances() {
    if (!selectedCluster) return;
    setLoadingInstances(true);
    try {
      const { instances: list } = await getInstances(selectedCluster);
      setInstances(list);
    } catch (err: any) {
      setError(`Failed to load instances: ${err.message}`);
    } finally {
      setLoadingInstances(false);
    }
  }

  async function handleLogin() {
    if (!selectedCluster) return;
    setLoggingIn(true);
    setError('');
    try {
      await startLogin(selectedCluster);
      // Poll for login completion
      loginPollRef.current = setInterval(async () => {
        try {
          const status = await getLoginStatus(selectedCluster);
          setLoginStatus(status);
          if (status.loggedIn) {
            clearInterval(loginPollRef.current!);
            loginPollRef.current = null;
            setLoggingIn(false);
            await loadInstances();
          }
        } catch { /* ignore poll errors */ }
      }, 2_000);
    } catch (err: any) {
      setError(err.message);
      setLoggingIn(false);
    }
  }

  useEffect(() => {
    return () => {
      if (loginPollRef.current) clearInterval(loginPollRef.current);
    };
  }, []);

  if (!tshAvailable) {
    return (
      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
        <strong>tsh not found.</strong> Install Teleport or set <code className="font-mono">TSH_PATH</code>.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Cluster selector */}
      <select
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 disabled:opacity-50 min-w-[160px]"
        value={selectedCluster}
        onChange={e => setSelectedCluster(e.target.value)}
        disabled={loading}
      >
        <option value="">Cluster...</option>
        {clusters.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Login button or logged-in indicator */}
      {selectedCluster && (
        loginStatus?.loggedIn ? (
          <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"></span>
            {loginStatus.username}
          </div>
        ) : (
          <button
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-700 rounded-lg px-3 py-2 disabled:opacity-50 whitespace-nowrap transition-colors"
            onClick={handleLogin}
            disabled={loggingIn}
          >
            {loggingIn ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-spin inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full"></span>
                Waiting...
              </span>
            ) : 'Login'}
          </button>
        )
      )}

      {/* Instance selector */}
      {loginStatus?.loggedIn && (
        loadingInstances ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 px-2">
            <span className="animate-spin inline-block w-3 h-3 border-2 border-gray-600 border-t-transparent rounded-full"></span>
            Loading...
          </div>
        ) : (
          <select
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 min-w-[180px]"
            value={selectedInstance}
            onChange={e => setSelectedInstance(e.target.value)}
          >
            <option value="">Select instance...</option>
            {instances.map(i => (
              <option key={i.name} value={i.name}>{i.name}</option>
            ))}
          </select>
        )
      )}

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1">
          {error}
        </div>
      )}
    </div>
  );
}
