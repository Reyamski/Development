import { CloudWatchHealthPoint, MetricSummary, HealthAlert, InstanceHealth, StackHealthSummary, ThresholdConfig, DEFAULT_THRESHOLDS, RdsInstanceConfig } from '../types.js';
import { getCloudWatchHealth } from './cloudwatch.js';
import { getAwsProfile, getRdsInstanceConfig } from './aws-rds.js';

function computeSummary(values: number[]): MetricSummary {
  if (values.length === 0) {
    return { avg: 0, max: 0, min: 0, current: 0, dataPoints: 0, trend: 'stable' };
  }
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = Math.round((sum / values.length) * 100) / 100;
  const max = Math.round(Math.max(...values) * 100) / 100;
  const min = Math.round(Math.min(...values) * 100) / 100;
  const current = Math.round(values[values.length - 1] * 100) / 100;

  const midpoint = Math.floor(values.length / 2);
  const firstHalfAvg = values.slice(0, midpoint).reduce((a, b) => a + b, 0) / (midpoint || 1);
  const secondHalfAvg = values.slice(midpoint).reduce((a, b) => a + b, 0) / ((values.length - midpoint) || 1);
  const diff = secondHalfAvg - firstHalfAvg;
  const threshold = Math.max(Math.abs(firstHalfAvg) * 0.1, 0.5);
  const trend: 'up' | 'down' | 'stable' = diff > threshold ? 'up' : diff < -threshold ? 'down' : 'stable';

  return { avg, max, min, current, dataPoints: values.length, trend };
}

function checkAlerts(
  metrics: InstanceHealth['metrics'],
  thresholds: ThresholdConfig,
  rdsConfig: RdsInstanceConfig | null,
): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  if (metrics.cpuUtilization.max >= thresholds.cpuCritical) {
    alerts.push({ metric: 'CPU', level: 'critical', message: `CPU peaked at ${metrics.cpuUtilization.max}%`, value: metrics.cpuUtilization.max, threshold: thresholds.cpuCritical });
  } else if (metrics.cpuUtilization.max >= thresholds.cpuWarning) {
    alerts.push({ metric: 'CPU', level: 'warning', message: `CPU peaked at ${metrics.cpuUtilization.max}%`, value: metrics.cpuUtilization.max, threshold: thresholds.cpuWarning });
  }

  if (metrics.freeableMemoryMb.min > 0 && metrics.freeableMemoryMb.min <= thresholds.memoryCriticalMb) {
    alerts.push({ metric: 'Memory', level: 'critical', message: `Free memory dropped to ${metrics.freeableMemoryMb.min} MB`, value: metrics.freeableMemoryMb.min, threshold: thresholds.memoryCriticalMb });
  } else if (metrics.freeableMemoryMb.min > 0 && metrics.freeableMemoryMb.min <= thresholds.memoryWarningMb) {
    alerts.push({ metric: 'Memory', level: 'warning', message: `Free memory dropped to ${metrics.freeableMemoryMb.min} MB`, value: metrics.freeableMemoryMb.min, threshold: thresholds.memoryWarningMb });
  }

  if (rdsConfig && rdsConfig.provisionedIops > 0) {
    const iopsPct = (metrics.totalIops.max / rdsConfig.provisionedIops) * 100;
    if (iopsPct >= thresholds.iopsCriticalPct) {
      alerts.push({ metric: 'IOPS', level: 'critical', message: `IOPS peaked at ${Math.round(iopsPct)}% of provisioned (${metrics.totalIops.max}/${rdsConfig.provisionedIops})`, value: iopsPct, threshold: thresholds.iopsCriticalPct });
    } else if (iopsPct >= thresholds.iopsWarningPct) {
      alerts.push({ metric: 'IOPS', level: 'warning', message: `IOPS peaked at ${Math.round(iopsPct)}% of provisioned (${metrics.totalIops.max}/${rdsConfig.provisionedIops})`, value: iopsPct, threshold: thresholds.iopsWarningPct });
    }
  }

  if (metrics.diskQueueDepth.max >= thresholds.queueDepthCritical) {
    alerts.push({ metric: 'Queue Depth', level: 'critical', message: `Disk queue depth peaked at ${metrics.diskQueueDepth.max}`, value: metrics.diskQueueDepth.max, threshold: thresholds.queueDepthCritical });
  } else if (metrics.diskQueueDepth.max >= thresholds.queueDepthWarning) {
    alerts.push({ metric: 'Queue Depth', level: 'warning', message: `Disk queue depth peaked at ${metrics.diskQueueDepth.max}`, value: metrics.diskQueueDepth.max, threshold: thresholds.queueDepthWarning });
  }

  if (metrics.replicaLag.max >= 0) {
    if (metrics.replicaLag.max >= thresholds.replicaLagCritical) {
      alerts.push({ metric: 'Replica Lag', level: 'critical', message: `Replica lag peaked at ${metrics.replicaLag.max}s`, value: metrics.replicaLag.max, threshold: thresholds.replicaLagCritical });
    } else if (metrics.replicaLag.max >= thresholds.replicaLagWarning) {
      alerts.push({ metric: 'Replica Lag', level: 'warning', message: `Replica lag peaked at ${metrics.replicaLag.max}s`, value: metrics.replicaLag.max, threshold: thresholds.replicaLagWarning });
    }
  }

  return alerts;
}

export async function getInstanceHealth(
  instanceId: string, name: string, accountId: string, region: string,
  since: string, until: string, thresholds: ThresholdConfig = DEFAULT_THRESHOLDS,
): Promise<InstanceHealth> {
  const profileName = await getAwsProfile(accountId, region);

  const [points, rdsConfig] = await Promise.all([
    getCloudWatchHealth(instanceId, region, profileName, since, until),
    getRdsInstanceConfig(accountId, region, instanceId).catch(() => null),
  ]);

  const extract = (field: keyof CloudWatchHealthPoint) => points.map(p => p[field] as number).filter(v => v >= 0);

  const metrics: InstanceHealth['metrics'] = {
    cpuUtilization: computeSummary(extract('cpuUtilization')),
    freeableMemoryMb: computeSummary(extract('freeableMemoryMb')),
    readIops: computeSummary(extract('readIops')),
    writeIops: computeSummary(extract('writeIops')),
    totalIops: computeSummary(extract('totalIops')),
    diskQueueDepth: computeSummary(extract('diskQueueDepth')),
    databaseConnections: computeSummary(extract('databaseConnections')),
    readLatencyMs: computeSummary(extract('readLatencyMs')),
    writeLatencyMs: computeSummary(extract('writeLatencyMs')),
    burstBalance: computeSummary(extract('burstBalance')),
    replicaLag: computeSummary(extract('replicaLag')),
  };

  const alerts = checkAlerts(metrics, thresholds, rdsConfig);

  return { instanceId, name, metrics, alerts, rdsConfig };
}

export function computeStackSummary(instances: InstanceHealth[]): StackHealthSummary {
  const allAlerts = instances.flatMap(i => i.alerts);
  const criticalAlerts = allAlerts.filter(a => a.level === 'critical').length;
  const warningAlerts = allAlerts.filter(a => a.level === 'warning').length;

  const overallStatus: 'healthy' | 'warning' | 'critical' =
    criticalAlerts > 0 ? 'critical' : warningAlerts > 0 ? 'warning' : 'healthy';

  const highlights: string[] = [];
  if (criticalAlerts > 0) highlights.push(`${criticalAlerts} critical alert(s) detected`);
  if (warningAlerts > 0) highlights.push(`${warningAlerts} warning(s) detected`);

  for (const inst of instances) {
    for (const alert of inst.alerts.filter(a => a.level === 'critical')) {
      highlights.push(`${inst.name}: ${alert.message}`);
    }
  }

  if (overallStatus === 'healthy') highlights.push('All instances operating within normal parameters');

  return { overallStatus, totalAlerts: allAlerts.length, criticalAlerts, warningAlerts, highlights };
}
