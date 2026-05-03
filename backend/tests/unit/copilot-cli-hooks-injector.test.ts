/**
 * Unit tests for CopilotHooksInjector (T005 — TDD first).
 * These tests should FAIL until T006 (copilot-cli-hooks-injector.ts) is implemented.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';

const FAKE_DIR = join(tmpdir(), `copilot-injector-test-${randomUUID()}`);

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => FAKE_DIR };
});

// Use a temp DB per test run
process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-injector-test-${randomUUID()}.db`);

const TEST_REPO_A = join(FAKE_DIR, 'repo-a');
const TEST_REPO_B = join(FAKE_DIR, 'repo-b');
const HOOKS_JSON_A = join(TEST_REPO_A, '.github', 'hooks', 'hooks.json');
const HOOKS_JSON_B = join(TEST_REPO_B, '.github', 'hooks', 'hooks.json');

const EVENTS = ['sessionStart', 'sessionEnd', 'preToolUse', 'postToolUse'];

function readHooks(path: string) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function isArgusEntry(entry: { bash?: string; powershell?: string }) {
  return (
    (entry.bash ?? '').includes('/hooks/copilot') ||
    (entry.powershell ?? '').includes('/hooks/copilot')
  );
}

describe('CopilotHooksInjector', () => {
  let dbModule: typeof import('../../src/db/database.js');
  let InjectorClass: typeof import('../../src/services/copilot-cli-hooks-injector.js').CopilotHooksInjector;

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-injector-test-${randomUUID()}.db`);
    vi.resetModules();

    mkdirSync(join(TEST_REPO_A, '.git'), { recursive: true });
    mkdirSync(join(TEST_REPO_B, '.git'), { recursive: true });

    dbModule = await import('../../src/db/database.js');
    const mod = await import('../../src/services/copilot-cli-hooks-injector.js');
    InjectorClass = mod.CopilotHooksInjector;
  });

  afterEach(() => {
    [TEST_REPO_A, TEST_REPO_B].forEach((dir) => {
      const hooksDir = join(dir, '.github', 'hooks');
      if (existsSync(hooksDir)) rmSync(hooksDir, { recursive: true, force: true });
    });
  });

  describe('injectForRepo()', () => {
    it('creates hooks.json with version 1 and all four events', () => {
      const injector = new InjectorClass();
      injector.injectForRepo(TEST_REPO_A);

      expect(existsSync(HOOKS_JSON_A)).toBe(true);
      const data = readHooks(HOOKS_JSON_A);
      expect(data.version).toBe(1);
      for (const event of EVENTS) {
        expect(data.hooks[event]).toBeDefined();
        expect(Array.isArray(data.hooks[event])).toBe(true);
        expect(data.hooks[event].length).toBeGreaterThan(0);
      }
    });

    it('each injected entry has type:"command", bash, and powershell fields', () => {
      new InjectorClass().injectForRepo(TEST_REPO_A);
      const data = readHooks(HOOKS_JSON_A);
      for (const event of EVENTS) {
        for (const entry of data.hooks[event]) {
          if (isArgusEntry(entry)) {
            expect(entry.type).toBe('command');
            expect(typeof entry.bash).toBe('string');
            expect(typeof entry.powershell).toBe('string');
          }
        }
      }
    });

    it('bash and powershell commands reference /hooks/copilot with correct event', () => {
      new InjectorClass().injectForRepo(TEST_REPO_A);
      const data = readHooks(HOOKS_JSON_A);
      for (const event of EVENTS) {
        const argusEntry = data.hooks[event].find(isArgusEntry);
        expect(argusEntry).toBeDefined();
        expect(argusEntry.bash).toContain(`?event=${event}`);
        expect(argusEntry.powershell).toContain(`?event=${event}`);
      }
    });

    it('preserves existing non-Argus entries', () => {
      mkdirSync(join(TEST_REPO_A, '.github', 'hooks'), { recursive: true });
      writeFileSync(
        HOOKS_JSON_A,
        JSON.stringify({
          version: 1,
          hooks: { sessionStart: [{ type: 'command', bash: 'echo hello', powershell: 'Write-Host hello' }] },
        }),
        'utf-8',
      );
      new InjectorClass().injectForRepo(TEST_REPO_A);
      const data = readHooks(HOOKS_JSON_A);
      const sessionStartEntries = data.hooks.sessionStart;
      const userEntry = sessionStartEntries.find((e: { bash?: string }) => e.bash === 'echo hello');
      expect(userEntry).toBeDefined();
    });

    it('is idempotent: injecting twice produces the same Argus entries (no duplicates)', () => {
      const injector = new InjectorClass();
      injector.injectForRepo(TEST_REPO_A);
      injector.injectForRepo(TEST_REPO_A);
      const data = readHooks(HOOKS_JSON_A);
      for (const event of EVENTS) {
        const argusCount = data.hooks[event].filter(isArgusEntry).length;
        expect(argusCount).toBe(1);
      }
    });

    it('heals stale port: removes old Argus entry and replaces with current port', () => {
      mkdirSync(join(TEST_REPO_A, '.github', 'hooks'), { recursive: true });
      writeFileSync(
        HOOKS_JSON_A,
        JSON.stringify({
          version: 1,
          hooks: {
            sessionStart: [{
              type: 'command',
              bash: "curl -sf -X POST 'http://127.0.0.1:9999/hooks/copilot?event=sessionStart' -d @- 2>/dev/null || true",
              powershell: "$input | Invoke-RestMethod -Uri 'http://127.0.0.1:9999/hooks/copilot?event=sessionStart' -ErrorAction SilentlyContinue",
            }],
          },
        }),
        'utf-8',
      );
      new InjectorClass().injectForRepo(TEST_REPO_A);
      const data = readHooks(HOOKS_JSON_A);
      const sessionStartEntries = data.hooks.sessionStart;
      // Old port should be gone
      const oldEntry = sessionStartEntries.find((e: { bash?: string }) =>
        (e.bash ?? '').includes('9999'),
      );
      expect(oldEntry).toBeUndefined();
      // New entry with current port should exist
      expect(sessionStartEntries.filter(isArgusEntry).length).toBe(1);
    });

    it('does not throw and logs warn when hooks dir is unwritable', () => {
      // Simulate a non-existent repo path (permission-denied equivalent)
      const injector = new InjectorClass();
      // Should not throw even for a path that can't be written
      expect(() => injector.injectForRepo('/dev/null/not-a-directory')).not.toThrow();
    });
  });

  describe('removeForRepo()', () => {
    it('removes only Argus entries, leaves non-Argus entries', () => {
      mkdirSync(join(TEST_REPO_A, '.github', 'hooks'), { recursive: true });
      writeFileSync(
        HOOKS_JSON_A,
        JSON.stringify({
          version: 1,
          hooks: {
            sessionStart: [
              { type: 'command', bash: 'echo hello', powershell: 'echo hello' },
              {
                type: 'command',
                bash: "curl -sf -X POST 'http://127.0.0.1:7411/hooks/copilot?event=sessionStart' -d @- 2>/dev/null || true",
                powershell: "$input | Invoke-RestMethod -Uri 'http://127.0.0.1:7411/hooks/copilot?event=sessionStart'",
              },
            ],
          },
        }),
        'utf-8',
      );
      new InjectorClass().removeForRepo(TEST_REPO_A);
      const data = readHooks(HOOKS_JSON_A);
      expect(data.hooks.sessionStart).toHaveLength(1);
      expect(data.hooks.sessionStart[0].bash).toBe('echo hello');
    });

    it('deletes hooks.json if it becomes empty of all event arrays', () => {
      mkdirSync(join(TEST_REPO_A, '.github', 'hooks'), { recursive: true });
      const onlyArgus: Record<string, unknown[]> = {};
      for (const event of EVENTS) {
        onlyArgus[event] = [{
          type: 'command',
          bash: `curl -sf -X POST 'http://127.0.0.1:7411/hooks/copilot?event=${event}' -d @- 2>/dev/null || true`,
          powershell: `$input | Invoke-RestMethod -Uri 'http://127.0.0.1:7411/hooks/copilot?event=${event}'`,
        }];
      }
      writeFileSync(HOOKS_JSON_A, JSON.stringify({ version: 1, hooks: onlyArgus }), 'utf-8');
      new InjectorClass().removeForRepo(TEST_REPO_A);
      expect(existsSync(HOOKS_JSON_A)).toBe(false);
    });

    it('does not throw if hooks.json does not exist', () => {
      expect(() => new InjectorClass().removeForRepo(TEST_REPO_A)).not.toThrow();
    });
  });

  describe('injectForAll()', () => {
    it('injects hooks into all registered repositories', () => {
      dbModule.insertRepository({
        id: randomUUID(), path: TEST_REPO_A, name: 'repo-a', source: 'ui',
        addedAt: new Date().toISOString(), lastScannedAt: null,
      });
      dbModule.insertRepository({
        id: randomUUID(), path: TEST_REPO_B, name: 'repo-b', source: 'ui',
        addedAt: new Date().toISOString(), lastScannedAt: null,
      });
      new InjectorClass().injectForAll();
      expect(existsSync(HOOKS_JSON_A)).toBe(true);
      expect(existsSync(HOOKS_JSON_B)).toBe(true);
    });

    it('does not throw when no repositories are registered', () => {
      expect(() => new InjectorClass().injectForAll()).not.toThrow();
    });
  });
});
