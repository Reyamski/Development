import type { TeleportInstance, TeleportStatus, ConnectionResult, ReplicaStatus, ReplicationWorker, CloudWatchLagPoint, InvestigationData } from './types';

async function post<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ===== Teleport API =====

export function teleportStatus(): Promise<{ available: boolean; tshPath: string | null }> {
  return get('/api/teleport/status');
}

export function teleportClusters(): Promise<{ clusters: string[] }> {
  return get('/api/teleport/clusters');
}

export function teleportLoginStatus(cluster?: string): Promise<TeleportStatus> {
  const params = cluster ? `?cluster=${encodeURIComponent(cluster)}` : '';
  return get(`/api/teleport/login-status${params}`);
}

export function teleportLogin(cluster: string): Promise<{ started: boolean }> {
  return post('/api/teleport/login', { cluster });
}

export function teleportInstances(cluster: string): Promise<{ instances: TeleportInstance[] }> {
  return get(`/api/teleport/instances?cluster=${encodeURIComponent(cluster)}`);
}

export function teleportConnect(cluster: string, instance: string, database: string): Promise<ConnectionResult> {
  return post('/api/teleport/connect', { cluster, instance, database });
}

export function teleportDisconnect(): Promise<{ disconnected: boolean }> {
  return post('/api/teleport/disconnect', {});
}

// ===== Lag API =====

export function fetchReplicaStatus(): Promise<{ status: ReplicaStatus | null }> {
  return get('/api/lag/replica-status');
}

export function fetchReplicationWorkers(): Promise<{ workers: ReplicationWorker[] }> {
  return get('/api/lag/workers');
}

export function fetchCloudWatchLag(
  accountId: string, region: string, instanceId: string, since: string, until: string,
): Promise<{ cloudwatch: CloudWatchLagPoint[] }> {
  const params = new URLSearchParams({ accountId, region, instanceId, since, until });
  return get(`/api/lag/cloudwatch?${params.toString()}`);
}

export function fetchRdsConfig(accountId: string, region: string, instanceId: string): Promise<{
  provisionedIops: number;
  storageType: string;
  allocatedStorageGb: number;
  instanceClass: string;
  engine: string;
  engineVersion: string;
}> {
  const params = new URLSearchParams({ accountId, region, instanceId });
  return get(`/api/lag/rds-config?${params.toString()}`);
}

export function fetchInvestigation(since?: string, until?: string): Promise<InvestigationData> {
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  if (until) params.set('until', until);
  const query = params.toString();
  return get(`/api/lag/investigation${query ? `?${query}` : ''}`);
}

export function triggerAwsSsoLogin(accountId: string, region: string): Promise<{ started: boolean; profileName: string }> {
  return post('/api/lag/aws-sso-login', { accountId, region });
}
