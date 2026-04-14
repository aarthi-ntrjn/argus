#!/usr/bin/env node

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from the same directory as this script, if present.
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

import { startServer } from '../backend/dist/server.js';

startServer().catch((err) => {
  console.error('Failed to start Argus:', err);
  process.exit(1);
});
