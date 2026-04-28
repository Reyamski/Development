/**
 * Lightweight SQL guard — regex / keyword checks (not a full parser).
 * Blocks destructive and high-risk patterns before execution.
 */

export interface SqlGuardResult {
  allowed: boolean;
  /** Comment-stripped, trimmed SQL ready to execute — only set when allowed. */
  cleanSql?: string;
  blockedPattern?: string;
  reason?: string;
}

/** Remove -- line and /* block *\/ comments (best-effort). */
export function stripSqlComments(sql: string): string {
  let s = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  s = s.replace(/--[^\n]*/g, ' ');
  return s;
}

export function countStatements(sql: string): number {
  const stripped = stripSqlComments(sql);
  return stripped
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean).length;
}

/**
 * Read-only allowlist. Only statements starting with one of these tokens are permitted.
 * Anything else (INSERT/UPDATE/DELETE/REPLACE/CALL/LOCK/BEGIN/COMMIT/MERGE/etc.) is blocked.
 *
 * USE is intentionally NOT in this list — database switching happens server-side via
 * `conn.query("USE ...")` in query-runner; user-supplied USE statements are not allowed
 * because they'd let a query mutate session state outside the chosen database scope.
 */
const READ_ONLY_PREFIXES = ['SELECT', 'WITH', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN'] as const;

export function guardSql(sql: string): SqlGuardResult {
  const trimmed = stripSqlComments(sql).trim();
  if (!trimmed) {
    return { allowed: false, blockedPattern: 'EMPTY', reason: 'SQL is empty' };
  }

  if (countStatements(sql) > 1) {
    return {
      allowed: false,
      blockedPattern: 'MULTI',
      reason: 'Only one SQL statement per execution is allowed',
    };
  }

  const upper = trimmed.toUpperCase();

  // Allowlist — must start with a known read-only verb
  const matchedPrefix = READ_ONLY_PREFIXES.find((p) => {
    // Word boundary: the verb must be followed by whitespace, paren, or end of string.
    const re = new RegExp(`^${p}(\\s|\\(|$)`, 'i');
    return re.test(trimmed);
  });

  if (!matchedPrefix) {
    return {
      allowed: false,
      blockedPattern: 'NOT_READ_ONLY',
      reason: `Query Hub is read-only — only ${READ_ONLY_PREFIXES.join('/')} statements are allowed`,
    };
  }

  // Belt-and-suspenders: even within an allowed prefix, reject embedded write/file patterns
  // (e.g. SELECT ... INTO OUTFILE — technically a SELECT but writes a file on the server).
  if (/\bINTO\s+(OUTFILE|DUMPFILE)\b/i.test(upper)) {
    return {
      allowed: false,
      blockedPattern: 'FILE_IO',
      reason: 'INTO OUTFILE / DUMPFILE is not allowed',
    };
  }

  // SELECT ... FOR UPDATE / FOR SHARE acquire row locks — block to avoid blocking writers.
  if (/\bFOR\s+(UPDATE|SHARE)\b/i.test(upper)) {
    return {
      allowed: false,
      blockedPattern: 'LOCK_READ',
      reason: 'SELECT ... FOR UPDATE / FOR SHARE is not allowed (acquires row locks)',
    };
  }

  return { allowed: true, cleanSql: trimmed };
}

/** Validate a MySQL database/schema name — throws on invalid input. */
export function validateDatabaseName(database: string): string {
  if (!database || typeof database !== 'string') {
    throw Object.assign(new Error('database name is required'), { status: 400 });
  }
  const trimmed = database.trim();
  if (!/^[A-Za-z0-9_$-]+$/.test(trimmed)) {
    throw Object.assign(new Error('Invalid database name'), { status: 400 });
  }
  return trimmed;
}

export function isSelectLike(sql: string): boolean {
  const t = stripSqlComments(sql).trim().toUpperCase();
  return (
    t.startsWith('SELECT') ||
    t.startsWith('WITH') ||
    t.startsWith('SHOW') ||
    t.startsWith('DESCRIBE') ||
    t.startsWith('DESC ')
  );
}

/** SELECT / WITH only — used for auto LIMIT (not SHOW/DESCRIBE). */
export function isSelectOrWith(sql: string): boolean {
  const t = stripSqlComments(sql).trim().toUpperCase();
  return t.startsWith('SELECT') || t.startsWith('WITH');
}

/** Append LIMIT for SELECT / WITH if missing (naive). */
export function ensureSelectRowLimit(sql: string, rowLimit: number): string {
  const trimmed = sql.trim();
  const upper = stripSqlComments(trimmed).toUpperCase();
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    return trimmed;
  }
  if (/\bLIMIT\s+[\d?]/i.test(upper)) {
    return trimmed;
  }
  return `${trimmed.replace(/;\s*$/, '')} LIMIT ${rowLimit}`;
}
