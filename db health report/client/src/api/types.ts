export interface TeleportInstance {
  name: string;
  uri: string;
  accountId: string;
  region: string;
  instanceId: string;
}

export interface TeleportStatus {
  loggedIn: boolean;
  username: string;
  cluster?: string;
}

export interface StackInstance {
  name: string;
  instanceId: string;
  accountId: string;
  region: string;
  cluster: string;
}

export interface Stack {
  id: string;
  name: string;
  instances: StackInstance[];
}

export interface MetricSummary {
  avg: number;
  max: number;
  min: number;
  current: number;
  dataPoints: number;
  trend: 'up' | 'down' | 'stable';
}

export interface HealthAlert {
  metric: string;
  level: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
}

export interface InstanceHealth {
  instanceId: string;
  name: string;
  metrics: {
    cpuUtilization: MetricSummary;
    freeableMemoryMb: MetricSummary;
    readIops: MetricSummary;
    writeIops: MetricSummary;
    totalIops: MetricSummary;
    diskQueueDepth: MetricSummary;
    databaseConnections: MetricSummary;
    readLatencyMs: MetricSummary;
    writeLatencyMs: MetricSummary;
    burstBalance: MetricSummary;
    replicaLag: MetricSummary;
  };
  alerts: HealthAlert[];
  rdsConfig: RdsInstanceConfig | null;
}

export interface StackHealthSummary {
  overallStatus: 'healthy' | 'warning' | 'critical';
  totalAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  highlights: string[];
}

export interface HealthReport {
  id: string;
  stackId: string;
  stackName: string;
  generatedAt: string;
  period: { since: string; until: string };
  instances: InstanceHealth[];
  summary: StackHealthSummary;
}

export interface ThresholdConfig {
  cpuWarning: number;
  cpuCritical: number;
  memoryWarningMb: number;
  memoryCriticalMb: number;
  iopsWarningPct: number;
  iopsCriticalPct: number;
  queueDepthWarning: number;
  queueDepthCritical: number;
  connectionWarningPct: number;
  connectionCriticalPct: number;
  replicaLagWarning: number;
  replicaLagCritical: number;
}

export interface TableSizeResult {
  instanceName: string;
  database: string;
  table: string;
  displayName: string;
  dataSizeMb: number;
  indexSizeMb: number;
  totalSizeMb: number;
  rows: number;
  engine: string;
}

export interface SchedulerConfig {
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  stackIds: string[];
  slackWebhookUrl: string;
  slackChannel: string;
}

export interface RdsInstanceConfig {
  provisionedIops: number;
  storageType: string;
  allocatedStorageGb: number;
  instanceClass: string;
  engine: string;
  engineVersion: string;
  readReplicaSource: string | null;
  readReplicaIds: string[];
  parameterGroupName: string | null;
}

export interface InstanceGroup {
  id: string;
  name: string;
  accountId: string;
  instances: TeleportInstance[];
}

export type TabId = 'health' | 'table-sizes' | 'reports' | 'settings';
