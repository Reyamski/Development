import { Router, Request, Response } from 'express';
import {
  findTsh,
  getClusters,
  getLoginStatus,
  loginToCluster,
  listMysqlInstances,
  discoverDatabases,
  cleanupAll,
} from '../services/teleport.js';
import { openSession, closeSession } from '../services/connection-manager.js';

const router = Router();

/** GET /api/teleport/status */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const tshPath = await findTsh();
    res.json({ available: true, tshPath });
  } catch {
    res.json({ available: false, tshPath: null });
  }
});

/** GET /api/teleport/clusters */
router.get('/clusters', async (_req: Request, res: Response) => {
  try {
    const clusters = await getClusters();
    res.json({ clusters: Array.isArray(clusters) ? clusters : [] });
  } catch (err: unknown) {
    console.error('[query-hub] GET /api/teleport/clusters failed:', err);
    // Never 500 here — empty list keeps the UI usable; tsh/status explains real blockers
    res.status(200).json({ clusters: [] });
  }
});

/** GET /api/teleport/login-status?cluster=X */
router.get('/login-status', async (req: Request, res: Response) => {
  try {
    const cluster = req.query.cluster as string | undefined;
    const tsh = await findTsh();
    const status = await getLoginStatus(tsh, cluster);
    res.json(status);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** POST /api/teleport/login */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { cluster } = req.body;
    if (!cluster) {
      res.status(400).json({ error: 'cluster is required' });
      return;
    }
    const tsh = await findTsh();
    const proc = loginToCluster(tsh, cluster);
    proc.on('exit', () => {});
    proc.on('error', () => {});
    res.json({ started: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/teleport/instances?cluster=X
 * All MySQL instances (Query Hub — no replica-only filter unlike rds-replica-lag).
 */
router.get('/instances', async (req: Request, res: Response) => {
  try {
    const cluster = req.query.cluster as string;
    if (!cluster) {
      res.status(400).json({ error: 'cluster query param is required' });
      return;
    }
    const tsh = await findTsh();
    const instances = await listMysqlInstances(tsh, cluster);
    res.json({ instances });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** POST /api/teleport/databases */
router.post('/databases', async (req: Request, res: Response) => {
  try {
    const { cluster, instance } = req.body;
    if (!cluster || !instance) {
      res.status(400).json({ error: 'cluster and instance are required' });
      return;
    }
    const databases = await discoverDatabases(cluster, instance);
    res.json({ databases });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** POST /api/teleport/connect */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { cluster, instance, database } = req.body;
    if (!cluster || !instance || !database) {
      res.status(400).json({ error: 'cluster, instance, and database are required' });
      return;
    }

    const { version, databases } = await openSession(cluster, instance, database);

    res.json({
      connected: true,
      database: database === '__ALL__' ? 'All Databases' : database,
      databases,
      version,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** POST /api/teleport/disconnect */
router.post('/disconnect', async (_req: Request, res: Response) => {
  try {
    await closeSession();
    res.json({ disconnected: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** POST /api/teleport/shutdown — sendBeacon on page close */
router.post('/shutdown', async (_req: Request, res: Response) => {
  await closeSession();
  await cleanupAll();
  res.json({ ok: true });
});

export default router;
