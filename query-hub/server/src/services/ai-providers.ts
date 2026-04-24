import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';

/**
 * Resolve Bedrock credentials from server-side env vars only.
 * No client-driven account selection — credentials never pass through the browser.
 *
 * Required env vars:
 *   QUERY_HUB_BEDROCK_MODEL_ID  — org-approved model (e.g. anthropic.claude-3-5-sonnet-20241022-v2:0)
 *   QUERY_HUB_BEDROCK_PROFILE   — AWS profile with bedrock:InvokeModel permission
 *
 * Optional:
 *   QUERY_HUB_BEDROCK_REGION    — defaults to us-east-1
 */
function resolveBedrockConfig(): { profile: string; region: string; modelId: string } {
  const modelId = process.env.QUERY_HUB_BEDROCK_MODEL_ID?.trim();
  if (!modelId) {
    throw Object.assign(
      new Error(
        'QUERY_HUB_BEDROCK_MODEL_ID is not set on the server. Ask your admin to configure the approved Bedrock model ID.',
      ),
      { status: 503 },
    );
  }

  const profile =
    process.env.QUERY_HUB_BEDROCK_PROFILE?.trim() ||
    process.env.AWS_PROFILE?.trim() ||
    'default';

  const region = process.env.QUERY_HUB_BEDROCK_REGION?.trim() || 'us-east-1';

  return { profile, region, modelId };
}

export async function runAiCompletion(
  system: string,
  user: string,
  maxTokens: number,
): Promise<{ text: string; model: string }> {
  const { profile, region, modelId } = resolveBedrockConfig();

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

export function aiErrorStatus(e: unknown): number {
  return typeof e === 'object' &&
    e !== null &&
    'status' in e &&
    typeof (e as { status: unknown }).status === 'number'
    ? (e as { status: number }).status
    : 500;
}
