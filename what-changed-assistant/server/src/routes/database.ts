import { Router } from 'express';
import { getDatabaseChanges, getQueryDigestChanges, getSchemaChanges } from '../services/database.js';

const router = Router();

router.get('/changes', async (req, res) => {
  try {
    const startTime = req.query.startTime as string;
    const endTime = req.query.endTime as string;
    const dbInstance = req.query.dbInstance as string;

    if (!startTime || !endTime || !dbInstance) {
      return res.status(400).json({ error: 'startTime, endTime, and dbInstance are required' });
    }

    const changes = await getDatabaseChanges(dbInstance, startTime, endTime);
    res.json(changes);
  } catch (error: any) {
    console.error('Error fetching database changes:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/query-digests', async (req, res) => {
  try {
    const startTime = req.query.startTime as string;
    const endTime = req.query.endTime as string;
    const dbInstance = req.query.dbInstance as string;

    if (!startTime || !endTime || !dbInstance) {
      return res.status(400).json({ error: 'startTime, endTime, and dbInstance are required' });
    }

    const digests = await getQueryDigestChanges(dbInstance, startTime, endTime);
    res.json(digests);
  } catch (error: any) {
    console.error('Error fetching query digest changes:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/schema', async (req, res) => {
  try {
    const startTime = req.query.startTime as string;
    const endTime = req.query.endTime as string;
    const dbInstance = req.query.dbInstance as string;

    if (!startTime || !endTime || !dbInstance) {
      return res.status(400).json({ error: 'startTime, endTime, and dbInstance are required' });
    }

    const schema = await getSchemaChanges(dbInstance, startTime, endTime);
    res.json(schema);
  } catch (error: any) {
    console.error('Error fetching schema changes:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
