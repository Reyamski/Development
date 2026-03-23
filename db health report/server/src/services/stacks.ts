import fs from 'fs/promises';
import path from 'path';
import { Stack } from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const STACKS_FILE = path.join(DATA_DIR, 'stacks.json');

async function ensureDataDir(): Promise<void> {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch { /* exists */ }
}

export async function getStacks(): Promise<Stack[]> {
  await ensureDataDir();
  try {
    const content = await fs.readFile(STACKS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch { return []; }
}

export async function saveStacks(stacks: Stack[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(STACKS_FILE, JSON.stringify(stacks, null, 2));
}

export async function getStack(id: string): Promise<Stack | null> {
  const stacks = await getStacks();
  return stacks.find(s => s.id === id) || null;
}

export async function upsertStack(stack: Stack): Promise<void> {
  const stacks = await getStacks();
  const idx = stacks.findIndex(s => s.id === stack.id);
  if (idx >= 0) stacks[idx] = stack;
  else stacks.push(stack);
  await saveStacks(stacks);
}

export async function deleteStack(id: string): Promise<void> {
  const stacks = await getStacks();
  await saveStacks(stacks.filter(s => s.id !== id));
}
