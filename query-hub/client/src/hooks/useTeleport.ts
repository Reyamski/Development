import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../store/app-store';
import {
  teleportStatus,
  teleportClusters,
  teleportLoginStatus,
  teleportLogin,
  teleportInstances,
  teleportConnect,
  teleportDisconnect,
} from '../api/client';

export function useTeleport() {
  const store = useAppStore();
  const loginPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshClusters = useCallback(() => {
    teleportClusters()
      .then(({ clusters }) => {
        useAppStore.getState().setClusters(clusters);
        useAppStore.getState().setClustersLoadError('');
      })
      .catch((e) => {
        useAppStore.getState().setClustersLoadError(
          e instanceof Error
            ? e.message
            : 'Failed to load clusters — is the Query Hub API running (port 3003) and is /api proxied?',
        );
      });
  }, []);

  useEffect(() => {
    teleportStatus()
      .then(({ available }) => useAppStore.getState().setTshAvailable(available))
      .catch(() => useAppStore.getState().setTshAvailable(false));
  }, []);

  useEffect(() => {
    void refreshClusters();
  }, [refreshClusters]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      navigator.sendBeacon('/api/teleport/shutdown');
      if (loginPollRef.current) {
        clearInterval(loginPollRef.current);
        loginPollRef.current = null;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (loginPollRef.current) {
        clearInterval(loginPollRef.current);
        loginPollRef.current = null;
      }
    };
  }, []);

  const stopLoginPolling = useCallback(() => {
    if (loginPollRef.current) {
      clearInterval(loginPollRef.current);
      loginPollRef.current = null;
    }
  }, []);

  const startLoginPolling = useCallback(() => {
    if (loginPollRef.current) return;
    loginPollRef.current = setInterval(async () => {
      const cluster = useAppStore.getState().selectedCluster;
      if (!cluster) return;
      try {
        const status = await teleportLoginStatus(cluster);
        useAppStore.getState().setLoginStatus(status);
        if (status.loggedIn && loginPollRef.current) {
          clearInterval(loginPollRef.current);
          loginPollRef.current = null;
        }
      } catch {
        /* ignore */
      }
    }, 2000);
  }, []);

  const silentDisconnect = useCallback(async () => {
    if (useAppStore.getState().connectionResult) {
      try {
        await teleportDisconnect();
      } catch {
        /* ignore */
      }
      store.setConnectionResult(null);
    }
  }, [store]);

  const selectCluster = useCallback(
    async (cluster: string) => {
      stopLoginPolling();
      await silentDisconnect();
      store.setSelectedCluster(cluster);
      if (!cluster) return;
      try {
        const status = await teleportLoginStatus(cluster);
        store.setLoginStatus(status);
        if (status.loggedIn) {
          const { instances } = await teleportInstances(cluster);
          store.setInstances(instances);
        }
      } catch {
        /* ignore */
      }
    },
    [store, stopLoginPolling, silentDisconnect],
  );

  const login = useCallback(async () => {
    if (!store.selectedCluster) return;
    try {
      await teleportLogin(store.selectedCluster);
      startLoginPolling();
    } catch {
      /* ignore */
    }
  }, [store.selectedCluster, startLoginPolling]);

  useEffect(() => {
    const s = useAppStore.getState();
    if (s.loginStatus?.loggedIn && s.selectedCluster && s.instances.length === 0) {
      teleportInstances(s.selectedCluster)
        .then(({ instances }) => useAppStore.getState().setInstances(instances))
        .catch(() => {});
    }
  }, [store.loginStatus?.loggedIn, store.selectedCluster, store.instances.length]);

  const selectInstance = useCallback(
    async (instanceName: string) => {
      await silentDisconnect();
      store.setSelectedInstance(instanceName);
      if (!instanceName || !store.selectedCluster) return;
      store.setConnecting(true);
      store.setError('');
      try {
        const result = await teleportConnect(store.selectedCluster, instanceName, '__ALL__');
        store.setConnectionResult(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to connect';
        store.setError(message);
      } finally {
        store.setConnecting(false);
      }
    },
    [store, silentDisconnect],
  );

  return { selectCluster, login, selectInstance, refreshClusters };
}
