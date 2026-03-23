import fs from 'fs/promises';
import path from 'path';
import { HealthReport } from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');

async function ensureReportsDir(): Promise<void> {
  try { await fs.mkdir(REPORTS_DIR, { recursive: true }); } catch { /* exists */ }
}

export async function saveReport(report: HealthReport): Promise<void> {
  await ensureReportsDir();
  const filename = `${report.id}.json`;
  await fs.writeFile(path.join(REPORTS_DIR, filename), JSON.stringify(report, null, 2));
}

export async function getReport(id: string): Promise<HealthReport | null> {
  try {
    const content = await fs.readFile(path.join(REPORTS_DIR, `${id}.json`), 'utf-8');
    return JSON.parse(content);
  } catch { return null; }
}

export async function listReports(stackId?: string, limit = 50): Promise<HealthReport[]> {
  await ensureReportsDir();
  try {
    const files = await fs.readdir(REPORTS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();

    const reports: HealthReport[] = [];
    for (const file of jsonFiles) {
      if (reports.length >= limit) break;
      try {
        const content = await fs.readFile(path.join(REPORTS_DIR, file), 'utf-8');
        const report: HealthReport = JSON.parse(content);
        if (!stackId || report.stackId === stackId) {
          reports.push(report);
        }
      } catch { /* skip corrupt files */ }
    }
    return reports;
  } catch { return []; }
}

export async function deleteReport(id: string): Promise<void> {
  try {
    await fs.unlink(path.join(REPORTS_DIR, `${id}.json`));
  } catch { /* ignore */ }
}
