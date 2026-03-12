import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { DatabaseDump } from './schema-dumper.js';

const DEFINER_PATTERN = /\bDEFINER\s*=\s*`[^`]*`\s*@\s*`[^`]*`\s*/gi;

function stripDefiner(sql: string): string {
  return sql.replace(DEFINER_PATTERN, '');
}

export async function writeDump(
  dump: DatabaseDump,
  outputBase: string,
  proxy: string,
  accountId: string,
  onProgress?: (msg: string) => void
): Promise<string[]> {
  const log = onProgress ?? (() => {});
  const written: string[] = [];

  // Folder name: {rdsId}-{region}-{accountId}
  const instanceFolder = `${dump.rdsIdentifier}-${dump.region}-${accountId}`;

  for (const [dbName, objects] of Object.entries(dump.databases)) {
    const dbBase = path.join(
      outputBase,
      proxy,
      instanceFolder,
      dump.region,
      dump.rdsIdentifier,
      dbName
    );

    const typeMap: Array<[keyof typeof objects, string]> = [
      ['tables', 'tables'],
      ['views', 'views'],
      ['procedures', 'procedures'],
      ['functions', 'functions'],
      ['triggers', 'triggers'],
    ];

    for (const [objKey, folderName] of typeMap) {
      const entries = Object.entries(objects[objKey]);
      if (entries.length === 0) continue;

      const dir = path.join(dbBase, folderName);
      await mkdir(dir, { recursive: true });

      for (const [name, sql] of entries) {
        const needsDefinerStrip = folderName !== 'tables' && folderName !== 'views';
        const cleanSql = needsDefinerStrip ? stripDefiner(sql) : sql;
        const filePath = path.join(dir, `${name}.sql`);
        await writeFile(filePath, cleanSql, 'utf8');
        written.push(filePath);
      }
    }

    log(`  Wrote ${dbName}: ${written.length} files so far`);
  }

  return written;
}
