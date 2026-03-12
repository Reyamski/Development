import { ComparisonResult } from '../differ/types.js';
import { TableDiffDetail } from '../differ/types.js';

export function generateAlterTable(result: ComparisonResult): string[] {
  const detail = result.tableDiff;
  if (!detail) return [];

  const tableName = result.name;
  const statements: string[] = [];

  // Order per plan:
  // 1. DROP FOREIGN KEY
  for (const fk of detail.foreignKeys) {
    if (fk.status === 'removed' || fk.status === 'modified') {
      statements.push(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${fk.name}\`;`);
    }
  }

  // 2. DROP INDEX
  for (const idx of detail.indexes) {
    if (idx.status === 'removed' || idx.status === 'modified') {
      statements.push(`ALTER TABLE \`${tableName}\` DROP INDEX \`${idx.name}\`;`);
    }
  }

  // 3. DROP PRIMARY KEY
  if (detail.primaryKeyChanged) {
    statements.push(`ALTER TABLE \`${tableName}\` DROP PRIMARY KEY;`);
  }

  // 4. DROP COLUMN
  for (const col of detail.columns) {
    if (col.status === 'removed') {
      statements.push(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${col.name}\`;`);
    }
  }

  // 5. ADD COLUMN
  for (const col of detail.columns) {
    if (col.status === 'added') {
      statements.push(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`${col.name}\` ${col.targetDefinition};`
      );
    }
  }

  // 6. MODIFY COLUMN
  for (const col of detail.columns) {
    if (col.status === 'modified') {
      // Use target definition since we're migrating target to match source
      statements.push(
        `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${col.name}\` ${col.sourceDefinition};`
      );
    }
  }

  // 7. ADD PRIMARY KEY
  if (detail.primaryKeyChanged) {
    // We need to get the source primary key - it's in the source raw
    // For now, add a comment placeholder; the full PK would come from the parsed source
    statements.push(
      `-- TODO: ADD PRIMARY KEY for \`${tableName}\` from source definition`
    );
  }

  // 8. ADD INDEX
  for (const idx of detail.indexes) {
    if (idx.status === 'added') {
      const unique = idx.targetUnique ? 'UNIQUE ' : '';
      const cols = (idx.targetColumns || []).map((c) => `\`${c}\``).join(', ');
      statements.push(
        `ALTER TABLE \`${tableName}\` ADD ${unique}INDEX \`${idx.name}\` (${cols});`
      );
    } else if (idx.status === 'modified') {
      const unique = idx.sourceUnique ? 'UNIQUE ' : '';
      const cols = (idx.sourceColumns || []).map((c) => `\`${c}\``).join(', ');
      statements.push(
        `ALTER TABLE \`${tableName}\` ADD ${unique}INDEX \`${idx.name}\` (${cols});`
      );
    }
  }

  // 9. ADD FOREIGN KEY
  for (const fk of detail.foreignKeys) {
    if (fk.status === 'added' || fk.status === 'modified') {
      statements.push(
        `-- TODO: ADD FOREIGN KEY \`${fk.name}\` on \`${tableName}\` from source definition`
      );
    }
  }

  // 10. Table option changes
  const optionParts: string[] = [];
  for (const [key, val] of Object.entries(detail.optionChanges)) {
    if (val.source) {
      optionParts.push(`${key}=${val.source}`);
    }
  }
  if (optionParts.length > 0) {
    statements.push(
      `ALTER TABLE \`${tableName}\` ${optionParts.join(' ')};`
    );
  }

  return statements;
}
