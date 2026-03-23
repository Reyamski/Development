import type { Connection } from 'mysql2/promise';
import { TeleportTunnel } from '../types.js';
import {
  findTsh, getLoginStatus, startTunnel, stopTunnel, registerTunnel, unregisterTunnel,
} from './teleport.js';

interface Session {
  tunnel: TeleportTunnel;
  connection: Connection;
  cluster: string;
  instance: string;
}

const sessions = new Map<string, Session>();

export function getActiveSessions(): { key: string; cluster: string; instance: string }[] {
  return Array.from(sessions.entries()).map(([key, s]) => ({
    key, cluster: s.cluster, instance: s.instance,
  }));
}

export async function openSession(
  key: string, cluster: string, instance: string,
): Promise<{ version: string; databases: string[] }> {
  if (sessions.has(key)) await closeSession(key);

  const tsh = await findTsh();
  const status = await getLoginStatus(tsh, cluster);
  if (!status.loggedIn || !status.username) {
    throw new Error('Not logged in to Teleport');
  }

  const tunnel = await startTunnel(tsh, instance, status.username, cluster);
  registerTunnel(tunnel);

  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection({
    host: tunnel.host,
    port: tunnel.port,
    user: tunnel.dbUser,
    database: 'information_schema',
    charset: 'utf8mb4_general_ci',
  });

  sessions.set(key, { tunnel, connection, cluster, instance });

  const [versionRows] = await connection.query('SELECT VERSION() as version');
  const version = (versionRows as any[])[0]?.version ?? 'unknown';

  const [dbRows] = await connection.query(
    "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys') ORDER BY SCHEMA_NAME"
  );
  const databases = (dbRows as any[]).map((r: any) => r.SCHEMA_NAME);

  return { version, databases };
}

export async function closeSession(key: string): Promise<void> {
  const session = sessions.get(key);
  if (!session) return;

  sessions.delete(key);
  try { await session.connection.end(); } catch { /* ignore */ }
  unregisterTunnel(session.instance);
  try {
    const tsh = await findTsh();
    await stopTunnel(tsh, session.tunnel);
  } catch { /* ignore */ }
}

export async function closeAllSessions(): Promise<void> {
  const keys = Array.from(sessions.keys());
  for (const key of keys) await closeSession(key);
}

export function getConnection(key: string): Connection {
  const session = sessions.get(key);
  if (!session) throw new Error(`No active session for key: ${key}`);
  return session.connection;
}
