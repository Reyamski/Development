import { execFile, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import net from 'net';
import path from 'path';
import os from 'os';
import fs from 'fs';

const execFileAsync = promisify(execFile);

export interface TeleportStatus {
  loggedIn: boolean;
  user?: string;
  expires?: string;
  proxy?: string;
}

export interface TeleportDatabase {
  name: string;
  protocol: string;
  uri: string;
  region: string;
}

export async function getTshStatus(proxy: string): Promise<TeleportStatus> {
  try {
    const { stdout } = await execFileAsync('tsh', ['status', `--proxy=${proxy}`, '--format=json'], {
      timeout: 10000,
    });
    const data = JSON.parse(stdout);
    // tsh status JSON: { active: { profile_url, username, valid_until, ... } }
    const active = data?.active;
    if (!active) return { loggedIn: false };
    return {
      loggedIn: true,
      user: active.username,
      expires: active.valid_until,
      proxy: active.profile_url,
    };
  } catch {
    return { loggedIn: false };
  }
}

export async function listDatabases(proxy: string): Promise<TeleportDatabase[]> {
  const { stdout } = await execFileAsync('tsh', ['db', 'ls', `--proxy=${proxy}`, '--format=json'], {
    timeout: 30000,
  });
  const raw: any[] = JSON.parse(stdout);
  return raw
    .filter((db) => db.protocol === 'mysql' || db.spec?.protocol === 'mysql')
    .map((db) => {
      const name = db.metadata?.name || db.name || '';
      const spec = db.spec || db;
      const uri: string = spec.uri || spec.ad?.hostname || '';
      // Extract region from labels or URI
      const labels: Record<string, string> = db.metadata?.labels || db.labels || {};
      const region = labels['region'] || labels['aws/region'] || extractRegionFromUri(uri);
      return { name, protocol: 'mysql', uri, region };
    });
}

function extractRegionFromUri(uri: string): string {
  // RDS URIs like: mydb.cluster-xxxx.us-west-2.rds.amazonaws.com
  const match = uri.match(/\.([\w-]+-\d+)\.rds\.amazonaws\.com/);
  return match ? match[1] : 'unknown';
}

export async function loginDatabase(dbName: string, proxy: string): Promise<void> {
  await execFileAsync('tsh', ['db', 'login', dbName, `--proxy=${proxy}`], {
    timeout: 30000,
  });
}

export function loginTeleport(proxy: string): ChildProcess {
  return spawn('tsh', ['login', `--proxy=${proxy}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export interface TshDbCerts {
  ca: string;
  cert: string;
  key: string;
}

export async function getTshDbCerts(dbName: string, proxy: string, username: string): Promise<TshDbCerts> {
  const tshDir = path.join(os.homedir(), '.tsh', 'keys', proxy);
  const dbCertBase = path.join(tshDir, `${username}-db`);

  // Find the cluster subdirectory (usually same as proxy name)
  let clusterDir = path.join(dbCertBase, proxy);
  if (!fs.existsSync(clusterDir)) {
    // Scan for any subdirectory as fallback
    const subdirs = fs.readdirSync(dbCertBase).filter((d) =>
      fs.statSync(path.join(dbCertBase, d)).isDirectory()
    );
    if (subdirs.length === 0) {
      throw new Error(`No cluster cert dir found in ${dbCertBase}. Run: tsh db login ${dbName}`);
    }
    clusterDir = path.join(dbCertBase, subdirs[0]);
  }

  // Try .crt/.key (newer tsh) then -x509.pem (older tsh)
  const certCrt = path.join(clusterDir, `${dbName}.crt`);
  const certX509 = path.join(clusterDir, `${dbName}-x509.pem`);
  const cert = fs.existsSync(certCrt) ? certCrt : certX509;

  const keyCrt = path.join(clusterDir, `${dbName}.key`);
  const keyX509 = path.join(tshDir, username);
  const key = fs.existsSync(keyCrt) ? keyCrt : keyX509;

  const ca = path.join(tshDir, 'cas', `${proxy}.pem`);

  if (!fs.existsSync(cert)) {
    throw new Error(`DB cert not found at ${cert}. Run: tsh db login ${dbName} --proxy=${proxy}`);
  }
  if (!fs.existsSync(key)) {
    throw new Error(`DB key not found at ${key}`);
  }
  if (!fs.existsSync(ca)) {
    throw new Error(`CA cert not found at ${ca}`);
  }

  return { ca, cert, key };
}

export async function startProxyTunnel(dbName: string, port: number, proxy: string): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    // Note: no --tunnel flag — ALPN tunneling requires server-side config that may not be present.
    // tsh proxy db without --tunnel uses the certs from `tsh db login` and works universally.
    const proc = spawn('tsh', ['proxy', 'db', dbName, `--proxy=${proxy}`, `--port=${port}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let resolved = false;

    const done = (err?: Error) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(hardTimeout);
      clearInterval(portPoll);
      if (err) {
        proc.kill();
        reject(err);
      } else {
        resolve(proc);
      }
    };

    // Hard timeout — increased to 40s for slow proxies
    const hardTimeout = setTimeout(() => {
      done(new Error(`tsh proxy tunnel for ${dbName} timed out waiting to start`));
    }, 40000);

    // Text-based detection: cover multiple tsh version formats
    const onData = (data: Buffer) => {
      const text = data.toString().trim();
      if (text) console.log(`[tsh proxy db ${dbName}]`, text);
      if (
        text.includes('Started local proxy') ||
        text.includes('listening on') ||
        text.includes('Started DB proxy') ||
        text.includes('proxy on ') ||
        text.includes(`127.0.0.1:${port}`) ||
        text.includes(`localhost:${port}`)
      ) {
        done();
      }
    };

    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);

    // Port-ready fallback: poll every 500ms starting after 1s
    // This works regardless of what text tsh outputs
    const portPoll = setInterval(async () => {
      if (resolved) return;
      const ready = await isPortListening(port);
      if (ready) done();
    }, 500);

    // Delay the first poll slightly so the process has time to start
    setTimeout(() => {}, 1000);

    proc.on('error', (err) => done(err));

    proc.on('exit', (code) => {
      if (!resolved) {
        done(new Error(`tsh proxy exited with code ${code} before port ${port} became ready`));
      }
    });
  });
}

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port, host: '127.0.0.1' });
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => resolve(false));
    sock.setTimeout(300);
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
  });
}

export async function getAwsAccountId(): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'aws',
      ['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'],
      { timeout: 10000 }
    );
    return stdout.trim();
  } catch {
    return 'unknown';
  }
}

export async function findFreePort(start = 13300, end = 13400): Promise<number> {
  for (let port = start; port <= end; port++) {
    const available = await isPortFree(port);
    if (available) return port;
  }
  throw new Error(`No free port found in range ${start}–${end}`);
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}
