import mysql from 'mysql2/promise';
import fs from 'fs';

export interface ObjectDump {
  tables: Record<string, string>;
  views: Record<string, string>;
  procedures: Record<string, string>;
  functions: Record<string, string>;
  triggers: Record<string, string>;
}

export interface DatabaseDump {
  rdsIdentifier: string;
  region: string;
  databases: Record<string, ObjectDump>;
}

export async function dumpDatabase(opts: {
  rdsIdentifier: string;
  region: string;
  iamUser: string;
  localPort: number;
  certs: { ca: string; cert: string; key: string };
  onProgress?: (msg: string) => void;
}): Promise<DatabaseDump> {
  const { rdsIdentifier, region, iamUser, localPort, certs, onProgress } = opts;
  const log = onProgress ?? (() => {});

  const conn = await Promise.race([
    mysql.createConnection({
      host: '127.0.0.1',
      port: localPort,
      user: iamUser,
      ssl: {
        rejectUnauthorized: false,
        ca: fs.readFileSync(certs.ca),
        cert: fs.readFileSync(certs.cert),
        key: fs.readFileSync(certs.key),
      },
      connectTimeout: 15000,
      multipleStatements: false,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('MySQL connect timed out after 20s — check TLS or proxy auth')), 20000)
    ),
  ]);

  const dump: DatabaseDump = {
    rdsIdentifier,
    region,
    databases: {},
  };

  try {
    const [dbRows] = await conn.query<any[]>('SHOW DATABASES');
    const systemDbs = new Set(['information_schema', 'performance_schema', 'mysql', 'sys']);
    const databases = dbRows
      .map((r: any) => r.Database as string)
      .filter((name) => !systemDbs.has(name));

    for (const dbName of databases) {
      log(`  Scanning database: ${dbName}`);
      const objects: ObjectDump = {
        tables: {},
        views: {},
        procedures: {},
        functions: {},
        triggers: {},
      };

      await conn.query(`USE \`${dbName}\``);

      // Tables and Views
      const [tableRows] = await conn.query<any[]>('SHOW FULL TABLES');
      for (const row of tableRows) {
        const name: string = row[`Tables_in_${dbName}`] || Object.values(row)[0] as string;
        const tableType: string = row.Table_type || Object.values(row)[1] as string;

        if (tableType === 'VIEW') {
          try {
            const [viewRows] = await conn.query<any[]>(`SHOW CREATE VIEW \`${name}\``);
            const sql: string = viewRows[0]?.['Create View'] || '';
            if (sql) objects.views[name] = sql;
          } catch {
            // skip views we can't read
          }
        } else {
          try {
            const [createRows] = await conn.query<any[]>(`SHOW CREATE TABLE \`${name}\``);
            const sql: string = createRows[0]?.['Create Table'] || '';
            if (sql) objects.tables[name] = sql;
          } catch {
            // skip tables we can't read
          }
        }
      }

      // Stored Procedures
      try {
        const [procRows] = await conn.query<any[]>(
          `SHOW PROCEDURE STATUS WHERE Db = ?`, [dbName]
        );
        for (const row of procRows) {
          const procName: string = row.Name;
          try {
            const [createRows] = await conn.query<any[]>(`SHOW CREATE PROCEDURE \`${dbName}\`.\`${procName}\``);
            const sql: string = createRows[0]?.['Create Procedure'] || '';
            if (sql) objects.procedures[procName] = sql;
          } catch {
            // skip
          }
        }
      } catch {
        // Procedures not accessible
      }

      // Functions
      try {
        const [funcRows] = await conn.query<any[]>(
          `SHOW FUNCTION STATUS WHERE Db = ?`, [dbName]
        );
        for (const row of funcRows) {
          const funcName: string = row.Name;
          try {
            const [createRows] = await conn.query<any[]>(`SHOW CREATE FUNCTION \`${dbName}\`.\`${funcName}\``);
            const sql: string = createRows[0]?.['Create Function'] || '';
            if (sql) objects.functions[funcName] = sql;
          } catch {
            // skip
          }
        }
      } catch {
        // Functions not accessible
      }

      // Triggers
      try {
        const [trigRows] = await conn.query<any[]>(
          `SHOW TRIGGERS WHERE \`Trigger_schema\` = ?`, [dbName]
        );
        for (const row of trigRows) {
          const trigName: string = row.Trigger;
          try {
            const [createRows] = await conn.query<any[]>(`SHOW CREATE TRIGGER \`${dbName}\`.\`${trigName}\``);
            const sql: string = createRows[0]?.['SQL Original Statement'] || createRows[0]?.['Create Trigger'] || '';
            if (sql) objects.triggers[trigName] = sql;
          } catch {
            // skip
          }
        }
      } catch {
        // Triggers not accessible
      }

      const counts = [
        `${Object.keys(objects.tables).length} tables`,
        Object.keys(objects.views).length ? `${Object.keys(objects.views).length} views` : null,
        Object.keys(objects.procedures).length ? `${Object.keys(objects.procedures).length} procedures` : null,
        Object.keys(objects.functions).length ? `${Object.keys(objects.functions).length} functions` : null,
        Object.keys(objects.triggers).length ? `${Object.keys(objects.triggers).length} triggers` : null,
      ].filter(Boolean).join(', ');

      log(`  Done: ${dbName} (${counts})`);
      dump.databases[dbName] = objects;
    }
  } finally {
    await conn.end();
  }

  return dump;
}
