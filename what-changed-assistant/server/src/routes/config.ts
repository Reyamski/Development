import { Router } from 'express';
import { getConfigChanges, getRdsParameterChanges } from '../services/config.js';

const router = Router();

router.get('/changes', async (req, res) => {
  try {
    const startTime = req.query.startTime as string;
    const endTime = req.query.endTime as string;
    const accountId = req.query.accountId as string | undefined;
    const region = req.query.region as string | undefined;
    const parameterGroupName = req.query.parameterGroupName as string | undefined;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime and endTime are required' });
    }

    const changes = await getConfigChanges(startTime, endTime, accountId, region, parameterGroupName);
    res.json(changes);
  } catch (error: any) {
    console.error('Error fetching config changes:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/rds-parameters', async (req, res) => {
  try {
    const dbInstanceId = req.query.dbInstanceId as string;
    const accountId = req.query.accountId as string;
    const region = req.query.region as string;
    const startTime = req.query.startTime as string;
    const endTime = req.query.endTime as string;

    if (!dbInstanceId || !accountId || !region || !startTime || !endTime) {
      return res.status(400).json({ 
        error: 'dbInstanceId, accountId, region, startTime, and endTime are required' 
      });
    }

    const parameters = await getRdsParameterChanges(dbInstanceId, accountId, region, startTime, endTime);
    res.json(parameters);
  } catch (error: any) {
    console.error('Error fetching RDS parameter changes:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
