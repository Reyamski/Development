const API_BASE = '/api';

async function readApiJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<') || trimmed.startsWith('<!')) {
    throw new Error(
      'API returned a web page instead of JSON - the backend on port 8020 is probably not running.'
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

export interface Baseline {
  characterSet: string;
  collation: string;
}

export interface CollationInfo {
  database: string;
  table: string | null;
  column: string | null;
  collation: string;
  characterSet: string;
  level: 'database' | 'table' | 'column';
}

export interface CollationIssue {
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  type: string;
  database: string;
  table?: string;
  column?: string;
  level: 'database' | 'table' | 'column';
  description: string;
  currentCollation: string;
  currentCharset: string;
  expectedCollation: string;
  expectedCharset: string;
}

export interface CollationReport {
  instance: string;
  databases: string[];
  baseline: Baseline;
  collations: CollationInfo[];
  issues: CollationIssue[];
  timestamp: string;
}

export const scanCollations = (
  instance: string,
  databases: string[],
  baseline: Baseline,
) => postJson<CollationReport>('/scan', { instance, databases, baseline });

export async function downloadCollationExcel(report: CollationReport): Promise<void> {
  const response = await fetch(`${API_BASE}/scan/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  });

  if (!response.ok) {
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      throw new Error(data.error || `Download failed (${response.status})`);
    } catch {
      throw new Error(`Download failed (${response.status})`);
    }
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] || `collations_${report.instance}.xlsx`;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
