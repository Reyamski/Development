import { useEffect, useState } from 'react';
import { confluenceStatus, exportToConfluence } from '../api/client';
import type {
  AnalysisResults,
  MissingIndexFinding,
  UnusedIndexFinding,
  DuplicateIndexFinding,
  OverlappingIndexFinding,
  BloatRiskFinding,
} from '../store/app-store';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={copy}
      className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
    >
      {copied ? 'Copied' : 'Copy SQL'}
    </button>
  );
}

function SeverityBadge({ severity }: { severity: 'warning' | 'info' }) {
  return severity === 'warning' ? (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
      Warning
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
      Info
    </span>
  );
}

function FindingCard({
  severity,
  title,
  subtitle,
  explanation,
  sql,
}: {
  severity: 'warning' | 'info';
  title: string;
  subtitle?: string;
  explanation: string;
  sql?: string;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3.5 ${severity === 'warning' ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <SeverityBadge severity={severity} />
            <span className="truncate text-sm font-bold text-slate-800">{title}</span>
          </div>
          {subtitle && <p className="mb-2 font-mono text-[11px] text-slate-500">{subtitle}</p>}
          <p className="text-xs leading-relaxed text-slate-600">{explanation}</p>
          {sql && (
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
                {sql}
              </code>
              <CopyButton text={sql} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-600">
        OK
      </div>
      <p className="font-semibold text-slate-700">{message}</p>
    </div>
  );
}

type TabId = 'missing' | 'unused' | 'duplicate' | 'overlapping' | 'bloat';

export function ResultsPanel({
  results,
  instance,
  onReanalyze,
}: {
  results: AnalysisResults;
  instance: string;
  onReanalyze: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('missing');
  const [isConfluenceConfigured, setIsConfluenceConfigured] = useState(false);
  const [isCheckingConfluence, setIsCheckingConfluence] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportLinks, setExportLinks] = useState<{ pageUrl: string; summaryPageUrl: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsCheckingConfluence(true);
    setExportError(null);

    void confluenceStatus()
      .then(({ configured }) => {
        if (!cancelled) {
          setIsConfluenceConfigured(configured);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setIsConfluenceConfigured(false);
          setExportError(error instanceof Error ? error.message : 'Failed to check Confluence status');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingConfluence(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setExportLinks(null);
    setExportError(null);
  }, [results.analyzedAt, results.database, instance]);

  const total =
    results.missingIndexes.length +
    results.unusedIndexes.length +
    results.duplicateIndexes.length +
    results.overlappingIndexes.length +
    results.bloatRiskTables.length;

  const warnings = [
    ...results.missingIndexes,
    ...results.unusedIndexes,
    ...results.duplicateIndexes,
    ...results.overlappingIndexes,
    ...results.bloatRiskTables,
  ].filter((f) => f.severity === 'warning').length;

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'missing', label: 'Missing', count: results.missingIndexes.length },
    { id: 'unused', label: 'Unused', count: results.unusedIndexes.length },
    { id: 'duplicate', label: 'Duplicate', count: results.duplicateIndexes.length },
    { id: 'overlapping', label: 'Overlapping', count: results.overlappingIndexes.length },
    { id: 'bloat', label: 'Bloat Risk', count: results.bloatRiskTables.length },
  ];

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);
    setExportLinks(null);

    try {
      const accountName = instance.split('-rds-')[0] || instance.split('-')[0];
      const links = await exportToConfluence(results.database, instance, results, accountName);
      setExportLinks(links);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-800">
              {total === 0 ? 'No issues found' : `${total} finding${total !== 1 ? 's' : ''}`}
              {warnings > 0 && <span className="ml-2 text-amber-600">- {warnings} warning{warnings !== 1 ? 's' : ''}</span>}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {results.database} - {new Date(results.analyzedAt).toLocaleString()}
              {' - '}
              <span className="font-medium text-slate-500">
                Missing {results.missingIndexes.length} - Unused {results.unusedIndexes.length} - Duplicate {results.duplicateIndexes.length} - Overlap {results.overlappingIndexes.length} - Bloat {results.bloatRiskTables.length}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onReanalyze}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Re-analyze
            </button>
            <button
              onClick={handleExport}
              disabled={!isConfluenceConfigured || isCheckingConfluence || isExporting}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
            >
              {isCheckingConfluence ? 'Checking Confluence...' : isExporting ? 'Exporting...' : 'Export to Confluence'}
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {isCheckingConfluence && <p>Checking whether Confluence export is configured...</p>}
          {!isCheckingConfluence && !isConfluenceConfigured && !exportError && (
            <p>Confluence export is not configured yet. Add the `CONFLUENCE_*` values in `.env` to enable it.</p>
          )}
          {exportError && <p className="text-red-600">{exportError}</p>}
          {exportLinks && (
            <p>
              Export complete.{' '}
              <a className="font-semibold text-violet-700 hover:text-violet-800" href={exportLinks.pageUrl} target="_blank" rel="noreferrer">
                Open report
              </a>
              {' - '}
              <a className="font-semibold text-violet-700 hover:text-violet-800" href={exportLinks.summaryPageUrl} target="_blank" rel="noreferrer">
                Open summary page
              </a>
            </p>
          )}
          {!isCheckingConfluence && isConfluenceConfigured && !exportError && !exportLinks && (
            <p>Export saves this result set as a dated child page under the shared Confluence summary page.</p>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1 border-b border-slate-200 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative -mb-px rounded-t-lg border border-b-0 px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'border-slate-200 bg-white text-violet-700'
                : 'border-transparent bg-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTab === tab.id ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
        {activeTab === 'missing' &&
          (results.missingIndexes.length === 0 ? (
            <EmptyState message="No missing index candidates found" />
          ) : (
            results.missingIndexes.map((f: MissingIndexFinding, i: number) => (
              <FindingCard
                key={i}
                severity={f.severity}
                title={f.table}
                subtitle={`${f.rowsExamined.toLocaleString()} rows examined - ${f.execCount.toLocaleString()} executions`}
                explanation={f.explanation}
              />
            ))
          ))}

        {activeTab === 'unused' &&
          (results.unusedIndexes.length === 0 ? (
            <EmptyState message="No unused indexes found" />
          ) : (
            results.unusedIndexes.map((f: UnusedIndexFinding, i: number) => (
              <FindingCard
                key={i}
                severity={f.severity}
                title={`${f.table} - ${f.indexName}`}
                subtitle={`(${f.columns.join(', ')}) - ${f.writeCount.toLocaleString()} writes`}
                explanation={f.explanation}
                sql={f.suggestedSql}
              />
            ))
          ))}

        {activeTab === 'duplicate' &&
          (results.duplicateIndexes.length === 0 ? (
            <EmptyState message="No duplicate indexes found" />
          ) : (
            results.duplicateIndexes.map((f: DuplicateIndexFinding, i: number) => (
              <FindingCard
                key={i}
                severity={f.severity}
                title={`${f.table} - ${f.indexName}`}
                subtitle={`Duplicates: ${f.duplicateOf} - columns: (${f.columns.join(', ')})`}
                explanation={f.explanation}
                sql={f.suggestedSql}
              />
            ))
          ))}

        {activeTab === 'overlapping' &&
          (results.overlappingIndexes.length === 0 ? (
            <EmptyState message="No overlapping indexes found" />
          ) : (
            results.overlappingIndexes.map((f: OverlappingIndexFinding, i: number) => (
              <FindingCard
                key={i}
                severity={f.severity}
                title={`${f.table} - ${f.redundantIndex}`}
                subtitle={`Covered by: ${f.coveringIndex} (${f.coveringColumns.join(', ')})`}
                explanation={f.explanation}
                sql={f.suggestedSql}
              />
            ))
          ))}

        {activeTab === 'bloat' &&
          (results.bloatRiskTables.length === 0 ? (
            <EmptyState message="No high-write bloat risk tables found" />
          ) : (
            results.bloatRiskTables.map((f: BloatRiskFinding, i: number) => (
              <FindingCard
                key={i}
                severity={f.severity}
                title={f.table}
                subtitle={`${f.indexCount} indexes - ${f.totalWrites.toLocaleString()} total writes`}
                explanation={f.explanation}
              />
            ))
          ))}
      </div>
    </div>
  );
}
