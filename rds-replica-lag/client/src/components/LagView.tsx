import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/app-store';
import { useLag } from '../hooks/useLag';
import { LagChart } from './LagChart';
import { TimeRangePicker } from './TimeRangePicker';
import { triggerAwsSsoLogin } from '../api/client';
import type { DbaSlowQuery, ReplicationWorker, SlowApplier } from '../api/types';

function formatLag(seconds: number | null): string {
  if (seconds === null) return 'N/A';
  if (seconds >= 3600) return (seconds / 3600).toFixed(1) + 'h';
  if (seconds >= 60) return (seconds / 60).toFixed(1) + 'm';
  return seconds.toFixed(0) + 's';
}

function formatTimestamp(value: string | null | undefined, utc: boolean): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return utc
    ? date.toLocaleString([], { timeZone: 'UTC' })
    : date.toLocaleString();
}

function formatWorkerElapsed(worker: ReplicationWorker): string | null {
  if (!worker.applyingTransactionStartApplyTimestamp) return null;
  const elapsedMs = Date.now() - new Date(worker.applyingTransactionStartApplyTimestamp).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  const seconds = Math.round(elapsedMs / 1000);
  return seconds > 1 ? formatLag(seconds) : null;
}

function useResizable(initial: number, min: number, max: number) {
  const [height, setHeight] = useState(initial);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    dragging.current = true;
    startY.current = event.clientY;
    startHeight.current = height;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragging.current) return;
      const delta = moveEvent.clientY - startY.current;
      setHeight(Math.max(min, Math.min(max, startHeight.current + delta)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [height, min, max]);

  return { height, onMouseDown };
}

export function LagView() {
  const store = useAppStore();
  const { refresh } = useLag();
  const [awsLoginBusy, setAwsLoginBusy] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const { height: chartHeight, onMouseDown: onResizeStart } = useResizable(220, 120, 620);

  const isInvestigating = store.timeRange.label === 'Custom';
  const showWorkspace = isInvestigating || store.chartPinned;
  const breachCount = store.lagThreshold > 0
    ? store.cloudwatchData.filter((point) => point.lagSeconds > store.lagThreshold).length
    : 0;
  const peakPoint = store.cloudwatchData.reduce<{ lagSeconds: number; timestamp: string } | null>((best, point) => {
    if (!best || point.lagSeconds > best.lagSeconds) return point;
    return best;
  }, null);
  const primaryWorker = store.replicationWorkers.find((worker) => worker.lastErrorNumber > 0)
    || store.replicationWorkers.find((worker) => formatWorkerElapsed(worker))
    || null;
  const topSlow = store.investigationData?.slowAppliers?.[0] ?? null;
  const gtidGap = store.investigationData?.gtidGap ?? null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-2 border-b border-slate-800 bg-slate-900">
        <TimeRangePicker />
      </div>

      {store.replicaStatus && <LiveLagBanner />}

      {store.awsAuthRequired && (
        <AwsAuthBanner
          busy={awsLoginBusy}
          onLogin={async () => {
            const instance = store.instances.find((item) => item.name === store.selectedInstance);
            if (!instance?.accountId || !instance?.region) {
              store.setLagError('Select an instance first before AWS re-login.');
              return;
            }
            setAwsLoginBusy(true);
            try {
              await triggerAwsSsoLogin(instance.accountId, instance.region);
              store.setAwsAuthRequired(false, '');
              store.setLagError('AWS SSO login started in browser. Complete login, then click Refresh.');
            } catch (err: any) {
              store.setLagError(err.message || 'Failed to start AWS SSO login');
            } finally {
              setAwsLoginBusy(false);
            }
          }}
          message={store.awsAuthMessage}
        />
      )}

      {(store.replicaStatus || store.cloudwatchData.length > 0) && (
        <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Current Lag"
              value={formatLag(store.replicaStatus?.secondsBehindSource ?? null)}
              accent={
                store.replicaStatus && !store.replicaStatus.ioThreadRunning
                  ? 'danger'
                  : store.replicaStatus && !store.replicaStatus.sqlThreadRunning
                    ? 'danger'
                    : store.replicaStatus && store.replicaStatus.secondsBehindSource !== null
                        && store.lagThreshold > 0
                        && store.replicaStatus.secondsBehindSource > store.lagThreshold
                      ? 'warning'
                      : 'ok'
              }
              detail={
                store.replicaStatus
                  ? `IO ${store.replicaStatus.ioThreadRunning ? 'running' : 'stopped'} · SQL ${store.replicaStatus.sqlThreadRunning ? 'running' : 'stopped'}`
                  : 'Waiting for replica status'
              }
            />
            <SummaryCard
              title="Peak In Range"
              value={peakPoint ? formatLag(peakPoint.lagSeconds) : 'N/A'}
              accent={peakPoint && store.lagThreshold > 0 && peakPoint.lagSeconds > store.lagThreshold ? 'warning' : 'neutral'}
              detail={peakPoint ? formatTimestamp(peakPoint.timestamp, store.showUtc) : 'No CloudWatch points yet'}
            />
            <SummaryCard
              title="Threshold Breaches"
              value={store.lagThreshold > 0 ? String(breachCount) : 'Off'}
              accent={breachCount > 0 ? 'danger' : 'ok'}
              detail={
                store.lagThreshold > 0
                  ? `${formatLag(store.lagThreshold)} SLA over ${store.cloudwatchData.length || 0} intervals`
                  : 'SLA threshold disabled'
              }
            />
            <SummaryCard
              title="Backlog / Worker"
              value={gtidGap ? `${gtidGap.gapCount.toLocaleString()} txns` : primaryWorker ? 'Worker active' : 'Clear'}
              accent={gtidGap && gtidGap.gapCount > 0 ? 'warning' : primaryWorker ? 'warning' : 'ok'}
              detail={
                gtidGap && gtidGap.gapCount > 0
                  ? `${gtidGap.gapPercent}% pending application`
                  : primaryWorker
                    ? `Worker ${primaryWorker.workerId}${formatWorkerElapsed(primaryWorker) ? ` · ${formatWorkerElapsed(primaryWorker)}` : ''}`
                    : 'No backlog signal detected'
              }
            />
          </div>
        </div>
      )}

      {isInvestigating ? (
        <div className="border-b border-slate-800">
          <button
            onClick={() => setShowChart(!showChart)}
            className="w-full flex items-center gap-1.5 px-4 py-1 text-[10px] text-slate-500 hover:text-slate-400 bg-slate-900/50"
          >
            <span className={`transition-transform ${showChart ? 'rotate-90' : ''}`}>&#9654;</span>
            Replica Lag Timeline
          </button>
          {showChart && (
            <>
              <div className="bg-slate-950">
                <LagChart chartHeight={chartHeight} />
              </div>
              <div
                onMouseDown={onResizeStart}
                className="h-1.5 cursor-row-resize bg-slate-800 hover:bg-slate-700 transition-colors flex items-center justify-center"
              >
                <div className="w-8 h-0.5 rounded bg-slate-600" />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="border-b border-slate-800">
          <div className="bg-slate-950">
            <LagChart chartHeight={chartHeight} />
          </div>
          <div
            onMouseDown={onResizeStart}
            className="h-1.5 cursor-row-resize bg-slate-800 hover:bg-slate-700 transition-colors flex items-center justify-center"
          >
            <div className="w-8 h-0.5 rounded bg-slate-600" />
          </div>
        </div>
      )}

      {!isInvestigating && !store.chartPinned && !store.lagLoading && store.cloudwatchData.length > 0 && (
        <div className="px-6 py-6 text-center">
          <p className="text-slate-300 text-sm font-medium">Drag across a lag spike to open the replica investigation workspace</p>
          <p className="text-slate-500 text-xs mt-1">You can also click a breach point to pin the RCA details in the sidebar.</p>
        </div>
      )}

      {store.lagError && (
        <div className="mx-6 mt-3 rounded bg-red-900/30 border border-red-700 px-3 py-2 text-xs text-red-300">
          {store.lagError}
        </div>
      )}

      {showWorkspace && (
        <>
          <div className="flex flex-wrap items-center gap-4 px-6 py-2 bg-slate-900 border-b border-slate-800">
            <span className="text-xs font-medium text-slate-300">
              {isInvestigating ? 'Replica Investigation Workspace' : 'Pinned Breach Snapshot'}
            </span>

            <button
              onClick={refresh}
              disabled={store.lagLoading}
              className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50 transition-colors"
            >
              {store.lagLoading ? 'Loading...' : 'Refresh'}
            </button>

            {store.chartPinned && (
              <button
                onClick={() => {
                  store.setChartPinned(false);
                  store.setChartHoverContext(null, false);
                }}
                className="px-3 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Clear selection
              </button>
            )}

            <span className="text-[10px] text-slate-600 ml-auto">
              Workers, slow appliers, GTID backlog, and DBA query evidence
              {store.lastRefreshed && <> &middot; {store.lastRefreshed.toLocaleTimeString()}</>}
            </span>
          </div>

          <div className="flex-1 overflow-auto px-6 py-4 bg-slate-950">
            <div className="space-y-4">
              <ActionPlan
                ioRunning={store.replicaStatus?.ioThreadRunning ?? true}
                sqlRunning={store.replicaStatus?.sqlThreadRunning ?? true}
                topSlow={topSlow}
                gtidGap={gtidGap}
                dbaSlowQueries={store.investigationData?.dbaSlowQueries ?? []}
              />

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <InvestigationSummary
                  topSlow={topSlow}
                  gtidGap={gtidGap}
                  primaryWorker={primaryWorker}
                  showUtc={store.showUtc}
                  breachCount={breachCount}
                  threshold={store.lagThreshold}
                />
                <WorkerTable workers={store.replicationWorkers} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <SlowApplierList slowAppliers={store.investigationData?.slowAppliers ?? []} />
                <DbaQueryList
                  queries={store.investigationData?.dbaSlowQueries ?? []}
                  showUtc={store.showUtc}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  detail,
  accent,
}: {
  title: string;
  value: string;
  detail: string;
  accent: 'neutral' | 'ok' | 'warning' | 'danger';
}) {
  const accentClasses = {
    neutral: 'border-slate-800 text-slate-200',
    ok: 'border-emerald-800/70 text-emerald-300',
    warning: 'border-amber-800/70 text-amber-300',
    danger: 'border-red-800/70 text-red-300',
  };

  return (
    <div className={`rounded-xl border bg-slate-900/70 px-4 py-3 ${accentClasses[accent]}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{title}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{detail}</div>
    </div>
  );
}

function InvestigationSection({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 px-4 py-3">
        {eyebrow && <div className="text-[10px] uppercase tracking-wider text-slate-500">{eyebrow}</div>}
        <div className="text-sm font-medium text-slate-200">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ActionPlan({
  ioRunning,
  sqlRunning,
  topSlow,
  gtidGap,
  dbaSlowQueries,
}: {
  ioRunning: boolean;
  sqlRunning: boolean;
  topSlow: SlowApplier | null;
  gtidGap: { gapCount: number; gapPercent: number } | null;
  dbaSlowQueries: DbaSlowQuery[];
}) {
  const actions: Array<{ title: string; detail: string; severity: 'critical' | 'warning' | 'info' }> = [];

  if (!ioRunning) {
    actions.push({
      title: 'Restore IO thread connectivity',
      detail: 'Replica is not receiving new events. Check source reachability, replication user credentials, and network path before anything else.',
      severity: 'critical',
    });
  }
  if (!sqlRunning) {
    actions.push({
      title: 'Fix SQL apply error',
      detail: 'Replication stopped while applying a transaction. Resolve the data/schema mismatch, then restart replication safely.',
      severity: 'critical',
    });
  }
  if (topSlow) {
    actions.push({
      title: 'Investigate the slow applier first',
      detail: `A replication statement took ${topSlow.durationSeconds}s to apply${topSlow.schema ? ` on ${topSlow.schema}` : ''}. This is your best direct lead for replica lag.`,
      severity: 'warning',
    });
  }
  if (gtidGap && gtidGap.gapCount > 0) {
    actions.push({
      title: 'Work down GTID backlog',
      detail: `${gtidGap.gapCount.toLocaleString()} transactions are still pending application (${gtidGap.gapPercent}%). Review write bursts and parallel worker capacity.`,
      severity: 'warning',
    });
  }
  if (dbaSlowQueries.length > 0) {
    actions.push({
      title: 'Cross-check DBA history',
      detail: `DBA history captured ${dbaSlowQueries.length} long-running query patterns. Use them to confirm whether lag matched broader workload pressure on the replica.`,
      severity: 'info',
    });
  }

  if (actions.length === 0) {
    actions.push({
      title: 'Collect the next spike in a custom range',
      detail: 'No clear blocker is visible yet. Drag over a fresh lag spike and re-check workers plus slow statement history immediately after the breach.',
      severity: 'info',
    });
  }

  const severityClasses = {
    critical: 'border-red-800/70 bg-red-950/20 text-red-200',
    warning: 'border-amber-800/70 bg-amber-950/20 text-amber-200',
    info: 'border-slate-700 bg-slate-800/70 text-slate-200',
  };

  return (
    <InvestigationSection title="Recommended Next Moves" eyebrow="Replica Playbook">
      <div className="grid gap-3 lg:grid-cols-3">
        {actions.map((action) => (
          <div key={action.title} className={`rounded-lg border px-3 py-3 ${severityClasses[action.severity]}`}>
            <div className="text-xs font-semibold">{action.title}</div>
            <div className="mt-1 text-[11px] leading-relaxed opacity-90">{action.detail}</div>
          </div>
        ))}
      </div>
    </InvestigationSection>
  );
}

function InvestigationSummary({
  topSlow,
  gtidGap,
  primaryWorker,
  showUtc,
  breachCount,
  threshold,
}: {
  topSlow: SlowApplier | null;
  gtidGap: { gapCount: number; gapPercent: number } | null;
  primaryWorker: ReplicationWorker | null;
  showUtc: boolean;
  breachCount: number;
  threshold: number;
}) {
  return (
    <InvestigationSection title="Replica Evidence Summary" eyebrow="Investigation">
      <div className="grid gap-3 sm:grid-cols-2">
        <MiniFact
          label="Slowest applier"
          value={topSlow ? `${topSlow.durationSeconds}s` : 'None captured'}
          detail={topSlow ? `${topSlow.schema || 'unknown'}${topSlow.table ? `.${topSlow.table}` : ''}` : 'No recent applier history'}
        />
        <MiniFact
          label="GTID gap"
          value={gtidGap ? gtidGap.gapCount.toLocaleString() : '0'}
          detail={gtidGap ? `${gtidGap.gapPercent}% of retrieved transactions` : 'No pending transaction gap'}
        />
        <MiniFact
          label="Active worker"
          value={primaryWorker ? `Worker ${primaryWorker.workerId}` : 'No stall'}
          detail={primaryWorker ? (formatWorkerElapsed(primaryWorker) || primaryWorker.serviceState) : 'No long-running worker found'}
        />
        <MiniFact
          label="Breach intervals"
          value={threshold > 0 ? String(breachCount) : 'Off'}
          detail={threshold > 0 ? `${formatLag(threshold)} SLA threshold` : 'Threshold disabled'}
        />
      </div>

      {topSlow?.sqlText && (
        <div className="mt-4">
          <div className="text-[11px] font-medium text-slate-300 mb-2">Top slow applier SQL</div>
          <SqlPreview text={topSlow.sqlText} />
        </div>
      )}

      {primaryWorker && (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-3 text-[11px] text-slate-300">
          <div className="font-medium text-slate-200">Worker {primaryWorker.workerId}</div>
          <div className="mt-1 text-slate-400">
            Applying: {primaryWorker.applyingTransaction || 'N/A'}
          </div>
          <div className="text-slate-500">
            Started: {formatTimestamp(primaryWorker.applyingTransactionStartApplyTimestamp, showUtc)}
          </div>
        </div>
      )}
    </InvestigationSection>
  );
}

function MiniFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-200">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{detail}</div>
    </div>
  );
}

function WorkerTable({ workers }: { workers: ReplicationWorker[] }) {
  return (
    <InvestigationSection title="Parallel Worker Activity" eyebrow="Replica Workers">
      {workers.length === 0 ? (
        <EmptyState message="No replication worker details returned for this range yet." />
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-800">
                <th className="text-left font-medium py-2 pr-3">Worker</th>
                <th className="text-left font-medium py-2 pr-3">State</th>
                <th className="text-left font-medium py-2 pr-3">Applying</th>
                <th className="text-left font-medium py-2 pr-3">Elapsed</th>
                <th className="text-left font-medium py-2">Last Error</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker.workerId} className="border-b border-slate-900/80 align-top">
                  <td className="py-2 pr-3 text-slate-200 font-medium">{worker.workerId}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${
                      worker.lastErrorNumber > 0
                        ? 'bg-red-950/40 text-red-300'
                        : worker.serviceState === 'ON'
                          ? 'bg-emerald-950/40 text-emerald-300'
                          : 'bg-slate-800 text-slate-300'
                    }`}>
                      {worker.lastErrorNumber > 0 ? 'ERROR' : worker.serviceState}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-400 font-mono text-[11px] break-all">
                    {worker.applyingTransaction || 'Idle'}
                  </td>
                  <td className="py-2 pr-3 text-slate-400">
                    {formatWorkerElapsed(worker) || 'n/a'}
                  </td>
                  <td className="py-2 text-slate-500 break-all">
                    {worker.lastErrorMessage || 'None'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </InvestigationSection>
  );
}

function SlowApplierList({ slowAppliers }: { slowAppliers: SlowApplier[] }) {
  return (
    <InvestigationSection title="Slow Statements Applied On Replica" eyebrow="Replication SQL">
      {slowAppliers.length === 0 ? (
        <EmptyState message="No slow applier statements were captured for the selected context." />
      ) : (
        <div className="space-y-3">
          {slowAppliers.map((item, index) => (
            <div key={`${item.threadId}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    {item.schema || 'unknown'}{item.table ? `.${item.table}` : ''}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Worker {item.workerId ?? 'n/a'} · Thread {item.threadId}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-200">{item.durationSeconds}s</div>
                  <div className="text-[11px] text-slate-500">{item.rowsAffected.toLocaleString()} rows affected</div>
                </div>
              </div>
              {item.sqlText && (
                <div className="mt-3">
                  <SqlPreview text={item.sqlText} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </InvestigationSection>
  );
}

function DbaQueryList({ queries, showUtc }: { queries: DbaSlowQuery[]; showUtc: boolean }) {
  return (
    <InvestigationSection title="DBA Query Snapshot" eyebrow="Historical Digest">
      {queries.length === 0 ? (
        <EmptyState message="No rows returned from the DBA slow-query snapshot for this selection." />
      ) : (
        <div className="space-y-3">
          {queries.map((query, index) => (
            <div key={`${query.schemaName}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-200">{query.schemaName || 'unknown'}</div>
                  <div className="text-[11px] text-slate-500">
                    Snapshot: {formatTimestamp(query.asOfDate, showUtc)}
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <div>max {query.maxDurationSeconds}s</div>
                  <div>avg {query.avgDurationSeconds}s · {query.countStar} execs</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                {query.sumRowsExamined.toLocaleString()} rows examined · {query.sumRowsAffected.toLocaleString()} rows affected
                {query.sumNoIndexUsed > 0 && <span className="text-amber-400"> · {query.sumNoIndexUsed} no-index executions</span>}
              </div>
              {(query.querySampleText || query.digestText) && (
                <div className="mt-3">
                  <SqlPreview text={query.querySampleText || query.digestText} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </InvestigationSection>
  );
}

function SqlPreview({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">SQL sample</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(text).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }).catch(() => {});
          }}
          className="text-[10px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 transition-colors"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-48 overflow-auto px-3 py-3 text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-all font-mono">
        {text}
      </pre>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 px-4 py-6 text-center text-[11px] text-slate-500">
      {message}
    </div>
  );
}

function LiveLagBanner() {
  const replicaStatus = useAppStore((s) => s.replicaStatus);
  const lagThreshold = useAppStore((s) => s.lagThreshold);
  const lagLoading = useAppStore((s) => s.lagLoading);

  if (!replicaStatus) return null;

  const lag = replicaStatus.secondsBehindSource;
  const isBreaching = lag !== null && lagThreshold > 0 && lag > lagThreshold;
  const ioDown = !replicaStatus.ioThreadRunning;
  const sqlDown = !replicaStatus.sqlThreadRunning;
  const isHealthy = lag === 0 && !ioDown && !sqlDown;

  return (
    <div className={`flex items-center gap-4 px-6 py-2 border-b border-slate-800 text-xs ${
      ioDown || sqlDown ? 'bg-red-950/40' :
      isBreaching ? 'bg-amber-950/20' :
      'bg-slate-900'
    }`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${
          ioDown || sqlDown ? 'bg-red-500' :
          isBreaching ? 'bg-amber-500 animate-pulse' :
          isHealthy ? 'bg-emerald-500' : 'bg-slate-400'
        }`} />
        <span className="text-slate-400">Live Lag:</span>
        <span className={`font-bold ${
          lag === null ? 'text-slate-500' :
          isBreaching ? 'text-amber-400' :
          lag === 0 ? 'text-emerald-400' : 'text-slate-300'
        }`}>
          {formatLag(lag)}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-slate-500">
        <span className={ioDown ? 'text-red-400' : 'text-slate-600'}>
          IO: {replicaStatus.ioThreadRunning ? '✓' : '✗ STOPPED'}
        </span>
        <span className={sqlDown ? 'text-red-400' : 'text-slate-600'}>
          SQL: {replicaStatus.sqlThreadRunning ? '✓' : '✗ STOPPED'}
        </span>
      </div>

      {lagLoading && (
        <div className="ml-auto flex items-center gap-1.5 text-slate-500">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-[10px]">Refreshing...</span>
        </div>
      )}
    </div>
  );
}

function AwsAuthBanner({ busy, onLogin, message }: { busy: boolean; onLogin: () => Promise<void>; message: string }) {
  return (
    <div className="px-6 py-2 border-b border-amber-700/50 bg-amber-950/20 flex items-center gap-3">
      <span className="text-xs text-amber-300 font-medium">AWS session expired.</span>
      <button
        onClick={onLogin}
        disabled={busy}
        className="px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors"
      >
        {busy ? 'Starting login...' : 'Re-login AWS SSO'}
      </button>
      <span className="text-[10px] text-amber-200/80 truncate">{message}</span>
    </div>
  );
}
