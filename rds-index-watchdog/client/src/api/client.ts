import type { AnalysisResults } from '../store/app-store';

const API_BASE = '/api';

async function readApiJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<') || trimmed.startsWith('<!')) {
    throw new Error(
      'API returned a web page instead of JSON - the backend on port 3013 is probably not running.'
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('API response was not valid JSON.');
  }

  if (!response.ok) {
    const err = (data as { error?: string })?.error;
    throw new Error(err || `Request failed (${response.status} ${response.statusText})`);
  }

  return data as T;
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readApiJson<T>(response);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  return readApiJson<T>(response);
}

export const teleportStatus = () =>
  getJson<{ available: boolean; tshPath: string | null }>('/teleport/status');

export const teleportClusters = () =>
  getJson<{ clusters: string[] }>('/teleport/clusters');

export const teleportLoginStatus = (cluster?: string) => {
  const q = cluster ? `?cluster=${encodeURIComponent(cluster)}` : '';
  return getJson<{ loggedIn: boolean; username?: string }>(`/teleport/login-status${q}`);
};

export const teleportLogin = (cluster: string) =>
  postJson<{ started: boolean }>('/teleport/login', { cluster });

export const teleportInstances = (cluster: string) =>
  getJson<{ instances: unknown[] }>(`/teleport/instances?cluster=${encodeURIComponent(cluster)}`);

export const teleportDatabases = (cluster: string, instance: string) =>
  postJson<{ databases: string[] }>('/teleport/databases', { cluster, instance });

export const teleportConnect = (cluster: string, instance: string, database: string) =>
  postJson<{ connected: boolean; database: string; version: string; dbUser?: string }>(
    '/teleport/connect',
    { cluster, instance, database }
  );

export const teleportDisconnect = () =>
  postJson<{ disconnected: boolean }>('/teleport/disconnect', {});

export const runAnalysis = (database: string, instance: string) =>
  postJson<AnalysisResults>('/analysis/run', { database, instance });

export const confluenceStatus = () =>
  getJson<{ configured: boolean }>('/confluence/status');

export const exportToConfluence = (database: string, instance: string, results: object, accountName?: string) =>
  postJson<{ pageUrl: string; summaryPageUrl: string }>('/confluence/export', {
    database,
    instance,
    results,
    accountName,
  });
