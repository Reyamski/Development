import fs from 'fs/promises';
import { SchemaFilePair, ParsedIndexFile } from '../parser/types.js';
import { parse } from '../parser/index.js';
import { diffText } from './text-differ.js';
import { diffTables, detectCollateDrift, detectCharsetDrift } from './table-differ.js';
import { ComparisonResult, DiffStatus, DiffOptions } from './types.js';
import { ParsedTable, ParsedText } from '../parser/types.js';

const DEFAULT_OPTIONS: DiffOptions = {
  ignoreFkNameOnly: false,
  ignoreIndexNameOnly: false,
  ignoreCollate: false,
  ignoreCharset: false,
  ignoreWhitespace: false,
};

function diffIndexFiles(
  source: ParsedIndexFile,
  target: ParsedIndexFile
): DiffStatus {
  const same =
    source.tableName === target.tableName &&
    source.unique === target.unique &&
    JSON.stringify(source.columns) === JSON.stringify(target.columns);
  return same ? 'unchanged' : 'modified';
}

/** True if the only difference between two SQL strings is COLLATE clauses. */
function textHasCollateDrift(sourceRaw: string, targetRaw: string): boolean {
  const strip = (s: string) => s.replace(/\s+COLLATE\s+\S+/gi, '').replace(/\s+/g, ' ').trim();
  return sourceRaw !== targetRaw && strip(sourceRaw) === strip(targetRaw);
}

/** True if the only difference between two SQL strings is CHARACTER SET / CHARSET clauses. */
function textHasCharsetDrift(sourceRaw: string, targetRaw: string): boolean {
  const strip = (s: string) =>
    s.replace(/\s+CHARACTER\s+SET\s+\S+/gi, '').replace(/\s+CHARSET\s+\S+/gi, '').replace(/\s+/g, ' ').trim();
  return sourceRaw !== targetRaw && strip(sourceRaw) === strip(targetRaw);
}

export async function compareFiles(
  pairs: SchemaFilePair[],
  options: DiffOptions = DEFAULT_OPTIONS
): Promise<ComparisonResult[]> {
  const results: ComparisonResult[] = [];

  for (const pair of pairs) {
    const sourceRaw = pair.source
      ? await fs.readFile(pair.source.path, 'utf-8')
      : undefined;
    const targetRaw = pair.target
      ? await fs.readFile(pair.target.path, 'utf-8')
      : undefined;

    let status: DiffStatus;
    let tableDiff;
    let collateDrift: boolean | undefined;
    let charsetDrift: boolean | undefined;

    if (!pair.source) {
      status = 'added';
    } else if (!pair.target) {
      status = 'removed';
    } else if (pair.objectType === 'tables') {
      const sourceParsed = parse(sourceRaw!, 'tables', pair.name) as ParsedTable;
      const targetParsed = parse(targetRaw!, 'tables', pair.name) as ParsedTable;
      const result = diffTables(sourceParsed, targetParsed, options);
      status = result.status;
      tableDiff = result.detail;
      if (status === 'modified') {
        collateDrift = detectCollateDrift(sourceParsed, targetParsed);
        charsetDrift = detectCharsetDrift(sourceParsed, targetParsed);
      }
    } else if (pair.objectType === 'indexes' && options.ignoreIndexNameOnly) {
      const sourceParsed = parse(sourceRaw!, 'indexes', pair.name) as ParsedIndexFile;
      const targetParsed = parse(targetRaw!, 'indexes', pair.name) as ParsedIndexFile;
      status = diffIndexFiles(sourceParsed, targetParsed);
    } else {
      const sourceParsed = parse(sourceRaw!, pair.objectType, pair.name) as ParsedText;
      const targetParsed = parse(targetRaw!, pair.objectType, pair.name) as ParsedText;
      status = diffText(sourceParsed, targetParsed, options);
      if (status === 'modified') {
        collateDrift = textHasCollateDrift(sourceRaw!, targetRaw!);
        charsetDrift = textHasCharsetDrift(sourceRaw!, targetRaw!);
      }
    }

    results.push({
      key: pair.key,
      objectType: pair.objectType,
      name: pair.name,
      status,
      sourceRaw,
      targetRaw,
      tableDiff,
      collateDrift,
      charsetDrift,
    });
  }

  return results;
}

export type { ComparisonResult, DiffStatus, DiffOptions };
