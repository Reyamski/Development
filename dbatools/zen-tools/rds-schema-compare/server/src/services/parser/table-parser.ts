import { Parser } from 'node-sql-parser';
import {
  ParsedTable,
  ParsedColumn,
  ParsedIndex,
  ParsedForeignKey,
} from './types.js';

const sqlParser = new Parser();

function columnDefToString(col: any): string {
  const parts: string[] = [];

  // Type
  const dataType = col.definition?.dataType || 'unknown';
  if (col.definition?.length) {
    if (col.definition.scale !== undefined && col.definition.scale !== null) {
      parts.push(`${dataType}(${col.definition.length},${col.definition.scale})`);
    } else {
      parts.push(`${dataType}(${col.definition.length})`);
    }
  } else {
    parts.push(dataType);
  }

  // Unsigned
  if (col.definition?.suffix && col.definition.suffix.includes('UNSIGNED')) {
    parts.push('UNSIGNED');
  }

  // Nullable
  if (col.nullable?.type === 'not null') {
    parts.push('NOT NULL');
  } else if (col.nullable?.type === 'null') {
    parts.push('NULL');
  }

  // Default
  if (col.default_val !== undefined && col.default_val !== null) {
    const dv = col.default_val;
    if (dv.value?.type === 'function') {
      parts.push(`DEFAULT ${dv.value.name?.name?.[0]?.value || dv.value.name || 'UNKNOWN'}()`);
    } else if (dv.value?.type === 'null') {
      parts.push('DEFAULT NULL');
    } else if (dv.value !== undefined && dv.value !== null) {
      const val = typeof dv.value === 'object' ? dv.value.value : dv.value;
      if (typeof val === 'string') {
        parts.push(`DEFAULT '${val}'`);
      } else {
        parts.push(`DEFAULT ${val}`);
      }
    }
  }

  // Auto increment
  if (col.auto_increment === 'auto_increment') {
    parts.push('AUTO_INCREMENT');
  }

  // Comment
  if (col.comment?.value) {
    parts.push(`COMMENT '${col.comment.value.value || col.comment.value}'`);
  }

  return parts.join(' ');
}

export function parseTable(raw: string): ParsedTable {
  const name = extractTableName(raw);

  let ast: any;
  try {
    ast = sqlParser.astify(raw, { database: 'MySQL' });
  } catch {
    // Fallback: return raw-only parsed table
    return {
      name,
      columns: [],
      primaryKey: null,
      indexes: [],
      foreignKeys: [],
      options: {},
      raw,
    };
  }

  const stmt = Array.isArray(ast) ? ast[0] : ast;
  if (!stmt || stmt.type !== 'create' || stmt.keyword !== 'table') {
    return { name, columns: [], primaryKey: null, indexes: [], foreignKeys: [], options: {}, raw };
  }

  const columns: ParsedColumn[] = [];
  const indexes: ParsedIndex[] = [];
  const foreignKeys: ParsedForeignKey[] = [];
  let primaryKey: string[] | null = null;

  const defs = stmt.create_definitions || [];
  for (const def of defs) {
    if (def.resource === 'column') {
      columns.push({
        name: def.column?.column || 'unknown',
        definition: columnDefToString(def),
      });
    } else if (def.resource === 'constraint') {
      if (def.constraint_type === 'primary key') {
        primaryKey = (def.definition || []).map((d: any) => d.column || d);
      } else if (def.constraint_type === 'unique key' || def.constraint_type === 'key' || def.constraint_type === 'index') {
        indexes.push({
          name: def.index || def.constraint || 'unnamed',
          unique: def.constraint_type === 'unique key',
          columns: (def.definition || []).map((d: any) => d.column || d),
          type: def.index_type,
        });
      } else if (def.constraint_type === 'FOREIGN KEY') {
        foreignKeys.push({
          name: def.constraint || 'unnamed',
          columns: (def.definition || []).map((d: any) => d.column || d),
          referenceTable: def.reference_definition?.table?.[0]?.table || 'unknown',
          referenceColumns: (def.reference_definition?.definition || []).map(
            (d: any) => d.column || d
          ),
          onDelete: def.reference_definition?.on_action?.find(
            (a: any) => a.type === 'on delete'
          )?.value,
          onUpdate: def.reference_definition?.on_action?.find(
            (a: any) => a.type === 'on update'
          )?.value,
        });
      }
    }
  }

  // Table options
  const options: Record<string, string> = {};
  const tableOptions = stmt.table_options;
  if (Array.isArray(tableOptions)) {
    for (const opt of tableOptions) {
      if (opt.keyword && opt.value) {
        options[opt.keyword.toUpperCase()] = String(opt.value);
      }
    }
  }

  return { name, columns, primaryKey, indexes, foreignKeys, options, raw };
}

function extractTableName(raw: string): string {
  const match = raw.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i);
  return match?.[1] || 'unknown';
}
