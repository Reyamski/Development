import { TableSizeResult } from '../types.js';
import { findTsh, getLoginStatus, startTunnel, stopTunnel, registerTunnel, unregisterTunnel } from './teleport.js';

export async function getTableSizes(
  cluster: string, instanceName: string,
): Promise<TableSizeResult[]> {
  const tsh = await findTsh();
  const status = await getLoginStatus(tsh, cluster);
  if (!status.loggedIn || !status.username) {
    throw new Error('Not logged in to Teleport');
  }

  const tunnel = await startTunnel(tsh, instanceName, status.username, cluster);
  registerTunnel(tunnel);

  try {
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection({
      host: tunnel.host,
      port: tunnel.port,
      user: tunnel.dbUser,
      database: 'information_schema',
      charset: 'utf8mb4_general_ci',
    });

    const [rows] = await conn.query(`
      SELECT
        TABLE_SCHEMA AS db,
        TABLE_NAME AS tbl,
        ENGINE AS engine,
        TABLE_ROWS AS row_count,
        ROUND(DATA_LENGTH / 1024 / 1024, 2) AS data_mb,
        ROUND(INDEX_LENGTH / 1024 / 1024, 2) AS index_mb,
        ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS total_mb
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
    `);

    await conn.end();

    return (rows as any[]).map(r => ({
      instanceName,
      database: r.db,
      table: r.tbl,
      displayName: `${r.db}.${r.tbl}`,
      dataSizeMb: Number(r.data_mb) || 0,
      indexSizeMb: Number(r.index_mb) || 0,
      totalSizeMb: Number(r.total_mb) || 0,
      rows: Number(r.row_count) || 0,
      engine: r.engine || '',
    }));
  } finally {
    unregisterTunnel(instanceName);
    await stopTunnel(tsh, tunnel);
  }
}
