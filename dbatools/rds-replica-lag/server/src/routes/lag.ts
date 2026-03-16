import { Router, Request, Response } from 'express';
import { getReplicaStatus, getReplicationWorkers, getSlowAppliers, computeGtidGap } from '../services/lag.js';
import { getDbaSlowQueriesWithDebug, getDbaQueryLatency } from '../services/dba-schema.js';

const router = Router();

/**
 * GET /api/lag/replica-status
 * Get current SHOW REPLICA STATUS output.
 */
router.get('/replica-status', async (_req: Request, res: Response) => {
  try {
    const status = await getReplicaStatus();
    res.json({ status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/lag/workers
 * Get replication worker status from performance_schema.
 */
router.get('/workers', async (_req: Request, res: Response) => {
  try {
    const workers = await getReplicationWorkers();
    res.json({ workers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/lag/cloudwatch?accountId=X&region=Y&instanceId=Z&since=ISO&until=ISO
 * Fetch ReplicaLag metric from CloudWatch.
 */
router.get('/cloudwatch', async (req: Request, res: Response) => {
  try {
    const accountId = req.query.accountId as string;
    const region = req.query.region as string;
    const instanceId = req.query.instanceId as string;
    const since = req.query.since as string;
    const until = req.query.until as string;
    if (!accountId || !region || !instanceId || !since || !until) {
      res.status(400).json({ error: 'accountId, region, instanceId, since, and until are required' });
      return;
    }
    const { getAwsProfile } = await import('../services/aws-rds.js');
    const { getCloudWatchLag } = await import('../services/cloudwatch.js');
    const profileName = await getAwsProfile(accountId, region);
    const data = await getCloudWatchLag(instanceId, region, profileName, since, until);
    res.json({ cloudwatch: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/lag/investigation
 * Returns slow applier detection + GTID gap + dba schema slow queries.
 * All queries are read-only — safe to run on a live replica.
 */
router.get('/investigation', async (req: Request, res: Response) => {
  try {
    const since = req.query.since ? new Date(req.query.since as string) : undefined;
    const until = req.query.until ? new Date(req.query.until as string) : undefined;
    const [status, slowAppliers, dbaResult] = await Promise.all([
      getReplicaStatus(),
      getSlowAppliers(),
      getDbaSlowQueriesWithDebug(10, since, until),
    ]);
    const gtidGap = status
      ? computeGtidGap(status.retrievedGtidSet, status.executedGtidSet)
      : null;
    // Observability for support/debugging (read-only path)
    console.info(
      `[lag/investigation] dba rows=${dbaResult.dbaDebug.rowCount} source=${dbaResult.dbaDebug.source}` +
      ` digest_table=${dbaResult.dbaDebug.digestHistoryTableExists} asof=${dbaResult.dbaDebug.lastAsOfDate ?? 'null'}` +
      (dbaResult.dbaDebug.error ? ` error=${dbaResult.dbaDebug.error}` : ''),
    );
    res.json({ slowAppliers, gtidGap, dbaSlowQueries: dbaResult.dbaSlowQueries, dbaDebug: dbaResult.dbaDebug });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/lag/dba-slow-queries
 * Returns top slow queries from dba.events_statements_summary_by_digest_history.
 */
router.get('/dba-slow-queries', async (_req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((_req.query.limit as string) || '10', 10) || 10, 50);
    const since = _req.query.since ? new Date(_req.query.since as string) : undefined;
    const until = _req.query.until ? new Date(_req.query.until as string) : undefined;
    const dbaResult = await getDbaSlowQueriesWithDebug(limit, since, until);
    res.json({ dbaSlowQueries: dbaResult.dbaSlowQueries, dbaDebug: dbaResult.dbaDebug });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/lag/dba-query-latency?since=ISO
 * Returns query latency from dba.query_latency_history.
 */
router.get('/dba-query-latency', async (req: Request, res: Response) => {
  try {
    const sinceStr = req.query.since as string;
    const since = sinceStr ? new Date(sinceStr) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const latency = await getDbaQueryLatency(since, 20);
    res.json({ latency });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/lag/rds-config?accountId=X&region=Y&instanceId=Z
 * Fetch RDS instance config from AWS API.
 */
router.get('/rds-config', async (req: Request, res: Response) => {
  try {
    const accountId = req.query.accountId as string;
    const region = req.query.region as string;
    const instanceId = req.query.instanceId as string;
    if (!accountId || !region || !instanceId) {
      res.status(400).json({ error: 'accountId, region, and instanceId are required' });
      return;
    }
    const { getRdsInstanceConfig } = await import('../services/aws-rds.js');
    const config = await getRdsInstanceConfig(accountId, region, instanceId);
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/lag/parameter-group?accountId=X&region=Y&parameterGroupName=Z
 * Fetch replica-relevant MySQL parameters from the RDS parameter group.
 */
router.get('/parameter-group', async (req: Request, res: Response) => {
  try {
    const accountId = req.query.accountId as string;
    const region = req.query.region as string;
    const parameterGroupName = req.query.parameterGroupName as string;
    if (!accountId || !region || !parameterGroupName) {
      res.status(400).json({ error: 'accountId, region, and parameterGroupName are required' });
      return;
    }
    const { getRdsParameterGroup } = await import('../services/aws-rds.js');
    const paramGroup = await getRdsParameterGroup(accountId, region, parameterGroupName);
    res.json(paramGroup);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/lag/aws-sso-login
 * Trigger AWS SSO login for the account/region profile used by this app.
 */
router.post('/aws-sso-login', async (req: Request, res: Response) => {
  try {
    const { accountId, region } = req.body || {};
    if (!accountId || !region) {
      res.status(400).json({ error: 'accountId and region are required' });
      return;
    }
    const { startAwsSsoLogin } = await import('../services/aws-rds.js');
    const result = await startAwsSsoLogin(accountId, region);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
