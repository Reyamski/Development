import { Router, Request, Response } from 'express';

const router = Router();

router.get('/sso-status', async (_req: Request, res: Response) => {
  try {
    const { getSsoAccessToken } = await import('../services/aws-rds.js');
    const token = await getSsoAccessToken();
    res.json({ loggedIn: !!token });
  } catch { res.json({ loggedIn: false }); }
});

router.post('/sso-login', async (req: Request, res: Response) => {
  try {
    const { accountId, region } = req.body || {};
    if (!accountId || !region) { res.status(400).json({ error: 'accountId and region are required' }); return; }
    const { startAwsSsoLogin } = await import('../services/aws-rds.js');
    const result = await startAwsSsoLogin(accountId, region);
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
