import { ParsedTable, ParsedIndex, ParsedForeignKey } from '../parser/types.js';
import {
  TableDiffDetail,
  ColumnDiff,
  IndexDiff,
  ForeignKeyDiff,
  DiffStatus,
  DiffOptions,
} from './types.js';

const DEFAULT_OPTIONS: DiffOptions = {
  ignoreFkNameOnly: false,
  ignoreIndexNameOnly: false,
  ignoreCollate: false,
  ignoreCharset: false,
  ignoreWhitespace: false,
};

export function diffTables(
  source: ParsedTable | undefined,
  target: ParsedTable | undefined,
  options: DiffOptions = DEFAULT_OPTIONS
): { status: DiffStatus; detail?: TableDiffDetail } {
  if (!source && !target) return { status: 'unchanged' };
  if (!source) return { status: 'added' };
  if (!target) return { status: 'removed' };

  const columns = diffColumns(source, target, options);
  const indexes = options.ignoreIndexNameOnly
    ? diffIndexesByStructure(source, target)
    : diffIndexesByName(source, target);
  const foreignKeys = options.ignoreFkNameOnly
    ? diffForeignKeysByStructure(source, target)
    : diffForeignKeysByName(source, target);
  const primaryKeyChanged = diffPrimaryKey(source, target);
  const optionChanges = diffOptions(source, target, options);

  const hasChanges =
    columns.some((c) => c.status !== 'unchanged') ||
    indexes.some((i) => i.status !== 'unchanged') ||
    foreignKeys.some((f) => f.status !== 'unchanged') ||
    primaryKeyChanged ||
    Object.keys(optionChanges).length > 0;

  return {
    status: hasChanges ? 'modified' : 'unchanged',
    detail: hasChanges
      ? { columns, indexes, foreignKeys, primaryKeyChanged, optionChanges }
      : undefined,
  };
}

function diffColumns(source: ParsedTable, target: ParsedTable, options: DiffOptions): ColumnDiff[] {
  const result: ColumnDiff[] = [];
  const sourceMap = new Map(source.columns.map((c) => [c.name, c]));
  const targetMap = new Map(target.columns.map((c) => [c.name, c]));

  for (const [name, col] of sourceMap) {
    const targetCol = targetMap.get(name);
    if (!targetCol) {
      result.push({ name, status: 'removed', sourceDefinition: col.definition });
    } else {
      let srcDef = col.definition;
      let tgtDef = targetCol.definition;
      if (options.ignoreCollate) { srcDef = stripCollate(srcDef); tgtDef = stripCollate(tgtDef); }
      if (options.ignoreCharset) { srcDef = stripCharset(srcDef); tgtDef = stripCharset(tgtDef); }
      if (srcDef !== tgtDef) {
        result.push({
          name,
          status: 'modified',
          sourceDefinition: col.definition,
          targetDefinition: targetCol.definition,
        });
      } else {
        result.push({ name, status: 'unchanged', sourceDefinition: col.definition });
      }
    }
  }

  for (const [name, col] of targetMap) {
    if (!sourceMap.has(name)) {
      result.push({ name, status: 'added', targetDefinition: col.definition });
    }
  }

  return result;
}

// --- Index diffing ---

function diffIndexesByName(source: ParsedTable, target: ParsedTable): IndexDiff[] {
  const result: IndexDiff[] = [];
  const sourceMap = new Map(source.indexes.map((i) => [i.name, i]));
  const targetMap = new Map(target.indexes.map((i) => [i.name, i]));

  for (const [name, idx] of sourceMap) {
    const targetIdx = targetMap.get(name);
    if (!targetIdx) {
      result.push({ name, status: 'removed', sourceColumns: idx.columns, sourceUnique: idx.unique });
    } else {
      const same =
        idx.unique === targetIdx.unique &&
        JSON.stringify(idx.columns) === JSON.stringify(targetIdx.columns);
      result.push({
        name,
        status: same ? 'unchanged' : 'modified',
        sourceColumns: idx.columns,
        targetColumns: targetIdx.columns,
        sourceUnique: idx.unique,
        targetUnique: targetIdx.unique,
      });
    }
  }

  for (const [name, idx] of targetMap) {
    if (!sourceMap.has(name)) {
      result.push({ name, status: 'added', targetColumns: idx.columns, targetUnique: idx.unique });
    }
  }

  return result;
}

function indexStructureKey(idx: ParsedIndex): string {
  return `${idx.unique ? 'U' : ''}:${JSON.stringify(idx.columns)}`;
}

function diffIndexesByStructure(source: ParsedTable, target: ParsedTable): IndexDiff[] {
  const result: IndexDiff[] = [];

  const sourceByStructure = new Map<string, ParsedIndex[]>();
  for (const idx of source.indexes) {
    const key = indexStructureKey(idx);
    const list = sourceByStructure.get(key) || [];
    list.push(idx);
    sourceByStructure.set(key, list);
  }

  const targetByStructure = new Map<string, ParsedIndex[]>();
  for (const idx of target.indexes) {
    const key = indexStructureKey(idx);
    const list = targetByStructure.get(key) || [];
    list.push(idx);
    targetByStructure.set(key, list);
  }

  const matchedTargetKeys = new Set<string>();

  for (const [structKey, srcIndexes] of sourceByStructure) {
    const tgtIndexes = targetByStructure.get(structKey);
    if (tgtIndexes && tgtIndexes.length > 0) {
      const matchCount = Math.min(srcIndexes.length, tgtIndexes.length);
      for (let i = 0; i < matchCount; i++) {
        result.push({
          name: srcIndexes[i].name,
          status: 'unchanged',
          sourceColumns: srcIndexes[i].columns,
          sourceUnique: srcIndexes[i].unique,
        });
      }
      for (let i = matchCount; i < srcIndexes.length; i++) {
        result.push({
          name: srcIndexes[i].name,
          status: 'removed',
          sourceColumns: srcIndexes[i].columns,
          sourceUnique: srcIndexes[i].unique,
        });
      }
      for (let i = matchCount; i < tgtIndexes.length; i++) {
        result.push({
          name: tgtIndexes[i].name,
          status: 'added',
          targetColumns: tgtIndexes[i].columns,
          targetUnique: tgtIndexes[i].unique,
        });
      }
      matchedTargetKeys.add(structKey);
    } else {
      for (const idx of srcIndexes) {
        result.push({
          name: idx.name,
          status: 'removed',
          sourceColumns: idx.columns,
          sourceUnique: idx.unique,
        });
      }
    }
  }

  for (const [structKey, tgtIndexes] of targetByStructure) {
    if (!matchedTargetKeys.has(structKey)) {
      for (const idx of tgtIndexes) {
        result.push({
          name: idx.name,
          status: 'added',
          targetColumns: idx.columns,
          targetUnique: idx.unique,
        });
      }
    }
  }

  return result;
}

// --- Foreign key diffing ---

function diffForeignKeysByName(source: ParsedTable, target: ParsedTable): ForeignKeyDiff[] {
  const result: ForeignKeyDiff[] = [];
  const sourceMap = new Map(source.foreignKeys.map((f) => [f.name, f]));
  const targetMap = new Map(target.foreignKeys.map((f) => [f.name, f]));

  for (const [name, fk] of sourceMap) {
    const targetFk = targetMap.get(name);
    if (!targetFk) {
      result.push({ name, status: 'removed' });
    } else {
      const same =
        JSON.stringify(fk.columns) === JSON.stringify(targetFk.columns) &&
        fk.referenceTable === targetFk.referenceTable &&
        JSON.stringify(fk.referenceColumns) === JSON.stringify(targetFk.referenceColumns) &&
        fk.onDelete === targetFk.onDelete &&
        fk.onUpdate === targetFk.onUpdate;
      result.push({ name, status: same ? 'unchanged' : 'modified' });
    }
  }

  for (const name of targetMap.keys()) {
    if (!sourceMap.has(name)) {
      result.push({ name, status: 'added' });
    }
  }

  return result;
}

function fkStructureKey(fk: ParsedForeignKey): string {
  return `${JSON.stringify(fk.columns)}|${fk.referenceTable}|${JSON.stringify(fk.referenceColumns)}|${fk.onDelete || ''}|${fk.onUpdate || ''}`;
}

function diffForeignKeysByStructure(source: ParsedTable, target: ParsedTable): ForeignKeyDiff[] {
  const result: ForeignKeyDiff[] = [];

  const sourceByStructure = new Map<string, ParsedForeignKey[]>();
  for (const fk of source.foreignKeys) {
    const key = fkStructureKey(fk);
    const list = sourceByStructure.get(key) || [];
    list.push(fk);
    sourceByStructure.set(key, list);
  }

  const targetByStructure = new Map<string, ParsedForeignKey[]>();
  for (const fk of target.foreignKeys) {
    const key = fkStructureKey(fk);
    const list = targetByStructure.get(key) || [];
    list.push(fk);
    targetByStructure.set(key, list);
  }

  const matchedTargetKeys = new Set<string>();

  for (const [structKey, srcFks] of sourceByStructure) {
    const tgtFks = targetByStructure.get(structKey);
    if (tgtFks && tgtFks.length > 0) {
      const matchCount = Math.min(srcFks.length, tgtFks.length);
      for (let i = 0; i < matchCount; i++) {
        result.push({ name: srcFks[i].name, status: 'unchanged' });
      }
      for (let i = matchCount; i < srcFks.length; i++) {
        result.push({ name: srcFks[i].name, status: 'removed' });
      }
      for (let i = matchCount; i < tgtFks.length; i++) {
        result.push({ name: tgtFks[i].name, status: 'added' });
      }
      matchedTargetKeys.add(structKey);
    } else {
      for (const fk of srcFks) {
        result.push({ name: fk.name, status: 'removed' });
      }
    }
  }

  for (const [structKey, tgtFks] of targetByStructure) {
    if (!matchedTargetKeys.has(structKey)) {
      for (const fk of tgtFks) {
        result.push({ name: fk.name, status: 'added' });
      }
    }
  }

  return result;
}

// --- Helpers ---

function diffPrimaryKey(source: ParsedTable, target: ParsedTable): boolean {
  return JSON.stringify(source.primaryKey) !== JSON.stringify(target.primaryKey);
}

const COLLATE_KEYS = new Set(['COLLATE', 'DEFAULT COLLATE']);
const CHARSET_KEYS = new Set(['CHARACTER SET', 'DEFAULT CHARACTER SET', 'CHARSET']);

function diffOptions(
  source: ParsedTable,
  target: ParsedTable,
  options: DiffOptions
): Record<string, { source?: string; target?: string }> {
  const changes: Record<string, { source?: string; target?: string }> = {};
  const allKeys = new Set([...Object.keys(source.options), ...Object.keys(target.options)]);

  for (const key of allKeys) {
    const upper = key.toUpperCase();
    if (options.ignoreCollate && COLLATE_KEYS.has(upper)) continue;
    if (options.ignoreCharset && CHARSET_KEYS.has(upper)) continue;
    if (source.options[key] !== target.options[key]) {
      changes[key] = { source: source.options[key], target: target.options[key] };
    }
  }

  return changes;
}

function stripCollate(definition: string): string {
  return definition.replace(/\s+COLLATE\s+\S+/gi, '');
}

function stripCharset(definition: string): string {
  return definition
    .replace(/\s+CHARACTER\s+SET\s+\S+/gi, '')
    .replace(/\s+CHARSET\s+\S+/gi, '');
}

// --- Drift detection (used by the differ index to tag results) ---

export function detectCollateDrift(source: ParsedTable, target: ParsedTable): boolean {
  // Table-level COLLATE option differs
  const allKeys = new Set([...Object.keys(source.options), ...Object.keys(target.options)]);
  for (const key of allKeys) {
    if (COLLATE_KEYS.has(key.toUpperCase()) && source.options[key] !== target.options[key]) {
      return true;
    }
  }
  // Column-level: definition differs only in COLLATE
  const targetMap = new Map(target.columns.map((c) => [c.name, c]));
  for (const col of source.columns) {
    const tgt = targetMap.get(col.name);
    if (!tgt) continue;
    if (col.definition !== tgt.definition && stripCollate(col.definition) === stripCollate(tgt.definition)) {
      return true;
    }
  }
  return false;
}

export function detectCharsetDrift(source: ParsedTable, target: ParsedTable): boolean {
  // Table-level CHARSET option differs
  const allKeys = new Set([...Object.keys(source.options), ...Object.keys(target.options)]);
  for (const key of allKeys) {
    if (CHARSET_KEYS.has(key.toUpperCase()) && source.options[key] !== target.options[key]) {
      return true;
    }
  }
  // Column-level: definition differs only in CHARSET
  const targetMap = new Map(target.columns.map((c) => [c.name, c]));
  for (const col of source.columns) {
    const tgt = targetMap.get(col.name);
    if (!tgt) continue;
    if (col.definition !== tgt.definition && stripCharset(col.definition) === stripCharset(tgt.definition)) {
      return true;
    }
  }
  return false;
}
