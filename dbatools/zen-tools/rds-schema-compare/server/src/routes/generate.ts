import { Router, Request, Response } from 'express';
import { generateMigration, generatePreview } from '../services/generator/index.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { results, outputPath, singleFile } = req.body;

  if (!results || !outputPath) {
    res.status(400).json({ error: 'results and outputPath are required' });
    return;
  }

  try {
    const output = await generateMigration(results, outputPath, singleFile !== false);
    res.json(output);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/preview', (req: Request, res: Response) => {
  const { result } = req.body;

  if (!result) {
    res.status(400).json({ error: 'result is required' });
    return;
  }

  try {
    const sql = generatePreview(result);
    res.json({ sql });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
