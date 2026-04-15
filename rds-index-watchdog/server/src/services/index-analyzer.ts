import { Connection } from 'mysql2/promise';

// ── MISSING INDEX CANDIDATES ──────────────────────────────────────────────
export async function getMissingIndexCandidates(conn: Connection, database: string) {
  const [rows] = await conn.execute<any[]>(`
    SELECT
      SCHEMA_NAME,
      DIGEST_TEXT,
      SUM_ROWS_EXAMINED,
      SUM_ROWS_SENT,
      COUNT_STAR,
      ROUND(SUM_ROWS_EXAMINED / NULLIF(SUM_ROWS_SENT, 0)) as ratio
    FROM performance_schema.events_statements_summary_by_digest
    WHERE SCHEMA_NAME = ?
      AND SUM_ROWS_EXAMINED > 5000
      AND SUM_ROWS_EXAMINED / NULLIF(SUM_ROWS_SENT, 0) > 50
      AND DIGEST_TEXT NOT LIKE 'SHOW%'
      AND DIGEST_TEXT NOT LIKE 'SET%'
      AND DIGEST_TEXT NOT LIKE 'SELECT @@%'
    ORDER BY SUM_ROWS_EXAMINED DESC
    LIMIT 20
  `, [database]);

  return rows.map((row: any) => {
    // Extract table names from digest text using simple regex
    const tableMatches = String(row.DIGEST_TEXT || '').match(/(?:FROM|JOIN|UPDATE)\s+`?(\w+)`?/gi) || [];
    const tables = [...new Set(tableMatches.map((m: string) => m.replace(/(?:FROM|JOIN|UPDATE)\s+`?/i, '').replace(/`/g, '').trim()))];

    // Extract WHERE/ORDER BY columns as suggestions
    const whereMatch = String(row.DIGEST_TEXT || '').match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/i);
    const orderMatch = String(row.DIGEST_TEXT || '').match(/ORDER\s+BY\s+(.+?)(?:LIMIT|$)/i);
    const suggestedColumns: string[] = [];

    if (whereMatch) {
      const colMatches = whereMatch[1].match(/`?(\w+)`?\s*(?:=|>|<|LIKE|IN|IS)/gi) || [];
      colMatches.forEach((m: string) => {
        const col = m.replace(/[`\s=><LIKEIN]/gi, '').trim();
        if (col && !suggestedColumns.includes(col)) suggestedColumns.push(col);
      });
    }
    if (orderMatch) {
      const colMatches = orderMatch[1].match(/`?(\w+)`?/g) || [];
      colMatches.forEach((m: string) => {
        const col = m.replace(/`/g, '').trim();
        if (col && !suggestedColumns.includes(col)) suggestedColumns.push(col);
      });
    }

    const examined = Number(row.SUM_ROWS_EXAMINED);
    const sent = Number(row.SUM_ROWS_SENT) || 1;
    const ratio = Math.round(examined / sent);

    return {
      table: tables.join(', ') || 'unknown',
      digestText: String(row.DIGEST_TEXT || '').substring(0, 200),
      rowsExamined: examined,
      rowsSent: Number(row.SUM_ROWS_SENT),
      execCount: Number(row.COUNT_STAR),
      suggestedColumns,
      explanation: `This query scans ~${examined.toLocaleString()} rows to return ~${sent.toLocaleString()} rows (${ratio}x ratio). ` +
        (suggestedColumns.length > 0
          ? `Consider an index on (${suggestedColumns.join(', ')}) to reduce the scan.`
          : 'Adding an index on the filter columns could significantly reduce row scanning.'),
      severity: ratio > 200 ? 'warning' : 'info',
    };
  });
}

// ── UNUSED INDEXES ─────────────────────────────────────────────────────────
export async function getUnusedIndexes(conn: Connection, database: string) {
  const [rows] = await conn.execute<any[]>(`
    SELECT
      i.OBJECT_NAME as TABLE_NAME,
      i.INDEX_NAME,
      i.COUNT_READ,
      i.COUNT_WRITE,
      GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX SEPARATOR ', ') as COLUMNS
    FROM performance_schema.table_io_waits_summary_by_index_usage i
    JOIN information_schema.STATISTICS s
      ON s.TABLE_SCHEMA = i.OBJECT_SCHEMA
      AND s.TABLE_NAME = i.OBJECT_NAME
      AND s.INDEX_NAME = i.INDEX_NAME
    WHERE i.OBJECT_SCHEMA = ?
      AND i.INDEX_NAME != 'PRIMARY'
      AND i.COUNT_READ = 0
      AND i.INDEX_NAME IS NOT NULL
    GROUP BY i.OBJECT_NAME, i.INDEX_NAME, i.COUNT_READ, i.COUNT_WRITE
    ORDER BY i.COUNT_WRITE DESC
    LIMIT 50
  `, [database]);

  return rows.map((row: any) => {
    const writes = Number(row.COUNT_WRITE);
    const cols = String(row.COLUMNS || '').split(', ');
    return {
      table: String(row.TABLE_NAME),
      indexName: String(row.INDEX_NAME),
      columns: cols,
      writeCount: writes,
      explanation: writes > 0
        ? `This index has never been read but is updated ${writes.toLocaleString()} times. It adds write overhead on every INSERT/UPDATE/DELETE with no read benefit.`
        : `This index has never been used for reads or writes since the last server restart. It may be a legacy index.`,
      suggestedSql: `DROP INDEX \`${row.INDEX_NAME}\` ON \`${database}\`.\`${row.TABLE_NAME}\`;`,
      severity: writes > 100000 ? 'warning' : 'info',
    };
  });
}

// ── DUPLICATE INDEXES ──────────────────────────────────────────────────────
export async function getDuplicateIndexes(conn: Connection, database: string) {
  const [rows] = await conn.execute<any[]>(`
    SELECT
      TABLE_NAME,
      INDEX_NAME,
      GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') as COLUMNS,
      NON_UNIQUE
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = ?
    GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
    ORDER BY TABLE_NAME, COLUMNS
  `, [database]);

  const findings: any[] = [];
  const byTable: Record<string, Array<{name: string, cols: string[], nonUnique: number}>> = {};

  for (const row of rows as any[]) {
    const t = String(row.TABLE_NAME);
    if (!byTable[t]) byTable[t] = [];
    byTable[t].push({ name: String(row.INDEX_NAME), cols: String(row.COLUMNS).split(','), nonUnique: Number(row.NON_UNIQUE) });
  }

  for (const [table, indexes] of Object.entries(byTable)) {
    for (let i = 0; i < indexes.length; i++) {
      for (let j = i + 1; j < indexes.length; j++) {
        const a = indexes[i], b = indexes[j];
        if (a.cols.join(',') === b.cols.join(',') && a.name !== 'PRIMARY' && b.name !== 'PRIMARY') {
          findings.push({
            table,
            indexName: b.name,
            duplicateOf: a.name,
            columns: a.cols,
            explanation: `\`${b.name}\` has identical columns (${a.cols.join(', ')}) as \`${a.name}\`. One of them is redundant and can be dropped.`,
            suggestedSql: `DROP INDEX \`${b.name}\` ON \`${database}\`.\`${table}\`;`,
            severity: 'warning',
          });
        }
      }
    }
  }
  return findings;
}

// ── OVERLAPPING INDEXES ────────────────────────────────────────────────────
export async function getOverlappingIndexes(conn: Connection, database: string) {
  const [rows] = await conn.execute<any[]>(`
    SELECT
      TABLE_NAME,
      INDEX_NAME,
      GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') as COLUMNS
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = ?
      AND INDEX_NAME != 'PRIMARY'
    GROUP BY TABLE_NAME, INDEX_NAME
    ORDER BY TABLE_NAME, LENGTH(GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ','))
  `, [database]);

  const findings: any[] = [];
  const byTable: Record<string, Array<{name: string, cols: string[]}>> = {};

  for (const row of rows as any[]) {
    const t = String(row.TABLE_NAME);
    if (!byTable[t]) byTable[t] = [];
    byTable[t].push({ name: String(row.INDEX_NAME), cols: String(row.COLUMNS).split(',') });
  }

  for (const [table, indexes] of Object.entries(byTable)) {
    for (let i = 0; i < indexes.length; i++) {
      for (let j = i + 1; j < indexes.length; j++) {
        const shorter = indexes[i], longer = indexes[j];
        if (longer.cols.length <= shorter.cols.length) continue;
        // Check if shorter is a left-prefix of longer
        const isPrefix = shorter.cols.every((col, idx) => col === longer.cols[idx]);
        if (isPrefix && shorter.name !== 'PRIMARY') {
          findings.push({
            table,
            redundantIndex: shorter.name,
            coveringIndex: longer.name,
            redundantColumns: shorter.cols,
            coveringColumns: longer.cols,
            explanation: `\`${shorter.name}\` (${shorter.cols.join(', ')}) is a left-prefix of \`${longer.name}\` (${longer.cols.join(', ')}). MySQL can use the longer index for single-column lookups too, making the shorter index redundant.`,
            suggestedSql: `DROP INDEX \`${shorter.name}\` ON \`${database}\`.\`${table}\`;`,
            severity: 'info',
          });
        }
      }
    }
  }
  return findings;
}

// ── HIGH-WRITE BLOAT RISK ──────────────────────────────────────────────────
export async function getHighWriteBloatRisk(conn: Connection, database: string) {
  const [rows] = await conn.execute<any[]>(`
    SELECT
      i.OBJECT_NAME as TABLE_NAME,
      COUNT(DISTINCT i.INDEX_NAME) as INDEX_COUNT,
      SUM(i.COUNT_WRITE) as TOTAL_WRITES,
      GROUP_CONCAT(DISTINCT i.INDEX_NAME ORDER BY i.INDEX_NAME SEPARATOR ', ') as INDEXES
    FROM performance_schema.table_io_waits_summary_by_index_usage i
    WHERE i.OBJECT_SCHEMA = ?
      AND i.INDEX_NAME IS NOT NULL
    GROUP BY i.OBJECT_NAME
    HAVING INDEX_COUNT >= 5 AND TOTAL_WRITES > 10000
    ORDER BY TOTAL_WRITES DESC
    LIMIT 20
  `, [database]);

  return (rows as any[]).map((row) => {
    const writes = Number(row.TOTAL_WRITES);
    const idxCount = Number(row.INDEX_COUNT);
    const indexList = String(row.INDEXES || '').split(', ');
    return {
      table: String(row.TABLE_NAME),
      indexCount: idxCount,
      totalWrites: writes,
      indexes: indexList,
      explanation: `This table has ${idxCount} indexes and has received ${writes.toLocaleString()} writes. Every write must update all ${idxCount} indexes. Review whether all indexes are actively used — removing unused ones will reduce write overhead.`,
      severity: writes > 1000000 ? 'warning' : 'info',
    };
  });
}
