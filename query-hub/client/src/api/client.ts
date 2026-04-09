import type { TeleportInstance, TeleportStatus, ConnectionResult, QueryExecuteResult } from './types';

async function post<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function authEmailStatus(): Promise<{ enabled: boolean; hasJwtSecret: boolean }> {
  return get('/api/auth/email/status');
}

export function authEmailRequestCode(email: string): Promise<{ ok: boolean; message?: string }> {
  return post('/api/auth/email/request-code', { email });
}

export function authEmailVerify(email: string, code: string): Promise<{ token: string; email: string }> {
  return post('/api/auth/email/verify', { email, code });
}

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

export function teleportConnect(
  cluster: string,
  instance: string,
  database: string,
): Promise<ConnectionResult> {
  return post('/api/teleport/connect', { cluster, instance, database });
}

export function teleportDisconnect(): Promise<{ disconnected: boolean }> {
  return post('/api/teleport/disconnect', {});
}

export function queryExecute(body: {
  sql: string;
  database: string;
  rowLimit?: number;
  timeoutMs?: number;
}): Promise<QueryExecuteResult> {
  return post('/api/query/execute', body as Record<string, unknown>);
}

export function queryExplain(body: { sql: string; database: string }): Promise<{
  plan: Record<string, unknown>[];
  executionTimeMs: number;
}> {
  return post('/api/query/explain', body as Record<string, unknown>);
}

export function queryValidate(sql: string): Promise<{
  valid: boolean;
  blocked: boolean;
  blockedPattern?: string;
  reason?: string;
}> {
  return post('/api/query/validate', { sql });
}

export async function queryExportCsv(body: {
  sql: string;
  database: string;
  rowLimit?: number;
}): Promise<Blob> {
  const res = await fetch('/api/query/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Export failed: ${res.status}`);
  }
  return res.blob();
}

export function schemaDatabases(): Promise<{ databases: string[] }> {
  return get('/api/schema/databases');
}

export function schemaTables(db: string): Promise<{ tables: import('./types').SchemaTable[] }> {
  return get(`/api/schema/tables?db=${encodeURIComponent(db)}`);
}

export function schemaColumns(
  db: string,
  table: string,
): Promise<{ columns: import('./types').SchemaColumn[] }> {
  return get(
    `/api/schema/columns?db=${encodeURIComponent(db)}&table=${encodeURIComponent(table)}`,
  );
}

export function schemaRoutines(db: string): Promise<{ routines: import('./types').SchemaRoutine[] }> {
  return get(`/api/schema/routines?db=${encodeURIComponent(db)}`);
}

export function schemaEvents(db: string): Promise<{ events: import('./types').SchemaEvent[] }> {
  return get(`/api/schema/events?db=${encodeURIComponent(db)}`);
}

export function schemaForeignKeys(db: string): Promise<{ edges: import('./types').SchemaForeignKeyEdge[] }> {
  return get(`/api/schema/foreign-keys?db=${encodeURIComponent(db)}`);
}

export function schemaObjectDependencies(db: string): Promise<import('./types').SchemaObjectDependencies> {
  return get(`/api/schema/object-dependencies?db=${encodeURIComponent(db)}`);
}

export function schemaObjectDdl(
  db: string,
  name: string,
  kind: import('./types').SchemaDdlKind,
): Promise<{ ddl: string }> {
  return get(
    `/api/schema/ddl?db=${encodeURIComponent(db)}&name=${encodeURIComponent(name)}&kind=${encodeURIComponent(kind)}`,
  );
}

export function aiAsk(body: {
  message: string;
  database?: string;
  includeSchema?: boolean;
}): Promise<{ message: string; sqlSuggestion?: string; model?: string }> {
  return post('/api/ai/ask', body as Record<string, unknown>);
}

export function aiExplainSql(body: {
  sql: string;
  database?: string;
}): Promise<{ explanation: string; model?: string }> {
  return post('/api/ai/explain', body as Record<string, unknown>);
}

export function aiOptimizeSql(body: {
  sql: string;
  database?: string;
}): Promise<{ message: string; optimizedSql?: string; model?: string }> {
  return post('/api/ai/optimize', body as Record<string, unknown>);
}

export function aiGenerateSql(body: {
  prompt: string;
  database?: string;
}): Promise<{ message: string; sql?: string; model?: string }> {
  return post('/api/ai/generate', body as Record<string, unknown>);
}

export function aiAnalyzeContext(body: {
  mode: 'explain_plan' | 'result_sample';
  sql?: string;
  database?: string;
  explainPlan?: Record<string, unknown>[];
  columns?: string[];
  rows?: unknown[][];
}): Promise<{ explanation: string; model?: string }> {
  return post('/api/ai/analyze', body as Record<string, unknown>);
}
