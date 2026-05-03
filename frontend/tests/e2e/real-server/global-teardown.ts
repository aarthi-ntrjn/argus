import { rmSync, existsSync } from 'fs';
import { TEST_DB_PATH, TEST_REPOS_DIR, TEST_PORT } from './test-config.js';

export default async function globalTeardown() {
  if (process.env.NODE_V8_COVERAGE) {
    try {
      await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/test/shutdown`, { method: 'POST' });
      await new Promise(r => setTimeout(r, 600));
    } catch {
      // Server may already be down
    }
  }

  if (existsSync(TEST_REPOS_DIR)) {
    rmSync(TEST_REPOS_DIR, { recursive: true, force: true });
  }
  if (existsSync(TEST_DB_PATH)) {
    try {
      rmSync(TEST_DB_PATH, { force: true });
    } catch {
      // The DB may still be locked by the server process on Windows; ignore
    }
  }
}
