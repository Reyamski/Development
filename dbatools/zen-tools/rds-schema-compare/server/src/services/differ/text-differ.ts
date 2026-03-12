import { ParsedText } from '../parser/types.js';
import { DiffStatus, DiffOptions } from './types.js';

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function diffText(
  source: ParsedText | undefined,
  target: ParsedText | undefined,
  options?: DiffOptions
): DiffStatus {
  if (!source && !target) return 'unchanged';
  if (!source) return 'added';
  if (!target) return 'removed';

  let srcNorm = source.normalized;
  let tgtNorm = target.normalized;

  if (options?.ignoreWhitespace) {
    srcNorm = collapseWhitespace(srcNorm);
    tgtNorm = collapseWhitespace(tgtNorm);
  }

  return srcNorm === tgtNorm ? 'unchanged' : 'modified';
}
