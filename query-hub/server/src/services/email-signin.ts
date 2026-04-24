import { createHmac, randomInt, timingSafeEqual } from 'crypto';

const CODE_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REQUESTS_PER_IP_PER_HOUR = 20;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const pendingCodes = new Map<string, { code: string; exp: number }>();

/** Simple IP bucket for request-code rate limit */
const ipBuckets = new Map<string, { count: number; resetAt: number }>();

export function isEmailAuthEnabled(): boolean {
  return process.env.QUERY_HUB_EMAIL_AUTH?.trim().toLowerCase() === 'true';
}

export function assertEmailAuthConfigured(): void {
  if (!isEmailAuthEnabled()) return;
  const secret = process.env.QUERY_HUB_JWT_SECRET?.trim();
  if (!secret || secret.length < 16) {
    console.warn(
      '[Query Hub] QUERY_HUB_EMAIL_AUTH=true but QUERY_HUB_JWT_SECRET is missing or too short (use 32+ random bytes).',
    );
  }
  const domain = process.env.QUERY_HUB_EMAIL_DOMAIN?.trim();
  const allow = process.env.QUERY_HUB_ALLOWED_EMAILS?.trim();
  if (!domain && !allow) {
    console.warn(
      '[Query Hub] QUERY_HUB_EMAIL_AUTH=true but set QUERY_HUB_EMAIL_DOMAIN (e.g. partech.com) or QUERY_HUB_ALLOWED_EMAILS.',
    );
  }
}

export function isEmailAllowed(email: string): boolean {
  const n = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n)) return false;

  const allow = process.env.QUERY_HUB_ALLOWED_EMAILS?.trim();
  if (allow) {
    const set = new Set(
      allow
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    return set.has(n);
  }

  const domain = process.env.QUERY_HUB_EMAIL_DOMAIN?.trim().toLowerCase();
  if (domain) {
    return n.endsWith(`@${domain}`);
  }

  return false;
}

function bucketKey(ip: string): string {
  return ip || 'unknown';
}

export function rateLimitRequestCode(ip: string): boolean {
  const now = Date.now();
  const k = bucketKey(ip);
  const b = ipBuckets.get(k);
  const windowMs = 60 * 60 * 1000;
  if (!b || now > b.resetAt) {
    ipBuckets.set(k, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= MAX_REQUESTS_PER_IP_PER_HOUR) return false;
  b.count += 1;
  return true;
}

export function createAndStoreCode(email: string): string {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const key = normalizeEmail(email);
  pendingCodes.set(key, { code, exp: Date.now() + CODE_TTL_MS });
  return code;
}

export function verifyAndConsumeCode(email: string, code: string): boolean {
  const key = normalizeEmail(email);
  const row = pendingCodes.get(key);
  if (!row) return false;
  if (Date.now() > row.exp) {
    pendingCodes.delete(key);
    return false;
  }
  const a = Buffer.from(row.code, 'utf8');
  const b = Buffer.from(code.trim(), 'utf8');
  if (a.length !== b.length) return false;
  const ok = timingSafeEqual(a, b);
  if (ok) pendingCodes.delete(key);
  return ok;
}

export function logCodeForDev(email: string, code: string): void {
  const log =
    process.env.NODE_ENV !== 'production' || process.env.QUERY_HUB_EMAIL_LOG_CODES?.trim() === 'true';
  if (log) {
    console.log(`[Query Hub email auth] Sign-in code for ${normalizeEmail(email)}: ${code}`);
  }
}

export function signSessionToken(email: string): string | null {
  const secret = process.env.QUERY_HUB_JWT_SECRET?.trim();
  if (!secret || secret.length < 16) return null;
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ email: normalizeEmail(email), exp }), 'utf8').toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  const secret = process.env.QUERY_HUB_JWT_SECRET?.trim();
  if (!secret) return null;
  const i = token.lastIndexOf('.');
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  try {
    if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  } catch {
    return null;
  }
  try {
    const j = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email?: string; exp?: number };
    if (typeof j.email !== 'string' || typeof j.exp !== 'number') return null;
    if (Date.now() > j.exp) return null;
    return j.email;
  } catch {
    return null;
  }
}
