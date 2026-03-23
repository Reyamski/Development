import { execFile, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { TeleportTunnel, TeleportInstance, TeleportStatus } from '../types.js';

const execFileAsync = promisify(execFile);

const TELEPORT_CONNECT_TSH =
  '/Applications/Teleport Connect.app/Contents/MacOS/tsh.app/Contents/MacOS/tsh';
const TSH_DIR = path.join(os.homedir(), '.tsh');
const TUNNEL_READY_TIMEOUT = 15_000;
const WINDOWS_TSH_CANDIDATES = [
  path.join(
    process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'),
    'Microsoft', 'WinGet', 'Packages',
    'Gravitational.Teleport_Microsoft.Winget.Source_8wekyb3d8bbwe', 'tsh.exe',
  ),
  path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'Microsoft', 'WindowsApps', 'tsh.exe'),
  path.join(process.env['ProgramFiles'] ?? 'C:\\Program Files', 'Teleport', 'tsh.exe'),
];

const activeTunnels = new Map<string, TeleportTunnel>();

export function registerTunnel(tunnel: TeleportTunnel): void {
  activeTunnels.set(tunnel.dbName, tunnel);
}

export function unregisterTunnel(dbName: string): void {
  activeTunnels.delete(dbName);
}

export function getActiveTunnel(dbName: string): TeleportTunnel | undefined {
  return activeTunnels.get(dbName);
}

export async function cleanupAll(): Promise<void> {
  if (activeTunnels.size === 0) return;
  const entries = Array.from(activeTunnels.entries());
  activeTunnels.clear();

  let tsh: string | null = null;
  try { tsh = await findTsh(); } catch { /* ignore */ }

  for (const [dbName, tunnel] of entries) {
    try { tunnel.process.kill('SIGTERM'); } catch { /* ignore */ }
    if (tsh) {
      try { await execFileAsync(tsh, ['db', 'logout', dbName], { timeout: 5_000 }); } catch { /* ignore */ }
    }
  }
  console.log(`[cleanup] Cleaned up ${entries.length} tunnel(s)`);
}

export async function findTsh(override?: string): Promise<string> {
  const configuredPath = override ?? process.env.TSH_PATH ?? process.env.tsh_path;
  if (configuredPath) {
    try {
      await fs.access(configuredPath, fs.constants.F_OK);
      return configuredPath;
    } catch {
      throw new Error(`Configured tsh path not found: ${configuredPath}`);
    }
  }

  try {
    const resolver = process.platform === 'win32' ? 'where' : 'which';
    const { stdout } = await execFileAsync(resolver, ['tsh']);
    const tshPaths = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const tshPath of tshPaths) {
      try { await fs.access(tshPath, fs.constants.F_OK); return tshPath; } catch { /* next */ }
    }
  } catch { /* not in PATH */ }

  if (process.platform === 'darwin') {
    try { await fs.access(TELEPORT_CONNECT_TSH, fs.constants.F_OK); return TELEPORT_CONNECT_TSH; } catch { /* not installed */ }
  }

  if (process.platform === 'win32') {
    for (const tshPath of WINDOWS_TSH_CANDIDATES) {
      try { await fs.access(tshPath, fs.constants.F_OK); return tshPath; } catch { /* next */ }
    }
  }

  throw new Error('Could not find tsh binary. Install Teleport or set TSH_PATH.');
}

export async function getClusters(): Promise<string[]> {
  try {
    const files = await fs.readdir(TSH_DIR);
    return files.filter(f => f.endsWith('.yaml')).map(f => f.replace(/\.yaml$/, '')).sort();
  } catch { return []; }
}

export async function getLoginStatus(tsh: string, cluster?: string): Promise<TeleportStatus> {
  try {
    const { stdout } = await execFileAsync(tsh, ['status', '--format=json'], { timeout: 10_000 })
      .catch(err => {
        if (err.stdout) return { stdout: err.stdout as string };
        throw err;
      });

    if (!stdout.trim()) return { loggedIn: false, username: '' };

    const status = JSON.parse(stdout);
    const active = status?.active ?? {};

    if (!cluster || active.cluster === cluster) {
      if (active.username) return { loggedIn: true, username: active.username, cluster: active.cluster };
    }

    const profiles: any[] = status?.profiles ?? [];
    for (const profile of profiles) {
      if (profile.cluster === cluster && profile.username) {
        return { loggedIn: true, username: profile.username, cluster: profile.cluster };
      }
    }

    if (!cluster && active.username) {
      return { loggedIn: true, username: active.username, cluster: active.cluster };
    }

    return { loggedIn: false, username: '' };
  } catch { return { loggedIn: false, username: '' }; }
}

export function loginToCluster(tsh: string, cluster: string): ChildProcess {
  return spawn(tsh, ['login', cluster], { stdio: ['ignore', 'pipe', 'pipe'] });
}

export async function listMysqlInstances(tsh: string, cluster: string): Promise<TeleportInstance[]> {
  const { stdout } = await execFileAsync(
    tsh, ['db', 'ls', `--proxy=${cluster}`, '--format=json'], { timeout: 30_000 },
  );

  let raw = JSON.parse(stdout);
  if (!Array.isArray(raw)) raw = [raw];

  const instances: TeleportInstance[] = [];
  for (const entry of raw) {
    const spec = entry?.spec ?? {};
    if (spec.protocol !== 'mysql') continue;
    const aws = spec.aws ?? {};
    const rds = aws.rds ?? {};
    instances.push({
      name: entry?.metadata?.name ?? '',
      uri: spec.uri ?? '',
      accountId: aws.account_id ?? '',
      region: aws.region ?? '',
      instanceId: rds.instance_id ?? '',
    });
  }
  return instances;
}

export async function startTunnel(
  tsh: string, dbName: string, dbUser: string, cluster?: string,
): Promise<TeleportTunnel> {
  const clusterArgs = cluster ? [`--proxy=${cluster}`] : [];

  await execFileAsync(tsh, ['db', 'login', dbName, `--db-user=${dbUser}`, ...clusterArgs], { timeout: 30_000 });

  const proc = spawn(tsh, ['proxy', 'db', '--tunnel', '--port', '0', dbName, ...clusterArgs], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const port = await waitForTunnelPort(proc);
  return { process: proc, host: '127.0.0.1', port, dbName, dbUser };
}

function waitForTunnelPort(proc: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    const pattern = /127\.0\.0\.1:(\d+)/;
    let collected = '';

    const timeout = setTimeout(() => {
      cleanup();
      proc.kill();
      reject(new Error(`Timed out waiting for tsh tunnel port. Output:\n${collected}`));
    }, TUNNEL_READY_TIMEOUT);

    function cleanup() {
      clearTimeout(timeout);
      proc.stdout?.removeAllListeners('data');
      proc.stderr?.removeAllListeners('data');
      proc.removeAllListeners('exit');
    }

    function onData(chunk: Buffer | string) {
      const text = chunk.toString();
      collected += text;
      const m = pattern.exec(text);
      if (m) { cleanup(); resolve(parseInt(m[1], 10)); }
    }

    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.on('exit', (code) => { cleanup(); reject(new Error(`tsh proxy exited with code ${code}. Output:\n${collected}`)); });
  });
}

export async function stopTunnel(tsh: string, tunnel: TeleportTunnel): Promise<void> {
  try {
    tunnel.process.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { tunnel.process.kill('SIGKILL'); resolve(); }, 5_000);
      tunnel.process.on('exit', () => { clearTimeout(timer); resolve(); });
    });
  } catch {
    try { tunnel.process.kill('SIGKILL'); } catch { /* ignore */ }
  }

  try {
    await execFileAsync(tsh, ['db', 'logout', tunnel.dbName], { timeout: 10_000 });
  } catch { console.warn(`Failed to logout from ${tunnel.dbName}`); }
}
