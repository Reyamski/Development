import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ColumnMeta } from '../api/types';

const MAX_HISTORY = 500;

export interface HistoryEntry {
  id: string;
  sql: string;
  database: string;
  ts: number;
  status: 'success' | 'error';
  rowCount?: number;
  executionTimeMs?: number;
  error?: string;
}

export interface SavedQuery {
  id: string;
  title: string;
  sql: string;
  database: string;
  createdAt: number;
}

/** Opens AI panel + runs one-shot analysis (see AiAssistant). */
export type AiPanelRequest =
  | {
      id: number;
      action: 'analyze_explain_plan';
      sql: string;
      database?: string;
      explainPlan: Record<string, unknown>[];
    }
  | {
      id: number;
      action: 'analyze_results';
      sql: string;
      database?: string;
      columns: string[];
      rows: unknown[][];
    }
  | {
      id: number;
      action: 'explain_sql';
      sql: string;
      database?: string;
    };

interface QueryState {
  editorSql: string;
  rowLimit: number;
  timeoutMs: number;
  lastColumns: ColumnMeta[];
  lastRows: unknown[][];
  lastMeta: {
    rowCount: number;
    executionTimeMs: number;
    truncated: boolean;
    kind: 'select' | 'mutate';
    rowsAffected?: number;
  } | null;
  lastError: string | null;
  /** Non-null means show EXPLAIN grid (even if empty array). */
  explainPlan: Record<string, unknown>[] | null;
  explainMs: number | null;
  history: HistoryEntry[];
  savedQueries: SavedQuery[];
  executing: boolean;
  explainLoading: boolean;
  historyTab: 'history' | 'saved';
  aiPanelRequest: AiPanelRequest | null;
  /** When true, successful EXPLAIN queues AI analysis automatically */
  autoAiAfterExplain: boolean;

  setEditorSql: (s: string) => void;
  setHistoryTab: (t: 'history' | 'saved') => void;
  setRowLimit: (n: number) => void;
  setTimeoutMs: (n: number) => void;
  setExecuting: (v: boolean) => void;
  setExplainLoading: (v: boolean) => void;
  setSelectResult: (
    columns: ColumnMeta[],
    rows: unknown[][],
    meta: { rowCount: number; executionTimeMs: number; truncated: boolean },
  ) => void;
  setMutateResult: (rowsAffected: number, executionTimeMs: number, insertId?: number) => void;
  setError: (msg: string | null) => void;
  setExplainPlan: (plan: Record<string, unknown>[] | null, ms: number | null) => void;
  clearResults: () => void;
  pushHistory: (entry: Omit<HistoryEntry, 'id'> & { id?: string }) => void;
  removeSaved: (id: string) => void;
  saveCurrent: (title: string, database: string) => void;
  setAiPanelRequest: (r: AiPanelRequest | null) => void;
  setAutoAiAfterExplain: (v: boolean) => void;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useQueryStore = create<QueryState>()(
  persist(
    (set, get) => ({
      editorSql: '-- Write SQL here. Ctrl+Enter to run.\nSELECT 1 AS one;',
      rowLimit: 1000,
      timeoutMs: 30_000,
      lastColumns: [],
      lastRows: [],
      lastMeta: null,
      lastError: null,
      explainPlan: null,
      explainMs: null,
      history: [],
      savedQueries: [],
      executing: false,
      explainLoading: false,
      historyTab: 'history',
      aiPanelRequest: null,
      autoAiAfterExplain: false,

      setEditorSql: (editorSql) => set({ editorSql }),
      setAiPanelRequest: (aiPanelRequest) => set({ aiPanelRequest }),
      setAutoAiAfterExplain: (autoAiAfterExplain) => set({ autoAiAfterExplain }),
      setHistoryTab: (historyTab) => set({ historyTab }),
      setRowLimit: (rowLimit) => set({ rowLimit }),
      setTimeoutMs: (timeoutMs) => set({ timeoutMs }),
      setExecuting: (executing) => set({ executing }),
      setExplainLoading: (explainLoading) => set({ explainLoading }),

      setSelectResult: (lastColumns, lastRows, meta) =>
        set({
          lastColumns,
          lastRows,
          lastMeta: { ...meta, kind: 'select' as const },
          lastError: null,
          explainPlan: null,
          explainMs: null,
        }),

      setMutateResult: (rowsAffected, executionTimeMs) =>
        set({
          lastColumns: [],
          lastRows: [],
          lastMeta: { rowCount: 0, executionTimeMs, truncated: false, kind: 'mutate', rowsAffected },
          lastError: null,
          explainPlan: null,
          explainMs: null,
        }),

      setError: (lastError) =>
        set({
          lastError,
          lastColumns: [],
          lastRows: [],
          lastMeta: null,
          explainPlan: null,
          explainMs: null,
        }),

      setExplainPlan: (explainPlan, explainMs) =>
        set({
          explainPlan,
          explainMs,
          lastColumns: [],
          lastRows: [],
          lastMeta: null,
          lastError: null,
        }),

      clearResults: () =>
        set({
          lastColumns: [],
          lastRows: [],
          lastMeta: null,
          lastError: null,
          explainPlan: null,
          explainMs: null,
        }),

      pushHistory: (entry) =>
        set((state) => {
          const id = entry.id ?? uid();
          const next: HistoryEntry = {
            id,
            sql: entry.sql,
            database: entry.database,
            ts: entry.ts,
            status: entry.status,
            rowCount: entry.rowCount,
            executionTimeMs: entry.executionTimeMs,
            error: entry.error,
          };
          const history = [next, ...state.history].slice(0, MAX_HISTORY);
          return { history };
        }),

      removeSaved: (id) =>
        set((state) => ({ savedQueries: state.savedQueries.filter((s) => s.id !== id) })),

      saveCurrent: (title, database) =>
        set((state) => ({
          savedQueries: [
            {
              id: uid(),
              title,
              sql: state.editorSql,
              database,
              createdAt: Date.now(),
            },
            ...state.savedQueries,
          ].slice(0, 200),
        })),
    }),
    {
      name: 'query-hub:store',
      partialize: (s) => ({
        editorSql: s.editorSql,
        rowLimit: s.rowLimit,
        timeoutMs: s.timeoutMs,
        history: s.history,
        savedQueries: s.savedQueries,
        autoAiAfterExplain: s.autoAiAfterExplain,
      }),
    },
  ),
);
