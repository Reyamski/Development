import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/app-store';
import {
  fetchTshStatus,
  fetchClusters,
  fetchLoginStatus,
  startLogin,
  fetchInstances,
} from '../api/client';

function StatusDot({ loggedIn }: { loggedIn: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
        loggedIn ? 'bg-green-400' : 'bg-yellow-400'
      }`}
    />
  );
}

export function InstancePicker() {
  const {
    tshAvailable,
    clusters,
    selectedCluster,
    loginStatus,
    instances,
    selectedInstance,
    setTshAvailable,
    setClusters,
    setSelectedCluster,
    setLoginStatus,
    setInstances,
    setSelectedInstance,
    error,
    setError,
  } = useAppStore();

  const loginPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount: check tsh + load clusters
  useEffect(() => {
    fetchTshStatus()
      .then(({ available }) => {
        setTshAvailable(available);
        if (available) {
          return fetchClusters().then(({ clusters }) => setClusters(clusters));
        }
      })
      .catch((err) => setError(err.message));

    return () => {
      if (loginPollRef.current) clearInterval(loginPollRef.current);
    };
  }, []);

  // When cluster changes, check login status
  useEffect(() => {
    if (!selectedCluster) return;
    fetchLoginStatus(selectedCluster)
      .then((status) => {
        setLoginStatus(status);
        if (status.loggedIn) {
          return fetchInstances(selectedCluster).then(({ instances }) => setInstances(instances));
        }
      })
      .catch((err) => setError(err.message));
  }, [selectedCluster]);

  function handleLogin() {
    if (!selectedCluster) return;
    startLogin(selectedCluster).catch((err) => setError(err.message));

    // Poll for login completion
    loginPollRef.current = setInterval(() => {
      fetchLoginStatus(selectedCluster)
        .then((status) => {
          if (status.loggedIn) {
            if (loginPollRef.current) clearInterval(loginPollRef.current);
            setLoginStatus(status);
            fetchInstances(selectedCluster)
              .then(({ instances }) => setInstances(instances))
              .catch((err) => setError(err.message));
          }
        })
        .catch(() => {});
    }, 2000);
  }

  if (!tshAvailable) {
    return (
      <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-lg p-3">
        <p className="text-xs text-yellow-400 font-medium">tsh not found</p>
        <p className="text-xs text-yellow-500/80 mt-0.5">
          Install Teleport CLI or set <code className="font-mono">TSH_PATH</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cluster selector */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
          Cluster
        </label>
        <select
          value={selectedCluster}
          onChange={(e) => setSelectedCluster(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
        >
          <option value="">— select cluster —</option>
          {clusters.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Login status row */}
      {selectedCluster && loginStatus && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusDot loggedIn={loginStatus.loggedIn} />
            {loginStatus.loggedIn ? (
              <span className="text-xs text-green-400">
                Signed in as <span className="font-medium">{loginStatus.username}</span>
              </span>
            ) : (
              <span className="text-xs text-yellow-400">
                Not logged in to {selectedCluster}
              </span>
            )}
          </div>

          {!loginStatus.loggedIn && (
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              Login via SSO
            </button>
          )}
        </div>
      )}

      {/* Instance selector */}
      {instances.length > 0 && (
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
            Instance
          </label>
          <select
            value={selectedInstance}
            onChange={(e) => setSelectedInstance(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
          >
            <option value="">— select instance —</option>
            {instances.map((inst) => (
              <option key={inst.name} value={inst.name}>{inst.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-2.5">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
