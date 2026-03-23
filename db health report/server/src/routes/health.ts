import { Router, Request, Response } from 'express';
import { getInstanceHealth, computeStackSummary } from '../services/health.js';
import { saveReport } from '../services/report-store.js';
import { sendSlackReport } from '../services/slack.js';
import { getThresholds } from '../services/settings-store.js';
import { getSchedulerConfig } from '../services/scheduler.js';
import { HealthReport } from '../types.js';

const router = Router();

router.post('/check', async (req: Request, res: Response) => {
  try {
    const { instances, since, until } = req.body;
    if (!Array.isArray(instances) || instances.length === 0 || !since || !until) {
      res.status(400).json({ error: 'instances array, since, and until are required' });
      return;
    }

    const thresholds = getThresholds();
    const instanceHealths = await Promise.all(
      instances.map((inst: any) =>
        getInstanceHealth(inst.instanceId, inst.name, inst.accountId, inst.region, since, until, thresholds)
          .catch(err => {
            console.error(`Health check failed for ${inst.name}:`, err.message);
            return null;
          })
      )
    );

    const validHealths = instanceHealths.filter((h): h is NonNullable<typeof h> => h !== null);
    const summary = computeStackSummary(validHealths);

    res.json({ instances: validHealths, summary });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/generate-report', async (req: Request, res: Response) => {
  try {
    const { groupName, instances, since, until } = req.body;
    if (!groupName || !Array.isArray(instances) || instances.length === 0 || !since || !until) {
      res.status(400).json({ error: 'groupName, instances array, since, and until are required' });
      return;
    }

    const thresholds = getThresholds();
    const instanceHealths = await Promise.all(
      instances.map((inst: any) =>
        getInstanceHealth(inst.instanceId, inst.name, inst.accountId, inst.region, since, until, thresholds)
          .catch(() => null)
      )
    );

    const validHealths = instanceHealths.filter((h): h is NonNullable<typeof h> => h !== null);
    const summary = computeStackSummary(validHealths);

    const now = new Date();
    const groupId = groupName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const report: HealthReport = {
      id: `${groupId}-${now.toISOString().replace(/[:.]/g, '-')}`,
      stackId: groupId,
      stackName: groupName,
      generatedAt: now.toISOString(),
      period: { since, until },
      instances: validHealths,
      summary,
    };

    await saveReport(report);

    const schedulerConfig = getSchedulerConfig();
    if (schedulerConfig.slackWebhookUrl) {
      try {
        await sendSlackReport(schedulerConfig.slackWebhookUrl, report, schedulerConfig.slackChannel || undefined);
        res.json({ report, slackSent: true });
      } catch (slackErr: any) {
        res.json({ report, slackSent: false, slackError: slackErr.message });
      }
    } else {
      res.json({ report, slackSent: false, slackError: 'No Slack webhook configured' });
    }
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
