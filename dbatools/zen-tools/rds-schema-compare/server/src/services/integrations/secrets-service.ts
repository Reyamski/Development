import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { SecretsConfig, AwsSecretValue, SecretsTestResponse } from './types.js';

function createClient(config: SecretsConfig): SecretsManagerClient {
  const credentials = fromNodeProviderChain(
    config.profile ? { profile: config.profile } : {}
  );
  return new SecretsManagerClient({
    region: config.region,
    credentials,
  });
}

export async function fetchSecret(config: SecretsConfig): Promise<AwsSecretValue> {
  const client = createClient(config);
  const cmd = new GetSecretValueCommand({ SecretId: config.secretName });
  const response = await client.send(cmd);

  if (!response.SecretString) {
    throw new Error('Secret has no string value (binary secrets are not supported)');
  }

  try {
    return JSON.parse(response.SecretString) as AwsSecretValue;
  } catch {
    throw new Error('Secret value is not valid JSON');
  }
}

export async function testSecret(config: SecretsConfig): Promise<SecretsTestResponse> {
  try {
    const value = await fetchSecret(config);
    const keys = Object.keys(value);
    return { valid: true, keys };
  } catch (err: any) {
    return { valid: false, keys: [], error: err.message };
  }
}
