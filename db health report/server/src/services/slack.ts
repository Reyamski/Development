import { HealthReport } from '../types.js';

export async function sendSlackReport(
  webhookUrl: string, report: HealthReport, channel?: string,
): Promise<void> {
  const statusEmoji = report.summary.overallStatus === 'critical' ? ':red_circle:'
    : report.summary.overallStatus === 'warning' ? ':large_yellow_circle:' : ':large_green_circle:';

  const headerText = `${statusEmoji} *DB Health Report — ${report.stackName}*`;
  const periodText = `_${new Date(report.period.since).toLocaleString()} — ${new Date(report.period.until).toLocaleString()}_`;

  const instanceBlocks: string[] = [];
  for (const inst of report.instances) {
    const m = inst.metrics;
    const alertIcons = inst.alerts.length > 0
      ? inst.alerts.map(a => a.level === 'critical' ? ':red_circle:' : ':warning:').join(' ')
      : ':white_check_mark:';

    instanceBlocks.push(
      `*${inst.name}* ${alertIcons}\n` +
      `> CPU: ${m.cpuUtilization.avg}% avg / ${m.cpuUtilization.max}% max | ` +
      `Memory: ${m.freeableMemoryMb.current} MB free\n` +
      `> IOPS: ${m.totalIops.avg} avg / ${m.totalIops.max} max | ` +
      `Queue: ${m.diskQueueDepth.avg} avg\n` +
      `> Connections: ${m.databaseConnections.avg} avg / ${m.databaseConnections.max} max` +
      (m.replicaLag.max >= 0 ? ` | Lag: ${m.replicaLag.avg}s avg / ${m.replicaLag.max}s max` : '') +
      (inst.alerts.length > 0 ? '\n> *Alerts:* ' + inst.alerts.map(a => a.message).join(', ') : '')
    );
  }

  const highlightsText = report.summary.highlights.length > 0
    ? '\n*Summary:*\n' + report.summary.highlights.map(h => `• ${h}`).join('\n')
    : '';

  const payload: any = {
    text: `${headerText}\n${periodText}${highlightsText}\n\n${instanceBlocks.join('\n\n')}`,
  };
  if (channel) payload.channel = channel;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
  }
}
