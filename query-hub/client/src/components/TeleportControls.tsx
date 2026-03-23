import { useAppStore } from '../store/app-store';
import { useTeleport } from '../hooks/useTeleport';

const selectClasses =
  'w-full bg-white border border-par-light-purple rounded px-2 py-1.5 text-sm text-par-text focus:border-par-purple focus:ring-1 focus:ring-par-purple focus:outline-none';
const labelClasses =
  'block text-xs font-bold text-par-navy uppercase tracking-[0.14em] mb-1.5 border-b border-par-purple/15 pb-1';

export function TeleportControls() {
  const store = useAppStore();
  const { selectCluster, login, selectInstance, refreshClusters } = useTeleport();

  const isLoggedIn = store.loginStatus?.loggedIn ?? false;
  const isConnected = !!store.connectionResult;

  return (
    <div className="space-y-3">
      {!store.tshAvailable && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800 font-medium">
          <strong className="block mb-1">tsh not found on the API server</strong>
          Install Teleport CLI or Teleport Connect on the <em>same machine</em> that runs{' '}
          <code className="bg-red-100 px-1 rounded">npm run dev</code> for Query Hub (not only on your laptop browser).
        </div>
      )}

      {store.clustersLoadError && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800 space-y-2">
          <p className="font-semibold">Could not load cluster list</p>
          <p className="text-red-700">{store.clustersLoadError}</p>
          <button
            type="button"
            onClick={() => void refreshClusters()}
            className="px-3 py-1.5 rounded-lg bg-red-700 text-white text-[11px] font-bold hover:bg-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {store.tshAvailable && !store.clustersLoadError && store.clusters.length === 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 space-y-2">
          <p className="font-bold">No Teleport clusters found</p>
          <p className="text-amber-900/90 leading-relaxed">
            Ang listahan galing sa <code className="bg-amber-100 px-1 rounded">~/.tsh/*.yaml</code> sa{' '}
            <strong>server</strong> na tumatakbo ang Query Hub API. Walang profile = walang dropdown options.
          </p>
          <ol className="list-decimal pl-4 space-y-1 text-amber-900/85">
            <li>
              Sa machine na may API: mag-terminal at{' '}
              <code className="bg-amber-100 px-1 rounded">tsh login &lt;your-proxy&gt;</code> (hal.{' '}
              <code className="bg-amber-100 px-1 rounded">par-prod.teleport.sh</code>).
            </li>
            <li>
              Siguraduhing tumatakbo ang Query Hub API:{' '}
              <code className="bg-amber-100 px-1 rounded">npm run dev</code> sa{' '}
              <code className="bg-amber-100 px-1 rounded">query-hub</code> server (port <strong>3003</strong>).
            </li>
            <li>I-click ang <strong>Refresh clusters</strong> sa baba.</li>
          </ol>
        </div>
      )}

      <div>
        <div className="flex items-end justify-between gap-2 mb-1.5">
          <span className="text-xs font-bold text-par-navy uppercase tracking-[0.14em]">Cluster</span>
          <button
            type="button"
            onClick={() => void refreshClusters()}
            disabled={!store.tshAvailable}
            className="text-[10px] font-bold text-par-purple hover:underline disabled:opacity-40"
          >
            Refresh clusters
          </button>
        </div>
        <select
          className={selectClasses}
          value={store.selectedCluster}
          onChange={(e) => selectCluster(e.target.value)}
          disabled={!store.tshAvailable}
        >
          <option value="">Select a cluster...</option>
          {store.clusters.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {store.selectedCluster && !isLoggedIn && (
        <button
          type="button"
          onClick={() => void login()}
          className="w-full py-2.5 text-sm font-medium rounded bg-par-purple hover:bg-[#5753b8] text-white transition-colors"
        >
          Login via SSO
        </button>
      )}

      {isLoggedIn && (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-white border border-par-light-purple/40">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-par-text/80">
            Logged in as <span className="text-par-text">{store.loginStatus!.username}</span>
          </span>
        </div>
      )}

      {isLoggedIn && store.instances.length > 0 && (
        <div>
          <label className={labelClasses}>MySQL instance</label>
          <select
            className={selectClasses}
            value={store.selectedInstance}
            onChange={(e) => void selectInstance(e.target.value)}
          >
            <option value="">Select an instance...</option>
            {store.instances.map((inst) => (
              <option key={inst.name} value={inst.name}>
                {inst.name} ({inst.region} / {inst.instanceId})
              </option>
            ))}
          </select>
        </div>
      )}

      {store.connecting && (
        <div className="flex items-center gap-2 text-xs text-par-purple">
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Connecting...
        </div>
      )}

      {isConnected && (
        <div className="rounded bg-green-50 border border-green-200 px-3 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-green-700">Connected</span>
          </div>
          <div className="text-xs text-green-700 space-y-1">
            <div>
              Cluster: <span className="text-green-800">{store.selectedCluster}</span>
            </div>
            <div>
              Instance: <span className="text-green-800">{store.selectedInstance}</span>
            </div>
            <div>
              MySQL: <span className="text-green-800">{store.connectionResult!.version}</span>
            </div>
          </div>
        </div>
      )}

      {store.error && !isConnected && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{store.error}</div>
      )}
    </div>
  );
}
