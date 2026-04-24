import { useAppStore } from '../store/app-store';
import { useTeleport } from '../hooks/useTeleport';

const selectClasses =
  'w-full bg-white border border-par-light-purple/90 rounded-xl px-3 py-2 text-sm text-par-text shadow-qh-inset focus:outline-none focus:ring-2 focus:ring-par-purple/30 focus:border-par-purple transition-shadow disabled:opacity-45 disabled:cursor-not-allowed';
const labelText = 'text-[10px] font-bold text-par-navy/70 uppercase tracking-[0.16em]';
const labelClasses = `block ${labelText} mb-2`;

const alertBase = 'rounded-2xl px-3.5 py-3 text-xs leading-relaxed';

export function TeleportControls() {
  const store = useAppStore();
  const { selectCluster, login, selectInstance, refreshClusters } = useTeleport();

  const isLoggedIn = store.loginStatus?.loggedIn ?? false;
  const isConnected = !!store.connectionResult;

  return (
    <div className="space-y-4">
      {!store.tshAvailable && (
        <div className={`${alertBase} border border-red-200/90 bg-red-50/95 text-red-900 shadow-qh-sm`}>
          <strong className="block mb-1.5 text-red-950 font-bold">tsh not found on the API server</strong>
          <p className="text-red-800/95">
            Install Teleport CLI or Teleport Connect on the <em>same machine</em> that runs Query Hub API (not only in
            this browser).
          </p>
          <p className="text-red-800/90 mt-2">
            Optional: set <code className="rounded-md bg-red-100/90 px-1.5 py-0.5 text-[11px]">QUERY_HUB_TSH_PATH</code>{' '}
            in the API <code className="rounded-md bg-red-100/90 px-1.5 py-0.5 text-[11px]">.env</code> to the full path
            of <code className="rounded-md bg-red-100/90 px-1.5 py-0.5 text-[11px]">tsh</code> if it is not on{' '}
            <code className="rounded-md bg-red-100/90 px-1.5 py-0.5 text-[11px]">PATH</code>.
          </p>
        </div>
      )}

      {store.clustersLoadError && (
        <div className={`${alertBase} border border-red-200/90 bg-red-50/95 text-red-900 space-y-2 shadow-qh-sm`}>
          <p className="font-bold text-red-950">Could not load cluster list</p>
          <p className="text-red-800">{store.clustersLoadError}</p>
          <button
            type="button"
            onClick={() => void refreshClusters()}
            className="mt-1 px-3 py-2 rounded-xl bg-red-700 text-white text-[11px] font-bold hover:bg-red-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      {store.tshAvailable && !store.clustersLoadError && store.clusters.length === 0 && (
        <div className={`${alertBase} border border-amber-200/90 bg-amber-50/95 text-amber-950 shadow-qh-sm space-y-2`}>
          <p className="font-bold">No Teleport clusters found</p>
          <p className="text-amber-900/90">
            Profiles come from <code className="rounded-md bg-amber-100/90 px-1.5 py-0.5">~/.tsh</code> on the API host.
          </p>
          <ol className="list-decimal pl-4 space-y-1.5 text-amber-900/85">
            <li>
              On that machine: <code className="rounded bg-amber-100/80 px-1">tsh login &lt;proxy&gt;</code>
            </li>
            <li>Ensure the Query Hub API is running, then tap Refresh clusters below.</li>
          </ol>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className={labelText}>Cluster</span>
          <button
            type="button"
            onClick={() => void refreshClusters()}
            disabled={!store.tshAvailable}
            className="text-[10px] font-bold text-par-purple hover:text-[#524fc4] disabled:opacity-40 transition-colors focus:outline-none focus-visible:underline"
          >
            Refresh
          </button>
        </div>
        <select
          className={selectClasses}
          value={store.selectedCluster}
          onChange={(e) => selectCluster(e.target.value)}
          disabled={!store.tshAvailable}
        >
          <option value="">Select a cluster…</option>
          {store.clusters.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {store.selectedCluster && !isLoggedIn && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void login()}
            className="w-full py-2.5 text-sm font-bold rounded-xl bg-par-purple text-white shadow-qh-sm hover:bg-[#5a56c4] active:scale-[0.99] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-par-purple focus-visible:ring-offset-2"
          >
            Login via SSO
          </button>
          <p className="text-[10px] text-par-text/45 leading-relaxed">
            SSO may open on the <strong>API host</strong>, not this browser, if the server is remote. Check the API
            terminal after clicking.
          </p>
        </div>
      )}

      {isLoggedIn && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white border border-par-light-purple/50 shadow-qh-sm">
          <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500 ring-2 ring-emerald-200/80" />
          <span className="text-xs text-par-text/85">
            Signed in as <span className="font-semibold text-par-navy">{store.loginStatus!.username}</span>
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
            <option value="">Select an instance…</option>
            {store.instances.map((inst) => (
              <option key={inst.name} value={inst.name}>
                {inst.name} ({inst.region} / {inst.instanceId})
              </option>
            ))}
          </select>
        </div>
      )}

      {store.connecting && (
        <div className="flex items-center gap-2.5 text-xs font-semibold text-par-purple">
          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Connecting…
        </div>
      )}

      {isConnected && (
        <div className="rounded-2xl border border-emerald-200/90 bg-gradient-to-b from-emerald-50/90 to-white px-3.5 py-3 shadow-qh-sm space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
            <span className="text-xs font-bold text-emerald-900">Connected</span>
          </div>
          <dl className="text-[11px] text-emerald-900/90 space-y-1 pl-4 border-l-2 border-emerald-200/80">
            <div>
              <dt className="inline text-emerald-800/70 font-semibold">Cluster</dt>{' '}
              <dd className="inline font-mono text-emerald-950">{store.selectedCluster}</dd>
            </div>
            <div>
              <dt className="inline text-emerald-800/70 font-semibold">Instance</dt>{' '}
              <dd className="inline font-mono text-emerald-950">{store.selectedInstance}</dd>
            </div>
            <div>
              <dt className="inline text-emerald-800/70 font-semibold">MySQL</dt>{' '}
              <dd className="inline font-mono text-emerald-950">{store.connectionResult!.version}</dd>
            </div>
          </dl>
        </div>
      )}

      {store.error && !isConnected && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 font-medium shadow-qh-sm">
          {store.error}
        </div>
      )}
    </div>
  );
}
