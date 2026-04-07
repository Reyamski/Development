import { useAppStore } from '../store/app-store.js';
import type { ProcessEntry } from '../api/types.js';

function LoadingSpinner() {
  return (
    <span className="inline-block w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
  );
}

function KillButtons({
  id,
  info,
}: {
  id: number;
  info: string;
}) {
  const { openKillModal } = useAppStore();
  return (
    <div className="flex gap-1">
      <button
        onClick={() => openKillModal(id, 'query', info)}
        className="text-xs bg-gray-800 hover:bg-yellow-900/40 text-yellow-400 border border-gray-700 hover:border-yellow-700 px-2 py-0.5 rounded transition-colors"
        title="Kill query (leaves connection alive)"
      >
        Kill Query
      </button>
      <button
        onClick={() => openKillModal(id, 'connection', info)}
        className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-0.5 rounded transition-colors font-medium"
        title="Kill entire connection"
      >
        Kill Conn
      </button>
    </div>
  );
}

function ProcessTable({ processes, showKill }: { processes: ProcessEntry[]; showKill: boolean }) {
  if (processes.length === 0) return <p className="text-xs text-gray-500 py-2">None found.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="text-sm w-full">
        <thead className="border-b border-gray-800">
          <tr>
            <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left font-medium">ID</th>
            <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left font-medium">User</th>
            <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left font-medium">Host</th>
            <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left font-medium">Time(s)</th>
            <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left font-medium">State</th>
            <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left font-medium">Query</th>
            {showKill && <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {processes.map((p) => (
            <tr key={p.id} className="hover:bg-gray-800/50">
              <td className="px-4 py-3 text-gray-300 font-mono text-xs">{p.id}</td>
              <td className="px-4 py-3 text-gray-300">{p.user}</td>
              <td className="px-4 py-3 text-gray-400 max-w-32 truncate">{p.host}</td>
              <td className="px-4 py-3 text-yellow-400 font-mono text-xs">{p.time}</td>
              <td className="px-4 py-3 text-gray-400 max-w-28 truncate">{p.state}</td>
              <td className="px-4 py-3 text-gray-300 max-w-xs truncate font-mono text-xs">
                {p.info ?? <span className="text-gray-600 italic">sleep</span>}
              </td>
              {showKill && (
                <td className="px-4 py-3">
                  <KillButtons id={p.id} info={p.info ?? `thread ${p.id}`} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DIAG_CONFIGS: {
  type: 'deadlocks' | 'locks' | 'connections' | 'slowQueries';
  label: string;
  icon: string;
  description: string;
}[] = [
  { type: 'deadlocks', label: 'Deadlock Analysis', icon: '⚡', description: 'Parse InnoDB deadlock info' },
  { type: 'locks', label: 'Lock Chain', icon: '🔗', description: 'Show blocking lock chains' },
  { type: 'connections', label: 'Connection Status', icon: '📡', description: 'Pool utilization + processlist' },
  { type: 'slowQueries', label: 'Slow Queries', icon: '🐌', description: 'Digest from performance_schema' },
];

export function DiagnosticsPanel() {
  const { diagnostics, runDiagnostic, activeIncident } = useAppStore();
  const { deadlocks, locks, connections, slowQueries, loading, errors } = diagnostics;

  const hasAnyResult = deadlocks || locks || connections || slowQueries
    || errors['deadlocks'] || errors['locks'] || errors['connections'] || errors['slowQueries'];

  return (
    <div className="space-y-4">
      {/* 2x2 card grid */}
      <div className="grid grid-cols-2 gap-3">
        {DIAG_CONFIGS.map(({ type, label, icon, description }) => {
          const isLoading = loading[type];
          const hasError = !!errors[type];
          const hasResult = type === 'deadlocks' ? !!deadlocks
            : type === 'locks' ? !!locks
            : type === 'connections' ? !!connections
            : !!slowQueries;

          return (
            <div
              key={type}
              className={`bg-gray-900 border rounded-lg p-4 flex flex-col gap-3 transition-colors ${
                hasError ? 'border-red-800' : hasResult ? 'border-blue-800' : 'border-gray-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none">{icon}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-200">{label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{description}</div>
                  </div>
                </div>
                {hasResult && !isLoading && (
                  <span className="text-xs text-blue-400">✓</span>
                )}
                {hasError && !isLoading && (
                  <span className="text-xs text-red-400">!</span>
                )}
              </div>
              <button
                onClick={() => void runDiagnostic(type)}
                disabled={isLoading || !activeIncident}
                className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-xs font-medium border border-gray-700 rounded-lg px-3 py-2 transition-colors"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <span className="text-blue-400">▶</span>
                    <span>Run</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Results section — expands below the card grid */}
      {hasAnyResult && (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">

          {/* Deadlocks result */}
          {(deadlocks || errors['deadlocks']) && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
                <span>⚡</span>
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Deadlock Analysis</h4>
              </div>
              <div className="p-4">
                {errors['deadlocks'] && (
                  <p className="text-red-400 text-xs flex items-center gap-1.5"><span>⚠</span>{errors['deadlocks']}</p>
                )}
                {deadlocks && (
                  <div className="space-y-3 text-xs">
                    {deadlocks.detectedAt && (
                      <p className="text-gray-500">
                        Detected at: <span className="text-gray-300 font-mono">{deadlocks.detectedAt}</span>
                      </p>
                    )}
                    {deadlocks.victimThreadId == null && deadlocks.blockingThreadId == null && deadlocks.rawSection === '' ? (
                      <p className="text-green-400 flex items-center gap-1.5"><span>✓</span> No recent deadlocks detected in InnoDB status.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-red-950 border border-red-800 rounded-lg p-3">
                            <p className="text-red-400 font-semibold mb-2 flex items-center gap-1.5">
                              <span>🔴</span> Blocking Thread: <span className="font-mono">{deadlocks.blockingThreadId ?? 'N/A'}</span>
                            </p>
                            <p className="text-gray-400 font-mono break-all text-xs leading-relaxed">{deadlocks.blockingQuery || '—'}</p>
                          </div>
                          <div className="bg-orange-950 border border-orange-800 rounded-lg p-3">
                            <p className="text-orange-400 font-semibold mb-2 flex items-center gap-1.5">
                              <span>🟠</span> Victim Thread: <span className="font-mono">{deadlocks.victimThreadId ?? 'N/A'}</span>
                            </p>
                            <p className="text-gray-400 font-mono break-all text-xs leading-relaxed">{deadlocks.victimQuery || '—'}</p>
                          </div>
                        </div>
                        {deadlocks.tablesInvolved.length > 0 && (
                          <p className="text-gray-500">
                            Tables involved:{' '}
                            <span className="text-gray-200 font-mono">{deadlocks.tablesInvolved.join(', ')}</span>
                          </p>
                        )}
                        {deadlocks.blockingThreadId && (
                          <div className="pt-1">
                            <KillButtons id={deadlocks.blockingThreadId} info={deadlocks.blockingQuery || `thread ${deadlocks.blockingThreadId}`} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lock chain result */}
          {(locks || errors['locks']) && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
                <span>🔗</span>
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Lock Chain
                  <span className="ml-2 text-gray-600 normal-case font-normal tracking-normal">
                    ({locks?.length ?? 0} waits)
                  </span>
                </h4>
              </div>
              <div className="p-4">
                {errors['locks'] && (
                  <p className="text-red-400 text-xs flex items-center gap-1.5"><span>⚠</span>{errors['locks']}</p>
                )}
                {locks && locks.length === 0 && (
                  <p className="text-green-400 text-xs flex items-center gap-1.5"><span>✓</span> No lock waits detected.</p>
                )}
                {locks && locks.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="text-sm w-full">
                      <thead className="border-b border-gray-800">
                        <tr>
                          <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Waiting Thread</th>
                          <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Waiting User</th>
                          <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Wait(s)</th>
                          <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Blocking Thread</th>
                          <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Blocking User</th>
                          <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Table</th>
                          <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Lock Type</th>
                          <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {locks.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-800/50">
                            <td className="px-4 py-3 text-yellow-400 font-mono text-xs">{row.waitingThread}</td>
                            <td className="px-4 py-3 text-gray-300">{row.waitingUser}</td>
                            <td className="px-4 py-3 text-yellow-400 font-mono text-xs">{row.waitingTime}</td>
                            <td className="px-4 py-3 text-red-400 font-mono text-xs">{row.blockingThread}</td>
                            <td className="px-4 py-3 text-gray-300">{row.blockingUser}</td>
                            <td className="px-4 py-3 text-gray-400 font-mono text-xs">{row.table}</td>
                            <td className="px-4 py-3 text-gray-400">{row.lockType}</td>
                            <td className="px-4 py-3">
                              <KillButtons id={row.blockingThread} info={row.blockingQuery || `thread ${row.blockingThread}`} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Connections result */}
          {(connections || errors['connections']) && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
                <span>📡</span>
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Connection Status</h4>
              </div>
              <div className="p-4">
                {errors['connections'] && (
                  <p className="text-red-400 text-xs flex items-center gap-1.5"><span>⚠</span>{errors['connections']}</p>
                )}
                {connections && (
                  <div className="space-y-4">
                    {/* Utilization bar */}
                    <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-gray-400 font-medium">Threads Connected</span>
                        <span className={`font-mono font-medium ${
                          connections.utilizationPct >= 90 ? 'text-red-400'
                            : connections.utilizationPct >= 70 ? 'text-yellow-400'
                            : 'text-green-400'
                        }`}>
                          {connections.threadsConnected} / {connections.maxConnections}
                          <span className="text-gray-500 ml-1">({connections.utilizationPct}%)</span>
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            connections.utilizationPct >= 90 ? 'bg-red-500'
                              : connections.utilizationPct >= 70 ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(connections.utilizationPct, 100)}%` }}
                        />
                      </div>
                    </div>

                    {connections.activeProcesses.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                          Active Processes <span className="text-gray-600 normal-case font-normal tracking-normal">({connections.activeProcesses.length})</span>
                        </p>
                        <ProcessTable processes={connections.activeProcesses} showKill />
                      </div>
                    )}

                    {connections.topSleepConnections.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                          Top Sleeping Connections
                        </p>
                        <ProcessTable processes={connections.topSleepConnections} showKill />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Slow queries result */}
          {(slowQueries || errors['slowQueries']) && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
                <span>🐌</span>
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Slow Queries</h4>
              </div>
              <div className="p-4">
                {errors['slowQueries'] && (
                  <p className="text-red-400 text-xs flex items-center gap-1.5"><span>⚠</span>{errors['slowQueries']}</p>
                )}
                {slowQueries && slowQueries.length === 0 && (
                  <p className="text-green-400 text-xs flex items-center gap-1.5"><span>✓</span> No queries with avg time &gt; 1s found.</p>
                )}
                {slowQueries && slowQueries.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="text-sm w-full">
                      <thead className="border-b border-gray-800">
                        <tr>
                          <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Query Sample</th>
                          <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Count</th>
                          <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Avg (ms)</th>
                          <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Max (ms)</th>
                          <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Rows Examined</th>
                          <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Rows Sent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {slowQueries.map((sq, i) => (
                          <tr key={i} className="hover:bg-gray-800/50">
                            <td className="px-4 py-3 text-gray-300 font-mono text-xs max-w-xs truncate" title={sq.querySample}>
                              {sq.querySample}
                            </td>
                            <td className="px-4 py-3 text-gray-300 text-xs">{sq.count}</td>
                            <td className={`px-4 py-3 font-mono text-xs font-medium ${sq.avgTimeMs > 1000 ? 'text-red-400' : 'text-yellow-400'}`}>
                              {sq.avgTimeMs.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-red-400 font-mono text-xs">{sq.maxTimeMs.toLocaleString()}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{sq.rowsExaminedAvg.toLocaleString()}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{sq.rowsSentAvg.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
