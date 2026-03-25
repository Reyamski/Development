import { create } from 'zustand';
import type { ConnectionResult, TeleportInstance, TeleportStatus, ColumnMeta } from '../api/types';
import type { HistoryEntry } from './query-store';
import { useAppStore } from './app-store';
import { useQueryStore } from './query-store';

export interface WorkspaceTabSnapshot {
  id: string;
  label: string;
  selectedCluster: string;
  loginStatus: TeleportStatus | null;
  instances: TeleportInstance[];
  selectedInstance: string;
  connectionResult: ConnectionResult | null;
  selectedDatabase: string;
  error: string;
  editorSql: string;
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
  explainPlan: Record<string, unknown>[] | null;
  explainMs: number | null;
  history: HistoryEntry[];
}

function tabId() {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyTabSnapshot(label: string): WorkspaceTabSnapshot {
  return {
    id: tabId(),
    label,
    selectedCluster: '',
    loginStatus: null,
    instances: [],
    selectedInstance: '',
    connectionResult: null,
    selectedDatabase: '',
    error: '',
    editorSql: '-- Write SQL here. Ctrl+Enter to run.\nSELECT 1 AS one;',
    lastColumns: [],
    lastRows: [],
    lastMeta: null,
    lastError: null,
    explainPlan: null,
    explainMs: null,
    history: [],
  };
}

function snapshotFromStores(targetTabId: string, label: string): WorkspaceTabSnapshot {
  const app = useAppStore.getState();
  const q = useQueryStore.getState();
  return {
    id: targetTabId,
    label,
    selectedCluster: app.selectedCluster,
    loginStatus: app.loginStatus,
    instances: app.instances,
    selectedInstance: app.selectedInstance,
    connectionResult: app.connectionResult,
    selectedDatabase: app.selectedDatabase,
    error: app.error,
    editorSql: q.editorSql,
    lastColumns: q.lastColumns,
    lastRows: q.lastRows,
    lastMeta: q.lastMeta,
    lastError: q.lastError,
    explainPlan: q.explainPlan,
    explainMs: q.explainMs,
    history: q.history,
  };
}

function applySnapshotToStores(tab: WorkspaceTabSnapshot) {
  useAppStore.setState({
    selectedCluster: tab.selectedCluster,
    loginStatus: tab.loginStatus,
    instances: tab.instances,
    selectedInstance: tab.selectedInstance,
    connectionResult: tab.connectionResult,
    selectedDatabase: tab.selectedDatabase,
    error: tab.error,
    connecting: false,
  });
  useQueryStore.setState({
    editorSql: tab.editorSql,
    lastColumns: tab.lastColumns,
    lastRows: tab.lastRows,
    lastMeta: tab.lastMeta,
    lastError: tab.lastError,
    explainPlan: tab.explainPlan,
    explainMs: tab.explainMs,
    history: tab.history,
    executing: false,
    explainLoading: false,
  });
}

const firstTab = createEmptyTabSnapshot('Workspace 1');

interface WorkspaceState {
  tabs: WorkspaceTabSnapshot[];
  activeTabId: string;
  captureActiveTabFromStores: () => void;
  restoreTabToStores: (tab: WorkspaceTabSnapshot) => void;
  setActiveTabId: (id: string) => void;
  addTab: (opts?: { clone?: boolean }) => void;
  removeTab: (id: string) => void;
  renameActiveTab: (label: string) => void;
  /** Merge first tab from current stores (run once on mount for persisted query-store). */
  bootstrapFromStores: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  tabs: [firstTab],
  activeTabId: firstTab.id,

  captureActiveTabFromStores: () => {
    const { activeTabId, tabs } = get();
    const prev = tabs.find((t) => t.id === activeTabId);
    const label = prev?.label ?? 'Workspace';
    const snap = snapshotFromStores(activeTabId, label);
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === activeTabId ? snap : t)) }));
  },

  restoreTabToStores: (tab) => {
    applySnapshotToStores(tab);
  },

  setActiveTabId: (id) => set({ activeTabId: id }),

  addTab: (opts) => {
    get().captureActiveTabFromStores();
    const n = get().tabs.length + 1;
    const label = `Workspace ${n}`;
    let next: WorkspaceTabSnapshot;
    if (opts?.clone) {
      const cur = get().tabs.find((t) => t.id === get().activeTabId);
      if (cur) {
        next = {
          ...structuredClone(cur),
          id: tabId(),
          label,
        };
      } else {
        next = createEmptyTabSnapshot(label);
      }
    } else {
      next = createEmptyTabSnapshot(label);
    }
    set((s) => ({ tabs: [...s.tabs, next], activeTabId: next.id }));
    applySnapshotToStores(next);
  },

  removeTab: (id) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return;
    const closingActive = activeTabId === id;
    if (closingActive) get().captureActiveTabFromStores();
    const nextTabs = tabs.filter((t) => t.id !== id);
    let nextActiveId = activeTabId;
    if (closingActive) {
      const idx = tabs.findIndex((t) => t.id === id);
      const fallback = nextTabs[Math.max(0, idx - 1)] ?? nextTabs[0];
      nextActiveId = fallback.id;
    }
    set({ tabs: nextTabs, activeTabId: nextActiveId });
    if (closingActive) {
      const t = nextTabs.find((x) => x.id === nextActiveId);
      if (t) applySnapshotToStores(t);
    }
  },

  renameActiveTab: (label) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === s.activeTabId ? { ...t, label } : t)),
    })),

  bootstrapFromStores: () => {
    const { activeTabId } = get();
    const snap = snapshotFromStores(activeTabId, 'Workspace 1');
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === activeTabId ? { ...snap, label: t.label } : t)) }));
  },
}));
