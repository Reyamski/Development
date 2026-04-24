import { Router, Request, Response } from 'express';
import type { Connection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { getConnection } from '../services/connection-manager.js';

const router = Router();

function escapeId(id: string): string {
  return id.replace(/`/g, '``');
}

/** SHOW CREATE * for DDL viewer (tables, views, procedures, functions, events). */
async function fetchObjectDdl(conn: Connection, db: string, name: string, kind: string): Promise<string> {
  const d = escapeId(db);
  const n = escapeId(name);
  const pick = (rows: RowDataPacket[], keys: string[]): string => {
    const r = rows[0] as RowDataPacket | undefined;
    if (!r) return '';
    for (const k of keys) {
      const v = r[k];
      if (v != null && String(v).length > 0) return String(v);
    }
    return '';
  };

  if (kind === 'event') {
    const [rows] = await conn.query<RowDataPacket[]>(`SHOW CREATE EVENT \`${d}\`.\`${n}\``);
    return pick(rows, ['Create Event']);
  }
  if (kind === 'function') {
    const [rows] = await conn.query<RowDataPacket[]>(`SHOW CREATE FUNCTION \`${d}\`.\`${n}\``);
    return pick(rows, ['Create Function']);
  }
  if (kind === 'procedure') {
    const [rows] = await conn.query<RowDataPacket[]>(`SHOW CREATE PROCEDURE \`${d}\`.\`${n}\``);
    return pick(rows, ['Create Procedure']);
  }
  if (kind === 'view') {
    try {
      const [rows] = await conn.query<RowDataPacket[]>(`SHOW CREATE VIEW \`${d}\`.\`${n}\``);
      const ddl = pick(rows, ['Create View']);
      if (ddl) return ddl;
    } catch {
      /* fall through */
    }
    const [rows] = await conn.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${d}\`.\`${n}\``);
    return pick(rows, ['Create Table', 'Create View']);
  }
  const [rows] = await conn.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${d}\`.\`${n}\``);
  return pick(rows, ['Create Table']);
}

router.get('/databases', async (_req: Request, res: Response) => {
  try {
    const conn = getConnection();
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys') ORDER BY SCHEMA_NAME",
    );
    const databases = (rows as RowDataPacket[]).map((r) => r.SCHEMA_NAME as string);
    res.json({ databases });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to list databases' });
  }
});

router.get('/tables', async (req: Request, res: Response) => {
  const db = req.query.db as string;
  if (!db) {
    res.status(400).json({ error: 'db query param is required' });
    return;
  }
  try {
    const conn = getConnection();
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT TABLE_NAME, TABLE_TYPE, ENGINE, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH, TABLE_COMMENT
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [db],
    );
    const tables = (rows as RowDataPacket[]).map((r) => ({
      name: r.TABLE_NAME as string,
      type: r.TABLE_TYPE as string,
      engine: r.ENGINE as string | null,
      rowEstimate: Number(r.TABLE_ROWS) || 0,
      dataSizeMb: r.DATA_LENGTH != null ? Number(r.DATA_LENGTH) / (1024 * 1024) : 0,
      indexSizeMb: r.INDEX_LENGTH != null ? Number(r.INDEX_LENGTH) / (1024 * 1024) : 0,
      comment: (r.TABLE_COMMENT as string) || '',
    }));
    res.json({ tables });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to list tables' });
  }
});

router.get('/columns', async (req: Request, res: Response) => {
  const db = req.query.db as string;
  const table = req.query.table as string;
  if (!db || !table) {
    res.status(400).json({ error: 'db and table query params are required' });
    return;
  }
  try {
    const conn = getConnection();
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA, COLUMN_COMMENT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [db, table],
    );
    const columns = (rows as RowDataPacket[]).map((r) => ({
      name: r.COLUMN_NAME as string,
      type: (r.COLUMN_TYPE as string) || (r.DATA_TYPE as string),
      nullable: (r.IS_NULLABLE as string) === 'YES',
      defaultValue: r.COLUMN_DEFAULT,
      key: (r.COLUMN_KEY as string) || '',
      extra: (r.EXTRA as string) || '',
      comment: (r.COLUMN_COMMENT as string) || '',
    }));
    res.json({ columns });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to list columns' });
  }
});

router.get('/routines', async (req: Request, res: Response) => {
  const db = req.query.db as string;
  if (!db) {
    res.status(400).json({ error: 'db query param is required' });
    return;
  }
  try {
    const conn = getConnection();
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT ROUTINE_NAME, ROUTINE_TYPE, ROUTINE_COMMENT
       FROM information_schema.ROUTINES
       WHERE ROUTINE_SCHEMA = ?
       ORDER BY ROUTINE_TYPE DESC, ROUTINE_NAME`,
      [db],
    );
    const routines = (rows as RowDataPacket[]).map((r) => ({
      name: r.ROUTINE_NAME as string,
      type: (r.ROUTINE_TYPE as string).toUpperCase() as 'PROCEDURE' | 'FUNCTION',
      comment: (r.ROUTINE_COMMENT as string) || '',
    }));
    res.json({ routines });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to list routines' });
  }
});

router.get('/events', async (req: Request, res: Response) => {
  const db = req.query.db as string;
  if (!db) {
    res.status(400).json({ error: 'db query param is required' });
    return;
  }
  try {
    const conn = getConnection();
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT EVENT_NAME, STATUS, EVENT_TYPE, EXECUTE_AT, INTERVAL_VALUE, INTERVAL_FIELD, STARTS, ENDS, EVENT_COMMENT
       FROM information_schema.EVENTS
       WHERE EVENT_SCHEMA = ?
       ORDER BY EVENT_NAME`,
      [db],
    );
    const events = (rows as RowDataPacket[]).map((r) => ({
      name: r.EVENT_NAME as string,
      status: (r.STATUS as string) || '',
      eventType: (r.EVENT_TYPE as string) || '',
      executeAt: r.EXECUTE_AT,
      intervalValue: r.INTERVAL_VALUE,
      intervalField: (r.INTERVAL_FIELD as string) || '',
      starts: r.STARTS,
      ends: r.ENDS,
      comment: (r.EVENT_COMMENT as string) || '',
    }));
    res.json({ events });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to list events' });
  }
});

/** Foreign keys for ER-style diagrams (information_schema). */
router.get('/foreign-keys', async (req: Request, res: Response) => {
  const db = req.query.db as string;
  if (!db) {
    res.status(400).json({ error: 'db query param is required' });
    return;
  }
  try {
    const conn = getConnection();
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT k.CONSTRAINT_NAME, k.TABLE_NAME, k.COLUMN_NAME,
              k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, k.ORDINAL_POSITION
       FROM information_schema.KEY_COLUMN_USAGE k
       INNER JOIN information_schema.TABLE_CONSTRAINTS tc
         ON k.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
        AND k.TABLE_NAME = tc.TABLE_NAME
        AND k.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
       WHERE k.TABLE_SCHEMA = ?
         AND k.REFERENCED_TABLE_SCHEMA IS NOT NULL
         AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
       ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
      [db],
    );
    const edges = (rows as RowDataPacket[]).map((r) => ({
      constraintName: r.CONSTRAINT_NAME as string,
      tableName: r.TABLE_NAME as string,
      columnName: r.COLUMN_NAME as string,
      referencedTableName: r.REFERENCED_TABLE_NAME as string,
      referencedColumnName: r.REFERENCED_COLUMN_NAME as string,
    }));
    res.json({ edges });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to list foreign keys' });
  }
});

function addRef(map: Map<string, Set<string>>, objectKey: string, tableName: string): void {
  if (!tableName) return;
  if (!map.has(objectKey)) map.set(objectKey, new Set());
  map.get(objectKey)!.add(tableName);
}

/** Backtick-quoted identifiers in SQL text (heuristic for events / fallbacks). */
function backtickIdentifiers(sql: string): string[] {
  const out: string[] = [];
  const re = /`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    out.push(m[1]);
  }
  return out;
}

/** Procedure/function names invoked via CALL … (best-effort). */
function extractCallTargets(sql: string): string[] {
  const seen = new Set<string>();
  const skip = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REPLACE', 'WITH']);
  const patterns: RegExp[] = [
    /\bCALL\s+`([^`]+)`\s*\(/gi,
    /\bCALL\s+([A-Za-z0-9_]+)\s*\(/gi,
    /\bCALL\s+(?:`?[A-Za-z0-9_]+`?\.)`([^`]+)`\s*\(/gi,
    /\bCALL\s+(?:`?[A-Za-z0-9_]+`?\.)`?([A-Za-z0-9_]+)`?\s*\(/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      const name = (m[2] || m[1] || '').trim();
      if (name && !skip.has(name.toUpperCase())) seen.add(name);
    }
  }
  return [...seen];
}

type TableKinds = { baseTables: Set<string>; viewNames: Set<string> };

async function loadTableKinds(conn: Connection, db: string): Promise<TableKinds> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
    [db],
  );
  const baseTables = new Set<string>();
  const viewNames = new Set<string>();
  for (const r of rows as RowDataPacket[]) {
    const n = r.TABLE_NAME as string;
    const t = String(r.TABLE_TYPE || '').toUpperCase();
    if (t === 'BASE TABLE') baseTables.add(n);
    else if (t === 'VIEW' || t === 'SYSTEM VIEW') viewNames.add(n);
  }
  return { baseTables, viewNames };
}

async function loadRoutineNames(conn: Connection, db: string): Promise<Map<string, 'PROCEDURE' | 'FUNCTION'>> {
  const map = new Map<string, 'PROCEDURE' | 'FUNCTION'>();
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?`,
    [db],
  );
  for (const r of rows as RowDataPacket[]) {
    const n = r.ROUTINE_NAME as string;
    const t = String(r.ROUTINE_TYPE || '').toUpperCase();
    if (t === 'PROCEDURE' || t === 'FUNCTION') map.set(n, t);
  }
  return map;
}

/**
 * Map lowercase identifier → canonical table/view name in this schema (for case-insensitive match).
 */
function buildCaseMap(baseTables: Set<string>, viewNames: Set<string>): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of baseTables) m.set(t.toLowerCase(), t);
  for (const v of viewNames) m.set(v.toLowerCase(), v);
  return m;
}

function resolveSchemaObject(
  raw: string,
  caseMap: Map<string, string>,
  excludeLower: Set<string>,
): string | null {
  const stripped = raw.trim();
  if (!stripped) return null;
  const unquoted = stripped.replace(/^`|`$/g, '').trim();
  const base = unquoted.includes('.') ? unquoted.slice(unquoted.lastIndexOf('.') + 1).trim() : unquoted;
  if (!base) return null;
  const low = base.toLowerCase();
  if (excludeLower.has(low)) return null;
  return caseMap.get(low) ?? null;
}

/** Unquoted identifier chain: `tbl` or `schema.tbl` (MySQL default schema allows one or more segments). */
const UNQUOTED_QUALIFIED_ID = '[A-Za-z_][A-Za-z0-9_$]*(?:\\.[A-Za-z_][A-Za-z0-9_$]*)*';

/**
 * Tables/views referenced in SQL body: backticks + unquoted names after FROM/JOIN/UPDATE/INTO/etc.
 * Qualified unquoted names (`schema.table`) are resolved to the final table segment.
 */
function extractRefsFromSqlBody(
  def: string,
  baseTables: Set<string>,
  viewNames: Set<string>,
  excludeNames: string[],
): Set<string> {
  const refs = new Set<string>();
  const caseMap = buildCaseMap(baseTables, viewNames);
  const excludeLower = new Set(excludeNames.map((n) => n.toLowerCase()));

  const addFromRaw = (raw: string) => {
    const canon = resolveSchemaObject(raw, caseMap, excludeLower);
    if (canon) refs.add(canon);
  };

  for (const id of backtickIdentifiers(def)) addFromRaw(id);

  const kwPatterns: RegExp[] = [
    new RegExp(`\\bFROM\\s+(?:\`([^\`]+)\`|(${UNQUOTED_QUALIFIED_ID}))`, 'gi'),
    new RegExp(`\\bJOIN\\s+(?:\`([^\`]+)\`|(${UNQUOTED_QUALIFIED_ID}))`, 'gi'),
    new RegExp(`\\bUPDATE\\s+(?:\`([^\`]+)\`|(${UNQUOTED_QUALIFIED_ID}))`, 'gi'),
    new RegExp(`\\bINTO\\s+(?:\`([^\`]+)\`|(${UNQUOTED_QUALIFIED_ID}))`, 'gi'),
    new RegExp(`\\bTABLE\\s+(?:\`([^\`]+)\`|(${UNQUOTED_QUALIFIED_ID}))`, 'gi'),
    new RegExp(`\\bINSERT\\s+INTO\\s+(?:\`([^\`]+)\`|(${UNQUOTED_QUALIFIED_ID}))`, 'gi'),
    new RegExp(`\\bDELETE\\s+FROM\\s+(?:\`([^\`]+)\`|(${UNQUOTED_QUALIFIED_ID}))`, 'gi'),
    new RegExp(`\\bTRUNCATE\\s+TABLE\\s+(?:\`([^\`]+)\`|(${UNQUOTED_QUALIFIED_ID}))`, 'gi'),
    new RegExp(`\\bREPLACE\\s+INTO\\s+(?:\`([^\`]+)\`|(${UNQUOTED_QUALIFIED_ID}))`, 'gi'),
  ];

  const joinPatterns: RegExp[] = [
    new RegExp(
      `\\b(?:INNER\\s+|LEFT\\s+|RIGHT\\s+|CROSS\\s+)?(?:OUTER\\s+)?JOIN\\s+(?:\`([^\`]+)\`|(${UNQUOTED_QUALIFIED_ID}))`,
      'gi',
    ),
  ];
  const allPatterns = [...kwPatterns, ...joinPatterns];
  for (const re of allPatterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(def)) !== null) {
      const part = (m[1] || m[2] || '').trim();
      if (part) addFromRaw(part);
    }
  }

  return refs;
}

function partitionRefs(refs: Set<string>, baseTables: Set<string>, viewNames: Set<string>): { tables: string[]; views: string[] } {
  const tables: string[] = [];
  const views: string[] = [];
  for (const name of refs) {
    if (baseTables.has(name)) tables.push(name);
    else if (viewNames.has(name)) views.push(name);
  }
  tables.sort((a, b) => a.localeCompare(b));
  views.sort((a, b) => a.localeCompare(b));
  return { tables, views };
}

function mapToRefBundles(
  map: Map<string, Set<string>>,
  baseTables: Set<string>,
  viewNames: Set<string>,
): Record<string, { tables: string[]; views: string[] }> {
  const o: Record<string, { tables: string[]; views: string[] }> = {};
  for (const [k, v] of map) {
    o[k] = partitionRefs(v, baseTables, viewNames);
  }
  return o;
}

function mergeRefMap(into: Map<string, Set<string>>, from: Map<string, Set<string>>): void {
  for (const [k, set] of from) {
    if (!into.has(k)) into.set(k, new Set());
    for (const v of set) into.get(k)!.add(v);
  }
}

async function viewDepsFromUsage(conn: Connection, db: string): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT VIEW_NAME, TABLE_NAME
     FROM information_schema.VIEW_TABLE_USAGE
     WHERE VIEW_SCHEMA = ?`,
    [db],
  );
  for (const r of rows as RowDataPacket[]) {
    addRef(map, r.VIEW_NAME as string, r.TABLE_NAME as string);
  }
  return map;
}

/** Parse VIEW_DEFINITION (always merged with VIEW_TABLE_USAGE when present). */
async function viewDepsFromParsed(
  conn: Connection,
  db: string,
  baseTables: Set<string>,
  viewNames: Set<string>,
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS view_name, VIEW_DEFINITION
     FROM information_schema.VIEWS
     WHERE TABLE_SCHEMA = ?`,
    [db],
  );
  for (const r of rows as RowDataPacket[]) {
    const viewName = r.view_name as string;
    let def = String(r.VIEW_DEFINITION || '').trim();
    if (!def) {
      try {
        def = (await fetchObjectDdl(conn, db, viewName, 'view')).trim();
      } catch {
        /* no access to definition */
      }
    }
    if (!def) continue;
    const extracted = extractRefsFromSqlBody(def, baseTables, viewNames, [viewName]);
    for (const name of extracted) addRef(map, viewName, name);
  }
  return map;
}

async function routineDepsFromUsage(conn: Connection, db: string): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT SPECIFIC_NAME, ROUTINE_TYPE, TABLE_NAME
     FROM information_schema.ROUTINE_TABLE_USAGE
     WHERE ROUTINE_SCHEMA = ?`,
    [db],
  );
  for (const r of rows as RowDataPacket[]) {
    const type = String(r.ROUTINE_TYPE || '').toUpperCase();
    const name = r.SPECIFIC_NAME as string;
    const key = `${type}:${name}`;
    addRef(map, key, r.TABLE_NAME as string);
  }
  return map;
}

/** Parse ROUTINE_DEFINITION (always merged with ROUTINE_TABLE_USAGE when present). */
async function routineDepsFromParsed(
  conn: Connection,
  db: string,
  baseTables: Set<string>,
  viewNames: Set<string>,
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT ROUTINE_NAME, ROUTINE_TYPE, ROUTINE_DEFINITION
     FROM information_schema.ROUTINES
     WHERE ROUTINE_SCHEMA = ?`,
    [db],
  );
  for (const r of rows as RowDataPacket[]) {
    const routineName = r.ROUTINE_NAME as string;
    const type = String(r.ROUTINE_TYPE || '').toUpperCase();
    const key = `${type}:${routineName}`;
    let def = String(r.ROUTINE_DEFINITION || '').trim();
    if (!def) {
      try {
        const kind = type === 'PROCEDURE' ? 'procedure' : 'function';
        def = (await fetchObjectDdl(conn, db, routineName, kind)).trim();
      } catch {
        /* no SHOW privilege or object missing */
      }
    }
    if (!def) continue;
    const extracted = extractRefsFromSqlBody(def, baseTables, viewNames, [routineName]);
    for (const name of extracted) addRef(map, key, name);
  }
  return map;
}

/**
 * Tables / views referenced by each view and routine (metadata or parsed definitions).
 * Events: tables, views (backtick heuristic), and stored routines (CALL + backtick match).
 */
router.get('/object-dependencies', async (req: Request, res: Response) => {
  const db = req.query.db as string;
  if (!db) {
    res.status(400).json({ error: 'db query param is required' });
    return;
  }
  try {
    const conn = getConnection();
    const { baseTables, viewNames } = await loadTableKinds(conn, db);
    const routineNameTypes = await loadRoutineNames(conn, db);

    const viewMap = new Map<string, Set<string>>();
    try {
      mergeRefMap(viewMap, await viewDepsFromUsage(conn, db));
    } catch {
      /* VIEW_TABLE_USAGE unavailable (older MySQL / MariaDB) */
    }
    mergeRefMap(viewMap, await viewDepsFromParsed(conn, db, baseTables, viewNames));

    const routineMap = new Map<string, Set<string>>();
    try {
      mergeRefMap(routineMap, await routineDepsFromUsage(conn, db));
    } catch {
      /* ROUTINE_TABLE_USAGE unavailable */
    }
    mergeRefMap(routineMap, await routineDepsFromParsed(conn, db, baseTables, viewNames));

    const views = mapToRefBundles(viewMap, baseTables, viewNames);
    const routines = mapToRefBundles(routineMap, baseTables, viewNames);

    const events: Record<string, { tables: string[]; views: string[]; routines: string[] }> = {};
    try {
      const [eRows] = await conn.query<RowDataPacket[]>(
        `SELECT EVENT_NAME, EVENT_DEFINITION FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ?`,
        [db],
      );
      for (const r of eRows as RowDataPacket[]) {
        const eventName = r.EVENT_NAME as string;
        const def = String(r.EVENT_DEFINITION || '');
        const routineSet = new Set<string>();
        for (const target of extractCallTargets(def)) {
          if (routineNameTypes.has(target)) {
            routineSet.add(target);
            continue;
          }
          const last = target.includes('.') ? target.slice(target.lastIndexOf('.') + 1) : '';
          if (last && routineNameTypes.has(last)) routineSet.add(last);
        }
        for (const id of backtickIdentifiers(def)) {
          if (id === eventName) continue;
          if (routineNameTypes.has(id)) routineSet.add(id);
        }
        // Unquoted invocations: procedure_or_function_name(
        for (const rname of routineNameTypes.keys()) {
          const esc = rname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(`\\b${esc}\\s*\\(`, 'i');
          if (re.test(def)) routineSet.add(rname);
        }
        const tvRefs = extractRefsFromSqlBody(def, baseTables, viewNames, [eventName]);
        const tableSet = new Set<string>();
        const viewSet = new Set<string>();
        for (const name of tvRefs) {
          if (baseTables.has(name)) tableSet.add(name);
          else if (viewNames.has(name)) viewSet.add(name);
        }
        events[eventName] = {
          tables: [...tableSet].sort((a, b) => a.localeCompare(b)),
          views: [...viewSet].sort((a, b) => a.localeCompare(b)),
          routines: [...routineSet].sort((a, b) => a.localeCompare(b)),
        };
      }
    } catch {
      /* optional */
    }

    res.json({ views, routines, events });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to load object dependencies' });
  }
});

router.get('/ddl', async (req: Request, res: Response) => {
  const db = req.query.db as string;
  const name = req.query.name as string;
  const kind = ((req.query.kind as string) || 'table').toLowerCase();
  if (!db || !name) {
    res.status(400).json({ error: 'db and name query params are required' });
    return;
  }
  const allowed = new Set(['table', 'view', 'procedure', 'function', 'event']);
  if (!allowed.has(kind)) {
    res.status(400).json({ error: 'kind must be table, view, procedure, function, or event' });
    return;
  }
  try {
    const conn = getConnection();
    const ddl = await fetchObjectDdl(conn, db, name, kind);
    if (!ddl) {
      res.status(404).json({ error: 'Empty DDL (missing permission or object not found)' });
      return;
    }
    res.json({ ddl });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to load DDL' });
  }
});

router.get('/indexes', async (req: Request, res: Response) => {
  const db = req.query.db as string;
  const table = req.query.table as string;
  if (!db || !table) {
    res.status(400).json({ error: 'db and table query params are required' });
    return;
  }
  try {
    const conn = getConnection();
    const [rows] = await conn.query<RowDataPacket[]>(
      `SHOW INDEX FROM \`${escapeId(table)}\` FROM \`${escapeId(db)}\``,
    );
    const byName = new Map<
      string,
      { name: string; unique: boolean; type: string; columns: string[] }
    >();
    for (const r of rows as RowDataPacket[]) {
      const name = r.Key_name as string;
      const col = r.Column_name as string;
      const unique = Number(r.Non_unique) === 0;
      const indexType = (r.Index_type as string) || 'BTREE';
      if (!byName.has(name)) {
        byName.set(name, { name, unique, type: indexType, columns: [] });
      }
      byName.get(name)!.columns.push(col);
    }
    res.json({ indexes: [...byName.values()] });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to list indexes' });
  }
});

export default router;
