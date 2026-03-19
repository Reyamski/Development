import { Router } from 'express';
import { getJiraReleases } from '../services/jira.js';

const router = Router();

router.get('/releases', async (req, res) => {
  try {
    const startTime = req.query.startTime as string;
    const endTime = req.query.endTime as string;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime and endTime are required' });
    }

    const releases = await getJiraReleases(startTime, endTime);
    res.json(releases);
  } catch (error: any) {
    console.error('Error fetching Jira releases:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
