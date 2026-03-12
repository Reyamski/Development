import fs from 'fs/promises';
import path from 'path';
import { OBJECT_TYPES, ObjectType, SchemaFile, SchemaFilePair } from './parser/types.js';
import { parseIndexFile } from './parser/index-parser.js';

async function walkDir(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(full)));
    } else if (entry.isFile() && entry.name.endsWith('.sql')) {
      files.push(full);
    }
  }
  return files;
}

function classifyFile(filePath: string, rootDir: string): SchemaFile | null {
  const rel = path.relative(rootDir, filePath);
  const parts = rel.split(path.sep);

  // Find the object type folder in the path
  for (let i = 0; i < parts.length; i++) {
    const folder = parts[i] as ObjectType;
    if (OBJECT_TYPES.includes(folder)) {
      const fileName = parts.slice(i + 1).join('/');
      const name = fileName.replace(/\.sql$/, '');
      return {
        objectType: folder,
        name,
        key: `${folder}/${name}`,
        path: filePath,
      };
    }
  }
  return null;
}

export async function scanFolder(rootDir: string): Promise<SchemaFile[]> {
  const allFiles = await walkDir(rootDir);
  const classified: SchemaFile[] = [];
  for (const f of allFiles) {
    const sf = classifyFile(f, rootDir);
    if (sf) classified.push(sf);
  }
  return classified;
}

export function matchFiles(
  sourceFiles: SchemaFile[],
  targetFiles: SchemaFile[]
): SchemaFilePair[] {
  const map = new Map<string, SchemaFilePair>();

  for (const sf of sourceFiles) {
    map.set(sf.key, {
      key: sf.key,
      objectType: sf.objectType,
      name: sf.name,
      source: sf,
    });
  }

  for (const tf of targetFiles) {
    const existing = map.get(tf.key);
    if (existing) {
      existing.target = tf;
    } else {
      map.set(tf.key, {
        key: tf.key,
        objectType: tf.objectType,
        name: tf.name,
        target: tf,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Match index files by parsed structure (table + columns + uniqueness)
 * instead of by filename. Unmatched source indexes are "removed",
 * unmatched target indexes are "added", matched pairs are kept for
 * structural diff (which will mark them unchanged).
 */
export async function matchFilesWithStructuralIndexes(
  sourceFiles: SchemaFile[],
  targetFiles: SchemaFile[]
): Promise<SchemaFilePair[]> {
  const sourceIndexes = sourceFiles.filter((f) => f.objectType === 'indexes');
  const targetIndexes = targetFiles.filter((f) => f.objectType === 'indexes');
  const sourceOther = sourceFiles.filter((f) => f.objectType !== 'indexes');
  const targetOther = targetFiles.filter((f) => f.objectType !== 'indexes');

  // Match non-index files by name as usual
  const pairs = matchFiles(sourceOther, targetOther);

  // Build structural keys for index files
  async function structuralKey(sf: SchemaFile): Promise<string> {
    const raw = await fs.readFile(sf.path, 'utf-8');
    const parsed = parseIndexFile(raw, sf.name);
    return `${parsed.tableName}|${parsed.unique}|${JSON.stringify(parsed.columns)}`;
  }

  const sourceByStructure = new Map<string, SchemaFile[]>();
  for (const sf of sourceIndexes) {
    const key = await structuralKey(sf);
    const list = sourceByStructure.get(key) || [];
    list.push(sf);
    sourceByStructure.set(key, list);
  }

  const targetByStructure = new Map<string, SchemaFile[]>();
  for (const tf of targetIndexes) {
    const key = await structuralKey(tf);
    const list = targetByStructure.get(key) || [];
    list.push(tf);
    targetByStructure.set(key, list);
  }

  const matchedTargetKeys = new Set<string>();

  for (const [structKey, srcFiles] of sourceByStructure) {
    const tgtFiles = targetByStructure.get(structKey);
    if (tgtFiles && tgtFiles.length > 0) {
      // Pair them up by structure
      const matchCount = Math.min(srcFiles.length, tgtFiles.length);
      for (let i = 0; i < matchCount; i++) {
        pairs.push({
          key: srcFiles[i].key,
          objectType: 'indexes',
          name: srcFiles[i].name,
          source: srcFiles[i],
          target: tgtFiles[i],
        });
      }
      // Extras in source = removed
      for (let i = matchCount; i < srcFiles.length; i++) {
        pairs.push({
          key: srcFiles[i].key,
          objectType: 'indexes',
          name: srcFiles[i].name,
          source: srcFiles[i],
        });
      }
      // Extras in target = added
      for (let i = matchCount; i < tgtFiles.length; i++) {
        pairs.push({
          key: tgtFiles[i].key,
          objectType: 'indexes',
          name: tgtFiles[i].name,
          target: tgtFiles[i],
        });
      }
      matchedTargetKeys.add(structKey);
    } else {
      for (const sf of srcFiles) {
        pairs.push({
          key: sf.key,
          objectType: 'indexes',
          name: sf.name,
          source: sf,
        });
      }
    }
  }

  for (const [structKey, tgtFiles] of targetByStructure) {
    if (!matchedTargetKeys.has(structKey)) {
      for (const tf of tgtFiles) {
        pairs.push({
          key: tf.key,
          objectType: 'indexes',
          name: tf.name,
          target: tf,
        });
      }
    }
  }

  return pairs.sort((a, b) => a.key.localeCompare(b.key));
}
