import { useState } from 'react';
import { useAppStore } from '../store/app-store';
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

export function ResultsGrid() {
  const [wrapCells, setWrapCells] = useState(false);
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);
  const setAiPanelRequest = useQueryStore((s) => s.setAiPanelRequest);
  const autoAiAfterExplain = useQueryStore((s) => s.autoAiAfterExplain);
  const setAutoAiAfterExplain = useQueryStore((s) => s.setAutoAiAfterExplain);
  const editorSql = useQueryStore((s) => s.editorSql);

  const lastColumns = useQueryStore((s) => s.lastColumns);
  const lastRows = useQueryStore((s) => s.lastRows);
  const lastMeta = useQueryStore((s) => s.lastMeta);
  const lastError = useQueryStore((s) => s.lastError);
  const explainPlan = useQueryStore((s) => s.explainPlan);
  const explainMs = useQueryStore((s) => s.explainMs);

  const queueExplainPlanAi = () => {
    if (!explainPlan?.length) return;
    setAiPanelRequest({
      id: Date.now(),
      action: 'analyze_explain_plan',
      sql: editorSql,
      database: selectedDatabase || undefined,
      explainPlan,
    });
  };

  const queueResultsAi = () => {
    if (!lastColumns.length || !lastRows.length) return;
    const columns = lastColumns.map((c) => c.name);
    const maxRows = 25;
    setAiPanelRequest({
      id: Date.now(),
      action: 'analyze_results',
      sql: editorSql,
      database: selectedDatabase || undefined,
      columns,
      rows: lastRows.slice(0, maxRows),
    });
  };

  const queueExplainSqlAi = () => {
    const sql = editorSql.trim();
    if (!sql) return;
    setAiPanelRequest({
      id: Date.now(),
      action: 'explain_sql',
      sql: editorSql,
      database: selectedDatabase || undefined,
    });
  };

  if (lastError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{lastError}</div>
    );
  }

  const tableShell = 'results-table-scroll overflow-auto flex-1 min-h-[140px] max-h-[min(52vh,560px)] rounded-lg border border-par-light-purple/50 bg-white always-show-scrollbar shadow-sm';

  if (explainPlan !== null) {
    const keys = explainPlan[0] ? Object.keys(explainPlan[0]) : [];
    return (
      <div className="flex flex-col flex-1 min-h-0 gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-xs font-medium text-par-text">
            <span className="text-par-text/50 uppercase tracking-wider">Results</span>
            <span className="mx-2 text-par-text/30">·</span>
            <span>EXPLAIN plan</span>
            {explainMs != null && <span className="text-par-text/55 font-normal ml-1">({explainMs} ms)</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-par-text/65 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoAiAfterExplain}
                onChange={(e) => setAutoAiAfterExplain(e.target.checked)}
                className="rounded border-par-light-purple"
              />
              Auto AI after EXPLAIN
            </label>
            <button
              type="button"
              className="text-[11px] px-2.5 py-1 rounded-md bg-par-purple text-white font-medium hover:opacity-90"
              onClick={queueExplainPlanAi}
            >
              AI: Interpret plan
            </button>
          </div>
        </div>
        <div className={tableShell}>
          {keys.length === 0 ? (
            <p className="p-4 text-sm text-par-text/50">Empty plan</p>
          ) : (
            <table className="results-data-table w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  {keys.map((k) => (
                    <th
                      key={k}
                      className="text-left px-3 py-2.5 border-b border-par-purple/20 font-semibold text-par-navy sticky top-0 z-[1] bg-[#e1e0f7]"
                    >
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-par-text">
                {explainPlan.map((row, i) => (
                  <tr key={i} className="even:bg-[#f7f7fc] hover:bg-par-light-purple/25">
                    {keys.map((k) => {
                      const v = row[k];
                      const risky = explainCellRisk(k, v);
                      return (
                        <td
                          key={k}
                          className={`px-3 py-2 align-top border-b border-par-light-purple/15 ${
                            wrapCells ? 'whitespace-normal break-words max-w-[min(28rem,40vw)]' : 'max-w-[14rem] truncate'
                          } ${risky ? 'bg-orange-50/90 text-orange-950 font-medium' : 'font-mono text-[11px]'}`}
                          title={v === null || v === undefined ? '' : String(v)}
                        >
                          {v === null || v === undefined ? (
                            <span className="text-par-text/40 italic font-sans">NULL</span>
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
        <label className="flex items-center gap-2 text-[11px] text-par-text/60">
          <input type="checkbox" checked={wrapCells} onChange={(e) => setWrapCells(e.target.checked)} />
          Wrap long cells
        </label>
      </div>
    );
  }

  if (lastMeta?.kind === 'mutate') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Rows affected: <strong>{lastMeta.rowsAffected ?? 0}</strong>
        {lastMeta.executionTimeMs != null && (
          <span className="text-green-700 ml-2">· {lastMeta.executionTimeMs} ms</span>
        )}
      </div>
    );
  }

  if (lastColumns.length === 0 && lastRows.length === 0) {
    return (
      <div className="text-sm text-par-text/45 py-8 text-center">Run a query to see results here.</div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="text-xs font-medium text-par-text">
          <span className="text-par-text/50 uppercase tracking-wider">Results</span>
          <span className="mx-2 text-par-text/30">·</span>
          <span className="text-par-text/70 font-normal">
            {lastMeta?.rowCount ?? lastRows.length} rows
            {lastMeta?.truncated && <span className="text-par-orange ml-1">(limited)</span>}
            {lastMeta?.executionTimeMs != null && <span className="ml-1">· {lastMeta.executionTimeMs} ms</span>}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="text-[11px] px-2.5 py-1 rounded-md border border-par-purple/40 text-par-purple font-medium hover:bg-par-light-purple/30"
            onClick={queueResultsAi}
          >
            AI: Summarize sample
          </button>
          <button
            type="button"
            className="text-[11px] px-2.5 py-1 rounded-md border border-par-purple/40 text-par-purple font-medium hover:bg-par-light-purple/30"
            onClick={queueExplainSqlAi}
          >
            AI: Explain query
          </button>
        </div>
      </div>
      <div className={tableShell}>
        <table className="results-data-table w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr>
              {lastColumns.map((c) => (
                <th
                  key={c.name}
                  title={c.type}
                  className="text-left px-3 py-2.5 border-b border-par-purple/20 font-semibold text-par-navy sticky top-0 z-[1] bg-[#e1e0f7]"
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-par-text">
            {lastRows.map((row, ri) => (
              <tr key={ri} className="even:bg-[#f7f7fc] hover:bg-par-light-purple/25">
                {row.map((cell, ci) => {
                  const col = lastColumns[ci];
                  const wide = col ? isWideTextColumn(col.name) : false;
                  const wrap = wrapCells || wide;
                  return (
                    <td
                      key={ci}
                      className={`px-3 py-2 align-top border-b border-par-light-purple/15 text-[11px] ${
                        wrap
                          ? 'whitespace-normal break-words max-w-[min(32rem,48vw)] font-mono leading-snug'
                          : 'whitespace-nowrap max-w-[12rem] truncate font-mono'
                      }`}
                      title={cell === null || cell === undefined ? '' : String(cell)}
                    >
                      {cell === null || cell === undefined ? (
                        <span className="text-par-text/40 italic font-sans">NULL</span>
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
      <label className="flex items-center gap-2 text-[11px] text-par-text/60">
        <input type="checkbox" checked={wrapCells} onChange={(e) => setWrapCells(e.target.checked)} />
        Wrap all columns (wide SQL/text columns wrap by default)
      </label>
    </div>
  );
}
