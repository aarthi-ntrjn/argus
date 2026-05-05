import { defineConfig } from 'vitest/config';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    env: {
      ARGUS_DB_PATH: join(tmpdir(), `argus-test-${Date.now()}.db`),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
    },
  },
});
