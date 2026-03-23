import { useTeleport } from '../hooks/useTeleport';
import { useAppStore } from '../store/app-store';

export function TeleportControls() {
  const { selectCluster, login } = useTeleport();
  const {
    tshAvailable, clusters, selectedCluster, loginStatus, instances,
  } = useAppStore();

  if (!tshAvailable) {
    return (
      <div className="rounded-lg bg-red-950/50 border border-red-800 p-3">
        <p className="text-sm text-red-400">tsh binary not found</p>
        <p className="text-xs text-red-500 mt-1">Install Teleport or set TSH_PATH</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Cluster</label>
        <select
          className="w-full bg-gray-800 text-sm rounded px-2 py-1.5 border border-gray-700 focus:border-emerald-500 focus:outline-none"
          value={selectedCluster}
          onChange={e => selectCluster(e.target.value)}
        >
          <option value="">Select cluster...</option>
          {clusters.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {selectedCluster && !loginStatus?.loggedIn && (
        <button
          onClick={login}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded px-3 py-1.5 transition-colors"
        >
          Login to {selectedCluster}
        </button>
      )}

      {loginStatus?.loggedIn && (
        <div className="text-xs text-emerald-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          Logged in as {loginStatus.username}
        </div>
      )}

      {instances.length > 0 && (
        <div className="text-xs text-gray-500">
          {instances.length} instance(s) discovered
        </div>
      )}
    </div>
  );
}
