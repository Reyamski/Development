import { useCallback } from 'react';
import { useAppStore, groupInstances } from '../store/app-store';
import { fetchGroupHealth, generateReport } from '../api/client';

export function useHealth() {
  const store = useAppStore();

  const loadHealth = useCallback(async (groupId: string) => {
    const { instances } = useAppStore.getState();
    const groups = groupInstances(instances);
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    store.setHealthLoading(true);
    store.setHealthError('');

    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const until = now.toISOString();

    const payload = group.instances.map(i => ({
      instanceId: i.instanceId, name: i.name, accountId: i.accountId, region: i.region,
    }));

    try {
      const data = await fetchGroupHealth(payload, since, until);
      store.setHealthData(data.instances, data.summary);
    } catch (err: any) {
      store.setHealthError(err.message || 'Failed to load health data');
    } finally {
      store.setHealthLoading(false);
    }
  }, [store]);

  const generateAndSendReport = useCallback(async (groupId: string) => {
    const { instances } = useAppStore.getState();
    const groups = groupInstances(instances);
    const group = groups.find(g => g.id === groupId);
    if (!group) return null;

    store.setHealthLoading(true);
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const until = now.toISOString();

    const payload = group.instances.map(i => ({
      instanceId: i.instanceId, name: i.name, accountId: i.accountId, region: i.region,
    }));

    try {
      const result = await generateReport(group.name, payload, since, until);
      store.setHealthData(result.report.instances, result.report.summary);
      return result;
    } catch (err: any) {
      store.setHealthError(err.message || 'Failed to generate report');
      return null;
    } finally {
      store.setHealthLoading(false);
    }
  }, [store]);

  return { loadHealth, generateAndSendReport };
}
