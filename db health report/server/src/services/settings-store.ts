import fs from 'fs';
import path from 'path';
import { ThresholdConfig, DEFAULT_THRESHOLDS, SchedulerConfig, DEFAULT_SCHEDULER_CONFIG } from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

interface Settings {
  thresholds: ThresholdConfig;
  scheduler: SchedulerConfig;
}

let cached: Settings | null = null;

function ensureDataDir(): void {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* exists */ }
}

export function getSettings(): Settings {
  if (cached) return cached;
  ensureDataDir();
  try {
    const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    cached = JSON.parse(content);
    return cached!;
  } catch {
    const defaults: Settings = {
      thresholds: { ...DEFAULT_THRESHOLDS },
      scheduler: { ...DEFAULT_SCHEDULER_CONFIG },
    };
    cached = defaults;
    return defaults;
  }
}

export function saveSettings(settings: Settings): void {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  cached = settings;
}

export function getThresholds(): ThresholdConfig {
  return getSettings().thresholds;
}

export function updateThresholds(thresholds: Partial<ThresholdConfig>): ThresholdConfig {
  const settings = getSettings();
  const updated = { ...settings.thresholds, ...thresholds };
  saveSettings({ ...settings, thresholds: updated });
  return updated;
}
