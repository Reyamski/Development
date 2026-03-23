import type {
  TeleportInstance, TeleportStatus, InstanceHealth, StackHealthSummary,
  HealthReport, ThresholdConfig, SchedulerConfig, TableSizeResult,
} from './types';

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

async function del<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ===== Teleport =====

export const teleportStatus = () => get<{ available: boolean; tshPath: string | null }>('/api/teleport/status');
export const teleportClusters = () => get<{ clusters: string[] }>('/api/teleport/clusters');
export const teleportLoginStatus = (cluster?: string) => {
  const params = cluster ? `?cluster=${encodeURIComponent(cluster)}` : '';
  return get<TeleportStatus>(`/api/teleport/login-status${params}`);
};
export const teleportLogin = (cluster: string) => post<{ started: boolean }>('/api/teleport/login', { cluster });
export const teleportInstances = (cluster: string) =>
  get<{ instances: TeleportInstance[] }>(`/api/teleport/instances?cluster=${encodeURIComponent(cluster)}`);

// ===== AWS SSO =====

export const awsSsoStatus = () => get<{ loggedIn: boolean }>('/api/aws/sso-status');
export const awsSsoLogin = (accountId: string, region: string) =>
  post<{ started: boolean; profileName: string }>('/api/aws/sso-login', { accountId, region });

// ===== Health =====

export const fetchGroupHealth = (
  instances: { instanceId: string; name: string; accountId: string; region: string }[],
  since: string, until: string,
) => post<{ instances: InstanceHealth[]; summary: StackHealthSummary }>('/api/health/check', { instances, since, until });

export const generateReport = (
  groupName: string,
  instances: { instanceId: string; name: string; accountId: string; region: string }[],
  since: string, until: string,
) => post<{ report: HealthReport; slackSent: boolean; slackError?: string }>('/api/health/generate-report', {
  groupName, instances, since, until,
});

// ===== Table Sizes =====

export const fetchTableSizes = (instances: { cluster: string; name: string }[]) =>
  post<{ tables: TableSizeResult[]; errors: { instance: string; error: string }[] }>('/api/table-sizes/fetch', { instances });

// ===== Settings =====

export const fetchThresholds = () => get<ThresholdConfig>('/api/settings/thresholds');
export const saveThresholds = (thresholds: Partial<ThresholdConfig>) =>
  post<ThresholdConfig>('/api/settings/thresholds', thresholds as any);

export const fetchSchedulerConfig = () => get<SchedulerConfig>('/api/settings/scheduler');
export const saveSchedulerConfig = (config: Partial<SchedulerConfig>) =>
  post<SchedulerConfig>('/api/settings/scheduler', config as any);
export const runSchedulerNow = () => post<{ ok: boolean }>('/api/settings/scheduler/run-now', {});

// ===== Reports =====

export const fetchReports = (stackId?: string, limit?: number) => {
  const params = new URLSearchParams();
  if (stackId) params.set('stackId', stackId);
  if (limit) params.set('limit', String(limit));
  return get<{ reports: HealthReport[] }>(`/api/settings/reports?${params}`);
};

export const fetchReport = (id: string) => get<HealthReport>(`/api/settings/reports/${id}`);
export const deleteReportApi = (id: string) => del<{ ok: boolean }>(`/api/settings/reports/${id}`);
