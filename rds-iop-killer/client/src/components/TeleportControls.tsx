import { useState } from 'react';
import { useAppStore } from '../store/app-store';
import { useTeleport } from '../hooks/useTeleport';
import { awsSsoLogin } from '../api/client';

const selectClasses = 'w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none';
const labelClasses = 'block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1';

export function TeleportControls() {
  const store = useAppStore();
  const { selectCluster, login, selectInstance } = useTeleport();
  const [awsLoginBusy, setAwsLoginBusy] = useState(false);
  const [manualCluster, setManualCluster] = useState('');

  const isLoggedIn = store.loginStatus?.loggedIn ?? false;
  const isConnected = !!store.connectionResult;
  const noSavedProfiles = store.tshAvailable && store.clusters.length === 0;

  return (
    <div className="space-y-3">
      {/* tsh status */}
      {!store.tshAvailable && (
        <div className="rounded bg-red-900/30 border border-red-700 px-3 py-2 text-xs text-red-300">
          tsh binary not found. Install Teleport or Teleport Connect.
        </div>
      )}

      {noSavedProfiles && (
        <div className="rounded bg-gray-800/80 border border-gray-600 px-3 py-2 text-[11px] text-gray-400 leading-relaxed">
          <p className="mb-2">
            Walang naka-save na Teleport cluster dito (<span className="text-gray-300 font-mono">~/.tsh/*.yaml</span>).
            Pwede mag-<span className="text-gray-300">tsh login par-prod.teleport.sh</span> sa terminal muna, o ilagay ang hostname sa baba.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. par-prod.teleport.sh"
              value={manualCluster}
              onChange={(e) => setManualCluster(e.target.value)}
              className="flex-1 min-w-0 bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-600 focus:border-red-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const h = manualCluster.trim();
                if (!h) return;
                void selectCluster(h);
              }}
              className="shrink-0 px-3 py-1.5 text-xs font-medium rounded bg-gray-700 hover:bg-gray-600 text-gray-100 border border-gray-600"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Cluster selector */}
      <div>
        <label className={labelClasses}>Cluster</label>
        <select
          className={selectClasses}
          value={store.selectedCluster}
          onChange={(e) => selectCluster(e.target.value)}
          disabled={!store.tshAvailable}
        >
          <option value="">{store.clusters.length ? 'Select a cluster...' : 'No saved profiles — use box above or login in terminal'}</option>
          {store.clusters.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Login */}
      {store.selectedCluster && !isLoggedIn && (
        <div className="flex items-center gap-3">
          <button
            onClick={login}
            className="w-full py-2.5 text-sm font-medium rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
          >
            Login via SSO
          </button>
        </div>
      )}

      {/* Login status */}
      {isLoggedIn && (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-gray-800 border border-gray-700">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-gray-300">
            Logged in as <span className="text-gray-100">{store.loginStatus!.username}</span>
          </span>
        </div>
      )}

      {/* Instance selector */}
      {isLoggedIn && store.instances.length > 0 && (
        <div>
          <label className={labelClasses}>RDS Instance</label>
          <select
            className={selectClasses}
            value={store.selectedInstance}
            onChange={(e) => selectInstance(e.target.value)}
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

      {/* Connecting indicator */}
      {store.connecting && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Connecting...
        </div>
      )}

      {/* Connected indicator */}
      {isConnected && (
        <div className="rounded bg-gray-800 border border-gray-700 px-3 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-green-400">Connected</span>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <div>Cluster: <span className="text-gray-200">{store.selectedCluster}</span></div>
            <div>Instance: <span className="text-gray-200">{store.selectedInstance}</span></div>
            <div>Version: <span className="text-gray-200">{store.connectionResult!.version}</span></div>
          </div>
        </div>
      )}


      {/* AWS SSO */}
      {isConnected && store.awsAuthRequired && (
        <div className="rounded bg-amber-900/30 border border-amber-700 px-3 py-3 space-y-2">
          <div className="text-xs text-amber-300">
            AWS SSO session required for CloudWatch data and RDS config.
          </div>
          {store.awsAuthMessage && (
            <div className="text-[11px] text-amber-200/80 break-words">
              {store.awsAuthMessage}
            </div>
          )}
          <button
            onClick={async () => {
              const instance = store.instances.find((item) => item.name === store.selectedInstance);
              if (!instance?.accountId || !instance?.region) {
                store.setIopsError('Select an instance first before AWS re-login.');
                return;
              }

              setAwsLoginBusy(true);
              try {
                await awsSsoLogin(instance.accountId, instance.region);
                store.setAwsAuthRequired(false, '');
                store.setIopsError('AWS SSO login started in browser. Complete login, then click Refresh.');
              } catch (err: any) {
                store.setIopsError(err.message || 'Failed to start AWS SSO login');
              } finally {
                setAwsLoginBusy(false);
              }
            }}
            disabled={awsLoginBusy}
            className="w-full py-2 text-sm font-medium rounded bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
          >
            {awsLoginBusy ? 'Starting AWS SSO...' : 'Re-login AWS SSO'}
          </button>
        </div>
      )}

      {/* Error */}
      {store.error && (
        <div className="rounded bg-red-900/30 border border-red-700 px-3 py-2 text-xs text-red-300">
          {store.error}
        </div>
      )}
    </div>
  );
}
