import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { useQueryStore } from '../store/query-store';

function isWideTextColumn(name: string): boolean {
  return /TEXT|DIGEST|QUERY|SQL|BODY|DESCRIPTION|JSON|URL|PATH/i.test(name);
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

function SortTh({
  label, colKey, title, sortCol, sortDir, onSort,
}: {
  label: string; colKey: string; title?: string;
  sortCol: string | null; sortDir: 'asc' | 'desc';
  onSort: (k: string) => void;
}) {
  const active = sortCol === colKey;
  return (
    <th
      title={title ? `${title} — click to sort` : 'click to sort'}
      className="text-left px-3 py-2.5 border-b border-par-purple/15 font-bold text-[11px] text-par-navy sticky top-0 z-[1] bg-[#ecebf7] cursor-pointer select-none hover:bg-[#e2e0f5] transition-colors"
      onClick={() => onSort(colKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          <span className="text-par-purple">{sortDir === 'asc' ? '▲' : '▼'}</span>
        ) : (
          <span className="text-par-navy/20 text-[9px]">⇅</span>
        )}
      </span>
    </th>
  );
}

export function ResultsGrid() {
  const [wrapCells, setWrapCells] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const lastColumns = useQueryStore((s) => s.lastColumns);
  const lastRows = useQueryStore((s) => s.lastRows);
  const lastMeta = useQueryStore((s) => s.lastMeta);
  const lastError = useQueryStore((s) => s.lastError);
  const explainPlan = useQueryStore((s) => s.explainPlan);
  const explainMs = useQueryStore((s) => s.explainMs);

  // Reset sort when a new query runs
  useEffect(() => { setSortCol(null); setSortDir('asc'); }, [lastColumns]);

  function handleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  }

  function copyCellValue(value: unknown, key: string) {
    const text = value === null || value === undefined ? '' : String(value);
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 900);
    });
  }

  const sortedRows = useMemo(() => {
    if (!sortCol) return lastRows;
    const colIdx = lastColumns.findIndex((c) => c.name === sortCol);
    if (colIdx === -1) return lastRows;
    return [...lastRows].sort((a, b) => {
      const av = a[colIdx], bv = b[colIdx];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const an = Number(av), bn = Number(bv);
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [lastRows, lastColumns, sortCol, sortDir]);

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

  if (explainPlan !== null) {
    const keys = explainPlan[0] ? Object.keys(explainPlan[0]) : [];
    const sortedExplain =
      sortCol && keys.includes(sortCol)
        ? [...explainPlan].sort((a, b) => {
            const av = a[sortCol], bv = b[sortCol];
            if (av === null || av === undefined) return 1;
            if (bv === null || bv === undefined) return -1;
            const an = Number(av), bn = Number(bv);
            if (!Number.isNaN(an) && !Number.isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an;
            return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
          })
        : explainPlan;

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
                    <SortTh key={k} label={k} colKey={k} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  ))}
                </tr>
              </thead>
              <tbody className="text-par-text">
                {sortedExplain.map((row, i) => (
                  <tr key={i} className="even:bg-[#f8f8fc] hover:bg-par-light-purple/20 transition-colors">
                    {keys.map((k) => {
                      const v = row[k];
                      const risky = explainCellRisk(k, v);
                      const cellKey = `e-${i}-${k}`;
                      const copied = copiedKey === cellKey;
                      return (
                        <td
                          key={k}
                          className={`px-3 py-2 align-top border-b border-par-light-purple/12 cursor-text select-text ${
                            copied ? 'bg-emerald-50' : ''
                          } ${
                            wrapCells ? 'whitespace-normal break-words max-w-[min(28rem,40vw)]' : 'max-w-[14rem] truncate'
                          } ${risky ? 'bg-orange-50/95 text-orange-950 font-semibold' : 'font-mono text-[11px]'}`}
                          title={copied ? 'Copied!' : (v === null || v === undefined ? '' : String(v))}
                          onClick={() => copyCellValue(v, cellKey)}
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
          <span className="font-bold">Rows affected:</span>{' '}
          <span className="font-mono font-bold">{lastMeta.rowsAffected ?? 0}</span>
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
      <div>
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
      <div className={tableShell}>
        <table className="results-data-table w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr>
              {lastColumns.map((c) => (
                <SortTh
                  key={c.name}
                  label={c.name}
                  colKey={c.name}
                  title={c.type}
                  sortCol={sortCol}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              ))}
            </tr>
          </thead>
          <tbody className="text-par-text">
            {sortedRows.map((row, ri) => (
              <tr key={ri} className="even:bg-[#f8f8fc] hover:bg-par-light-purple/20 transition-colors">
                {row.map((cell, ci) => {
                  const col = lastColumns[ci];
                  const wide = col ? isWideTextColumn(col.name) : false;
                  const wrap = wrapCells || wide;
                  const cellKey = `${ri}-${ci}`;
                  const copied = copiedKey === cellKey;
                  return (
                    <td
                      key={ci}
                      className={`px-3 py-2 align-top border-b border-par-light-purple/12 text-[11px] cursor-text select-text ${
                        copied ? 'bg-emerald-50' : ''
                      } ${
                        wrap
                          ? 'whitespace-normal break-words max-w-[min(32rem,48vw)] font-mono leading-snug'
                          : 'whitespace-nowrap max-w-[12rem] truncate font-mono'
                      }`}
                      title={copied ? 'Copied!' : (cell === null || cell === undefined ? 'NULL' : String(cell))}
                      onClick={() => copyCellValue(cell, cellKey)}
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
