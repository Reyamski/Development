import { ComparisonResult } from '../differ/types.js';

export function generateIndexChanges(result: ComparisonResult): {
  drop: string[];
  create: string[];
} {
  const drop: string[] = [];
  const create: string[] = [];

  if (result.objectType !== 'indexes') return { drop, create };

  if (result.status === 'removed') {
    // Extract table name and index name from the key (format: indexes/{table}__{index})
    const parts = result.name.split('__');
    const tableName = parts[0];
    const indexName = parts[1] || result.name;
    drop.push(`DROP INDEX \`${indexName}\` ON \`${tableName}\`;`);
  } else if (result.status === 'added') {
    if (result.targetRaw) {
      create.push(result.targetRaw.trim().replace(/;?\s*$/, ';'));
    }
  } else if (result.status === 'modified') {
    const parts = result.name.split('__');
    const tableName = parts[0];
    const indexName = parts[1] || result.name;
    drop.push(`DROP INDEX \`${indexName}\` ON \`${tableName}\`;`);
    if (result.sourceRaw) {
      create.push(result.sourceRaw.trim().replace(/;?\s*$/, ';'));
    }
  }

  return { drop, create };
}
