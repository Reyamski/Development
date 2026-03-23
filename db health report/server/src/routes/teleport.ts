import { Router, Request, Response } from 'express';
import {
  findTsh, getClusters, getLoginStatus, loginToCluster, listMysqlInstances, cleanupAll,
} from '../services/teleport.js';
import { closeAllSessions } from '../services/connection-manager.js';

const router = Router();

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const tshPath = await findTsh();
    res.json({ available: true, tshPath });
  } catch { res.json({ available: false, tshPath: null }); }
});

router.get('/clusters', async (_req: Request, res: Response) => {
  try {
    const clusters = await getClusters();
    res.json({ clusters });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/login-status', async (req: Request, res: Response) => {
  try {
    const cluster = req.query.cluster as string | undefined;
    const tsh = await findTsh();
    const status = await getLoginStatus(tsh, cluster);
    res.json(status);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { cluster } = req.body;
    if (!cluster) { res.status(400).json({ error: 'cluster is required' }); return; }
    const tsh = await findTsh();
    const proc = loginToCluster(tsh, cluster);
    proc.on('exit', () => {});
    proc.on('error', () => {});
    res.json({ started: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/instances', async (req: Request, res: Response) => {
  try {
    const cluster = req.query.cluster as string;
    if (!cluster) { res.status(400).json({ error: 'cluster query param is required' }); return; }
    const tsh = await findTsh();
    const instances = await listMysqlInstances(tsh, cluster);
    res.json({ instances });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/shutdown', async (_req: Request, res: Response) => {
  await closeAllSessions();
  await cleanupAll();
  res.json({ ok: true });
});

export default router;
