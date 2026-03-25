import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const execFileAsync = promisify(execFile);

const MAX_PROMPT_CHARS = 500_000;

const KIRO_INSTALL_DOC = 'https://kiro.dev/docs/cli/installation';

/**
 * Locate `kiro-cli` — **not** an npm dependency; install from AWS/Kiro docs.
 * Mirrors the idea of {@link findTsh} for Teleport.
 */
export async function findKiroCliBinary(): Promise<string | null> {
  const explicit = process.env.QUERY_HUB_KIRO_CLI_PATH?.trim();
  if (explicit) {
    try {
      await fs.access(explicit);
      return explicit;
    } catch {
      return null;
    }
  }

  const isWin = process.platform === 'win32';
  const home = os.homedir();

  const tryWhich = async (name: string): Promise<string | null> => {
    try {
      const cmd = isWin
        ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'where.exe')
        : 'which';
      const { stdout } = await execFileAsync(cmd, isWin ? [name] : [name], {
        timeout: 8_000,
        windowsHide: true,
      });
      const line = stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
      return line || null;
    } catch {
      return null;
    }
  };

  for (const name of ['kiro-cli', 'kiro']) {
    const w = await tryWhich(name);
    if (w) return w;
  }

  const localUnix = path.join(home, '.local', 'bin', isWin ? 'kiro-cli.exe' : 'kiro-cli');
  try {
    await fs.access(localUnix);
    return localUnix;
  } catch {
    /* continue */
  }

  if (isWin) {
    const localWin = path.join(process.env.USERPROFILE || home, '.local', 'bin', 'kiro-cli.exe');
    try {
      await fs.access(localWin);
      return localWin;
    } catch {
      /* continue */
    }
  }

  return null;
}

function notFoundError(): Error & { status?: number } {
  const e = new Error(
    `Kiro CLI not found on this machine (spawn ENOENT). It is not installed via npm — install from ${KIRO_INSTALL_DOC}, ` +
      `then run "kiro-cli login". If it is installed but Node cannot see it, set QUERY_HUB_KIRO_CLI_PATH to the full path of the binary ` +
      `(Windows: often add ~/.local/bin or the folder from the installer to PATH, or paste the full path to kiro-cli.exe).`,
  ) as Error & { status?: number };
  e.status = 503;
  return e;
}

/**
 * Run AWS Kiro via **Kiro CLI** (`kiro-cli chat --no-interactive`), not Bedrock Runtime API.
 * Requires `kiro-cli login` on the **same host** as the Query Hub API (see https://kiro.dev/docs/cli ).
 */
export async function runKiroCliChat(fullPrompt: string): Promise<{ text: string; model: string }> {
  const trimmed = fullPrompt.trim();
  if (!trimmed) {
    const e = new Error('Empty prompt') as Error & { status?: number };
    e.status = 400;
    throw e;
  }
  if (trimmed.length > MAX_PROMPT_CHARS) {
    const e = new Error(`Prompt exceeds ${MAX_PROMPT_CHARS} characters for Kiro CLI`) as Error & {
      status?: number;
    };
    e.status = 400;
    throw e;
  }

  const bin = await findKiroCliBinary();
  if (!bin) {
    throw notFoundError();
  }

  const timeoutMs = Math.min(Math.max(Number(process.env.QUERY_HUB_KIRO_CLI_TIMEOUT_MS) || 180_000, 5_000), 600_000);
  const maxBuffer = 16 * 1024 * 1024;

  let workdir = process.env.QUERY_HUB_KIRO_WORKDIR?.trim();
  if (!workdir) {
    workdir = path.join(os.tmpdir(), 'query-hub-kiro-sessions');
  }
  await fs.mkdir(workdir, { recursive: true });

  const args = ['chat', '--no-interactive', trimmed];

  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      cwd: workdir,
      timeout: timeoutMs,
      maxBuffer,
      windowsHide: true,
    });
    const text = stdout.trim();
    if (!text && stderr?.trim()) {
      const e = new Error(stderr.trim()) as Error & { status?: number };
      e.status = 503;
      throw e;
    }
    return { text: text || '(Kiro CLI returned empty output)', model: 'kiro-cli' };
  } catch (err: unknown) {
    const typed = err as NodeJS.ErrnoException & { status?: number };
    if (typed.status === 503) {
      throw err;
    }
    if (typed.code === 'ENOENT' || /ENOENT/i.test(String(typed.message))) {
      throw notFoundError();
    }
    const base = err instanceof Error ? err.message : String(err);
    const e = new Error(
      `Kiro CLI failed (${bin}). Run "kiro-cli login" on the API host. ${base}`,
    ) as Error & { status?: number };
    e.status = 503;
    throw e;
  }
}

export function useKiroCliBackend(): boolean {
  return process.env.QUERY_HUB_USE_KIRO_CLI?.trim().toLowerCase() === 'true';
}
