export interface TimeWindow {
  incidentTime: string;
  lookbackHours: number;
  startTime: string;
  endTime: string;
}

export interface RiskAssessment {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  flags: string[];
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
  risk?: RiskAssessment;
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
  risk?: RiskAssessment;
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
  risk?: RiskAssessment;
}

export interface Correlation {
  id: string;
  type: 'jira_to_db' | 'db_to_config' | 'query_to_schema' | 'multi';
  strength: 'weak' | 'medium' | 'strong';
  description: string;
  relatedChangeIds: string[];
}

export interface ChangesSummary {
  timeWindow: TimeWindow;
  jiraChanges: JiraRelease[];
  databaseChanges: DatabaseChange[];
  configChanges: ConfigChange[];
  correlations: Correlation[];
}
