import { useAppStore } from '../store/app-store';
import type { ReplicaStatus, ReplicationWorker, InvestigationData, CloudWatchLagPoint, TimeRange } from '../api/types';

function formatLag(seconds: number | null): string {
  if (seconds === null) return 'unknown';
  if (seconds >= 3600) return (seconds / 3600).toFixed(1) + 'h';
  if (seconds >= 60) return (seconds / 60).toFixed(1) + 'm';
  return seconds.toFixed(0) + 's';
}

function SeverityBadge({ severity }: { severity: 'critical' | 'warning' | 'ok' }) {
  const classes = {
    critical: 'bg-red-600 text-white',
    warning: 'bg-amber-600 text-white',
    ok: 'bg-green-700 text-white',
  };
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${classes[severity]}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function generateNarrative(
  replicaStatus: ReplicaStatus,
  investigationData: InvestigationData | null,
  replicationWorkers: ReplicationWorker[],
  lagThreshold: number,
  cloudwatchData: CloudWatchLagPoint[],
  timeRange: TimeRange,
): string[] {
  const dbaQueries = investigationData?.dbaSlowQueries ?? [];
  const lines: string[] = [];
  const lag = replicaStatus.secondsBehindSource;

  // 1. Thread health (highest priority)
  if (!replicaStatus.ioThreadRunning && !replicaStatus.sqlThreadRunning) {
    lines.push('Both IO and SQL threads are stopped — replication is fully halted.');
    return lines;
  }
  if (!replicaStatus.ioThreadRunning) {
    lines.push('IO thread is stopped — no new binlog events are being received from source.');
    return lines;
  }
  if (!replicaStatus.sqlThreadRunning) {
    lines.push('SQL thread is stopped — events are queued in the relay log but not being applied.');
    return lines;
  }

  // 2. Currently stalled worker
  const stalledWorker = replicationWorkers.find(w => {
    if (!w.applyingTransactionStartApplyTimestamp) return false;
    const elapsed = (Date.now() - new Date(w.applyingTransactionStartApplyTimestamp).getTime()) / 1000;
    return elapsed > 10;
  });
  if (stalledWorker?.applyingTransactionStartApplyTimestamp) {
    const elapsed = Math.round(
      (Date.now() - new Date(stalledWorker.applyingTransactionStartApplyTimestamp).getTime()) / 1000,
    );
    lines.push(
      `Worker ${stalledWorker.workerId} has been applying the same transaction for ${formatLag(elapsed)}` +
      (stalledWorker.applyingTransaction ? ` (${stalledWorker.applyingTransaction.split(':').pop()})` : '') + '.',
    );
  }

  // 3. Slow applier from history
  const top = investigationData?.slowAppliers[0];
  if (top) {
    const loc = [top.schema, top.table].filter(Boolean).join('.');
    lines.push(
      `Slowest recently-applied statement${loc ? ` on \`${loc}\`` : ''} took ${top.durationSeconds}s` +
      (top.rowsAffected > 0 ? `, affecting ${top.rowsAffected.toLocaleString()} rows` : '') + '.',
    );
  }

  // 4. GTID gap
  if (investigationData?.gtidGap && investigationData.gtidGap.gapCount > 0) {
    const { gapCount, gapPercent } = investigationData.gtidGap;
    lines.push(
      `${gapCount.toLocaleString()} transaction${gapCount === 1 ? '' : 's'} (${gapPercent}% of received) are pending application.`,
    );
  }

  // 5. Catch-up ETA hint (only if there's a real issue)
  if (lag !== null && lag > 0 && lines.length > 0) {
    lines.push(`Estimated catch-up: ~${formatLag(lag)} assuming no new writes to source.`);
  }

  // 6. Lag with no specific cause detected (live lag)
  if (lag !== null && lag > lagThreshold && lagThreshold > 0 && lines.length === 0) {
    lines.push(
      `Replica is ${formatLag(lag)} behind with no single slow statement detected. ` +
      'Likely causes: sustained high write load on source or insufficient parallel workers (slave_parallel_workers).',
    );
  }

  // 7. Breaches in selected time range (CloudWatch)
  // cloudwatchData is fetched for the current timeRange (preset or custom)
  let addedBreachMessage = false;
  if (lagThreshold > 0 && cloudwatchData.length > 0) {
    const breachPoints = cloudwatchData.filter(p => p.lagSeconds > lagThreshold);
    const breachCount = breachPoints.length;
    const peak = Math.max(...cloudwatchData.map(p => p.lagSeconds));
    const avgDuringBreach = breachCount > 0
      ? breachPoints.reduce((s, p) => s + p.lagSeconds, 0) / breachCount
      : 0;
    if (breachCount > 0 && lines.length === 0) {
      lines.push(
        `During this range, lag exceeded SLA threshold (${formatLag(lagThreshold)}) ${breachCount} time${breachCount === 1 ? '' : 's'} — peak ${formatLag(peak)}, avg during breach ${formatLag(Math.round(avgDuringBreach * 10) / 10)}. ` +
        (lag === 0 ? 'Current lag is now 0s.' : lag !== null ? `Current lag: ${formatLag(lag)}.` : ''),
      );
      addedBreachMessage = true;
    }
  }

  // 8. When we have breaches but no specific cause — add possible causes and next steps
  if (addedBreachMessage) {
    const hasSlowAppliers = !!(investigationData?.slowAppliers?.length);
    const hasDbaQueries = dbaQueries.length > 0;
    if (!hasSlowAppliers && !hasDbaQueries) {
      lines.push('No slow query captured in recent history — performance_schema buffer may have evicted older statements. Check DBA schema section below (if available) or drag to zoom and investigate quickly after a spike.');
    } else if (hasDbaQueries) {
      const top = dbaQueries[0];
      lines.push(`dba schema shows ${dbaQueries.length} slow queries — top: ${top.schemaName} max ${top.maxDurationSeconds}s (${top.countStar} execs). See DBA Schema section below.`);
    }
    lines.push('');
    lines.push('Possible causes:');
    lines.push('• Slow query on replica — a statement took too long to apply (check Slow Statements below if in investigation mode)');
    lines.push('• High write load on source — many transactions queued faster than replica can apply');
    lines.push('• Insufficient slave_parallel_workers — replica cannot keep up with parallel writes');
    lines.push('• Network or I/O bottleneck — relay log read/write delays');
    lines.push('');
    lines.push('What to check:');
    lines.push('• Drag the chart to zoom into a spike → enables worker-level analysis and recent slow queries');
    lines.push('• Review source write patterns — batch size, transaction volume');
    lines.push('• Check slave_parallel_workers (default often 4–8; increase if replica has CPU headroom)');
    lines.push('• Enable performance_schema for replication (if not already) to capture slow applier history');
  }

  // 9. Healthy (only when no breaches and no other issues)
  if (lines.length === 0) {
    if (lag === 0) lines.push('Replication is healthy — no lag detected.');
    else if (lag !== null) lines.push(`Replication is operating normally — ${formatLag(lag)} behind source.`);
    else lines.push('Seconds_Behind_Source is NULL — replica may not be connected to a source.');
  }

  return lines;
}

export function RootCauseAnalysis() {
  const replicaStatus = useAppStore((s) => s.replicaStatus);
  const replicationWorkers = useAppStore((s) => s.replicationWorkers);
  const investigationData = useAppStore((s) => s.investigationData);
  const lagThreshold = useAppStore((s) => s.lagThreshold);
  const cloudwatchData = useAppStore((s) => s.cloudwatchData);
  const timeRange = useAppStore((s) => s.timeRange);
  const chartHoverIsBreach = useAppStore((s) => s.chartHoverIsBreach);
  const chartPinned = useAppStore((s) => s.chartPinned);
  const setChartPinned = useAppStore((s) => s.setChartPinned);
  const setChartHoverContext = useAppStore((s) => s.setChartHoverContext);
  const isInvestigating = timeRange.label === 'Custom';
  const showDiagnosticPanels = chartHoverIsBreach || chartPinned;

  if (!replicaStatus) return null;

  const lag = replicaStatus.secondsBehindSource;
  const isLagging = lag !== null && lagThreshold > 0 && lag > lagThreshold;
  const ioDown = !replicaStatus.ioThreadRunning;
  const sqlDown = !replicaStatus.sqlThreadRunning;
  const hasErrors = !!(replicaStatus.lastSqlError || replicaStatus.lastIoError);
  const hasIssues = isLagging || ioDown || sqlDown || hasErrors;

  // Always compute narrative so we show breach info for any range (preset or custom)
  const narrativeLines = generateNarrative(replicaStatus, investigationData, replicationWorkers, lagThreshold, cloudwatchData, timeRange);

  return (
    <div className="rounded bg-slate-800 border border-slate-700 px-3 py-3 space-y-3">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Replication Status</div>

      {/* Live lag indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Current Lag</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${
              lag === null ? 'text-slate-500' :
              isLagging ? 'text-amber-400' :
              lag > 0 ? 'text-slate-300' : 'text-emerald-400'
            }`}>
              {formatLag(lag)}
            </span>
            <SeverityBadge severity={
              lag === null || ioDown || sqlDown ? 'critical' :
              isLagging ? 'critical' :
              lag > 0 ? 'warning' : 'ok'
            } />
          </div>
        </div>

        {/* Thread status */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className={`rounded px-2 py-1.5 text-center text-[10px] font-medium ${
            replicaStatus.ioThreadRunning
              ? 'bg-green-900/30 border border-green-800 text-green-400'
              : 'bg-red-900/30 border border-red-800 text-red-400'
          }`}>
            IO: {replicaStatus.ioThreadRunning ? 'Running' : 'STOPPED'}
          </div>
          <div className={`rounded px-2 py-1.5 text-center text-[10px] font-medium ${
            replicaStatus.sqlThreadRunning
              ? 'bg-green-900/30 border border-green-800 text-green-400'
              : 'bg-red-900/30 border border-red-800 text-red-400'
          }`}>
            SQL: {replicaStatus.sqlThreadRunning ? 'Running' : 'STOPPED'}
          </div>
        </div>
      </div>

      {/* Issues */}
      {hasIssues && (
        <div className="space-y-1.5 border-t border-slate-700 pt-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Issues Detected</div>

          {ioDown && (
            <div className="rounded border border-red-800 bg-red-950/30 px-2.5 py-2.5 text-[11px] text-red-300 space-y-2">
              <p className="font-medium">IO thread stopped — replication is not receiving binlog events from source.</p>
              <div className="space-y-1">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Why</div>
                <p className="text-[10px] text-red-200/90">The replica cannot connect to or read from the source. Network issues, source down, or credentials can cause this.</p>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Next steps</div>
                <ul className="text-[10px] text-red-200/90 list-disc list-inside space-y-0.5">
                  <li>Check if the source database is up and reachable</li>
                  <li>Verify network connectivity and security groups</li>
                  <li>Review the error below and contact DBA if needed</li>
                </ul>
              </div>
              {replicaStatus.lastIoError && (
                <p className="mt-1 text-red-400/80 text-[10px] font-mono break-all">{replicaStatus.lastIoError}</p>
              )}
            </div>
          )}

          {sqlDown && (
            <div className="rounded border border-red-800 bg-red-950/30 px-2.5 py-2.5 text-[11px] text-red-300 space-y-2">
              <p className="font-medium">SQL thread stopped — replication is not applying events.</p>
              <div className="space-y-1">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Why</div>
                <p className="text-[10px] text-red-200/90">A statement failed to apply on the replica (e.g. duplicate key, missing table). Replication pauses until the error is fixed.</p>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Next steps</div>
                <ul className="text-[10px] text-red-200/90 list-disc list-inside space-y-0.5">
                  <li>Review the error below — it usually points to the failing statement</li>
                  <li>Fix schema or data mismatch between source and replica</li>
                  <li>Use <code className="bg-slate-900 px-0.5 rounded">STOP REPLICA</code>; fix; then <code className="bg-slate-900 px-0.5 rounded">START REPLICA</code></li>
                </ul>
              </div>
              {replicaStatus.lastSqlError && (
                <p className="mt-1 text-red-400/80 text-[10px] font-mono break-all">{replicaStatus.lastSqlError}</p>
              )}
            </div>
          )}

          {isLagging && !ioDown && !sqlDown && (
            <div className="rounded border border-slate-600 bg-slate-800/80 px-2.5 py-2.5 text-[11px] text-slate-300 space-y-2">
              <p className="font-medium">Replica is {formatLag(lag)} behind — exceeds SLA threshold of {formatLag(lagThreshold)}.</p>

              <div className="space-y-1">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Why</div>
                <p className="text-[10px] text-slate-200/90">
                  Lag happens when the replica cannot apply changes from the source fast enough. Common causes: a slow query on the replica, high write load on the source, or too few parallel workers.
                </p>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Next steps</div>
                <ul className="text-[10px] text-slate-200/90 list-disc list-inside space-y-0.5">
                  <li>Check the slow query below (if shown) — optimize it or add indexes</li>
                  <li>Review source write load — consider batching or off-peak writes</li>
                  <li>Check <code className="bg-slate-900 px-0.5 rounded">slave_parallel_workers</code> — more workers can help catch up</li>
                  <li>Drag the chart to zoom into a spike for detailed root cause analysis</li>
                </ul>
              </div>

              {investigationData?.slowAppliers?.[0] && (
                <div className="space-y-1 border-t border-slate-600 pt-2 mt-2">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Likely cause — slow query</div>
                  <div className="rounded bg-slate-900/80 border border-slate-600 px-2 py-1.5 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-slate-200 font-medium">
                        {investigationData.slowAppliers[0].schema || 'unknown'}
                        {investigationData.slowAppliers[0].table ? `.${investigationData.slowAppliers[0].table}` : ''}
                      </span>
                      <span className="text-slate-300 font-bold shrink-0">
                        {investigationData.slowAppliers[0].durationSeconds}s
                        {investigationData.slowAppliers[0].rowsAffected > 0 && (
                          <span className="text-slate-500 font-normal ml-1">
                            ({investigationData.slowAppliers[0].rowsAffected.toLocaleString()} rows)
                          </span>
                        )}
                      </span>
                    </div>
                    {investigationData.slowAppliers[0].sqlText && (
                      <pre className="text-[9px] font-mono text-slate-300 break-all whitespace-pre-wrap overflow-x-auto max-h-24 overflow-y-auto">
                        {investigationData.slowAppliers[0].sqlText}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Replication source info */}
      {replicaStatus.sourceHost && (
        <div className="text-[10px] text-slate-600 space-y-0.5 border-t border-slate-700 pt-2">
          <div>Source: <span className="text-slate-500">{replicaStatus.sourceHost}</span></div>
          {replicaStatus.channelName && (
            <div>Channel: <span className="text-slate-500">{replicaStatus.channelName}</span></div>
          )}
        </div>
      )}

      {/* ===== Investigation Mode Panels ===== */}
      {isInvestigating && (
        <>
          {/* Parallel workers */}
          {replicationWorkers.length > 0 && (
            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                Parallel Workers ({replicationWorkers.length})
              </div>
              {replicationWorkers.map(w => (
                <div key={w.workerId} className={`rounded border px-2.5 py-2 text-[10px] space-y-0.5 ${
                  w.lastErrorNumber > 0
                    ? 'border-red-800 bg-red-950/30'
                    : w.serviceState === 'ON'
                      ? 'border-slate-700 bg-slate-800/50'
                      : 'border-slate-700 bg-slate-800/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Worker {w.workerId}</span>
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                      w.lastErrorNumber > 0 ? 'bg-red-600 text-white' :
                      w.serviceState === 'ON' ? 'bg-emerald-700 text-white' : 'bg-slate-600 text-slate-200'
                    }`}>
                      {w.lastErrorNumber > 0 ? 'ERROR' : w.serviceState}
                    </span>
                  </div>
                  {w.applyingTransaction && (
                    <div className="text-slate-500">
                      Applying: <span className="text-slate-400 font-mono text-[9px]">{w.applyingTransaction}</span>
                    </div>
                  )}
                  {w.applyingTransactionStartApplyTimestamp && (() => {
                    const elapsed = Math.round(
                      (Date.now() - new Date(w.applyingTransactionStartApplyTimestamp).getTime()) / 1000,
                    );
                    return elapsed > 2 ? (
                      <div className={`text-[9px] font-medium ${
                        elapsed > 30 ? 'text-red-400' : elapsed > 10 ? 'text-amber-400' : 'text-slate-500'
                      }`}>
                        In progress: {formatLag(elapsed)}
                      </div>
                    ) : null;
                  })()}
                  {w.lastAppliedTransaction && (
                    <div className="text-slate-600">
                      Last: <span className="font-mono text-[9px]">{w.lastAppliedTransaction}</span>
                    </div>
                  )}
                  {w.lastErrorMessage && (
                    <div className="text-red-400 break-all">{w.lastErrorMessage}</div>
                  )}
                </div>
              ))}
            </div>
          )}

        </>
      )}

      {/* GTID Gap, Slow Statements, DBA Schema — show on breach hover or pinned selection */}
      {showDiagnosticPanels && (
        <>
          {chartPinned && (
            <div className="border-t border-slate-700 pt-2">
              <button
                onClick={() => {
                  setChartPinned(false);
                  setChartHoverContext(null, false);
                }}
                className="px-2 py-1 text-[10px] rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
              >
                Clear selection
              </button>
            </div>
          )}

          {investigationData?.dbaDebug && (
            <div className="border-t border-slate-700 pt-2 space-y-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">DBA Debug</div>
              <div className="rounded border border-slate-700 bg-slate-900/60 px-2.5 py-2 text-[10px] space-y-1">
                <div className="text-slate-400">
                  schema: <span className={investigationData.dbaDebug.schemaAccessible ? 'text-emerald-400' : 'text-red-400'}>
                    {investigationData.dbaDebug.schemaAccessible ? 'accessible' : 'not accessible'}
                  </span>
                  {' · '}
                  digest table: <span className={investigationData.dbaDebug.digestHistoryTableExists ? 'text-emerald-400' : 'text-red-400'}>
                    {investigationData.dbaDebug.digestHistoryTableExists ? 'found' : 'missing'}
                  </span>
                </div>
                <div className="text-slate-500">
                  rows: {investigationData.dbaDebug.rowCount}
                  {' · '}source: {investigationData.dbaDebug.source}
                </div>
                {investigationData.dbaDebug.lastAsOfDate && (
                  <div className="text-slate-500">
                    latest snapshot: {new Date(investigationData.dbaDebug.lastAsOfDate).toLocaleString()}
                  </div>
                )}
                {investigationData.dbaDebug.error && (
                  <div className="text-red-400 break-all">
                    {investigationData.dbaDebug.error}
                  </div>
                )}
              </div>
            </div>
          )}

          {investigationData?.gtidGap && investigationData.gtidGap.gapCount > 0 && (
            <div className="border-t border-slate-700 pt-2 space-y-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">GTID Gap</div>
              <div className="rounded border border-slate-700 bg-slate-800/50 px-2.5 py-2 text-[10px] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Pending transactions</span>
                  <span className={`font-bold ${
                    investigationData.gtidGap.gapPercent > 20 ? 'text-red-400' :
                    investigationData.gtidGap.gapPercent > 5 ? 'text-amber-400' : 'text-slate-300'
                  }`}>
                    {investigationData.gtidGap.gapCount.toLocaleString()}
                    <span className="font-normal text-slate-500 ml-1">({investigationData.gtidGap.gapPercent}%)</span>
                  </span>
                </div>
                <div className="h-1 rounded bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-slate-500 rounded"
                    style={{ width: `${Math.min(100, 100 - investigationData.gtidGap.gapPercent)}%` }}
                  />
                </div>
                <div className="text-slate-600 text-[9px]">
                  {investigationData.gtidGap.executedCount.toLocaleString()} applied / {investigationData.gtidGap.retrievedCount.toLocaleString()} received
                </div>
              </div>
            </div>
          )}
          {investigationData?.slowAppliers && investigationData.slowAppliers.length > 0 && (
            <div className="border-t border-slate-700 pt-2 space-y-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                Slow Statements (recent replication threads)
              </div>
              {investigationData.slowAppliers.map((a, i) => (
                <div key={i} className="rounded border border-slate-600 bg-slate-800/50 px-2.5 py-2 text-[10px] space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-300 font-medium break-all">
                      {a.schema || 'unknown'}{a.table ? `.${a.table}` : ''}
                      {a.workerId !== null && <span className="text-slate-500 font-normal ml-1.5">· Worker {a.workerId}</span>}
                    </span>
                    <span className="text-slate-200 font-bold shrink-0">{a.durationSeconds}s</span>
                  </div>
                  {a.rowsAffected > 0 && <div className="text-slate-500">{a.rowsAffected.toLocaleString()} rows affected</div>}
                  {a.sqlText && (
                    <div className="text-slate-500 font-mono text-[9px] break-all line-clamp-3 leading-relaxed">{a.sqlText}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* DBA schema — long-running queries from dba.events_statements_summary_by_digest_history */}
          {investigationData?.dbaSlowQueries && investigationData.dbaSlowQueries.length > 0 && (
            <div className="border-t border-slate-700 pt-2 space-y-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                DBA Schema — Long Running Queries
              </div>
              <div className="text-[9px] text-slate-600 mb-1">
                From dba.events_statements_summary_by_digest_history (latest snapshot)
              </div>
              {investigationData.dbaSlowQueries.map((q, i) => (
                <div key={i} className="rounded border border-slate-600 bg-slate-800/50 px-2.5 py-2 text-[10px] space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-300 font-medium break-all">
                      {q.schemaName || 'unknown'}
                    </span>
                    <span className="text-slate-200 font-bold shrink-0">
                      max {q.maxDurationSeconds}s · avg {q.avgDurationSeconds}s
                    </span>
                  </div>
                  <div className="text-slate-500 text-[9px]">
                    {q.countStar} execs · {q.sumRowsExamined.toLocaleString()} rows examined
                    {q.sumNoIndexUsed > 0 && <span className="text-amber-400 font-medium"> · {q.sumNoIndexUsed} no index</span>}
                  </div>
                  {(q.querySampleText || q.digestText) && (
                    <div className="text-slate-500 font-mono text-[9px] break-all line-clamp-3 leading-relaxed">
                      {q.querySampleText || q.digestText}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {investigationData?.dbaDebug && (!investigationData.dbaSlowQueries || investigationData.dbaSlowQueries.length === 0) && (
            <div className="border-t border-slate-700 pt-2 space-y-1">
              <div className="rounded border border-amber-700 bg-amber-950/20 px-2.5 py-2 text-[10px] text-amber-300">
                No DBA slow query rows returned for the current snapshot.
                {investigationData.dbaDebug.lastAsOfDate
                  ? ` Snapshot: ${new Date(investigationData.dbaDebug.lastAsOfDate).toLocaleString()}.`
                  : ''}
              </div>
            </div>
          )}
        </>
      )}

      {/* RCA Narrative — show only on breach hover or drag-selection */}
      {showDiagnosticPanels && narrativeLines.length > 0 && (
        <div className="border-t border-slate-700 pt-2 space-y-1">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Root Cause Analysis</div>
          <div className="rounded border border-slate-600 bg-slate-800/80 px-2.5 py-2.5 space-y-1.5">
            {narrativeLines.map((line, i) => (
              line === '' ? (
                <div key={i} className="h-1.5" />
              ) : (
                <p key={i} className={`text-[10px] leading-relaxed ${
                  i === 0 ? 'text-slate-200 font-medium' : 'text-slate-300/70'
                }`}>
                  {line}
                </p>
              )
            ))}
          </div>
        </div>
      )}

      {/* Lag threshold config */}
      <div className="border-t border-slate-700 pt-2">
        <LagThresholdControl />
      </div>
    </div>
  );
}

function LagThresholdControl() {
  const lagThreshold = useAppStore((s) => s.lagThreshold);
  const setLagThreshold = useAppStore((s) => s.setLagThreshold);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 shrink-0">SLA Threshold:</span>
      <input
        type="number"
        min="0"
        value={lagThreshold}
        onChange={(e) => setLagThreshold(Math.max(0, parseInt(e.target.value) || 0))}
        className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-200 focus:border-indigo-500 focus:outline-none"
      />
      <span className="text-[10px] text-slate-600">seconds (0 = off)</span>
    </div>
  );
}
