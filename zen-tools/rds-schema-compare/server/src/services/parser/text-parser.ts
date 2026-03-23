import { ParsedText } from './types.js';

export function parseText(raw: string): ParsedText {
  let normalized = raw;
  // Strip DEFINER clause
  normalized = normalized.replace(
    /\bDEFINER\s*=\s*`[^`]*`@`[^`]*`\s*/gi,
    ''
  );
  // Normalize whitespace
  normalized = normalized.replace(/\r\n/g, '\n');
  normalized = normalized.replace(/[ \t]+/g, ' ');
  normalized = normalized.replace(/\n\s*\n/g, '\n');
  normalized = normalized.trim();

  return { normalized, raw };
}
