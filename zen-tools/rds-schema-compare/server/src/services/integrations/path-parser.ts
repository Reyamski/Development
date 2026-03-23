import path from 'path';

export interface SchemaContext {
  instanceName: string;
  databaseName: string;
}

/**
 * Parses instance name and RDS identifier from a target directory path.
 *
 * Expected structure:
 *   /SchemaDump/.../punchh-dq-rds-us-west-2-793800672737/us-west-2/punchh-dq-rds/
 *                   ^-- instance folder (contains -rds-) --^         ^-- target --^
 *
 * - Instance name: everything before the first "-rds-" in the ancestor folder
 *   that matches the *-rds-* pattern (e.g. "punchh-dq")
 * - Database name: the target folder itself — the RDS identifier
 *   (e.g. "punchh-dq-rds")
 *
 * The target path typically points to the RDS identifier folder which contains
 * multiple database folders, each with object type subfolders (tables/, indexes/, etc.)
 */
export function parseSchemaContext(targetPath: string): SchemaContext {
  // Normalize and split path
  const normalized = targetPath.replace(/\/+$/, '');
  const parts = normalized.split(path.sep).filter(Boolean);

  let instanceName = 'unknown';
  // Default database name to the last folder in the target path (RDS identifier)
  let databaseName = parts.length > 0 ? parts[parts.length - 1] : 'unknown';

  // Walk the path parts to find the folder matching *-rds-* pattern
  for (const part of parts) {
    const rdsIdx = part.indexOf('-rds-');
    if (rdsIdx !== -1) {
      instanceName = part.substring(0, rdsIdx);
      break;
    }
  }

  return { instanceName, databaseName };
}
