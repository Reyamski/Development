import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);

// ===== SSO Config =====
// Auto-detected from ~/.aws/config (first sso-session found).
// Override with env vars: AWS_SSO_START_URL, AWS_SSO_REGION

let _cachedSsoConfig: { startUrl: string; region: string; sessionName: string } | null | undefined = undefined;

async function readSsoConfigFromFile(): Promise<{ startUrl: string; region: string; sessionName: string } | null> {
  const configPath = path.join(os.homedir(), '.aws', 'config');
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const sessionMatch = content.match(/\[sso-session ([^\]]+)\]/);
    const startUrl = content.match(/sso_start_url\s*=\s*(.+)/)?.[1]?.trim();
    const region = content.match(/sso_region\s*=\s*(.+)/)?.[1]?.trim();
    return startUrl ? { startUrl, region: region || 'us-east-1', sessionName: sessionMatch?.[1]?.trim() || '' } : null;
  } catch {
    return null;
  }
}

async function getSsoConfig(): Promise<{ startUrl: string; region: string; sessionName: string } | null> {
  if (_cachedSsoConfig === undefined) _cachedSsoConfig = await readSsoConfigFromFile();
  return _cachedSsoConfig;
}

async function getSsoSessionName(): Promise<string | null> {
  if (process.env.AWS_SSO_SESSION) return process.env.AWS_SSO_SESSION;
  const config = await getSsoConfig();
  return config?.sessionName || null;
}

async function getSsoStartUrl(): Promise<string> {
  if (process.env.AWS_SSO_START_URL) return process.env.AWS_SSO_START_URL;
  const config = await getSsoConfig();
  if (config?.startUrl) return config.startUrl;
  throw new Error('AWS SSO start URL not found. Set AWS_SSO_START_URL env var or configure an sso-session in ~/.aws/config.');
}

async function getSsoRegion(): Promise<string> {
  if (process.env.AWS_SSO_REGION) return process.env.AWS_SSO_REGION;
  const config = await getSsoConfig();
  return config?.region || 'us-east-1';
}

export interface RdsInstanceConfig {
  provisionedIops: number;
  storageType: string;
  allocatedStorageGb: number;
  instanceClass: string;
  engine: string;
  engineVersion: string;
}

/**
 * Get the SSO access token from the cached SSO session.
 */
async function getSsoAccessToken(): Promise<string | null> {
  const cacheDir = path.join(os.homedir(), '.aws', 'sso', 'cache');
  try {
    const files = await fs.readdir(cacheDir);
    let bestToken: string | null = null;
    let bestTime = 0;
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(cacheDir, file);
      const stat = await fs.stat(filePath);
      if (stat.mtimeMs <= bestTime) continue;
      try {
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        if (data.accessToken && data.expiresAt) {
          const expires = new Date(data.expiresAt).getTime();
          if (expires > Date.now()) {
            bestToken = data.accessToken;
            bestTime = stat.mtimeMs;
          }
        }
      } catch { /* skip corrupt files */ }
    }
    return bestToken;
  } catch {
    return null;
  }
}

/**
 * Find an SSO role that can read RDS config for the given account.
 * Prefers DBALimited > DeveloperAccessReadOnly > any role with ReadOnly/DBA in name.
 */
async function findSsoRole(accountId: string, accessToken: string): Promise<string | null> {
  try {
    const region = await getSsoRegion();
    const { stdout } = await execFileAsync('aws', [
      'sso', 'list-account-roles',
      '--account-id', accountId,
      '--access-token', accessToken,
      '--region', region,
      '--output', 'json',
    ], { timeout: 10_000 });

    const data = JSON.parse(stdout);
    const roles: string[] = (data.roleList || []).map((r: any) => r.roleName);

    const preferred = ['DBALimited', 'DeveloperAccessReadOnly'];
    for (const pref of preferred) {
      if (roles.includes(pref)) return pref;
    }
    const fallback = roles.find(r => /readonly|dba/i.test(r));
    return fallback || roles[0] || null;
  } catch {
    return null;
  }
}

/**
 * Ensure an AWS CLI profile exists for the given account/role combo.
 * Creates it in ~/.aws/config if missing.
 */
async function ensureProfile(accountId: string, region: string, roleName: string): Promise<string> {
  const profileName = `rds-dba-${accountId}`;
  const configPath = path.join(os.homedir(), '.aws', 'config');

  let existing = '';
  try {
    existing = await fs.readFile(configPath, 'utf-8');
  } catch { /* file doesn't exist yet */ }

  const profileHeader = `[profile ${profileName}]`;
  if (!existing.includes(profileHeader)) {
    const sessionName = await getSsoSessionName();
    let block: string;
    if (sessionName) {
      // New-style: reference sso-session by name (token reuse)
      block = `\n${profileHeader}\nsso_session = ${sessionName}\nsso_account_id = ${accountId}\nsso_role_name = ${roleName}\nregion = ${region}\n`;
    } else {
      // Old-style fallback: inline sso_start_url
      const startUrl = await getSsoStartUrl();
      const ssoRegion = await getSsoRegion();
      block = `\n${profileHeader}\nsso_start_url = ${startUrl}\nsso_region = ${ssoRegion}\nsso_account_id = ${accountId}\nsso_role_name = ${roleName}\nregion = ${region}\n`;
    }
    await fs.appendFile(configPath, block);
  }

  return profileName;
}

/**
 * Resolve an AWS CLI profile name for the given account.
 * Prefers an existing profile in ~/.aws/config (rds-dba-<accountId> or any profile
 * with matching sso_account_id that prefers DBALimited). Falls back to creating one
 * dynamically via the SSO API.
 */
export async function getAwsProfile(accountId: string, region: string): Promise<string> {
  const configPath = path.join(os.homedir(), '.aws', 'config');

  try {
    const content = await fs.readFile(configPath, 'utf-8');

    // 1. Check our auto-created profile first
    const autoProfile = `rds-dba-${accountId}`;
    if (content.includes(`[profile ${autoProfile}]`)) return autoProfile;

    // 2. Find any existing profile for this account (prefer DBALimited)
    const profileBlocks = content.split(/(?=\[profile )/);
    const candidates: string[] = [];
    for (const block of profileBlocks) {
      const nameMatch = block.match(/^\[profile ([^\]]+)\]/);
      if (!nameMatch) continue;
      if (!block.includes(`sso_account_id = ${accountId}`)) continue;
      candidates.push(nameMatch[1].trim());
    }
    if (candidates.length > 0) {
      return candidates.find(n => /dba/i.test(n)) || candidates[0];
    }
  } catch { /* ignore */ }

  // 3. Profile not found — create it via SSO API
  const accessToken = await getSsoAccessToken();
  if (!accessToken) {
    throw new Error('No valid AWS SSO session. Run "aws sso login --sso-session <session-name>" first.');
  }
  const roleName = await findSsoRole(accountId, accessToken);
  if (!roleName) {
    throw new Error(`No SSO roles available for account ${accountId}`);
  }
  return ensureProfile(accountId, region, roleName);
}

/**
 * Fetch RDS instance config (provisioned IOPS, storage type, etc.)
 * using AWS CLI with SSO credentials.
 */
export async function getRdsInstanceConfig(
  accountId: string,
  region: string,
  instanceId: string,
): Promise<RdsInstanceConfig | null> {
  const profileName = await getAwsProfile(accountId, region);

  const { stdout } = await execFileAsync('aws', [
    'rds', 'describe-db-instances',
    '--db-instance-identifier', instanceId,
    '--region', region,
    '--profile', profileName,
    '--query', 'DBInstances[0].{Iops:Iops,StorageType:StorageType,AllocatedStorage:AllocatedStorage,DBInstanceClass:DBInstanceClass,Engine:Engine,EngineVersion:EngineVersion}',
    '--output', 'json',
  ], { timeout: 15_000 });

  const data = JSON.parse(stdout);
  if (!data) return null;

  return {
    provisionedIops: data.Iops || 0,
    storageType: data.StorageType || '',
    allocatedStorageGb: data.AllocatedStorage || 0,
    instanceClass: data.DBInstanceClass || '',
    engine: data.Engine || '',
    engineVersion: data.EngineVersion || '',
  };
}

/**
 * Start AWS SSO login for the resolved profile.
 * Fire-and-forget: opens browser for re-authentication.
 */
export async function startAwsSsoLogin(accountId: string, region: string): Promise<{ started: boolean; profileName: string }> {
  const profileName = await getAwsProfile(accountId, region);
  const child = spawn('aws', ['sso', 'login', '--profile', profileName], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  return { started: true, profileName };
}
