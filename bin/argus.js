#!/usr/bin/env node

import { exec } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const args = process.argv.slice(2);
if (args.includes('--version') || args.includes('-v')) {
  console.log(version);
  process.exit(0);
}

const skipOpen = args.includes('--no-open');

function openBrowser(url) {
  const cmd =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${cmd} ${url}`);
}

import { startServer } from '../backend/dist/server.js';

startServer()
  .then((app) => {
    if (!skipOpen) {
      const addr = app.server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 7411;
      openBrowser(`http://localhost:${port}`);
    }
  })
  .catch((err) => {
    console.error('Failed to start Argus:', err);
    process.exit(1);
  });
