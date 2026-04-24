import type { Baseline, CollationInfo, CollationIssue } from '../types.js';

/**
 * Flag every collation that does not match the baseline charset/collation.
 * HIGH — charset mismatch (potential data-loss / conversion risk)
 * MEDIUM — charset matches but collation differs (sort/compare semantics differ)
 */
export function analyzeCollations(collations: CollationInfo[], baseline: Baseline): CollationIssue[] {
  const issues: CollationIssue[] = [];

  for (const c of collations) {
    const charsetMatch = c.characterSet === baseline.characterSet;
    const collationMatch = c.collation === baseline.collation;
    if (charsetMatch && collationMatch) continue;

    const severity: CollationIssue['severity'] = charsetMatch ? 'MEDIUM' : 'HIGH';
    const type = charsetMatch ? 'COLLATION_MISMATCH' : 'CHARSET_MISMATCH';
    const description = charsetMatch
      ? `Collation differs from baseline (${c.collation} vs ${baseline.collation})`
      : `Character set differs from baseline (${c.characterSet} vs ${baseline.characterSet})`;

    issues.push({
      severity,
      type,
      database: c.database,
      table: c.table || undefined,
      column: c.column || undefined,
      level: c.level,
      description,
      currentCollation: c.collation,
      currentCharset: c.characterSet,
      expectedCollation: baseline.collation,
      expectedCharset: baseline.characterSet,
    });
  }

  return issues;
}

/**
 * Returns true if the row matches the baseline.
 */
export function matchesBaseline(c: CollationInfo, baseline: Baseline): boolean {
  return c.characterSet === baseline.characterSet && c.collation === baseline.collation;
}
