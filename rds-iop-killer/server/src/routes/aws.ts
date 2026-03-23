import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/aws/sso-status
 * Check if there's a valid AWS SSO session (cached access token).
 */
router.get('/sso-status', async (_req: Request, res: Response) => {
  try {
    const { getSsoAccessToken } = await import('../services/aws-rds.js');
    const token = await getSsoAccessToken();
    res.json({ loggedIn: !!token });
  } catch {
    res.json({ loggedIn: false });
  }
});

/**
 * POST /api/aws/sso-login
 * Start AWS SSO login for the account/region profile used by this app.
 */
router.post('/sso-login', async (req: Request, res: Response) => {
  try {
    const { accountId, region } = req.body || {};
    if (!accountId || !region) {
      res.status(400).json({ error: 'accountId and region are required' });
      return;
    }
    const { startAwsSsoLogin } = await import('../services/aws-rds.js');
    const result = await startAwsSsoLogin(accountId, region);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
