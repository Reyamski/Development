export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface ColumnDiff {
  name: string;
  status: DiffStatus;
  sourceDefinition?: string;
  targetDefinition?: string;
}

export interface IndexDiff {
  name: string;
  status: DiffStatus;
  sourceColumns?: string[];
  targetColumns?: string[];
}

export interface ForeignKeyDiff {
  name: string;
  status: DiffStatus;
}

export interface TableDiffDetail {
  columns: ColumnDiff[];
  indexes: IndexDiff[];
  foreignKeys: ForeignKeyDiff[];
  primaryKeyChanged: boolean;
  optionChanges: Record<string, { source?: string; target?: string }>;
}

export interface ComparisonResult {
  key: string;
  objectType: string;
  name: string;
  status: DiffStatus;
  sourceRaw?: string;
  targetRaw?: string;
  tableDiff?: TableDiffDetail;
  collateDrift?: boolean;
  charsetDrift?: boolean;
}

export interface CompareResponse {
  results: ComparisonResult[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
}

export interface ValidatePathResponse {
  valid: boolean;
  error?: string;
}

export interface GenerateRequest {
  results: ComparisonResult[];
  outputPath: string;
  singleFile: boolean;
}

export interface GenerateResponse {
  filesWritten: string[];
  totalStatements: number;
  sql?: string;
}

export interface BrowseResponse {
  current: string;
  parent: string | null;
  directories: { name: string; path: string }[];
}

export interface SchemaContext {
  instanceName: string;
  databaseName: string;
}

export interface SlackConfig {
  webhookUrl?: string;
  botToken?: string;
  channel?: string;
}

export interface ConfluenceConfig {
  baseUrl: string;
  spaceKey: string;
  email: string;
  apiToken: string;
  parentPageId?: string;
  pageTitle?: string;
}

export interface OutputFilter {
  includeAdded: boolean;
  includeRemoved: boolean;
  includeModified: boolean;
  detailLevel: 'list' | 'full';
  includeCollation: boolean;
}

export interface SecretsConfig {
  secretName: string;
  region: string;
  profile?: string;
}

export interface SecretsTestResponse {
  valid: boolean;
  keys: string[];
  error?: string;
}

export interface SlackResponse {
  success: boolean;
  error?: string;
}

export interface ConfluenceResponse {
  success: boolean;
  pageUrl?: string;
  pageId?: string;
  error?: string;
}

export interface TeleportStatus {
  loggedIn: boolean;
  user?: string;
  expires?: string;
  proxy?: string;
}

export interface TeleportDatabase {
  name: string;
  protocol: string;
  uri: string;
  region: string;
}

export interface DumpStartRequest {
  proxy: string;
  databases: string[];
  outputBase: string;
  stagingPath?: string;
  autoUploadToS3?: boolean;
}

export interface DumpStartResponse {
  jobId: string;
}

export interface S3SyncResponse {
  localPath: string;
  syncedAt: string;
}
