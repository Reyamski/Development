import { Router, Request, Response } from 'express';
import { scanFolder, matchFiles, matchFilesWithStructuralIndexes } from '../services/scanner.js';
import { compareFiles } from '../services/differ/index.js';
import { syncFromS3 } from '../services/s3-service.js';

const router = Router();

router.post('/sync-s3', async (req: Request, res: Response) => {
  const { s3Path } = req.body as { s3Path?: string };
  if (!s3Path?.startsWith('s3://')) {
    res.status(400).json({ error: 's3Path must start with s3://' });
    return;
  }
  try {
    const result = await syncFromS3(s3Path);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const { sourcePath, targetPath, ignoreFkNameOnly, ignoreIndexNameOnly, ignoreCollate, ignoreCharset, ignoreWhitespace } = req.body;

  if (!sourcePath || !targetPath) {
    res.status(400).json({ error: 'sourcePath and targetPath are required' });
    return;
  }

  try {
    const [sourceFiles, targetFiles] = await Promise.all([
      scanFolder(sourcePath),
      scanFolder(targetPath),
    ]);

    const options = {
      ignoreFkNameOnly: !!ignoreFkNameOnly,
      ignoreIndexNameOnly: !!ignoreIndexNameOnly,
      ignoreCollate: !!ignoreCollate,
      ignoreCharset: !!ignoreCharset,
      ignoreWhitespace: !!ignoreWhitespace,
    };

    const pairs = options.ignoreIndexNameOnly
      ? await matchFilesWithStructuralIndexes(sourceFiles, targetFiles)
      : matchFiles(sourceFiles, targetFiles);

    const results = await compareFiles(pairs, options);

    const summary = {
      added: results.filter((r) => r.status === 'added').length,
      removed: results.filter((r) => r.status === 'removed').length,
      modified: results.filter((r) => r.status === 'modified').length,
      unchanged: results.filter((r) => r.status === 'unchanged').length,
    };

    res.json({ results, summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
