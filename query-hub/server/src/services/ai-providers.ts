import type { Request } from 'express';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';
import { getKiroAwsProfile } from './kiro-aws-sso.js';
import { runKiroCliChat, useKiroCliBackend } from './kiro-cli-runner.js';

export type ResolvedAi =
  | { ok: true; provider: 'bedrock'; profile: string; region: string; modelId: string }
  | { ok: false; error: string };

function header(req: Request, name: string): string {
  const v = req.headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0] ?? '';
  return typeof v === 'string' ? v : '';
}

/** Server-only Bedrock when QUERY_HUB_BEDROCK_PROFILE (+ model id env) set — no account header. */
function bedrockProfileFromEnv(): { profile: string; region: string } | null {
  const profile =
    process.env.QUERY_HUB_BEDROCK_PROFILE?.trim() || process.env.AWS_PROFILE?.trim() || '';
  const region = process.env.QUERY_HUB_BEDROCK_REGION?.trim() || 'us-east-1';
  if (!profile) return null;
  return { profile, region };
}

/**
 * Kiro / AI completion:
 * - **`QUERY_HUB_USE_KIRO_CLI=true`** → always **Kiro CLI** (`kiro-cli chat --no-interactive`).
 * - Else if **`QUERY_HUB_BEDROCK_MODEL_ID`** is unset → try **Kiro CLI once** (workaround when you have Kiro access but no Bedrock IAM). Disable with **`QUERY_HUB_DISABLE_KIRO_CLI_FALLBACK=true`**.
 * - Else **Amazon Bedrock** `Converse`:
 *   - Optional `QUERY_HUB_BEDROCK_ACCOUNT_ID` (split account vs Teleport RDS).
 *   - Else headers / `QUERY_HUB_BEDROCK_PROFILE` + model ID from env.
 */
export async function resolveAiCredentials(req: Request): Promise<ResolvedAi> {
  const modelId = process.env.QUERY_HUB_BEDROCK_MODEL_ID?.trim() || '';
  if (!modelId) {
    return {
      ok: false,
      error:
        'Kiro: QUERY_HUB_BEDROCK_MODEL_ID must be set on the Query Hub API server (org-approved Bedrock model).',
    };
  }

  const headerAccount = header(req, 'x-query-hub-aws-account-id').trim();
  const forcedAccount = process.env.QUERY_HUB_BEDROCK_ACCOUNT_ID?.trim() || '';
  const accountId = forcedAccount || headerAccount;
  const region =
    header(req, 'x-query-hub-bedrock-region').trim() ||
    process.env.QUERY_HUB_BEDROCK_REGION?.trim() ||
    'us-east-1';

  if (accountId) {
    try {
      const profile = await getKiroAwsProfile(accountId, region);
      return { ok: true, provider: 'bedrock', profile, region, modelId };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Failed to resolve AWS SSO profile for Kiro',
      };
    }
  }

  const envProfile = bedrockProfileFromEnv();
  if (envProfile) {
    return {
      ok: true,
      provider: 'bedrock',
      profile: envProfile.profile,
      region: envProfile.region,
      modelId,
    };
  }

  return {
    ok: false,
    error:
      'Select an AWS account in Kiro → Connection and sign in with AWS SSO, or configure QUERY_HUB_BEDROCK_PROFILE + QUERY_HUB_BEDROCK_MODEL_ID on the API server.',
  };
}

export async function runBedrock(
  profile: string,
  region: string,
  modelId: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<{ text: string; model: string }> {
  const client = new BedrockRuntimeClient({
    region,
    credentials: fromIni({ profile }),
  });
  const max = Math.min(Math.max(maxTokens, 1), 8192);
  const command = new ConverseCommand({
    modelId,
    system: [{ text: system }],
    messages: [{ role: 'user', content: [{ text: user }] }],
    inferenceConfig: {
      maxTokens: max,
      temperature: 0.2,
    },
  });
  const out = await client.send(command);
  const blocks = out.output?.message?.content;
  let text = '';
  if (blocks) {
    for (const b of blocks) {
      if (b && 'text' in b && typeof b.text === 'string') text += b.text;
    }
  }
  return { text, model: modelId };
}

export async function runAiCompletion(
  req: Request,
  system: string,
  user: string,
  maxTokens: number,
): Promise<{ text: string; model: string }> {
  const full = `${system}\n\n---\n\n${user}`.trim();

  if (useKiroCliBackend()) {
    return runKiroCliChat(full);
  }

  const modelIdEnv = process.env.QUERY_HUB_BEDROCK_MODEL_ID?.trim() || '';
  const tryCliIfNoBedrock =
    !modelIdEnv && process.env.QUERY_HUB_DISABLE_KIRO_CLI_FALLBACK?.trim().toLowerCase() !== 'true';

  if (tryCliIfNoBedrock) {
    try {
      return await runKiroCliChat(full);
    } catch (cliErr) {
      const cliHint = cliErr instanceof Error ? cliErr.message : String(cliErr);
      const e = new Error(
        `No QUERY_HUB_BEDROCK_MODEL_ID on the server, and automatic Kiro CLI fallback failed:\n${cliHint}\n\n` +
          `Fix one of: (1) Set QUERY_HUB_BEDROCK_MODEL_ID for Bedrock. (2) On the API host: install Kiro CLI, run kiro-cli login, ensure kiro-cli is on PATH (or QUERY_HUB_KIRO_CLI_PATH). (3) Set QUERY_HUB_USE_KIRO_CLI=true to use only Kiro CLI.`,
      ) as Error & { status?: number };
      e.status = 503;
      throw e;
    }
  }

  const r = await resolveAiCredentials(req);
  if (!r.ok) {
    const e = new Error(r.error) as Error & { status?: number };
    e.status = 503;
    throw e;
  }
  return runBedrock(r.profile, r.region, r.modelId, system, user, maxTokens);
}

export function aiErrorStatus(e: unknown): number {
  return typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status: unknown }).status === 'number'
    ? (e as { status: number }).status
    : 500;
}
