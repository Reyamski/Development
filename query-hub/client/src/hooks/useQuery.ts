import { useCallback } from 'react';
import { useAppStore } from '../store/app-store';
import { useQueryStore } from '../store/query-store';
import { queryExecute, queryExplain, queryExportCsv } from '../api/client';

export function useQueryActions() {
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);

  const run = useCallback(async () => {
    const sql = useQueryStore.getState().editorSql;
    const db = useAppStore.getState().selectedDatabase;
    const { rowLimit, timeoutMs, pushHistory, setExecuting, setSelectResult, setMutateResult, setError } =
      useQueryStore.getState();

    if (!db) {
      setError('Select a database first');
      return;
    }
    const trimmed = sql.trim();
    if (!trimmed) {
      setError('SQL is empty');
      return;
    }

    setExecuting(true);
    setError(null);
    try {
      const result = await queryExecute({ sql, database: db, rowLimit, timeoutMs });
      if (result.kind === 'select') {
        setSelectResult(result.columns, result.rows, {
          rowCount: result.rowCount,
          executionTimeMs: result.executionTimeMs,
          truncated: result.truncated,
        });
        pushHistory({
          sql: trimmed,
          database: db,
          ts: Date.now(),
          status: 'success',
          rowCount: result.rowCount,
          executionTimeMs: result.executionTimeMs,
        });
      } else {
        setMutateResult(result.rowsAffected, result.executionTimeMs, result.insertId);
        pushHistory({
          sql: trimmed,
          database: db,
          ts: Date.now(),
          status: 'success',
          rowCount: result.rowsAffected,
          executionTimeMs: result.executionTimeMs,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Query failed';
      setError(msg);
      pushHistory({
        sql: trimmed,
        database: db,
        ts: Date.now(),
        status: 'error',
        error: msg,
      });
    } finally {
      setExecuting(false);
    }
  }, []);

  const explain = useCallback(async () => {
    const sql = useQueryStore.getState().editorSql;
    const db = useAppStore.getState().selectedDatabase;
    const { setExplainLoading, setExplainPlan, setError } = useQueryStore.getState();
    if (!db) {
      setError('Select a database first');
      return;
    }
    setExplainLoading(true);
    setError(null);
    try {
      const { plan, executionTimeMs } = await queryExplain({ sql, database: db });
      setExplainPlan(plan, executionTimeMs);
      const qs = useQueryStore.getState();
      if (qs.autoAiAfterExplain && plan.length > 0) {
        qs.setAiPanelRequest({
          id: Date.now(),
          action: 'analyze_explain_plan',
          sql,
          database: db,
          explainPlan: plan,
        });
      }
    } catch (e) {
      useQueryStore.getState().setExplainPlan(null, null);
      setError(e instanceof Error ? e.message : 'EXPLAIN failed');
    } finally {
      setExplainLoading(false);
    }
  }, []);

  const exportCsv = useCallback(async () => {
    const sql = useQueryStore.getState().editorSql;
    const db = useAppStore.getState().selectedDatabase;
    if (!db) {
      useQueryStore.getState().setError('Select a database first');
      return;
    }
    try {
      const blob = await queryExportCsv({ sql, database: db, rowLimit: 50_000 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `query-hub-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      useQueryStore.getState().setError(e instanceof Error ? e.message : 'Export failed');
    }
  }, []);

  return { run, explain, exportCsv, selectedDatabase };
}
