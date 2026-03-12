import { create } from 'zustand';
import type { ComparisonResult, CompareResponse, GenerateResponse, OutputFilter, SecretsTestResponse, TeleportStatus, TeleportDatabase } from '../api/types';

const DEFAULT_FILTER: OutputFilter = {
  includeAdded: true,
  includeRemoved: true,
  includeModified: true,
  detailLevel: 'full',
  includeCollation: true,
};

interface ComparisonState {
  sourcePath: string;
  targetPath: string;
  outputPath: string;
  singleFile: boolean;
  ignoreFkNameOnly: boolean;
  ignoreIndexNameOnly: boolean;
  ignoreCollate: boolean;
  ignoreCharset: boolean;
  showOnlyCollateDrift: boolean;
  showOnlyCharsetDrift: boolean;
  ignoreWhitespace: boolean;
  results: ComparisonResult[];
  summary: CompareResponse['summary'] | null;
  selectedKey: string | null;
  selectedForExport: Set<string>;
  loading: boolean;
  generating: boolean;
  generateResult: GenerateResponse | null;
  error: string | null;

  // S3 sync state for compare paths
  sourceLocalPath: string | null;
  sourceLastSynced: string | null;
  sourceSyncing: boolean;
  targetLocalPath: string | null;
  targetLastSynced: string | null;
  targetSyncing: boolean;

  // Schema context
  instanceName: string;
  databaseName: string;

  // Integration state
  slackWebhookUrl: string;
  slackUseBotToken: boolean;
  slackBotToken: string;
  slackChannel: string;
  confluenceBaseUrl: string;
  confluenceSpaceKey: string;
  confluenceEmail: string;
  confluenceApiToken: string;
  confluenceParentPageId: string;
  confluencePageTitle: string;
  sendingSlack: boolean;
  publishingConfluence: boolean;
  slackResult: { success: boolean; error?: string } | null;
  confluenceResult: { success: boolean; pageUrl?: string; error?: string } | null;

  // AWS Secrets — Slack
  slackUseSecrets: boolean;
  slackSecretName: string;
  slackSecretRegion: string;
  slackSecretProfile: string;
  slackSecretsTestResult: SecretsTestResponse | null;
  slackTestingSecrets: boolean;

  // AWS Secrets — Confluence
  confluenceUseSecrets: boolean;
  confluenceSecretName: string;
  confluenceSecretRegion: string;
  confluenceSecretProfile: string;
  confluenceSecretsTestResult: SecretsTestResponse | null;
  confluenceTestingSecrets: boolean;

  // Output filters
  slackFilter: OutputFilter;
  confluenceFilter: OutputFilter;

  // Schema Dump — Teleport
  dumpProxy: string;
  dumpOutputBase: string;
  dumpStagingPath: string;
  dumpAutoUploadToS3: boolean;
  dumpStatus: TeleportStatus | null;
  dumpDatabases: TeleportDatabase[];
  dumpSelectedDbs: Set<string>;
  dumpCheckingStatus: boolean;
  dumpLoadingDbs: boolean;
  dumpLoggingIn: boolean;
  dumpRunning: boolean;
  dumpLogs: string[];
  dumpError: string | null;

  setSourcePath: (path: string) => void;
  setTargetPath: (path: string) => void;
  setOutputPath: (path: string) => void;
  setSingleFile: (v: boolean) => void;
  setIgnoreFkNameOnly: (v: boolean) => void;
  setIgnoreIndexNameOnly: (v: boolean) => void;
  setIgnoreCollate: (v: boolean) => void;
  setIgnoreCharset: (v: boolean) => void;
  setShowOnlyCollateDrift: (v: boolean) => void;
  setShowOnlyCharsetDrift: (v: boolean) => void;
  setIgnoreWhitespace: (v: boolean) => void;
  setResults: (data: CompareResponse) => void;
  setSelectedKey: (key: string | null) => void;
  toggleExport: (key: string) => void;
  selectAllChanged: () => void;
  deselectAll: () => void;
  setLoading: (v: boolean) => void;
  setGenerating: (v: boolean) => void;
  setGenerateResult: (r: GenerateResponse | null) => void;
  setError: (err: string | null) => void;
  reset: () => void;

  // S3 sync setters
  setSourceLocalPath: (v: string | null) => void;
  setSourceLastSynced: (v: string | null) => void;
  setSourceSyncing: (v: boolean) => void;
  setTargetLocalPath: (v: string | null) => void;
  setTargetLastSynced: (v: string | null) => void;
  setTargetSyncing: (v: boolean) => void;

  // Schema context setters
  setInstanceName: (v: string) => void;
  setDatabaseName: (v: string) => void;

  // Integration setters
  setSlackWebhookUrl: (v: string) => void;
  setSlackUseBotToken: (v: boolean) => void;
  setSlackBotToken: (v: string) => void;
  setSlackChannel: (v: string) => void;
  setConfluenceBaseUrl: (v: string) => void;
  setConfluenceSpaceKey: (v: string) => void;
  setConfluenceEmail: (v: string) => void;
  setConfluenceApiToken: (v: string) => void;
  setConfluenceParentPageId: (v: string) => void;
  setConfluencePageTitle: (v: string) => void;
  setSendingSlack: (v: boolean) => void;
  setPublishingConfluence: (v: boolean) => void;
  setSlackResult: (r: { success: boolean; error?: string } | null) => void;
  setConfluenceResult: (r: { success: boolean; pageUrl?: string; error?: string } | null) => void;

  // AWS Secrets setters — Slack
  setSlackUseSecrets: (v: boolean) => void;
  setSlackSecretName: (v: string) => void;
  setSlackSecretRegion: (v: string) => void;
  setSlackSecretProfile: (v: string) => void;
  setSlackSecretsTestResult: (r: SecretsTestResponse | null) => void;
  setSlackTestingSecrets: (v: boolean) => void;

  // AWS Secrets setters — Confluence
  setConfluenceUseSecrets: (v: boolean) => void;
  setConfluenceSecretName: (v: string) => void;
  setConfluenceSecretRegion: (v: string) => void;
  setConfluenceSecretProfile: (v: string) => void;
  setConfluenceSecretsTestResult: (r: SecretsTestResponse | null) => void;
  setConfluenceTestingSecrets: (v: boolean) => void;

  // Output filter setters
  setSlackFilter: (f: Partial<OutputFilter>) => void;
  setConfluenceFilter: (f: Partial<OutputFilter>) => void;

  // Schema Dump setters
  setDumpProxy: (v: string) => void;
  setDumpOutputBase: (v: string) => void;
  setDumpStagingPath: (v: string) => void;
  setDumpAutoUploadToS3: (v: boolean) => void;
  setDumpStatus: (v: TeleportStatus | null) => void;
  setDumpDatabases: (v: TeleportDatabase[]) => void;
  toggleDumpDb: (name: string) => void;
  setDumpSelectedDbs: (v: Set<string>) => void;
  setDumpCheckingStatus: (v: boolean) => void;
  setDumpLoadingDbs: (v: boolean) => void;
  setDumpLoggingIn: (v: boolean) => void;
  setDumpRunning: (v: boolean) => void;
  appendDumpLog: (msg: string) => void;
  clearDumpLogs: () => void;
  setDumpError: (v: string | null) => void;
}

export const useComparisonStore = create<ComparisonState>((set, get) => ({
  sourcePath: '',
  targetPath: '',
  outputPath: '',
  singleFile: true,
  ignoreFkNameOnly: false,
  ignoreIndexNameOnly: false,
  ignoreCollate: false,
  ignoreCharset: false,
  showOnlyCollateDrift: false,
  showOnlyCharsetDrift: false,
  ignoreWhitespace: false,
  results: [],
  summary: null,
  selectedKey: null,
  selectedForExport: new Set<string>(),
  loading: false,
  generating: false,
  generateResult: null,
  error: null,

  // S3 sync defaults
  sourceLocalPath: null,
  sourceLastSynced: null,
  sourceSyncing: false,
  targetLocalPath: null,
  targetLastSynced: null,
  targetSyncing: false,

  // Schema context defaults
  instanceName: '',
  databaseName: '',

  // Integration defaults
  slackWebhookUrl: '',
  slackUseBotToken: false,
  slackBotToken: '',
  slackChannel: '',
  confluenceBaseUrl: '',
  confluenceSpaceKey: '',
  confluenceEmail: '',
  confluenceApiToken: '',
  confluenceParentPageId: '',
  confluencePageTitle: '',
  sendingSlack: false,
  publishingConfluence: false,
  slackResult: null,
  confluenceResult: null,

  // AWS Secrets defaults — Slack
  slackUseSecrets: false,
  slackSecretName: '',
  slackSecretRegion: 'us-east-1',
  slackSecretProfile: '',
  slackSecretsTestResult: null,
  slackTestingSecrets: false,

  // AWS Secrets defaults — Confluence
  confluenceUseSecrets: false,
  confluenceSecretName: '',
  confluenceSecretRegion: 'us-east-1',
  confluenceSecretProfile: '',
  confluenceSecretsTestResult: null,
  confluenceTestingSecrets: false,

  // Output filter defaults
  slackFilter: { ...DEFAULT_FILTER },
  confluenceFilter: { ...DEFAULT_FILTER },

  setSourcePath: (path) => set({ sourcePath: path }),
  setTargetPath: (path) => set({ targetPath: path }),
  setOutputPath: (path) => set({ outputPath: path }),
  setSingleFile: (v) => set({ singleFile: v }),
  setIgnoreFkNameOnly: (v) => set({ ignoreFkNameOnly: v }),
  setIgnoreIndexNameOnly: (v) => set({ ignoreIndexNameOnly: v }),
  setIgnoreCollate: (v) => set({ ignoreCollate: v }),
  setIgnoreCharset: (v) => set({ ignoreCharset: v }),
  setShowOnlyCollateDrift: (v) => set({ showOnlyCollateDrift: v }),
  setShowOnlyCharsetDrift: (v) => set({ showOnlyCharsetDrift: v }),
  setIgnoreWhitespace: (v) => set({ ignoreWhitespace: v }),
  setResults: (data) => {
    const changed = data.results.filter((r) => r.status !== 'unchanged');
    set({
      results: data.results,
      summary: data.summary,
      error: null,
      selectedKey: null,
      selectedForExport: new Set(changed.map((r) => r.key)),
    });
  },
  setSelectedKey: (key) => set({ selectedKey: key }),
  toggleExport: (key) => {
    const current = get().selectedForExport;
    const next = new Set(current);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    set({ selectedForExport: next });
  },
  selectAllChanged: () => {
    const changed = get().results.filter((r) => r.status !== 'unchanged');
    set({ selectedForExport: new Set(changed.map((r) => r.key)) });
  },
  deselectAll: () => set({ selectedForExport: new Set() }),
  setLoading: (v) => set({ loading: v }),
  setGenerating: (v) => set({ generating: v }),
  setGenerateResult: (r) => set({ generateResult: r }),
  setError: (err) => set({ error: err }),

  // S3 sync setters
  setSourceLocalPath: (v) => set({ sourceLocalPath: v }),
  setSourceLastSynced: (v) => set({ sourceLastSynced: v }),
  setSourceSyncing: (v) => set({ sourceSyncing: v }),
  setTargetLocalPath: (v) => set({ targetLocalPath: v }),
  setTargetLastSynced: (v) => set({ targetLastSynced: v }),
  setTargetSyncing: (v) => set({ targetSyncing: v }),

  // Schema context setters
  setInstanceName: (v) => set({ instanceName: v }),
  setDatabaseName: (v) => set({ databaseName: v }),

  // Integration setters
  setSlackWebhookUrl: (v) => set({ slackWebhookUrl: v }),
  setSlackUseBotToken: (v) => set({ slackUseBotToken: v }),
  setSlackBotToken: (v) => set({ slackBotToken: v }),
  setSlackChannel: (v) => set({ slackChannel: v }),
  setConfluenceBaseUrl: (v) => set({ confluenceBaseUrl: v }),
  setConfluenceSpaceKey: (v) => set({ confluenceSpaceKey: v }),
  setConfluenceEmail: (v) => set({ confluenceEmail: v }),
  setConfluenceApiToken: (v) => set({ confluenceApiToken: v }),
  setConfluenceParentPageId: (v) => set({ confluenceParentPageId: v }),
  setConfluencePageTitle: (v) => set({ confluencePageTitle: v }),
  setSendingSlack: (v) => set({ sendingSlack: v }),
  setPublishingConfluence: (v) => set({ publishingConfluence: v }),
  setSlackResult: (r) => set({ slackResult: r }),
  setConfluenceResult: (r) => set({ confluenceResult: r }),

  // AWS Secrets setters — Slack
  setSlackUseSecrets: (v) => set({ slackUseSecrets: v }),
  setSlackSecretName: (v) => set({ slackSecretName: v }),
  setSlackSecretRegion: (v) => set({ slackSecretRegion: v }),
  setSlackSecretProfile: (v) => set({ slackSecretProfile: v }),
  setSlackSecretsTestResult: (r) => set({ slackSecretsTestResult: r }),
  setSlackTestingSecrets: (v) => set({ slackTestingSecrets: v }),

  // AWS Secrets setters — Confluence
  setConfluenceUseSecrets: (v) => set({ confluenceUseSecrets: v }),
  setConfluenceSecretName: (v) => set({ confluenceSecretName: v }),
  setConfluenceSecretRegion: (v) => set({ confluenceSecretRegion: v }),
  setConfluenceSecretProfile: (v) => set({ confluenceSecretProfile: v }),
  setConfluenceSecretsTestResult: (r) => set({ confluenceSecretsTestResult: r }),
  setConfluenceTestingSecrets: (v) => set({ confluenceTestingSecrets: v }),

  // Output filter setters (merge partials)
  setSlackFilter: (f) => set((s) => ({ slackFilter: { ...s.slackFilter, ...f } })),
  setConfluenceFilter: (f) => set((s) => ({ confluenceFilter: { ...s.confluenceFilter, ...f } })),

  // Schema Dump defaults
  dumpProxy: 'par-nonprod.teleport.sh',
  dumpOutputBase: '/SchemaDump',
  dumpStagingPath: '/tmp/SchemaDump',
  dumpAutoUploadToS3: false,
  dumpStatus: null,
  dumpDatabases: [],
  dumpSelectedDbs: new Set<string>(),
  dumpCheckingStatus: false,
  dumpLoadingDbs: false,
  dumpLoggingIn: false,
  dumpRunning: false,
  dumpLogs: [],
  dumpError: null,

  setDumpProxy: (v) => set({ dumpProxy: v }),
  setDumpOutputBase: (v) => set({ dumpOutputBase: v }),
  setDumpStagingPath: (v) => set({ dumpStagingPath: v }),
  setDumpAutoUploadToS3: (v) => set({ dumpAutoUploadToS3: v }),
  setDumpStatus: (v) => set({ dumpStatus: v }),
  setDumpDatabases: (v) => set({ dumpDatabases: v }),
  toggleDumpDb: (name) =>
    set((s) => {
      const next = new Set(s.dumpSelectedDbs);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { dumpSelectedDbs: next };
    }),
  setDumpSelectedDbs: (v) => set({ dumpSelectedDbs: v }),
  setDumpCheckingStatus: (v) => set({ dumpCheckingStatus: v }),
  setDumpLoadingDbs: (v) => set({ dumpLoadingDbs: v }),
  setDumpLoggingIn: (v) => set({ dumpLoggingIn: v }),
  setDumpRunning: (v) => set({ dumpRunning: v }),
  appendDumpLog: (msg) => set((s) => ({ dumpLogs: [...s.dumpLogs, msg] })),
  clearDumpLogs: () => set({ dumpLogs: [] }),
  setDumpError: (v) => set({ dumpError: v }),

  reset: () =>
    set({
      results: [],
      summary: null,
      selectedKey: null,
      selectedForExport: new Set(),
      error: null,
      generateResult: null,
      slackResult: null,
      confluenceResult: null,
      slackSecretsTestResult: null,
      confluenceSecretsTestResult: null,
    }),
}));
