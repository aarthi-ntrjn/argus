#!/usr/bin/env node
/**
 * Thin launcher used by playwright.real.config.ts.
 * Sets ARGUS_PORT and ARGUS_DB_PATH from CLI args then imports the server.
 *
 * Usage: node backend/start-test-server.mjs <port> <db-path>
 */
const [port, dbPath] = process.argv.slice(2);
if (port) process.env.ARGUS_PORT = port;
if (dbPath) process.env.ARGUS_DB_PATH = dbPath;

const { startServer } = await import('./src/server.ts');
await startServer();
