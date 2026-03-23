import { Router, Request, Response } from 'express';
import { getStacks, upsertStack, deleteStack } from '../services/stacks.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const stacks = await getStacks();
    res.json({ stacks });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const stack = req.body;
    if (!stack.id || !stack.name) {
      res.status(400).json({ error: 'id and name are required' });
      return;
    }
    await upsertStack(stack);
    res.json({ ok: true, stack });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteStack(req.params.id);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
