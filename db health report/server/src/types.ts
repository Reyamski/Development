import type { ChildProcess } from 'child_process';

// ===== Teleport Types =====

export interface TeleportTunnel {
  process: ChildProcess;
  host: string;
  port: number;
  dbName: string;
  dbUser: string;
}

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

// ===== Stack Types =====

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

// ===== Health Types =====

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

// ===== Threshold Types =====

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

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  cpuWarning: 80,
  cpuCritical: 90,
  memoryWarningMb: 1024,
  memoryCriticalMb: 512,
  iopsWarningPct: 80,
  iopsCriticalPct: 95,
  queueDepthWarning: 5,
  queueDepthCritical: 10,
  connectionWarningPct: 80,
  connectionCriticalPct: 90,
  replicaLagWarning: 10,
  replicaLagCritical: 30,
};

// ===== Table Size Types =====

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

// ===== Scheduler Types =====

export interface SchedulerConfig {
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  stackIds: string[];
  slackWebhookUrl: string;
  slackChannel: string;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  enabled: false,
  cronExpression: '0 9 * * *',
  timezone: 'UTC',
  stackIds: [],
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  slackChannel: process.env.SLACK_CHANNEL || '#dba-reports',
};

// ===== RDS Config =====

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

// ===== CloudWatch =====

export interface CloudWatchHealthPoint {
  timestamp: string;
  readIops: number;
  writeIops: number;
  totalIops: number;
  diskQueueDepth: number;
  readLatencyMs: number;
  writeLatencyMs: number;
  cpuUtilization: number;
  freeableMemoryMb: number;
  databaseConnections: number;
  burstBalance: number;
  replicaLag: number;
}
