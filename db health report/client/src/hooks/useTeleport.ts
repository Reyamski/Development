import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../store/app-store';
import {
  teleportStatus, teleportClusters, teleportLoginStatus, teleportLogin, teleportInstances,
} from '../api/client';

export function useTeleport() {
  const store = useAppStore();
  const loginPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    teleportStatus()
      .then(({ available }) => store.setTshAvailable(available))
      .catch(() => store.setTshAvailable(false));
  }, []);

  useEffect(() => {
    teleportClusters()
      .then(({ clusters }) => store.setClusters(clusters))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      navigator.sendBeacon('/api/teleport/shutdown');
      stopLoginPolling();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      stopLoginPolling();
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
      } catch { /* ignore */ }
    }, 2000);
  }, []);

  const selectCluster = useCallback(async (cluster: string) => {
    stopLoginPolling();
    store.setSelectedCluster(cluster);
    if (!cluster) return;

    try {
      const status = await teleportLoginStatus(cluster);
      store.setLoginStatus(status);
      if (status.loggedIn) {
        const { instances } = await teleportInstances(cluster);
        store.setInstances(instances);
      }
    } catch { /* ignore */ }
  }, [store, stopLoginPolling]);

  const login = useCallback(async () => {
    if (!store.selectedCluster) return;
    try {
      await teleportLogin(store.selectedCluster);
      startLoginPolling();
    } catch { /* ignore */ }
  }, [store.selectedCluster, startLoginPolling]);

  useEffect(() => {
    if (store.loginStatus?.loggedIn && store.selectedCluster && store.instances.length === 0) {
      teleportInstances(store.selectedCluster)
        .then(({ instances }) => store.setInstances(instances))
        .catch(() => {});
    }
  }, [store.loginStatus?.loggedIn, store.selectedCluster]);

  return { selectCluster, login };
}
