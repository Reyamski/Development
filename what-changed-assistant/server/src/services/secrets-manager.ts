import { execFile } from 'child_process';
import { promisify } from 'util';
import { getAwsProfile } from './aws-rds.js';

const execFileAsync = promisify(execFile);

/**
 * Hybrid secret retrieval: checks environment variables first, then AWS Secrets Manager.
 * For local dev: use .env file
 * For production: use AWS Secrets Manager
 */

interface SecretCache {
  value: string;
  fetchedAt: number;
}

const cache = new Map<string, SecretCache>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get a secret value. Tries in this order:
 * 1. Environment variable (for local dev)
 * 2. AWS Secrets Manager (for production)
 */
export async function getSecret(secretName: string, envVarName?: string): Promise<string> {
  // 1. Check environment variable first (local dev)
  const envVar = envVarName || secretName.replace(/[\/\-]/g, '_').toUpperCase();
  if (process.env[envVar]) {
    console.log(`[secrets] Using ${envVar} from environment`);
    return process.env[envVar]!;
  }

  // 2. Check cache
  const cached = cache.get(secretName);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    console.log(`[secrets] Using cached ${secretName}`);
    return cached.value;
  }

  // 3. Fetch from AWS Secrets Manager
  try {
    console.log(`[secrets] Fetching ${secretName} from AWS Secrets Manager`);
    const value = await fetchFromSecretsManager(secretName);
    cache.set(secretName, { value, fetchedAt: Date.now() });
    return value;
  } catch (error: any) {
    throw new Error(
      `Failed to get secret "${secretName}". ` +
      `Set environment variable ${envVar} for local dev, or ensure AWS Secrets Manager access. ` +
      `Error: ${error.message}`
    );
  }
}

/**
 * Fetch a secret from AWS Secrets Manager using AWS CLI with SSO profile.
 * Assumes AWS SSO login is already done.
 */
async function fetchFromSecretsManager(secretName: string): Promise<string> {
  // Default region for secrets (can be overridden by AWS_REGION env var)
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  
  // For secrets manager, we'll try to use a default profile or the first available SSO profile
  // If you have a specific account ID for secrets, pass it here
  let profileArgs: string[] = [];
  
  // Try to use default AWS credentials first
  try {
    const { stdout } = await execFileAsync('aws', [
      'secretsmanager', 'get-secret-value',
      '--secret-id', secretName,
      '--region', region,
      '--output', 'json',
    ], { timeout: 15_000 });

    const data = JSON.parse(stdout);
    return data.SecretString || '';
  } catch (error: any) {
    // If default credentials fail, try with SSO profile
    // You may need to configure a specific account ID here
    throw new Error(`Failed to fetch from Secrets Manager: ${error.message}. Run 'aws sso login' first.`);
  }
}

/**
 * Get Jira API token (hybrid: env or Secrets Manager)
 */
export async function getJiraToken(): Promise<string> {
  return getSecret('prod/jira/api-token', 'JIRA_API_TOKEN');
}

/**
 * Get Confluence API token (hybrid: env or Secrets Manager)
 */
export async function getConfluenceToken(): Promise<string> {
  return getSecret('prod/confluence/api-token', 'CONFLUENCE_API_TOKEN');
}

/**
 * Get Jira base URL (hybrid: env or Secrets Manager)
 */
export async function getJiraUrl(): Promise<string> {
  return process.env.JIRA_URL || getSecret('prod/jira/url', 'JIRA_URL');
}

/**
 * Get Jira email for authentication
 */
export async function getJiraEmail(): Promise<string> {
  return process.env.JIRA_EMAIL || getSecret('prod/jira/email', 'JIRA_EMAIL');
}

/**
 * Get Confluence base URL
 */
export async function getConfluenceUrl(): Promise<string> {
  return process.env.CONFLUENCE_URL || getSecret('prod/confluence/url', 'CONFLUENCE_URL');
}
