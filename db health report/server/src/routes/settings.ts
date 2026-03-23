import { Router, Request, Response } from 'express';
import { getSettings, updateThresholds } from '../services/settings-store.js';
import { getSchedulerConfig, updateSchedulerConfig, runScheduledReport } from '../services/scheduler.js';
import { listReports, getReport, deleteReport } from '../services/report-store.js';

const router = Router();

router.get('/thresholds', (_req: Request, res: Response) => {
  try {
    const settings = getSettings();
    res.json(settings.thresholds);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/thresholds', (req: Request, res: Response) => {
  try {
    const updated = updateThresholds(req.body);
    res.json(updated);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/scheduler', (_req: Request, res: Response) => {
  try {
    const config = getSchedulerConfig();
    res.json(config);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/scheduler', (req: Request, res: Response) => {
  try {
    const updated = updateSchedulerConfig(req.body);
    res.json(updated);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/scheduler/run-now', async (_req: Request, res: Response) => {
  try {
    await runScheduledReport();
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/reports', async (req: Request, res: Response) => {
  try {
    const stackId = req.query.stackId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const reports = await listReports(stackId, limit);
    res.json({ reports });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/:id', async (req: Request, res: Response) => {
  try {
    const report = await getReport(req.params.id);
    if (!report) { res.status(404).json({ error: 'Report not found' }); return; }
    res.json(report);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/reports/:id', async (req: Request, res: Response) => {
  try {
    await deleteReport(req.params.id);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
