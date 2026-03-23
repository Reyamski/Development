import { useState } from 'react';
import { useAppStore } from '../store/app-store';

interface ParamRecommendation {
  param: string;
  currentValue: string;
  suggestedValue: string;
  applyType: 'dynamic' | 'static';
  severity: 'critical' | 'warning' | 'info';
  summary: string;
  pros: string[];
  cons: string[];
  details: string;
}

const STATIC_PARAMS = new Set([
  'innodb_buffer_pool_size',
  'innodb_read_io_threads',
  'innodb_write_io_threads',
  'max_connections',
  'slave_parallel_workers',
  'replica_parallel_workers',
]);

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + 'GB';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(0) + 'MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + 'KB';
  return String(bytes);
}

function getParamValue(params: Record<string, { value: string; source: string }>, ...names: string[]): { value: string; source: string } | null {
  for (const n of names) {
    if (params[n]) return params[n];
  }
  return null;
}

function buildRecommendations(
  params: Record<string, { value: string; source: string }>,
): ParamRecommendation[] {
  const recs: ParamRecommendation[] = [];

  // slave_parallel_workers / replica_parallel_workers
  const pw = getParamValue(params, 'slave_parallel_workers', 'replica_parallel_workers');
  if (pw) {
    const workers = parseInt(pw.value);
    const paramName = params['replica_parallel_workers'] ? 'replica_parallel_workers' : 'slave_parallel_workers';
    if (workers === 0) {
      recs.push({
        param: paramName,
        currentValue: '0 (single-threaded replication)',
        suggestedValue: '8-16',
        applyType: 'static',
        severity: 'critical',
        summary: 'Replication is single-threaded — this is the #1 cause of unnecessary lag',
        pros: [
          'Multi-threaded applier can process multiple transactions in parallel',
          'Directly reduces lag during high write load on the source',
          'Modern MySQL (5.7+) supports LOGICAL_CLOCK for safe parallelism',
        ],
        cons: [
          'Requires instance reboot on RDS',
          'Must also set slave_parallel_type=LOGICAL_CLOCK for best results',
          'Very rare edge cases with non-deterministic transactions',
        ],
        details: `With slave_parallel_workers=0, all replication events are applied by a single SQL thread. This means the replica can only process one transaction at a time, even if the source was writing in parallel.\n\nSet to 8-16 workers. This must be combined with slave_parallel_type=LOGICAL_CLOCK (MySQL 5.7+) to parallelize within the same schema.\n\nThis single change typically gives the biggest improvement in replica lag.`,
      });
    } else if (workers < 4) {
      recs.push({
        param: paramName,
        currentValue: String(workers),
        suggestedValue: '8-16',
        applyType: 'static',
        severity: 'warning',
        summary: `Only ${workers} parallel worker${workers > 1 ? 's' : ''} — may not be enough for high write throughput`,
        pros: [
          'More workers can apply more transactions simultaneously',
          'Reduces lag during burst writes on the source',
        ],
        cons: [
          'Requires instance reboot on RDS',
          'Each worker uses some memory for its relay log buffer',
        ],
        details: `Currently ${workers} worker${workers > 1 ? 's' : ''}. For high-write workloads, 8-16 workers typically give good parallelism without excessive overhead. Monitor worker utilization after increasing — if most workers are idle, the bottleneck is elsewhere (e.g., single large transaction).`,
      });
    }
  }

  // slave_parallel_type / replica_parallel_type
  const pt = getParamValue(params, 'slave_parallel_type', 'replica_parallel_type');
  if (pt) {
    const ptype = pt.value.toUpperCase();
    const paramName = params['replica_parallel_type'] ? 'replica_parallel_type' : 'slave_parallel_type';
    if (ptype === 'DATABASE') {
      recs.push({
        param: paramName,
        currentValue: 'DATABASE',
        suggestedValue: 'LOGICAL_CLOCK',
        applyType: 'dynamic',
        severity: 'warning',
        summary: 'Parallel type is DATABASE — only parallelizes across different schemas',
        pros: [
          'LOGICAL_CLOCK enables parallelism within the same schema/database',
          'Transactions that committed in parallel on the source can be applied in parallel on the replica',
          'Much better for single-database workloads (most common setup)',
        ],
        cons: [
          'Requires binlog_transaction_dependency_tracking=WRITESET on the source for best results',
          'Slight overhead for dependency tracking',
        ],
        details: `With parallel_type=DATABASE, the replica can only parallelize transactions across different databases. If most writes go to a single database (common for web apps), replication is effectively single-threaded.\n\nLOGICAL_CLOCK uses the commit timestamp from the source to determine which transactions can safely run in parallel, even within the same database.`,
      });
    }
  }

  // slave_preserve_commit_order / replica_preserve_commit_order
  const pco = getParamValue(params, 'slave_preserve_commit_order', 'replica_preserve_commit_order');
  if (pco && pco.value === '0') {
    const paramName = params['replica_preserve_commit_order'] ? 'replica_preserve_commit_order' : 'slave_preserve_commit_order';
    recs.push({
      param: paramName,
      currentValue: '0 (OFF)',
      suggestedValue: '1 (ON)',
      applyType: 'dynamic',
      severity: 'info',
      summary: 'Commit order not preserved — reads from replica may see out-of-order commits',
      pros: [
        'Guarantees that transactions commit in the same order as on the source',
        'Important for applications that read from the replica and expect causal consistency',
        'Required for safe GTID-based replication failover',
      ],
      cons: [
        'Slight reduction in parallelism (workers may need to wait to commit in order)',
        'Usually negligible impact on throughput with LOGICAL_CLOCK',
      ],
      details: `When preserve_commit_order=0, parallel workers may commit transactions in any order. This means an application reading from the replica could see transaction B committed but not transaction A, even though A committed first on the source.\n\nSet to 1 for consistency, especially if you use GTID-based replication or the replica serves read traffic.`,
    });
  }

  // innodb_flush_log_at_trx_commit (on replica, can be relaxed)
  const fltc = getParamValue(params, 'innodb_flush_log_at_trx_commit');
  if (fltc && fltc.value === '1') {
    recs.push({
      param: 'innodb_flush_log_at_trx_commit',
      currentValue: '1 (full durability — flush + sync every commit)',
      suggestedValue: '2 (flush every commit, sync once/sec)',
      applyType: 'dynamic',
      severity: 'warning',
      summary: 'Full durability on a replica — can be safely relaxed for better apply speed',
      pros: [
        'Setting to 2 significantly reduces write I/O on the replica',
        'Faster applier = less lag, especially during burst writes',
        'Safe for replicas: if it crashes, the source still has the authoritative data',
      ],
      cons: [
        'Up to 1 second of applied transactions lost on OS crash (not MySQL crash)',
        'Must re-sync from source after crash (same as any replica crash)',
        'Not recommended if this replica can be promoted to primary',
      ],
      details: `On a replica, innodb_flush_log_at_trx_commit=1 forces a disk sync for every applied transaction. Since the source has all the data, the replica can safely use value 2 (flush to OS cache per commit, fsync once/sec).\n\nThis reduces write IOPS significantly and allows the applier to keep up with high write throughput. Value 0 is even faster but risks losing 1 second on any crash.`,
    });
  }

  // sync_binlog (on replica, can be relaxed)
  const sb = getParamValue(params, 'sync_binlog');
  if (sb && sb.value === '1') {
    recs.push({
      param: 'sync_binlog',
      currentValue: '1 (sync every commit)',
      suggestedValue: '0 or 1000',
      applyType: 'dynamic',
      severity: 'info',
      summary: 'Binary log sync on every commit — adds I/O overhead on the replica',
      pros: [
        'Relaxing sync_binlog reduces write IOPS from binlog flushes',
        'On a read replica, binlog is often not needed unless it has its own replicas',
      ],
      cons: [
        'If this replica has downstream replicas, unsyncedlog events could be lost on crash',
        'Not safe to relax if this replica is used for point-in-time recovery',
      ],
      details: `sync_binlog=1 forces a disk sync of the binary log on every commit. On a replica, if the binary log is only used for PITR or downstream replication, relaxing to 0 (OS decides) or 1000 (sync every 1000 commits) reduces I/O.\n\nIf this replica has no downstream replicas and PITR is handled by the source, setting to 0 is safe.`,
    });
  }

  // innodb_buffer_pool_size
  const bps = getParamValue(params, 'innodb_buffer_pool_size');
  if (bps) {
    const bpBytes = parseInt(bps.value);
    const bpGb = bpBytes / (1024 * 1024 * 1024);
    if (bpGb > 0 && bpGb < 1) {
      recs.push({
        param: 'innodb_buffer_pool_size',
        currentValue: formatBytes(bpBytes),
        suggestedValue: '70-80% of instance memory',
        applyType: 'static',
        severity: 'warning',
        summary: `Buffer pool is only ${formatBytes(bpBytes)} — increase to reduce disk reads during apply`,
        pros: [
          'Larger buffer pool caches more data pages in memory',
          'Replica reads from buffer pool when applying row-based events',
          'Reduces read I/O and speeds up applier, directly reducing lag',
        ],
        cons: [
          'Requires instance reboot on RDS',
          'Must leave memory for OS cache and per-connection buffers',
        ],
        details: `The InnoDB buffer pool is crucial for replica performance. When applying row-based replication events, the replica must read the affected pages into memory. A small buffer pool means more disk reads, slowing down the applier.\n\nSet to 70-80% of instance memory. Currently at ${formatBytes(bpBytes)}.`,
      });
    }
  }

  // innodb_io_capacity
  const ioc = getParamValue(params, 'innodb_io_capacity');
  if (ioc) {
    const cap = parseInt(ioc.value);
    if (cap <= 200) {
      recs.push({
        param: 'innodb_io_capacity',
        currentValue: String(cap),
        suggestedValue: '1000-2000',
        applyType: 'dynamic',
        severity: 'info',
        summary: `io_capacity=${cap} is low — may throttle background flushing during heavy apply`,
        pros: [
          'Higher io_capacity allows faster dirty page flushing',
          'Prevents checkpoint stalls that can block the applier',
        ],
        cons: [
          'Increases background I/O which may compete with apply I/O',
        ],
        details: `innodb_io_capacity controls how aggressively InnoDB flushes dirty pages. At ${cap}, during heavy replication apply, dirty pages may accumulate faster than they are flushed, causing stalls.\n\nIncrease to 1000-2000 for replicas on SSD/gp3 storage. Also set innodb_io_capacity_max to 2x this value.`,
      });
    }
  }

  // read_only / super_read_only
  const ro = getParamValue(params, 'read_only');
  const sro = getParamValue(params, 'super_read_only');
  if (ro && ro.value === '0') {
    recs.push({
      param: 'read_only',
      currentValue: '0 (OFF)',
      suggestedValue: '1 (ON)',
      applyType: 'dynamic',
      severity: 'warning',
      summary: 'Replica is not read-only — application writes could cause replication conflicts',
      pros: [
        'Prevents accidental writes to the replica',
        'Eliminates replication conflicts from direct writes',
      ],
      cons: [
        'Cannot perform direct writes (intended behavior for a replica)',
      ],
      details: `A read replica should always have read_only=1 to prevent application writes. Direct writes to a replica can cause replication errors (duplicate key, etc.) that stop the SQL thread.\n\nAlso consider super_read_only=1 to prevent even SUPER-privileged users from writing.`,
    });
  }

  // binlog_transaction_dependency_tracking
  const btdt = getParamValue(params, 'binlog_transaction_dependency_tracking');
  if (btdt && btdt.value.toUpperCase() === 'COMMIT_ORDER') {
    recs.push({
      param: 'binlog_transaction_dependency_tracking',
      currentValue: 'COMMIT_ORDER',
      suggestedValue: 'WRITESET',
      applyType: 'dynamic',
      severity: 'info',
      summary: 'Dependency tracking uses COMMIT_ORDER — WRITESET enables more parallelism',
      pros: [
        'WRITESET tracks which rows each transaction modified',
        'Transactions touching different rows can be applied in parallel even if serialized on source',
        'Can significantly increase parallel apply throughput',
      ],
      cons: [
        'This must be set on the SOURCE, not the replica',
        'Slight CPU overhead for tracking write sets',
        'Requires transaction_write_set_extraction=XXHASH64 on source',
      ],
      details: `With COMMIT_ORDER, only transactions that actually committed at the same time on the source can run in parallel on the replica. WRITESET analyzes which rows were modified — if two transactions touch different rows, they can parallelize even if they committed sequentially.\n\nNote: this parameter must be changed on the SOURCE database, not the replica. The replica benefits automatically.`,
    });
  }

  return recs;
}

function ApplyBadge({ type }: { type: 'dynamic' | 'static' }) {
  return (
    <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${
      type === 'dynamic' ? 'bg-emerald-800 text-emerald-200' : 'bg-amber-800 text-amber-200'
    }`}>
      {type === 'dynamic' ? 'LIVE' : 'REBOOT'}
    </span>
  );
}

function SeverityDot({ severity }: { severity: 'critical' | 'warning' | 'info' }) {
  const color = severity === 'critical' ? 'bg-red-500' : severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500';
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />;
}

export function ParameterGroupPanel() {
  const parameterGroup = useAppStore((s) => s.parameterGroup);
  const parameterGroupName = useAppStore((s) => s.parameterGroupName);
  const parameterGroupLoading = useAppStore((s) => s.parameterGroupLoading);
  const [expandedParam, setExpandedParam] = useState<string | null>(null);

  if (!parameterGroupName) return null;

  if (parameterGroupLoading) {
    return (
      <div className="rounded bg-slate-800 border border-slate-700 px-3 py-3 space-y-2">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Replica Parameters</div>
        <div className="text-[10px] text-slate-500 animate-pulse">Loading parameter group...</div>
      </div>
    );
  }

  if (!parameterGroup) return null;

  const recommendations = buildRecommendations(parameterGroup);

  // Key replica parameters to always show
  const keyParams = [
    { names: ['slave_parallel_workers', 'replica_parallel_workers'], label: 'Parallel Workers' },
    { names: ['slave_parallel_type', 'replica_parallel_type'], label: 'Parallel Type' },
    { names: ['slave_preserve_commit_order', 'replica_preserve_commit_order'], label: 'Preserve Commit Order' },
    { names: ['innodb_flush_log_at_trx_commit'], label: 'Flush Log at Commit' },
    { names: ['sync_binlog'], label: 'Sync Binlog' },
    { names: ['innodb_buffer_pool_size'], label: 'Buffer Pool Size' },
    { names: ['innodb_io_capacity'], label: 'IO Capacity' },
    { names: ['read_only'], label: 'Read Only' },
  ];

  const displayParams = keyParams.map(kp => {
    const p = getParamValue(parameterGroup, ...kp.names);
    if (!p) return null;
    const hasRec = recommendations.some(r => kp.names.some(n => r.param === n || r.param.includes(kp.label.toLowerCase().replace(/ /g, '_'))));
    let displayValue = p.value;
    if (kp.label === 'Buffer Pool Size') displayValue = formatBytes(parseInt(p.value));
    return { label: kp.label, value: displayValue, source: p.source, hasRec };
  }).filter(Boolean) as { label: string; value: string; source: string; hasRec: boolean }[];

  return (
    <div className="rounded bg-slate-800 border border-slate-700 px-3 py-3 space-y-3">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Replica Parameters</div>
      <div className="text-[9px] text-slate-600">{parameterGroupName}</div>

      {/* Current values */}
      {displayParams.length > 0 && (
        <div className="space-y-1">
          {displayParams.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">{p.label}</span>
              <div className="flex items-center gap-1.5">
                <span className={`font-mono ${p.source === 'user' ? 'text-indigo-300' : 'text-slate-300'}`}>
                  {p.value}
                </span>
                {p.source === 'user' && (
                  <span className="text-[8px] px-1 py-0.5 rounded bg-indigo-900/50 text-indigo-300">MODIFIED</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-700 pt-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
            Recommendations ({recommendations.length})
          </div>
          {recommendations.map((rec, i) => {
            const isExpanded = expandedParam === rec.param;
            return (
              <div key={i} className={`rounded border px-2.5 py-2 text-[10px] space-y-1 cursor-pointer transition-colors ${
                rec.severity === 'critical' ? 'border-red-800/60 bg-red-950/15 hover:bg-red-950/25' :
                rec.severity === 'warning' ? 'border-amber-800/40 bg-amber-950/10 hover:bg-amber-950/20' :
                'border-slate-600 bg-slate-800/50 hover:bg-slate-800/80'
              }`} onClick={() => setExpandedParam(isExpanded ? null : rec.param)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <SeverityDot severity={rec.severity} />
                    <span className="text-slate-300 font-medium">{rec.summary}</span>
                  </div>
                  <ApplyBadge type={rec.applyType} />
                </div>

                <div className="flex items-center gap-2 text-[9px] text-slate-500">
                  <span>Current: <span className="text-slate-400 font-mono">{rec.currentValue}</span></span>
                  <span>→</span>
                  <span>Suggested: <span className="text-emerald-400 font-mono">{rec.suggestedValue}</span></span>
                </div>

                {isExpanded && (
                  <div className="space-y-2 mt-2 border-t border-slate-700/50 pt-2">
                    <div>
                      <div className="text-[9px] text-emerald-400 font-medium mb-0.5">Pros:</div>
                      {rec.pros.map((p, j) => (
                        <div key={j} className="text-[9px] text-slate-400">+ {p}</div>
                      ))}
                    </div>
                    <div>
                      <div className="text-[9px] text-red-400 font-medium mb-0.5">Cons:</div>
                      {rec.cons.map((c, j) => (
                        <div key={j} className="text-[9px] text-slate-400">- {c}</div>
                      ))}
                    </div>
                    <div className="text-[9px] text-slate-400 whitespace-pre-wrap leading-relaxed bg-slate-900/60 rounded px-2 py-1.5">
                      {rec.details}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {recommendations.length === 0 && (
        <div className="text-[10px] text-emerald-400 border-t border-slate-700 pt-2">
          All replica parameters look well-tuned for this workload.
        </div>
      )}
    </div>
  );
}
