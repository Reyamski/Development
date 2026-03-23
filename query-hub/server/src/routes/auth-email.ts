import { Router, Request, Response } from 'express';
import {
  isEmailAuthEnabled,
  isEmailAllowed,
  rateLimitRequestCode,
  createAndStoreCode,
  verifyAndConsumeCode,
  logCodeForDev,
  signSessionToken,
} from '../services/email-signin.js';

const router = Router();

function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0]!.trim();
  if (Array.isArray(xf) && xf[0]) return xf[0].trim();
  return req.socket.remoteAddress ?? 'unknown';
}

/** GET /api/auth/email/status */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    enabled: isEmailAuthEnabled(),
    hasJwtSecret: Boolean(process.env.QUERY_HUB_JWT_SECRET?.trim() && process.env.QUERY_HUB_JWT_SECRET.length >= 16),
  });
});

/** POST /api/auth/email/request-code { email } */
router.post('/request-code', (req: Request, res: Response) => {
  if (!isEmailAuthEnabled()) {
    res.status(503).json({ error: 'Email sign-in is not enabled on this server (QUERY_HUB_EMAIL_AUTH).' });
    return;
  }
  const secret = process.env.QUERY_HUB_JWT_SECRET?.trim();
  if (!secret || secret.length < 16) {
    res.status(503).json({ error: 'Server email auth is misconfigured (QUERY_HUB_JWT_SECRET).' });
    return;
  }

  const { email } = req.body as { email?: string };
  if (!email?.trim()) {
    res.status(400).json({ error: 'email is required' });
    return;
  }
  if (!isEmailAllowed(email)) {
    res.status(403).json({ error: 'That email is not allowed for this Query Hub instance.' });
    return;
  }
  if (!rateLimitRequestCode(clientIp(req))) {
    res.status(429).json({ error: 'Too many code requests. Try again later.' });
    return;
  }

  const code = createAndStoreCode(email);
  logCodeForDev(email, code);

  res.json({
    ok: true,
    message:
      'Code generated. In development, look at the Query Hub API terminal for the 6-digit code (expires in 15 minutes).',
  });
});

/** POST /api/auth/email/verify { email, code } */
router.post('/verify', (req: Request, res: Response) => {
  if (!isEmailAuthEnabled()) {
    res.status(503).json({ error: 'Email sign-in is not enabled on this server.' });
    return;
  }
  const { email, code } = req.body as { email?: string; code?: string };
  if (!email?.trim() || !code?.trim()) {
    res.status(400).json({ error: 'email and code are required' });
    return;
  }
  if (!isEmailAllowed(email)) {
    res.status(403).json({ error: 'That email is not allowed.' });
    return;
  }
  if (!verifyAndConsumeCode(email, code)) {
    res.status(401).json({ error: 'Invalid or expired code.' });
    return;
  }
  const token = signSessionToken(email);
  if (!token) {
    res.status(503).json({ error: 'Could not create session (server JWT secret).' });
    return;
  }
  res.json({ token, email: email.trim().toLowerCase() });
});

export default router;
