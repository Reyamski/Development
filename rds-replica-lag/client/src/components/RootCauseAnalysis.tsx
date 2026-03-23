import { useAppStore } from '../store/app-store';
import type { ReplicaStatus, ReplicationWorker, InvestigationData, CloudWatchLagPoint, TimeRange, DbaSlowQuery, SourceCloudWatchPoint } from '../api/types';

function formatLag(seconds: number | null): string {
  if (seconds === null) return 'unknown';
  if (seconds >= 3600) return (seconds / 3600).toFixed(1) + 'h';
  if (seconds >= 60) return (seconds / 60).toFixed(1) + 'm';
  return seconds.toFixed(0) + 's';
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function extractTable(sql: string): string {
  const m = sql.match(/(?:FROM|JOIN|UPDATE|INTO|TABLE)\s+`?(\w+)`?/i);
  return m ? m[1] : '';
}

function suggestIndex(sql: string, table: string): string | null {
  if (!sql || !table) return null;
  const cols: string[] = [];
  const seen = new Set<string>();
  const add = (col: string) => {
    const clean = col.replace(/[`'"]/g, '').replace(/^\w+\./, '').toLowerCase();
    if (clean && !seen.has(clean) && clean !== '*' && !/^\d/.test(clean)) {
      seen.add(clean);
      cols.push(clean);
    }
  };

  const whereCols = sql.matchAll(/(?:WHERE|AND|OR)\s+`?(?:\w+\.)?`?(\w+)`?\s*(?:=|>|<|IN|BETWEEN|LIKE|IS)/gi);
  for (const m of whereCols) if (m[1]) add(m[1]);
  const joinCols = sql.matchAll(/ON\s+`?(?:\w+\.)?`?(\w+)`?\s*=\s*`?(?:\w+\.)?`?(\w+)`?/gi);
  for (const m of joinCols) { if (m[1]) add(m[1]); if (m[2]) add(m[2]); }
  const orderCols = sql.matchAll(/ORDER\s+BY\s+`?(?:\w+\.)?`?(\w+)`?/gi);
  for (const m of orderCols) if (m[1]) add(m[1]);

  if (cols.length === 0) return null;
  return `ALTER TABLE \`${table}\` ADD INDEX idx_${table}_${cols.slice(0, 3).join('_')} (${cols.slice(0, 4).map(c => `\`${c}\``).join(', ')})`;
}

interface QueryRecommendation {
  query: DbaSlowQuery;
  impactScore: number;
  issues: string[];
  suggestions: string[];
  indexHint: string | null;
}

function analyzeQuery(q: DbaSlowQuery): QueryRecommendation {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const sql = q.querySampleText || q.digestText;
  const table = extractTable(sql);

  let impactScore = q.maxDurationSeconds * 10;
  impactScore += q.countStar * q.avgDurationSeconds;

  if (q.sumNoIndexUsed > 0) {
    issues.push(`Full table scan — ${q.sumNoIndexUsed} execution${q.sumNoIndexUsed > 1 ? 's' : ''} without index`);
    suggestions.push('Add an index to avoid full table scans on the replica');
    impactScore *= 2;
  }

  const avgRowsPerExec = q.countStar > 0 ? q.sumRowsExamined / q.countStar : 0;
  if (avgRowsPerExec > 10000) {
    issues.push(`High row scan — ${formatNumber(avgRowsPerExec)} rows examined per execution`);
    suggestions.push('Consider adding a covering index or limiting the result set');
  }

  if (q.sumRowsAffected > 0 && q.countStar > 0) {
    const avgAffected = q.sumRowsAffected / q.countStar;
    if (avgAffected > 1000) {
      issues.push(`Bulk write — avg ${formatNumber(avgAffected)} rows affected per execution`);
      suggestions.push('Break large writes into smaller batches on the source to reduce applier stalls');
    }
  }

  if (q.maxDurationSeconds > 10) {
    issues.push(`Slow execution — max ${q.maxDurationSeconds}s`);
    if (q.avgDurationSeconds > 5) {
      suggestions.push('This query consistently takes >5s — optimize it or schedule during low traffic');
    }
  }

  const indexHint = q.sumNoIndexUsed > 0 ? suggestIndex(sql, table) : null;

  return { query: q, impactScore, issues, suggestions, indexHint };
}

function analyzeWorkers(workers: ReplicationWorker[]): {
  total: number;
  active: number;
  idle: number;
  errored: number;
  stalledIds: number[];
  utilizationPct: number;
  recommendation: string | null;
} {
  const total = workers.length;
  if (total === 0) return { total: 0, active: 0, idle: 0, errored: 0, stalledIds: [], utilizationPct: 0, recommendation: null };

  let active = 0;
  let errored = 0;
  const stalledIds: number[] = [];

  for (const w of workers) {
    if (w.lastErrorNumber > 0) { errored++; continue; }
    if (w.applyingTransaction) {
      active++;
      if (w.applyingTransactionStartApplyTimestamp) {
        const elapsed = (Date.now() - new Date(w.applyingTransactionStartApplyTimestamp).getTime()) / 1000;
        if (elapsed > 30) stalledIds.push(w.workerId);
      }
    }
  }

  const idle = total - active - errored;
  const utilizationPct = total > 0 ? Math.round((active / total) * 100) : 0;

  let recommendation: string | null = null;
  if (utilizationPct >= 90) {
    recommendation = `All ${total} workers are busy — increase slave_parallel_workers (try ${total * 2}) to reduce applier bottleneck`;
  } else if (utilizationPct <= 20 && total <= 4) {
    recommendation = `Only ${active}/${total} workers active — if lag persists, the bottleneck may be single-threaded DDL or large transactions, not worker count`;
  }

  return { total, active, idle, errored, stalledIds, utilizationPct, recommendation };
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

function formatIops(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.round(n).toString();
}

function generateNarrative(
  replicaStatus: ReplicaStatus,
  investigationData: InvestigationData | null,
  replicationWorkers: ReplicationWorker[],
  lagThreshold: number,
  cloudwatchData: CloudWatchLagPoint[],
  timeRange: TimeRange,
  sourceCloudwatchData: SourceCloudWatchPoint[],
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

  // 8. When we have breaches — data-driven analysis instead of generic bullets
  if (addedBreachMessage) {
    const hasSlowAppliers = !!(investigationData?.slowAppliers?.length);
    const hasDbaQueries = dbaQueries.length > 0;
    const workerAnalysis = analyzeWorkers(replicationWorkers);

    if (hasDbaQueries) {
      lines.push('');
      lines.push('Queries contributing to lag:');
      const topQueries = dbaQueries.slice(0, 3);
      for (const q of topQueries) {
        const table = extractTable(q.querySampleText || q.digestText);
        const avgRows = q.countStar > 0 ? q.sumRowsExamined / q.countStar : 0;
        let detail = `• ${q.schemaName}${table ? '.' + table : ''} — max ${q.maxDurationSeconds}s, ${q.countStar} execs`;
        if (avgRows > 1000) detail += `, ${formatNumber(avgRows)} rows/exec`;
        if (q.sumNoIndexUsed > 0) detail += ' ⚠ NO INDEX';
        lines.push(detail);
      }
      if (dbaQueries.length > 3) {
        lines.push(`  ...and ${dbaQueries.length - 3} more (see details below)`);
      }
    }

    if (hasSlowAppliers && !hasDbaQueries) {
      lines.push('');
      const topApplier = investigationData!.slowAppliers[0];
      const loc = [topApplier.schema, topApplier.table].filter(Boolean).join('.');
      lines.push(`Slow replication applier detected${loc ? ` on \`${loc}\`` : ''} — took ${topApplier.durationSeconds}s${topApplier.rowsAffected > 0 ? `, ${formatNumber(topApplier.rowsAffected)} rows affected` : ''}.`);
    }

    if (workerAnalysis.total > 0) {
      lines.push('');
      lines.push(`Workers: ${workerAnalysis.active} active / ${workerAnalysis.idle} idle / ${workerAnalysis.total} total (${workerAnalysis.utilizationPct}% utilization)`);
      if (workerAnalysis.stalledIds.length > 0) {
        lines.push(`⚠ Worker${workerAnalysis.stalledIds.length > 1 ? 's' : ''} ${workerAnalysis.stalledIds.join(', ')} stalled >30s on a single transaction`);
      }
      if (workerAnalysis.recommendation) {
        lines.push(`→ ${workerAnalysis.recommendation}`);
      }
    }

    // Source (primary) correlation
    if (sourceCloudwatchData.length > 0) {
      const avgWriteIops = sourceCloudwatchData.reduce((s, p) => s + p.writeIops, 0) / sourceCloudwatchData.length;
      const peakWriteIops = Math.max(...sourceCloudwatchData.map(p => p.writeIops));
      const avgCpu = sourceCloudwatchData.reduce((s, p) => s + p.cpuUtilization, 0) / sourceCloudwatchData.length;

      if (peakWriteIops > avgWriteIops * 2 && peakWriteIops > 100) {
        lines.push('');
        lines.push(`⚡ Source primary write spike detected — peak ${formatIops(peakWriteIops)} IOPS (avg ${formatIops(avgWriteIops)}), ${(peakWriteIops / avgWriteIops).toFixed(1)}x surge.`);
        lines.push('→ High write volume on the primary directly increases replication apply backlog.');
      } else if (avgWriteIops > 500) {
        lines.push('');
        lines.push(`Source primary: sustained ${formatIops(avgWriteIops)} avg WriteIOPS during this period.`);
      }
      if (avgCpu > 80) {
        lines.push(`Source CPU at ${avgCpu.toFixed(0)}% — primary is under heavy load which may delay binlog generation.`);
      }
    }

    if (!hasSlowAppliers && !hasDbaQueries && sourceCloudwatchData.length === 0) {
      lines.push('');
      lines.push('No slow queries captured — performance_schema buffer may have evicted older statements.');
      lines.push('Drag the chart to zoom into a spike quickly after it happens for better capture.');
    }
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
  const sourceCloudwatchData = useAppStore((s) => s.sourceCloudwatchData);
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

  const narrativeLines = generateNarrative(replicaStatus, investigationData, replicationWorkers, lagThreshold, cloudwatchData, timeRange, sourceCloudwatchData);

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
          {/* Parallel workers with utilization analysis */}
          {replicationWorkers.length > 0 && (() => {
            const wa = analyzeWorkers(replicationWorkers);
            return (
              <div className="space-y-1.5 border-t border-slate-700 pt-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                  Parallel Worker Activity
                </div>

                {/* Utilization bar */}
                <div className="rounded border border-slate-700 bg-slate-900/60 px-2.5 py-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Utilization</span>
                    <span className={`font-bold ${
                      wa.utilizationPct >= 90 ? 'text-red-400' :
                      wa.utilizationPct >= 50 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>{wa.utilizationPct}%</span>
                  </div>
                  <div className="h-2 rounded bg-slate-700 overflow-hidden flex">
                    {wa.active > 0 && (
                      <div className="h-full bg-emerald-500" style={{ width: `${(wa.active / wa.total) * 100}%` }} />
                    )}
                    {wa.errored > 0 && (
                      <div className="h-full bg-red-500" style={{ width: `${(wa.errored / wa.total) * 100}%` }} />
                    )}
                  </div>
                  <div className="flex gap-3 text-[9px] text-slate-500">
                    <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />{wa.active} active</span>
                    <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-600 mr-1" />{wa.idle} idle</span>
                    {wa.errored > 0 && <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1" />{wa.errored} error</span>}
                  </div>
                  {wa.recommendation && (
                    <div className={`text-[10px] mt-1 px-2 py-1.5 rounded ${
                      wa.utilizationPct >= 90
                        ? 'bg-red-950/30 border border-red-800 text-red-300'
                        : 'bg-slate-800 border border-slate-600 text-slate-300'
                    }`}>
                      💡 {wa.recommendation}
                    </div>
                  )}
                </div>

                {/* Individual workers */}
                {replicationWorkers.map(w => (
                  <div key={w.workerId} className={`rounded border px-2.5 py-2 text-[10px] space-y-0.5 ${
                    w.lastErrorNumber > 0
                      ? 'border-red-800 bg-red-950/30'
                      : w.applyingTransaction
                        ? 'border-emerald-800/50 bg-emerald-950/10'
                        : 'border-slate-700 bg-slate-800/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Worker {w.workerId}</span>
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                        w.lastErrorNumber > 0 ? 'bg-red-600 text-white' :
                        w.applyingTransaction ? 'bg-emerald-700 text-white' :
                        w.serviceState === 'ON' ? 'bg-slate-600 text-slate-200' : 'bg-slate-700 text-slate-400'
                      }`}>
                        {w.lastErrorNumber > 0 ? 'ERROR' : w.applyingTransaction ? 'APPLYING' : w.serviceState === 'ON' ? 'IDLE' : w.serviceState}
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
                          {elapsed > 30 && ' — likely blocking replication'}
                        </div>
                      ) : null;
                    })()}
                    {w.lastAppliedTransaction && !w.applyingTransaction && (
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
            );
          })()}

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

          {/* DBA schema — analyzed queries with recommendations */}
          {investigationData?.dbaSlowQueries && investigationData.dbaSlowQueries.length > 0 && (() => {
            const analyzed = investigationData.dbaSlowQueries
              .map(analyzeQuery)
              .sort((a, b) => b.impactScore - a.impactScore);
            const maxImpact = analyzed[0]?.impactScore || 1;

            return (
              <div className="border-t border-slate-700 pt-2 space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                  Query Analysis — Ranked by Lag Impact
                </div>
                <div className="text-[9px] text-slate-600 mb-1">
                  {analyzed.length} queries from DBA snapshot
                  {investigationData.dbaDebug?.lastAsOfDate && (
                    <> · {new Date(investigationData.dbaDebug.lastAsOfDate).toLocaleTimeString()}</>
                  )}
                </div>
                {analyzed.map((a, i) => {
                  const impactPct = Math.round((a.impactScore / maxImpact) * 100);
                  const q = a.query;
                  const table = extractTable(q.querySampleText || q.digestText);
                  return (
                    <div key={i} className={`rounded border px-2.5 py-2 text-[10px] space-y-1.5 ${
                      i === 0 ? 'border-red-800/60 bg-red-950/15' :
                      a.issues.length > 0 ? 'border-amber-800/40 bg-amber-950/10' :
                      'border-slate-600 bg-slate-800/50'
                    }`}>
                      {/* Header: rank, schema.table, timing */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            i === 0 ? 'bg-red-600 text-white' :
                            i <= 2 ? 'bg-amber-600 text-white' : 'bg-slate-600 text-slate-200'
                          }`}>#{i + 1}</span>
                          <span className="text-slate-300 font-medium break-all">
                            {q.schemaName || 'unknown'}{table ? `.${table}` : ''}
                          </span>
                        </div>
                        <span className="text-slate-200 font-bold shrink-0">
                          max {q.maxDurationSeconds}s
                        </span>
                      </div>

                      {/* Impact bar */}
                      <div className="space-y-0.5">
                        <div className="h-1 rounded bg-slate-700 overflow-hidden">
                          <div className={`h-full rounded ${
                            i === 0 ? 'bg-red-500' : a.issues.length > 0 ? 'bg-amber-500' : 'bg-slate-500'
                          }`} style={{ width: `${impactPct}%` }} />
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[9px] text-slate-500">
                        <span>{q.countStar} execs</span>
                        <span>avg {q.avgDurationSeconds}s</span>
                        <span>{formatNumber(q.sumRowsExamined)} rows examined</span>
                        {q.sumRowsAffected > 0 && <span>{formatNumber(q.sumRowsAffected)} rows affected</span>}
                        {q.sumNoIndexUsed > 0 && (
                          <span className="text-red-400 font-bold">⚠ NO INDEX ({q.sumNoIndexUsed}x)</span>
                        )}
                      </div>

                      {/* Issues */}
                      {a.issues.length > 0 && (
                        <div className="space-y-0.5">
                          {a.issues.map((issue, j) => (
                            <div key={j} className="text-[9px] text-amber-300/90">⚠ {issue}</div>
                          ))}
                        </div>
                      )}

                      {/* Suggestions */}
                      {a.suggestions.length > 0 && (
                        <div className="space-y-0.5 border-t border-slate-700/50 pt-1">
                          {a.suggestions.map((s, j) => (
                            <div key={j} className="text-[9px] text-emerald-400/80">→ {s}</div>
                          ))}
                        </div>
                      )}

                      {/* Index hint */}
                      {a.indexHint && (
                        <div className="border-t border-slate-700/50 pt-1">
                          <div className="text-[9px] text-slate-500 mb-0.5">Suggested index:</div>
                          <pre className="text-[9px] font-mono text-indigo-300 bg-slate-900/80 rounded px-2 py-1 break-all whitespace-pre-wrap cursor-pointer hover:bg-slate-900"
                            onClick={() => navigator.clipboard.writeText(a.indexHint!)}
                            title="Click to copy"
                          >{a.indexHint}</pre>
                        </div>
                      )}

                      {/* SQL text */}
                      {(q.querySampleText || q.digestText) && (
                        <pre className="text-[9px] font-mono text-slate-500 break-all whitespace-pre-wrap line-clamp-3 leading-relaxed cursor-pointer hover:text-slate-400"
                          onClick={() => navigator.clipboard.writeText(q.querySampleText || q.digestText)}
                          title="Click to copy full query"
                        >{q.querySampleText || q.digestText}</pre>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

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
