import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ArgusConfig } from '../models/index.js';

const CONFIG_DIR = join(homedir(), '.argus');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULTS: ArgusConfig = {
  port: process.env.ARGUS_PORT ? parseInt(process.env.ARGUS_PORT, 10) : 7411,
  watchDirectories: [],
  sessionRetentionHours: 24,
  outputRetentionMbPerSession: 10,
  autoRegisterRepos: false,
};

export function loadConfig(): ArgusConfig {
  if (!existsSync(CONFIG_PATH)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2), 'utf-8');
    return { ...DEFAULTS };
  }
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const fileConfig = JSON.parse(raw);
    const merged = { ...DEFAULTS, ...fileConfig };
    // Environment variables always override config file
    if (process.env.ARGUS_PORT) merged.port = parseInt(process.env.ARGUS_PORT, 10);
    if (process.env.ARGUS_DB_PATH) merged.dbPath = process.env.ARGUS_DB_PATH;
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(config: ArgusConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
