import type {
  CompareResponse,
  ComparisonResult,
  ValidatePathResponse,
  GenerateRequest,
  GenerateResponse,
  BrowseResponse,
  SlackConfig,
  SlackResponse,
  ConfluenceConfig,
  ConfluenceResponse,
  SchemaContext,
  OutputFilter,
  SecretsConfig,
  SecretsTestResponse,
  TeleportStatus,
  TeleportDatabase,
  DumpStartRequest,
  DumpStartResponse,
  S3SyncResponse,
} from './types';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function validatePath(path: string): Promise<ValidatePathResponse> {
  return fetchJson('/api/validate-path', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

export interface CompareOptions {
  ignoreFkNameOnly?: boolean;
  ignoreIndexNameOnly?: boolean;
  ignoreCollate?: boolean;
  ignoreCharset?: boolean;
  ignoreWhitespace?: boolean;
}

export async function syncS3Path(s3Path: string): Promise<S3SyncResponse> {
  return fetchJson('/api/compare/sync-s3', {
    method: 'POST',
    body: JSON.stringify({ s3Path }),
  });
}

export async function compare(
  sourcePath: string,
  targetPath: string,
  options?: CompareOptions
): Promise<CompareResponse> {
  return fetchJson('/api/compare', {
    method: 'POST',
    body: JSON.stringify({ sourcePath, targetPath, ...options }),
  });
}

export async function generate(req: GenerateRequest): Promise<GenerateResponse> {
  return fetchJson('/api/generate', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function browse(path?: string): Promise<BrowseResponse> {
  return fetchJson('/api/browse', {
    method: 'POST',
    body: JSON.stringify({ path: path || '' }),
  });
}

export async function preview(result: ComparisonResult): Promise<{ sql: string }> {
  return fetchJson('/api/generate/preview', {
    method: 'POST',
    body: JSON.stringify({ result }),
  });
}

export async function testSecret(req: SecretsConfig): Promise<SecretsTestResponse> {
  const params = new URLSearchParams({
    secretName: req.secretName,
    region: req.region,
    ...(req.profile ? { profile: req.profile } : {}),
  });
  return fetchJson(`/api/integrations/secrets-test?${params.toString()}`);
}

export async function sendToSlack(req: {
  config?: SlackConfig;
  secrets?: SecretsConfig;
  results: ComparisonResult[];
  summary: CompareResponse['summary'];
  schemaContext?: SchemaContext;
  targetPath?: string;
  filter?: OutputFilter;
  confluencePageUrl?: string;
}): Promise<SlackResponse> {
  return fetchJson('/api/integrations/slack', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function publishToConfluence(req: {
  config?: ConfluenceConfig;
  secrets?: SecretsConfig;
  results: ComparisonResult[];
  summary: CompareResponse['summary'];
  schemaContext?: SchemaContext;
  targetPath?: string;
  filter?: OutputFilter;
}): Promise<ConfluenceResponse> {
  return fetchJson('/api/integrations/confluence', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function getTeleportStatus(proxy: string): Promise<TeleportStatus> {
  const params = new URLSearchParams({ proxy });
  return fetchJson(`/api/dump/status?${params.toString()}`);
}

export async function listTeleportDatabases(proxy: string): Promise<TeleportDatabase[]> {
  const params = new URLSearchParams({ proxy });
  return fetchJson(`/api/dump/databases?${params.toString()}`);
}

export async function startDump(req: DumpStartRequest): Promise<DumpStartResponse> {
  return fetchJson('/api/dump/start', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}
