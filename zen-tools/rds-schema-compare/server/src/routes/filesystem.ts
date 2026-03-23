import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const router = Router();

router.post('/validate-path', async (req: Request, res: Response) => {
  const { path: dirPath } = req.body;

  if (!dirPath || typeof dirPath !== 'string') {
    res.json({ valid: false, error: 'Path is required' });
    return;
  }

  try {
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) {
      res.json({ valid: false, error: 'Path is not a directory' });
      return;
    }
    res.json({ valid: true });
  } catch {
    res.json({ valid: false, error: 'Directory does not exist' });
  }
});

router.post('/browse', async (req: Request, res: Response) => {
  const { path: dirPath } = req.body;
  const target = dirPath || os.homedir();

  try {
    const stat = await fs.stat(target);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: 'Not a directory' });
      return;
    }

    const entries = await fs.readdir(target, { withFileTypes: true });
    const dirs: { name: string; path: string }[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        dirs.push({
          name: entry.name,
          path: path.join(target, entry.name),
        });
      }
    }

    dirs.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      current: target,
      parent: path.dirname(target) !== target ? path.dirname(target) : null,
      directories: dirs,
    });
  } catch {
    res.status(400).json({ error: 'Cannot read directory' });
  }
});

export default router;
