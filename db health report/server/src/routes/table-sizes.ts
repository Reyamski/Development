import { Router, Request, Response } from 'express';
import { getTableSizes } from '../services/table-sizes.js';

const router = Router();

router.post('/fetch', async (req: Request, res: Response) => {
  try {
    const { instances } = req.body;
    if (!Array.isArray(instances) || instances.length === 0) {
      res.status(400).json({ error: 'instances array is required' });
      return;
    }

    const results: any[] = [];
    const errors: { instance: string; error: string }[] = [];

    for (const inst of instances) {
      try {
        const tables = await getTableSizes(inst.cluster, inst.name);
        results.push(...tables);
      } catch (err: any) {
        errors.push({ instance: inst.name, error: err.message });
      }
    }

    res.json({ tables: results, errors });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
