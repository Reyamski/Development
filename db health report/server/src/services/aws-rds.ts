import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { RdsInstanceConfig } from '../types.js';

const execFileAsync = promisify(execFile);
const SSO_REGION = process.env.AWS_SSO_REGION || 'us-east-1';

async function getSsoStartUrl(): Promise<string> {
  if (process.env.AWS_SSO_START_URL) return process.env.AWS_SSO_START_URL;
  try {
    const configPath = path.join(os.homedir(), '.aws', 'config');
    const content = await fs.readFile(configPath, 'utf-8');
    const match = content.match(/sso_start_url\s*=\s*(https:\/\/\S+)/);
    if (match) return match[1];
  } catch { /* ignore */ }
  throw new Error('No AWS SSO start URL found. Set AWS_SSO_START_URL or configure a profile with sso_start_url in ~/.aws/config');
}

let _ssoStartUrl: string | null = null;
async function ssoStartUrl(): Promise<string> {
  if (!_ssoStartUrl) _ssoStartUrl = await getSsoStartUrl();
  return _ssoStartUrl;
}

export async function getSsoAccessToken(): Promise<string | null> {
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
  } catch { return null; }
}

async function findSsoRole(accountId: string, accessToken: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('aws', [
      'sso', 'list-account-roles',
      '--account-id', accountId, '--access-token', accessToken,
      '--region', SSO_REGION, '--output', 'json',
    ], { timeout: 10_000 });

    const data = JSON.parse(stdout);
    const roles: string[] = (data.roleList || []).map((r: any) => r.roleName);
    const preferred = ['DBALimited', 'DeveloperAccessReadOnly'];
    for (const pref of preferred) { if (roles.includes(pref)) return pref; }
    return roles.find(r => /readonly|dba/i.test(r)) || roles[0] || null;
  } catch { return null; }
}

async function ensureProfile(accountId: string, region: string, roleName: string): Promise<string> {
  const profileName = `db-health-${accountId}`;
  const configPath = path.join(os.homedir(), '.aws', 'config');

  let existing = '';
  try { existing = await fs.readFile(configPath, 'utf-8'); } catch { /* file doesn't exist */ }

  const startUrl = await ssoStartUrl();
  const profileHeader = `[profile ${profileName}]`;
  if (!existing.includes(profileHeader)) {
    const block = `\n${profileHeader}\nsso_start_url = ${startUrl}\nsso_region = ${SSO_REGION}\nsso_account_id = ${accountId}\nsso_role_name = ${roleName}\nregion = ${region}\n`;
    await fs.appendFile(configPath, block);
  }
  return profileName;
}

export async function getAwsProfile(accountId: string, region: string): Promise<string> {
  const configPath = path.join(os.homedir(), '.aws', 'config');
  try {
    const content = await fs.readFile(configPath, 'utf-8');

    // Check for auto-created profiles from any DBA tool
    for (const prefix of ['db-health-', 'rds-iop-', 'rds-lag-']) {
      const autoProfile = `${prefix}${accountId}`;
      if (content.includes(`[profile ${autoProfile}]`)) return autoProfile;
    }

    const profileBlocks = content.split(/(?=\[profile )/);
    const candidates: string[] = [];
    for (const block of profileBlocks) {
      const nameMatch = block.match(/^\[profile ([^\]]+)\]/);
      if (!nameMatch) continue;
      if (!block.includes(`sso_account_id = ${accountId}`)) continue;
      candidates.push(nameMatch[1].trim());
    }
    if (candidates.length > 0) {
      return candidates.find(name => /dba|readonly/i.test(name)) || candidates[0];
    }
  } catch { /* ignore */ }

  const accessToken = await getSsoAccessToken();
  if (!accessToken) throw new Error('No valid AWS SSO session. Run "aws sso login" first.');
  const roleName = await findSsoRole(accountId, accessToken);
  if (!roleName) throw new Error(`No SSO roles available for account ${accountId}`);
  return ensureProfile(accountId, region, roleName);
}

export async function startAwsSsoLogin(accountId: string, region: string): Promise<{ started: boolean; profileName: string }> {
  const profileName = await getAwsProfile(accountId, region);
  const child = spawn('aws', ['sso', 'login', '--profile', profileName], {
    detached: true, stdio: 'ignore', windowsHide: true,
  });
  child.unref();
  return { started: true, profileName };
}

export async function getRdsInstanceConfig(
  accountId: string, region: string, instanceId: string,
): Promise<RdsInstanceConfig | null> {
  const profileName = await getAwsProfile(accountId, region);
  const { stdout } = await execFileAsync('aws', [
    'rds', 'describe-db-instances',
    '--db-instance-identifier', instanceId,
    '--region', region, '--profile', profileName,
    '--query', 'DBInstances[0].{Iops:Iops,StorageType:StorageType,AllocatedStorage:AllocatedStorage,DBInstanceClass:DBInstanceClass,Engine:Engine,EngineVersion:EngineVersion,ReadReplicaSource:ReadReplicaSourceDBInstanceIdentifier,ReadReplicaIds:ReadReplicaDBInstanceIdentifiers,ParamGroups:DBParameterGroups}',
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
    readReplicaSource: data.ReadReplicaSource || null,
    readReplicaIds: data.ReadReplicaIds || [],
    parameterGroupName: data.ParamGroups?.[0]?.DBParameterGroupName || null,
  };
}
