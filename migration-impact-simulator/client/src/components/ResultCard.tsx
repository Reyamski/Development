import { useAppStore } from '../store/app-store';
import { CommandPreview } from './CommandPreview';
import { RawQueriesPanel } from './RawQueriesPanel';
import type { Recommendation, OperationType } from '../api/types';

function formatRows(rows: number): string {
  if (rows >= 1_000_000_000) return `${(rows / 1_000_000_000).toFixed(1)}B`;
  if (rows >= 1_000_000) return `${(rows / 1_000_000).toFixed(1)}M`;
  if (rows >= 1_000) return `${(rows / 1_000).toFixed(0)}K`;
  return rows.toString();
}

function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

type BadgeConfig = {
  label: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  dotClass: string;
};

const BADGE_CONFIGS: Record<Recommendation, BadgeConfig> = {
  INSTANT: {
    label: 'INSTANT',
    textClass: 'text-green-300',
    bgClass: 'bg-green-500/10',
    borderClass: 'border-green-500/30',
    dotClass: 'bg-green-400',
  },
  INPLACE: {
    label: 'INPLACE',
    textClass: 'text-blue-300',
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/30',
    dotClass: 'bg-blue-400',
  },
  GH_OST: {
    label: 'gh-ost',
    textClass: 'text-yellow-300',
    bgClass: 'bg-yellow-500/10',
    borderClass: 'border-yellow-500/30',
    dotClass: 'bg-yellow-400',
  },
  PT_OSC: {
    label: 'pt-osc',
    textClass: 'text-yellow-300',
    bgClass: 'bg-yellow-500/10',
    borderClass: 'border-yellow-500/30',
    dotClass: 'bg-yellow-400',
  },
  REBUILD_FIRST: {
    label: 'REBUILD FIRST',
    textClass: 'text-red-300',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    dotClass: 'bg-red-400',
  },
};

// Fallback for any unrecognised value
function getBadgeConfig(rec: Recommendation): BadgeConfig {
  return (
    BADGE_CONFIGS[rec] ?? {
      label: rec,
      textClass: 'text-gray-300',
      bgClass: 'bg-gray-500/10',
      borderClass: 'border-gray-500/30',
      dotClass: 'bg-gray-400',
    }
  );
}

function RecommendationBadgeLarge({ rec }: { rec: Recommendation }) {
  const c = getBadgeConfig(rec);
  return (
    <div className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl border ${c.bgClass} ${c.borderClass}`}>
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dotClass}`} />
      <span className={`text-2xl font-bold tracking-wide ${c.textClass}`}>{c.label}</span>
    </div>
  );
}

function RecommendationBadgeSmall({ rec }: { rec: Recommendation }) {
  const c = getBadgeConfig(rec);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${c.bgClass} ${c.borderClass} ${c.textClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dotClass}`} />
      {c.label}
    </span>
  );
}

function operationLabel(type: OperationType): string {
  const labels: Record<OperationType, string> = {
    ADD_COLUMN: 'Add Column',
    DROP_COLUMN: 'Drop Column',
    MODIFY_COLUMN: 'Modify Column',
    RENAME_COLUMN: 'Rename Column',
    ADD_INDEX: 'Add Index',
    DROP_INDEX: 'Drop Index',
    ADD_VIRTUAL_COLUMN: 'Add Virtual Column',
    DROP_VIRTUAL_COLUMN: 'Drop Virtual Column',
    MODIFY_DEFAULT: 'Modify Default',
    CHANGE_ENUM_SET: 'Change ENUM/SET',
    CHANGE_INDEX_TYPE: 'Change Index Type',
    CHANGE_ENGINE: 'Change Engine',
    ADD_PRIMARY_KEY: 'Add Primary Key',
    DROP_PRIMARY_KEY: 'Drop Primary Key',
    ADD_FOREIGN_KEY: 'Add Foreign Key',
    DROP_FOREIGN_KEY: 'Drop Foreign Key',
    UNKNOWN: 'Unknown',
  };
  return labels[type] ?? type;
}

function RowVersionsBar({ count }: { count: number }) {
  const pct = Math.min(100, (count / 64) * 100);
  const isSafe = count < 63;
  const barColor = isSafe ? 'bg-green-500' : 'bg-red-500';
  const textColor = isSafe ? 'text-green-400' : 'text-red-400';
  const labelColor = isSafe ? 'text-green-500' : 'text-red-500';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Row Versions</span>
        <span className={`text-xs font-mono font-medium ${textColor}`}>
          {count} / 64{' '}
          <span className={`${labelColor}`}>{isSafe ? '(safe)' : '(at limit)'}</span>
        </span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function LockEstimateDisplay({ label, minMs, maxMs }: { label: string; minMs: number; maxMs: number }) {
  // Parse the label to extract number + unit for large display
  // e.g. "< 1ms", "~200ms", "2–5s"
  return (
    <div>
      <p className="text-3xl font-bold text-gray-100 leading-none">{label}</p>
      {maxMs > 200 && (
        <p className="text-xs text-gray-500 mt-1">
          {minMs < 1000 ? `${minMs}ms` : `${(minMs / 1000).toFixed(1)}s`}
          {' – '}
          {maxMs < 1000 ? `${maxMs}ms` : `${(maxMs / 1000).toFixed(1)}s`}
        </p>
      )}
    </div>
  );
}

export function ResultCard() {
  const { analysisResult, analysisError, analyzing } = useAppStore();

  // Loading state
  if (analyzing) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 flex flex-col items-center justify-center gap-3">
        <svg
          className="w-8 h-8 animate-spin text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-gray-400">Analyzing DDL — querying information_schema…</p>
      </div>
    );
  }

  // Error state
  if (analysisError) {
    return (
      <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-400 mb-1">Analysis Failed</p>
            <p className="text-sm text-red-500/80">{analysisError}</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty / placeholder state
  if (!analysisResult) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.699-1.329 2.699H4.127c-1.36 0-2.333-1.7-1.329-2.699L4.2 15.3" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-400">No analysis yet</p>
          <p className="text-xs text-gray-600 mt-1">
            Paste a DDL statement above and click Analyze
          </p>
        </div>
      </div>
    );
  }

  const r = analysisResult;

  return (
    <div className="space-y-4">
      {/* Hero: recommendation + lock estimate — most prominent elements */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Recommendation badge — largest element */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Recommended Strategy
            </p>
            <RecommendationBadgeLarge rec={r.recommendation} />
            {r.recommendation === 'REBUILD_FIRST' && (
              <p className="text-xs text-red-400 mt-1">
                Run ENGINE=InnoDB rebuild before the ALTER
              </p>
            )}
          </div>

          {/* Lock estimate — large number */}
          <div className="sm:text-right space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Lock Window
            </p>
            <LockEstimateDisplay
              label={r.lockEstimate.label}
              minMs={r.lockEstimate.minMs}
              maxMs={r.lockEstimate.maxMs}
            />
          </div>
        </div>
      </div>

      {/* Stats grid: operation / recommendation / lock / table size */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Operation type */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Operation</p>
          <p className="text-sm font-semibold text-gray-100">{operationLabel(r.operation.type)}</p>
          {r.operation.column && (
            <p className="text-xs text-gray-500 mt-1 font-mono truncate">{r.operation.column}</p>
          )}
        </div>

        {/* Recommendation small */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Strategy</p>
          <RecommendationBadgeSmall rec={r.recommendation} />
        </div>

        {/* Lock estimate small */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Lock</p>
          <p className="text-sm font-semibold text-gray-100">{r.lockEstimate.label}</p>
        </div>

        {/* Table size */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Table Size</p>
          <p className="text-sm font-semibold text-gray-100">{formatMb(r.table.sizeMb)}</p>
          <p className="text-xs text-gray-500 mt-1">{formatRows(r.table.rows)} rows</p>
        </div>
      </div>

      {/* Table details + row versions */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-100 font-mono">
              {r.table.schema}.{r.table.name}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {r.table.engine}
              {r.table.hasTriggers && (
                <span className="ml-2 text-yellow-400">&#9888; Has Triggers</span>
              )}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-500 uppercase tracking-wider">INSTANT eligible</p>
            <p
              className={`text-sm font-semibold mt-0.5 ${
                r.instantEligible ? 'text-green-400' : 'text-gray-600'
              }`}
            >
              {r.instantEligible ? 'Yes' : 'No'}
            </p>
          </div>
        </div>

        {/* Row version counter with mini progress bar */}
        <RowVersionsBar count={r.table.rowVersions} />
      </div>

      {/* Warnings */}
      {r.warnings.length > 0 && (
        <div className="space-y-2">
          {r.warnings.map((w, i) => (
            <div
              key={i}
              className="flex gap-2.5 border border-yellow-500/20 bg-yellow-500/5 rounded-lg px-4 py-3"
            >
              <span className="text-yellow-400 shrink-0 text-sm">&#9888;</span>
              <p className="text-xs text-yellow-300 leading-relaxed">{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* Replication lag warning */}
      {r.replicationLagWarning && (
        <div className="flex gap-2.5 border border-blue-500/20 bg-blue-500/5 rounded-lg px-4 py-3">
          <span className="text-blue-400 shrink-0 text-sm">&#8505;</span>
          <p className="text-xs text-blue-300 leading-relaxed">
            Replicas will lag for approximately the same duration as the lock window. Schedule this during off-peak hours.
          </p>
        </div>
      )}

      {/* Disk space */}
      {r.diskSpaceNeededMb !== null && (
        <div className="flex gap-2.5 border border-gray-700 bg-gray-900 rounded-lg px-4 py-3">
          <span className="text-gray-500 shrink-0 text-sm">&#128190;</span>
          <p className="text-xs text-gray-400 leading-relaxed">
            Estimated disk space needed:{' '}
            <span className="font-semibold text-gray-200">{formatMb(r.diskSpaceNeededMb)}</span>{' '}
            (shadow table ~ 2x table size)
          </p>
        </div>
      )}

      {/* Command previews */}
      <div className="space-y-2">
        <CommandPreview title="gh-ost command" command={r.ghOstCommand} variant="ghost" />
        <CommandPreview title="pt-osc command" command={r.ptOscCommand} variant="ptosc" />
        <RawQueriesPanel queries={r.rawQueries} />
      </div>
    </div>
  );
}
