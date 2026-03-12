import { ComparisonResult } from '../differ/types.js';

const TYPE_KEYWORDS: Record<string, string> = {
  views: 'VIEW',
  procedures: 'PROCEDURE',
  functions: 'FUNCTION',
  triggers: 'TRIGGER',
  events: 'EVENT',
};

export function generateDropCreate(result: ComparisonResult): {
  drop: string[];
  create: string[];
} {
  const keyword = TYPE_KEYWORDS[result.objectType];
  if (!keyword) return { drop: [], create: [] };

  const drop: string[] = [];
  const create: string[] = [];

  if (result.status === 'removed') {
    drop.push(`DROP ${keyword} IF EXISTS \`${result.name}\`;`);
  } else if (result.status === 'added') {
    if (result.targetRaw) {
      create.push(result.targetRaw.trim().replace(/;?\s*$/, ';'));
    }
  } else if (result.status === 'modified') {
    drop.push(`DROP ${keyword} IF EXISTS \`${result.name}\`;`);
    // Re-create from source (the desired state)
    if (result.sourceRaw) {
      // Strip DEFINER for cleaner migration
      const cleaned = result.sourceRaw
        .replace(/\bDEFINER\s*=\s*`[^`]*`@`[^`]*`\s*/gi, '')
        .trim()
        .replace(/;?\s*$/, ';');
      create.push(cleaned);
    }
  }

  return { drop, create };
}
