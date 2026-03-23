import type { Request } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { verifySessionToken, isEmailAllowed } from './email-signin.js';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

export type ResolvedAi =
  | { ok: true; provider: 'anthropic'; key: string }
  | { ok: true; provider: 'openai'; key: string; model: string }
  | { ok: false; error: string };

function header(req: Request, name: string): string {
  const v = req.headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0] ?? '';
  return typeof v === 'string' ? v : '';
}

/**
 * X-Query-Hub-AI-Provider: server | email_team | anthropic | openai
 * Authorization: Bearer <session> (email_team — work email sign-in)
 * X-Query-Hub-Anthropic-Key / X-Query-Hub-OpenAI-Key: personal API keys
 */
export function resolveAiCredentials(req: Request): ResolvedAi {
  const mode = (header(req, 'x-query-hub-ai-provider') || 'server').toLowerCase();

  if (mode === 'email_team') {
    const auth = header(req, 'authorization');
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    const token = m?.[1]?.trim() ?? '';
    if (!token) {
      return {
        ok: false,
        error:
          'Team (email): sign in under AI → Connection, or use a personal API key / server default.',
      };
    }
    const email = verifySessionToken(token);
    if (!email || !isEmailAllowed(email)) {
      return {
        ok: false,
        error: 'Email session expired or no longer allowed. Sign in again with a new code.',
      };
    }
    const ak = process.env.ANTHROPIC_API_KEY?.trim();
    if (ak) return { ok: true, provider: 'anthropic', key: ak };
    const ok = process.env.OPENAI_API_KEY?.trim();
    if (ok) {
      const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
      return { ok: true, provider: 'openai', key: ok, model };
    }
    return {
      ok: false,
      error:
        'Team AI keys are not configured on the server. Admin must set ANTHROPIC_API_KEY or OPENAI_API_KEY.',
    };
  }

  if (mode === 'server') {
    const ak = process.env.ANTHROPIC_API_KEY?.trim();
    if (ak) return { ok: true, provider: 'anthropic', key: ak };
    const ok = process.env.OPENAI_API_KEY?.trim();
    if (ok) {
      const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
      return { ok: true, provider: 'openai', key: ok, model };
    }
    return {
      ok: false,
      error:
        'AI disabled: server has no ANTHROPIC_API_KEY or OPENAI_API_KEY. Use AI settings with your own key, or ask your admin to set env vars.',
    };
  }

  if (mode === 'openai') {
    const k = header(req, 'x-query-hub-openai-key').trim() || process.env.OPENAI_API_KEY?.trim();
    if (!k) {
      return {
        ok: false,
        error:
          'OpenAI: add your API key in Query Hub → AI settings (or set OPENAI_API_KEY on the server). Note: ChatGPT Plus is not the same as the API — use platform.openai.com API keys.',
      };
    }
    const model =
      header(req, 'x-query-hub-openai-model').trim() || process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
    return { ok: true, provider: 'openai', key: k, model };
  }

  const k = header(req, 'x-query-hub-anthropic-key').trim() || process.env.ANTHROPIC_API_KEY?.trim();
  if (!k) {
    return {
      ok: false,
      error:
        'Claude: add your API key in Query Hub → AI settings (or set ANTHROPIC_API_KEY on the server).',
    };
  }
  return { ok: true, provider: 'anthropic', key: k };
}

export async function runAnthropic(
  key: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<{ text: string; model: string }> {
  const client = new Anthropic({ apiKey: key });
  const resp = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const text = resp.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  return { text, model: CLAUDE_MODEL };
}

export async function runOpenai(
  key: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<{ text: string; model: string }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j.error?.message) msg = j.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg || `OpenAI HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  return { text, model: data.model ?? model };
}

export async function runAiCompletion(
  req: Request,
  system: string,
  user: string,
  maxTokens: number,
): Promise<{ text: string; model: string }> {
  const r = resolveAiCredentials(req);
  if (!r.ok) {
    const e = new Error(r.error) as Error & { status?: number };
    e.status = 503;
    throw e;
  }
  if (r.provider === 'anthropic') {
    return runAnthropic(r.key, system, user, maxTokens);
  }
  return runOpenai(r.key, r.model, system, user, maxTokens);
}

export function aiErrorStatus(e: unknown): number {
  return typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status: unknown }).status === 'number'
    ? (e as { status: number }).status
    : 500;
}
