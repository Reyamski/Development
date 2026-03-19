import { Router } from 'express';
import { getConfigChanges, getRdsParameterChanges } from '../services/config.js';

const router = Router();

router.get('/changes', async (req, res) => {
  try {
    const startTime = req.query.startTime as string;
    const endTime = req.query.endTime as string;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime and endTime are required' });
    }

    const changes = await getConfigChanges(startTime, endTime);
    res.json(changes);
  } catch (error: any) {
    console.error('Error fetching config changes:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/rds-parameters', async (req, res) => {
  try {
    const dbInstance = req.query.dbInstance as string;
    const startTime = req.query.startTime as string;
    const endTime = req.query.endTime as string;

    if (!dbInstance || !startTime || !endTime) {
      return res.status(400).json({ error: 'dbInstance, startTime, and endTime are required' });
    }

    const parameters = await getRdsParameterChanges(dbInstance, startTime, endTime);
    res.json(parameters);
  } catch (error: any) {
    console.error('Error fetching RDS parameter changes:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
