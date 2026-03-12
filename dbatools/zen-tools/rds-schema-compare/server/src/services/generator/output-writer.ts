import fs from 'fs/promises';
import path from 'path';

export async function writeSingleFile(
  outputPath: string,
  sql: string
): Promise<string> {
  const filePath = path.join(outputPath, 'migration.sql');
  await fs.mkdir(outputPath, { recursive: true });
  await fs.writeFile(filePath, sql, 'utf-8');
  return filePath;
}

export async function writeIndividualFiles(
  outputPath: string,
  files: { name: string; sql: string }[]
): Promise<string[]> {
  await fs.mkdir(outputPath, { recursive: true });
  const written: string[] = [];

  for (const file of files) {
    const filePath = path.join(outputPath, file.name);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, file.sql, 'utf-8');
    written.push(filePath);
  }

  return written;
}
