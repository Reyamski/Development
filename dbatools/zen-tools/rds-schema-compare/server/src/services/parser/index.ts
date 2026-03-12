import { ObjectType, ParsedObject } from './types.js';
import { parseTable } from './table-parser.js';
import { parseIndexFile } from './index-parser.js';
import { parseText } from './text-parser.js';

export function parse(
  raw: string,
  objectType: ObjectType,
  fileName: string
): ParsedObject {
  switch (objectType) {
    case 'tables':
      return parseTable(raw);
    case 'indexes':
      return parseIndexFile(raw, fileName);
    default:
      return parseText(raw);
  }
}

export { parseTable, parseIndexFile, parseText };
