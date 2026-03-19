import { Router } from 'express';
import { getSummary } from '../services/changes-summary.js';

const router = Router();

router.get('/summary', async (req, res) => {
  try {
    const incidentTime = req.query.incidentTime as string;
    const lookbackHours = parseInt(req.query.lookbackHours as string) || 6;

    if (!incidentTime) {
      return res.status(400).json({ error: 'incidentTime is required' });
    }

    const summary = await getSummary(incidentTime, lookbackHours);
    res.json(summary);
  } catch (error: any) {
    console.error('Error fetching changes summary:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
