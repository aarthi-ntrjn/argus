import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';

const FAKE_HOME = join(tmpdir(), `claude-injector-test-${randomUUID()}`);
const CLAUDE_SETTINGS_PATH = join(FAKE_HOME, '.claude', 'settings.json');

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => FAKE_HOME };
});

const EVENTS = ['SessionStart', 'SessionEnd', 'PreToolUse', 'PostToolUse'];
const ASK_EVENTS = ['PreToolUse', 'PostToolUse'];

function readSettings() {
  return JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
}

function isArgusEntry(entry: { hooks?: Array<{ command?: string }> }): boolean {
  return entry.hooks?.some((h) => (h.command ?? '').includes('/hooks/claude')) ?? false;
}

describe('ClaudeCodeHooksInjector', () => {
  let InjectorClass: typeof import('../../src/services/claude-code-hooks-injector.js').ClaudeCodeHooksInjector;

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-claude-injector-${randomUUID()}.db`);
    vi.resetModules();
    mkdirSync(join(FAKE_HOME, '.claude'), { recursive: true });
    const mod = await import('../../src/services/claude-code-hooks-injector.js');
    InjectorClass = mod.ClaudeCodeHooksInjector;
  });

  afterEach(() => {
    if (existsSync(CLAUDE_SETTINGS_PATH)) rmSync(CLAUDE_SETTINGS_PATH, { force: true });
  });

  describe('injectForAll()', () => {
    it('creates settings.json with all four hook events when file does not exist', () => {
      new InjectorClass().injectForAll();
      expect(existsSync(CLAUDE_SETTINGS_PATH)).toBe(true);
      const settings = readSettings();
      for (const event of EVENTS) {
        expect(settings.hooks[event]).toBeDefined();
        expect(Array.isArray(settings.hooks[event])).toBe(true);
      }
    });

    it('SessionStart and SessionEnd entries have empty matcher', () => {
      new InjectorClass().injectForAll();
      const settings = readSettings();
      for (const event of ['SessionStart', 'SessionEnd']) {
        const argusEntry = settings.hooks[event].find(isArgusEntry);
        expect(argusEntry).toBeDefined();
        expect(argusEntry.matcher).toBe('');
      }
    });

    it('PreToolUse and PostToolUse entries have matcher AskUserQuestion', () => {
      new InjectorClass().injectForAll();
      const settings = readSettings();
      for (const event of ASK_EVENTS) {
        const argusEntry = settings.hooks[event].find(isArgusEntry);
        expect(argusEntry).toBeDefined();
        expect(argusEntry.matcher).toBe('AskUserQuestion');
      }
    });

    it('injected command references /hooks/claude with default port 7411', () => {
      new InjectorClass().injectForAll();
      const settings = readSettings();
      for (const event of EVENTS) {
        const argusEntry = settings.hooks[event].find(isArgusEntry);
        expect(argusEntry.hooks[0].command).toContain('127.0.0.1:7411/hooks/claude');
      }
    });

    it('injected command uses port from ARGUS_PORT env var', async () => {
      process.env.ARGUS_PORT = '9000';
      vi.resetModules();
      const mod = await import('../../src/services/claude-code-hooks-injector.js');
      new mod.ClaudeCodeHooksInjector().injectForAll();
      const settings = readSettings();
      const argusEntry = settings.hooks['SessionStart'].find(isArgusEntry);
      expect(argusEntry.hooks[0].command).toContain('127.0.0.1:9000/hooks/claude');
      delete process.env.ARGUS_PORT;
    });

    it('preserves existing non-Argus entries', () => {
      writeFileSync(
        CLAUDE_SETTINGS_PATH,
        JSON.stringify({
          hooks: {
            SessionStart: [{ matcher: '', hooks: [{ type: 'command', command: 'echo user-hook' }] }],
          },
        }),
        'utf-8',
      );
      new InjectorClass().injectForAll();
      const settings = readSettings();
      const userEntry = settings.hooks.SessionStart.find(
        (e: { hooks?: Array<{ command?: string }> }) => !isArgusEntry(e),
      );
      expect(userEntry).toBeDefined();
      expect(userEntry.hooks[0].command).toBe('echo user-hook');
    });

    it('is idempotent: injecting twice produces exactly one Argus entry per event', () => {
      const injector = new InjectorClass();
      injector.injectForAll();
      injector.injectForAll();
      const settings = readSettings();
      for (const event of EVENTS) {
        const argusCount = settings.hooks[event].filter(isArgusEntry).length;
        expect(argusCount).toBe(1);
      }
    });

    it('heals stale port: removes old Argus entry and replaces with current port', () => {
      writeFileSync(
        CLAUDE_SETTINGS_PATH,
        JSON.stringify({
          hooks: {
            SessionStart: [{
              matcher: '',
              hooks: [{ type: 'command', command: 'curl -sf -X POST http://127.0.0.1:9999/hooks/claude -d @-' }],
            }],
          },
        }),
        'utf-8',
      );
      new InjectorClass().injectForAll();
      const settings = readSettings();
      const argusEntries = settings.hooks.SessionStart.filter(isArgusEntry);
      expect(argusEntries).toHaveLength(1);
      expect(argusEntries[0].hooks[0].command).not.toContain('9999');
      expect(argusEntries[0].hooks[0].command).toContain('/hooks/claude');
    });

    it('removes malformed event keys silently', () => {
      writeFileSync(
        CLAUDE_SETTINGS_PATH,
        JSON.stringify({
          hooks: {
            '[object Object]': [{ matcher: '', hooks: [] }],
            SessionStart: [],
          },
        }),
        'utf-8',
      );
      expect(() => new InjectorClass().injectForAll()).not.toThrow();
      const settings = readSettings();
      expect(settings.hooks['[object Object]']).toBeUndefined();
    });

    it('does not throw when settings.json does not exist', () => {
      expect(() => new InjectorClass().injectForAll()).not.toThrow();
    });
  });

  describe('injectForRepo()', () => {
    it('behaves identically to injectForAll (global file)', () => {
      new InjectorClass().injectForRepo('/some/repo/path');
      expect(existsSync(CLAUDE_SETTINGS_PATH)).toBe(true);
      const settings = readSettings();
      for (const event of EVENTS) {
        expect(settings.hooks[event].filter(isArgusEntry)).toHaveLength(1);
      }
    });
  });

  describe('removeForRepo()', () => {
    it('is a no-op: does not modify settings.json', () => {
      new InjectorClass().injectForAll();
      const before = readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8');
      new InjectorClass().removeForRepo('/some/repo/path');
      const after = readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8');
      expect(after).toBe(before);
    });

    it('does not throw when settings.json does not exist', () => {
      expect(() => new InjectorClass().removeForRepo('/some/repo')).not.toThrow();
    });
  });

  describe('removeAll()', () => {
    it('removes all Argus entries from settings.json', () => {
      new InjectorClass().injectForAll();
      new InjectorClass().removeAll();
      const settings = readSettings();
      for (const event of EVENTS) {
        const argusEntries = (settings.hooks[event] ?? []).filter(isArgusEntry);
        expect(argusEntries).toHaveLength(0);
      }
    });

    it('preserves non-Argus entries when removing', () => {
      writeFileSync(
        CLAUDE_SETTINGS_PATH,
        JSON.stringify({
          hooks: {
            SessionStart: [
              { matcher: '', hooks: [{ type: 'command', command: 'echo user-hook' }] },
              { matcher: '', hooks: [{ type: 'command', command: 'curl -sf -X POST http://127.0.0.1:7411/hooks/claude -d @-' }] },
            ],
          },
        }),
        'utf-8',
      );
      new InjectorClass().removeAll();
      const settings = readSettings();
      expect(settings.hooks.SessionStart).toHaveLength(1);
      expect(settings.hooks.SessionStart[0].hooks[0].command).toBe('echo user-hook');
    });

    it('does not throw when settings.json does not exist', () => {
      expect(() => new InjectorClass().removeAll()).not.toThrow();
    });

    it('does not throw when hooks section is missing', () => {
      writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify({ otherSetting: true }), 'utf-8');
      expect(() => new InjectorClass().removeAll()).not.toThrow();
    });
  });
});
