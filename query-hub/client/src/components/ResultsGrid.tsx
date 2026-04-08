import { useState, useCallback, type ReactNode } from 'react';
import { useQueryStore } from '../store/query-store';

function isWideTextColumn(name: string): boolean {
  return /TEXT|DIGEST|QUERY|SQL|BODY|DESCRIPTION|JSON|URL|PATH|CREATE|DDL|DEFINITION/i.test(name);
}

function explainCellRisk(columnKey: string, val: unknown): boolean {
  const k = columnKey.toLowerCase();
  if (k === 'type' && String(val).toUpperCase() === 'ALL') return true;
  if (k === 'extra' && typeof val === 'string' && /filesort|temporary|full scan|impossible/i.test(val)) return true;
  if (k === 'rows' || k === 'filtered') {
    const n = Number(val);
    return Number.isFinite(n) && n > 50_000;
  }
  return false;
}

function formatCellPreview(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    try {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString();
    } catch {
      /* ignore */
    }
  }
  return s;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-par-text/40 mb-2 flex items-center gap-2">
      <span className="h-px flex-1 max-w-[2rem] bg-par-purple/20 rounded-full" aria-hidden />
      {children}
    </div>
  );
}

export function ResultsGrid() {
  const [wrapCells, setWrapCells] = useState(false);
  const [copied, setCopied] = useState(false);

  const lastColumns = useQueryStore((s) => s.lastColumns);
  const lastRows = useQueryStore((s) => s.lastRows);
  const lastMeta = useQueryStore((s) => s.lastMeta);
  const lastError = useQueryStore((s) => s.lastError);
  const explainPlan = useQueryStore((s) => s.explainPlan);
  const explainMs = useQueryStore((s) => s.explainMs);

  const handleCopyTsv = useCallback(() => {
    const headers = lastColumns.map((c) => c.name).join('\t');
    const rows = lastRows.map((row) =>
      row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))).join('\t'),
    );
    void navigator.clipboard.writeText([headers, ...rows].join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [lastColumns, lastRows]);

  if (lastError) {
    return (
      <div className="flex flex-1 flex-col min-h-0">
        <div className="rounded-2xl border border-red-200/90 bg-red-50/90 px-4 py-3.5 text-sm text-red-800 shadow-qh-sm font-medium leading-relaxed">
          {lastError}
        </div>
      </div>
    );
  }

  const tableShell =
    'results-table-scroll overflow-auto flex-1 min-h-0 rounded-xl border border-par-light-purple/40 bg-white always-show-scrollbar shadow-qh-sm';

  const thClass =
    'text-left px-3 py-2.5 border-b border-par-purple/15 font-bold text-[11px] text-par-navy sticky top-0 z-[1] bg-[#ecebf7]';

  if (explainPlan !== null) {
    const keys = explainPlan[0] ? Object.keys(explainPlan[0]) : [];
    return (
      <div className="flex flex-col flex-1 min-h-0 gap-3">
        <div>
          <SectionTitle>Results</SectionTitle>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-par-navy font-semibold">
            <span>EXPLAIN plan</span>
            {explainMs != null && <span className="text-xs font-medium text-par-text/45">({explainMs} ms)</span>}
          </div>
        </div>
        <div className={tableShell}>
          {keys.length === 0 ? (
            <p className="p-5 text-sm text-par-text/45 text-center font-medium">Empty plan</p>
          ) : (
            <table className="results-data-table w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  {keys.map((k) => (
                    <th key={k} className={thClass}>
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-par-text">
                {explainPlan.map((row, i) => (
                  <tr key={i} className="even:bg-[#f8f8fc] hover:bg-par-light-purple/20 transition-colors">
                    {keys.map((k) => {
                      const v = row[k];
                      const risky = explainCellRisk(k, v);
                      return (
                        <td
                          key={k}
                          className={`px-3 py-2 align-top border-b border-par-light-purple/12 ${
                            wrapCells ? 'whitespace-normal break-words max-w-[min(28rem,40vw)]' : 'max-w-[14rem] truncate'
                          } ${risky ? 'bg-orange-50/95 text-orange-950 font-semibold' : 'font-mono text-[11px]'}`}
                          title={v === null || v === undefined ? '' : String(v)}
                        >
                          {v === null || v === undefined ? (
                            <span className="text-par-text/35 italic font-sans font-normal">NULL</span>
                          ) : (
                            formatCellPreview(v)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <label className="inline-flex items-center gap-2 text-[11px] font-medium text-par-text/50 cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            checked={wrapCells}
            onChange={(e) => setWrapCells(e.target.checked)}
            className="rounded border-par-light-purple"
          />
          Wrap long cells
        </label>
      </div>
    );
  }

  if (lastMeta?.kind === 'mutate') {
    return (
      <div className="flex flex-1 flex-col min-h-0">
      <div className="rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 to-white px-4 py-3.5 text-sm text-emerald-900 shadow-qh-sm">
        <span className="font-bold">Rows affected:</span> <span className="font-mono font-bold">{lastMeta.rowsAffected ?? 0}</span>
        {lastMeta.executionTimeMs != null && (
          <span className="text-emerald-800/80 ml-2 text-xs font-semibold">· {lastMeta.executionTimeMs} ms</span>
        )}
      </div>
      </div>
    );
  }

  if (lastColumns.length === 0 && lastRows.length === 0) {
    return (
      <div className="flex flex-1 flex-col min-h-0 items-center justify-center py-8 px-4 text-center">
        <div className="rounded-2xl border border-dashed border-par-purple/25 bg-par-light-purple/15 px-6 py-8 max-w-xs">
          <p className="text-sm font-bold text-par-navy/80">No result set yet</p>
          <p className="text-xs text-par-text/45 mt-2 leading-relaxed">Run a query to show rows or an EXPLAIN plan here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <SectionTitle>Results</SectionTitle>
          <p className="text-sm text-par-navy font-semibold">
            <span className="text-par-text/50 font-bold text-xs uppercase tracking-wider mr-2">Dataset</span>
            {lastMeta?.rowCount ?? lastRows.length} rows
            {lastMeta?.truncated && <span className="text-par-orange ml-2 text-xs font-bold">· limited</span>}
            {lastMeta?.executionTimeMs != null && (
              <span className="text-par-text/45 ml-2 text-xs font-semibold">· {lastMeta.executionTimeMs} ms</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyTsv}
          className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-par-purple focus-visible:ring-offset-1 select-none
            border-par-light-purple/60 text-par-navy/70 bg-white hover:bg-par-light-purple/30 hover:border-par-purple/40
            data-[copied=true]:border-emerald-400/60 data-[copied=true]:text-emerald-700 data-[copied=true]:bg-emerald-50"
          data-copied={copied}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className={tableShell}>
        <table className="results-data-table w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr>
              {lastColumns.map((c) => (
                <th key={c.name} title={c.type} className={thClass}>
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-par-text">
            {lastRows.map((row, ri) => (
              <tr key={ri} className="even:bg-[#f8f8fc] hover:bg-par-light-purple/20 transition-colors">
                {row.map((cell, ci) => {
                  const col = lastColumns[ci];
                  const wide = col ? isWideTextColumn(col.name) : false;
                  const wrap = wrapCells || wide;
                  return (
                    <td
                      key={ci}
                      className={`px-3 py-2 align-top border-b border-par-light-purple/12 text-[11px] ${
                        wrap
                          ? 'whitespace-normal break-words max-w-[min(32rem,48vw)] font-mono leading-snug'
                          : 'whitespace-nowrap max-w-[12rem] truncate font-mono'
                      }`}
                      title={cell === null || cell === undefined ? '' : String(cell)}
                    >
                      {cell === null || cell === undefined ? (
                        <span className="text-par-text/35 italic font-sans">NULL</span>
                      ) : (
                        formatCellPreview(cell)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="inline-flex items-center gap-2 text-[11px] font-medium text-par-text/50 cursor-pointer select-none w-fit">
        <input type="checkbox" checked={wrapCells} onChange={(e) => setWrapCells(e.target.checked)} />
        Wrap all columns (wide text columns wrap by default)
      </label>
    </div>
  );
}
