/**
 * Lightweight SQL guard — regex / keyword checks (not a full parser).
 * Blocks destructive and high-risk patterns before execution.
 */

export interface SqlGuardResult {
  allowed: boolean;
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

  // DDL
  if (/^\s*(CREATE|ALTER|DROP|TRUNCATE|RENAME)\s+/i.test(trimmed)) {
    return {
      allowed: false,
      blockedPattern: 'DDL',
      reason: 'DDL statements (CREATE/ALTER/DROP/TRUNCATE/RENAME) are not allowed',
    };
  }

  // Privilege / users
  if (
    /^\s*(GRANT|REVOKE)\s+/i.test(trimmed) ||
    /^\s*(CREATE|ALTER|DROP)\s+USER\b/i.test(trimmed) ||
    /^\s*ALTER\s+USER\b/i.test(trimmed)
  ) {
    return {
      allowed: false,
      blockedPattern: 'PRIVILEGE',
      reason: 'Privilege and user-management statements are not allowed',
    };
  }

  // Admin / server
  if (
    /^\s*(SHUTDOWN|KILL)\b/i.test(trimmed) ||
    /^\s*RESET\s+/i.test(trimmed) ||
    /^\s*PURGE\s+/i.test(trimmed) ||
    /^\s*FLUSH\s+/i.test(trimmed)
  ) {
    return {
      allowed: false,
      blockedPattern: 'ADMIN',
      reason: 'Server administration statements are not allowed',
    };
  }

  // File I/O
  if (
    /^\s*LOAD\s+DATA\b/i.test(trimmed) ||
    /\bINTO\s+(OUTFILE|DUMPFILE)\b/i.test(upper)
  ) {
    return {
      allowed: false,
      blockedPattern: 'FILE_IO',
      reason: 'LOAD DATA and INTO OUTFILE/DUMPFILE are not allowed',
    };
  }

  // User SET (we use SET SESSION internally on the server)
  if (/^\s*SET\s+/i.test(trimmed)) {
    return {
      allowed: false,
      blockedPattern: 'SET',
      reason: 'SET statements are not allowed from the editor',
    };
  }

  // DELETE / UPDATE without WHERE
  if (/^\s*DELETE\s+FROM\b/i.test(trimmed) && !/\bWHERE\b/i.test(upper)) {
    return {
      allowed: false,
      blockedPattern: 'DELETE_NO_WHERE',
      reason: 'DELETE without WHERE is not allowed',
    };
  }
  if (/^\s*UPDATE\b/i.test(trimmed) && !/\bWHERE\b/i.test(upper)) {
    return {
      allowed: false,
      blockedPattern: 'UPDATE_NO_WHERE',
      reason: 'UPDATE without WHERE is not allowed',
    };
  }

  return { allowed: true };
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
