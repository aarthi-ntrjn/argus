#!/usr/bin/env node

import { startServer } from '../backend/dist/server.js';

startServer().catch((err) => {
  console.error('Failed to start Argus:', err);
  process.exit(1);
});
