import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { mkdir } from 'fs/promises';

const execFileAsync = promisify(execFile);

export function isS3Path(p: string): boolean {
  return p.startsWith('s3://');
}

/**
 * Sync an S3 path to a stable local cache directory.
 * Returns the local directory path and an ISO timestamp.
 */
export async function syncFromS3(s3Path: string): Promise<{ localPath: string; syncedAt: string }> {
  const hash = crypto.createHash('md5').update(s3Path).digest('hex').slice(0, 8);
  const localPath = path.join(os.tmpdir(), 'schema-compare-s3', hash);
  await mkdir(localPath, { recursive: true });

  await execFileAsync('aws', ['s3', 'sync', s3Path, localPath, '--delete'], {
    timeout: 120000,
  });

  return { localPath, syncedAt: new Date().toISOString() };
}

/**
 * Sync a local directory up to an S3 path.
 */
export async function syncToS3(localPath: string, s3Path: string): Promise<void> {
  await execFileAsync('aws', ['s3', 'sync', localPath, s3Path], {
    timeout: 120000,
  });
}
