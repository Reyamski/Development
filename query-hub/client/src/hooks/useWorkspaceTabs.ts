import { useCallback } from 'react';
import { teleportConnect, teleportDisconnect } from '../api/client';
import { useAppStore } from '../store/app-store';
import {
  useWorkspaceStore,
  type WorkspaceTabSnapshot,
} from '../store/workspace-store';

/**
 * Query Hub API keeps one MySQL session. Switching workspace tabs restores UI state
 * and reconnects the server to match the active tab (same or different instance).
 */
export async function reconnectServerForTab(tab: WorkspaceTabSnapshot): Promise<void> {
  if (!tab.connectionResult || !tab.selectedCluster || !tab.selectedInstance) {
    try {
      await teleportDisconnect();
    } catch {
      /* ignore */
    }
    useAppStore.getState().setConnectionResult(null);
    return;
  }

  useAppStore.getState().setConnecting(true);
  useAppStore.getState().setError('');
  try {
    try {
      await teleportDisconnect();
    } catch {
      /* ignore */
    }
    const result = await teleportConnect(tab.selectedCluster, tab.selectedInstance, '__ALL__');
    useAppStore.getState().setConnectionResult(result);
    const dbs = result.databases ?? [];
    const want = tab.selectedDatabase;
    if (want && dbs.includes(want)) {
      useAppStore.getState().setSelectedDatabase(want);
    } else if (dbs.length > 0) {
      useAppStore.getState().setSelectedDatabase(dbs[0]);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Reconnect failed';
    useAppStore.getState().setError(msg);
    useAppStore.getState().setConnectionResult(null);
  } finally {
    useAppStore.getState().setConnecting(false);
  }
}

export function useWorkspaceTabs() {
  const switchTab = useCallback(async (id: string) => {
    const ws = useWorkspaceStore.getState();
    if (id === ws.activeTabId) return;
    ws.captureActiveTabFromStores();
    ws.setActiveTabId(id);
    const tab = ws.tabs.find((t) => t.id === id);
    if (!tab) return;
    ws.restoreTabToStores(tab);
    await reconnectServerForTab(tab);
    ws.captureActiveTabFromStores();
  }, []);

  const addTab = useCallback(async (opts?: { clone?: boolean }) => {
    useWorkspaceStore.getState().addTab(opts);
    const ws = useWorkspaceStore.getState();
    const tab = ws.tabs.find((t) => t.id === ws.activeTabId);
    if (tab) {
      await reconnectServerForTab(tab);
      ws.captureActiveTabFromStores();
    }
  }, []);

  const removeTab = useCallback(async (id: string) => {
    const ws = useWorkspaceStore.getState();
    const wasActive = ws.activeTabId === id;
    ws.removeTab(id);
    if (wasActive) {
      const next = useWorkspaceStore.getState();
      const tab = next.tabs.find((t) => t.id === next.activeTabId);
      if (tab) {
        await reconnectServerForTab(tab);
        next.captureActiveTabFromStores();
      }
    }
  }, []);

  return { switchTab, addTab, removeTab };
}
