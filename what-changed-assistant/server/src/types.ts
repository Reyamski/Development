export interface TimeWindow {
  incidentTime: string;
  lookbackHours: number;
  startTime: string;
  endTime: string;
}

export interface JiraRelease {
  id: string;
  key: string;
  summary: string;
  releaseDate: string;
  deploymentType: 'production' | 'staging' | 'hotfix' | 'unknown';
  issueType: string;
  status: string;
  assignee: string | null;
  reporter: string | null;
  description: string | null;
  labels: string[];
  components: string[];
}

export interface DatabaseChange {
  id: string;
  timestamp: string;
  changeType: 'schema' | 'migration' | 'query_pattern';
  database: string;
  table?: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  details: any;
}

export interface SchemaChange {
  table: string;
  changeType: 'CREATE' | 'ALTER' | 'DROP' | 'INDEX';
  statement: string;
  timestamp: string;
}

export interface QueryDigestChange {
  digest: string;
  queryText: string;
  schema: string;
  firstSeen: string;
  lastSeen: string;
  executionCount: number;
  avgLatency: number;
  totalLatency: number;
  affectedTables: string[];
  changeType: 'new' | 'spike' | 'missing';
  comparisonMetric: {
    before: number;
    after: number;
    percentChange: number;
  };
}

export interface ConfigChange {
  id: string;
  timestamp: string;
  changeType: 'parameter' | 'feature_flag' | 'env_var';
  source: string;
  parameter: string;
  oldValue: string | null;
  newValue: string;
  appliedBy: string | null;
  requiresReboot: boolean;
}

export interface RdsParameterChange {
  parameterName: string;
  oldValue: string | null;
  newValue: string;
  applyType: 'IMMEDIATE' | 'PENDING_REBOOT';
  modifiedDate: string;
}

export interface ChangesSummary {
  timeWindow: TimeWindow;
  jiraChanges: JiraRelease[];
  databaseChanges: DatabaseChange[];
  configChanges: ConfigChange[];
  correlations: Correlation[];
}

export interface Correlation {
  id: string;
  type: 'jira_to_db' | 'db_to_config' | 'query_to_schema' | 'multi';
  strength: 'weak' | 'medium' | 'strong';
  description: string;
  relatedChangeIds: string[];
}
