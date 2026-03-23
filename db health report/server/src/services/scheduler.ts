import cron from 'node-cron';
import { SchedulerConfig, DEFAULT_SCHEDULER_CONFIG, HealthReport } from '../types.js';
import { getStacks } from './stacks.js';
import { getInstanceHealth, computeStackSummary } from './health.js';
import { sendSlackReport } from './slack.js';
import { saveReport } from './report-store.js';
import { getSettings, saveSettings } from './settings-store.js';

let activeTask: cron.ScheduledTask | null = null;

export function getSchedulerConfig(): SchedulerConfig {
  const settings = getSettings();
  return settings.scheduler || { ...DEFAULT_SCHEDULER_CONFIG };
}

export function updateSchedulerConfig(config: Partial<SchedulerConfig>): SchedulerConfig {
  const settings = getSettings();
  const current = settings.scheduler || { ...DEFAULT_SCHEDULER_CONFIG };
  const updated = { ...current, ...config };
  saveSettings({ ...settings, scheduler: updated });
  restartScheduler();
  return updated;
}

export function restartScheduler(): void {
  if (activeTask) {
    activeTask.stop();
    activeTask = null;
  }

  const config = getSchedulerConfig();
  if (!config.enabled || !config.cronExpression || !config.slackWebhookUrl) return;

  if (!cron.validate(config.cronExpression)) {
    console.warn(`[scheduler] Invalid cron expression: ${config.cronExpression}`);
    return;
  }

  activeTask = cron.schedule(config.cronExpression, () => {
    runScheduledReport().catch(err => console.error('[scheduler] Report failed:', err));
  }, { timezone: config.timezone || 'UTC' });

  console.log(`[scheduler] Scheduled: ${config.cronExpression} (${config.timezone})`);
}

async function runScheduledReport(): Promise<void> {
  const config = getSchedulerConfig();
  if (!config.slackWebhookUrl) return;

  const stacks = await getStacks();
  const targetStacks = config.stackIds.length > 0
    ? stacks.filter(s => config.stackIds.includes(s.id))
    : stacks;

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const until = now.toISOString();

  for (const stack of targetStacks) {
    try {
      const instanceHealths = await Promise.all(
        stack.instances.map(inst =>
          getInstanceHealth(inst.instanceId, inst.name, inst.accountId, inst.region, since, until)
            .catch(err => {
              console.error(`[scheduler] Failed to get health for ${inst.name}:`, err.message);
              return null;
            })
        )
      );

      const validHealths = instanceHealths.filter((h): h is NonNullable<typeof h> => h !== null);
      if (validHealths.length === 0) continue;

      const summary = computeStackSummary(validHealths);
      const report: HealthReport = {
        id: `${stack.id}-${now.toISOString().replace(/[:.]/g, '-')}`,
        stackId: stack.id,
        stackName: stack.name,
        generatedAt: now.toISOString(),
        period: { since, until },
        instances: validHealths,
        summary,
      };

      await saveReport(report);
      await sendSlackReport(config.slackWebhookUrl, report, config.slackChannel || undefined);
      console.log(`[scheduler] Report sent for stack: ${stack.name}`);
    } catch (err: any) {
      console.error(`[scheduler] Failed for stack ${stack.name}:`, err.message);
    }
  }
}

export { runScheduledReport };
