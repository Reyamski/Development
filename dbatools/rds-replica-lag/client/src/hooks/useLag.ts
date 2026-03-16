import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../store/app-store';
import { fetchReplicaStatus, fetchReplicationWorkers, fetchCloudWatchLag, fetchRdsConfig, fetchInvestigation, fetchParameterGroup, fetchSourceCloudWatch } from '../api/client';

function isAwsAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('token has expired') ||
    m.includes('no valid aws sso session') ||
    m.includes('aws sso login') ||
    m.includes('retrieving token from sso') ||
    m.includes('expired and refresh failed')
  );
}

export function useLag() {
  const store = useAppStore();
  const rdsFetched = useRef(false);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const { connectionResult, timeRange } = useAppStore.getState();
    if (!connectionResult) return;

    const thisRequest = ++requestId.current;

    const { selectedInstance, instances } = useAppStore.getState();
    const instance = instances.find(i => i.name === selectedInstance);
    const hasAws = !!(instance?.accountId && instance?.region && instance?.instanceId);

    useAppStore.getState().setLagLoading(true);
    useAppStore.getState().setLagError('');
    useAppStore.getState().setAwsAuthRequired(false, '');

    try {
      // Always fetch live replica status + CloudWatch lag in parallel
      const cwPromise = hasAws
        ? fetchCloudWatchLag(instance!.accountId, instance!.region, instance!.instanceId, timeRange.since, timeRange.until)
        : Promise.resolve(null);

      const sourceId = useAppStore.getState().sourceInstanceId;
      const srcCwPromise = hasAws && sourceId
        ? fetchSourceCloudWatch(instance!.accountId, instance!.region, sourceId, timeRange.since, timeRange.until).catch(() => null)
        : Promise.resolve(null);

      const isInvestigating = timeRange.label === 'Custom';

      if (isInvestigating) {
        const [cwRes, statusRes, workersRes, investigationRes, srcCwRes] = await Promise.all([
          cwPromise,
          fetchReplicaStatus(),
          fetchReplicationWorkers(),
          fetchInvestigation(timeRange.since, timeRange.until).catch(() => null),
          srcCwPromise,
        ]);

        if (thisRequest !== requestId.current) return;

        if (cwRes) useAppStore.getState().setCloudwatchData(cwRes.cloudwatch);
        if (srcCwRes) useAppStore.getState().setSourceCloudwatchData(srcCwRes.sourceCloudwatch);
        useAppStore.getState().setReplicaStatus(statusRes.status);
        useAppStore.getState().setReplicationWorkers(workersRes.workers);
        useAppStore.getState().setInvestigationData(investigationRes);
      } else {
        const [cwRes, statusRes, investigationRes, srcCwRes] = await Promise.all([
          cwPromise,
          fetchReplicaStatus(),
          fetchInvestigation(timeRange.since, timeRange.until).catch(() => null),
          srcCwPromise,
        ]);

        if (thisRequest !== requestId.current) return;

        if (cwRes) useAppStore.getState().setCloudwatchData(cwRes.cloudwatch);
        if (srcCwRes) useAppStore.getState().setSourceCloudwatchData(srcCwRes.sourceCloudwatch);
        useAppStore.getState().setReplicaStatus(statusRes.status);
        useAppStore.getState().setReplicationWorkers([]);
        useAppStore.getState().setInvestigationData(investigationRes);
      }

      useAppStore.getState().setLastRefreshed(new Date());
    } catch (err: any) {
      if (thisRequest !== requestId.current) return;
      const msg = err.message || 'Failed to fetch lag data';
      useAppStore.getState().setLagError(msg);
      if (isAwsAuthError(msg)) {
        useAppStore.getState().setAwsAuthRequired(true, msg);
      }
    } finally {
      if (thisRequest === requestId.current) {
        useAppStore.getState().setLagLoading(false);
      }
    }
  }, []);

  // Auto-fetch RDS config on connect
  useEffect(() => {
    if (store.connectionResult && !rdsFetched.current) {
      rdsFetched.current = true;
      const { selectedInstance, instances } = useAppStore.getState();
      const instance = instances.find(i => i.name === selectedInstance);
      if (instance?.accountId && instance?.region && instance?.instanceId) {
        fetchRdsConfig(instance.accountId, instance.region, instance.instanceId)
          .then((config) => {
            useAppStore.getState().setRdsConfig({
              instanceClass: config.instanceClass,
              engine: config.engine,
              engineVersion: config.engineVersion,
              parameterGroupName: (config as any).parameterGroupName || null,
            });
            const sourceId = (config as any).readReplicaSource || null;
            if (sourceId) {
              useAppStore.getState().setSourceInstanceId(sourceId);
            }
            const pgName = (config as any).parameterGroupName;
            if (pgName && instance) {
              useAppStore.getState().setParameterGroupName(pgName);
              useAppStore.getState().setParameterGroupLoading(true);
              fetchParameterGroup(instance.accountId, instance.region, pgName)
                .then((pg) => {
                  useAppStore.getState().setParameterGroup(pg.parameters);
                })
                .catch((pgErr) => {
                  console.warn('Failed to fetch parameter group:', pgErr.message);
                })
                .finally(() => {
                  useAppStore.getState().setParameterGroupLoading(false);
                });
            }
          })
          .catch((err) => {
            console.warn('Failed to fetch RDS config from AWS:', err.message);
            if (isAwsAuthError(err.message || '')) {
              useAppStore.getState().setAwsAuthRequired(true, err.message || 'AWS authentication required');
            }
          });
      }
    }
    if (!store.connectionResult) {
      rdsFetched.current = false;
    }
  }, [store.connectionResult]);

  // Refresh when connected or time range changes
  useEffect(() => {
    if (store.connectionResult) {
      refresh();
    }
  }, [store.connectionResult, store.timeRange, refresh]);

  return { refresh };
}
