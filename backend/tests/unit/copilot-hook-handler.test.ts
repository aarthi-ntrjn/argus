/**
 * Unit tests for CopilotCliDetector.handleHookPayload (T007 - TDD first).
 * Tests verify pending choice handling via normalized hook payloads.
 * These should FAIL until T008 implements handleHookPayload.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync, rmSync, existsSync } from 'fs';

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => ({
      on: vi.fn(() => ({ on: vi.fn() })),
      close: vi.fn(async () => {}),
    })),
  },
}));

const TEST_REPO_PATH = join(tmpdir(), `copilot-hook-handler-repo-${randomUUID()}`);
const FAKE_HOME_DIR = join(tmpdir(), `copilot-hook-handler-home-${randomUUID()}`);

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => FAKE_HOME_DIR };
});

interface NormalizedPayload {
  hook_event_name: string;
  session_id: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  [key: string]: unknown;
}

function makeSession(sessionId: string, repoId: string): import('../../src/models/index.js').Session {
  return {
    id: sessionId,
    repositoryId: repoId,
    type: 'copilot-cli',
    launchMode: null,
    pid: null,
    hostPid: null,
    pidSource: null,
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    lastActivityAt: new Date().toISOString(),
    summary: null,
    expiresAt: null,
    model: null,
    reconciled: true,
    yoloMode: null,
  };
}

describe('CopilotCliDetector — handleHookPayload', () => {
  let dbModule: typeof import('../../src/db/database.js');
  let detector: import('../../src/services/copilot-cli-detector.js').CopilotCliDetector;
  let repoId: string;

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-copilot-hook-test-${randomUUID()}.db`);
    vi.resetModules();

    mkdirSync(join(FAKE_HOME_DIR, '.copilot', 'session-state'), { recursive: true });
    mkdirSync(join(TEST_REPO_PATH, '.git'), { recursive: true });

    dbModule = await import('../../src/db/database.js');
    repoId = randomUUID();
    dbModule.insertRepository({
      id: repoId,
      path: TEST_REPO_PATH,
      name: 'copilot-hook-test',
      source: 'ui',
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
    });

    const { CopilotCliDetector } = await import('../../src/services/copilot-cli-detector.js');
    detector = new CopilotCliDetector(join(FAKE_HOME_DIR, '.copilot', 'session-state'));
  });

  afterEach(() => {
    dbModule.closeDb();
    vi.resetModules();
    if (existsSync(FAKE_HOME_DIR)) {rmSync(FAKE_HOME_DIR, { recursive: true, force: true });}
    if (existsSync(TEST_REPO_PATH)) {rmSync(TEST_REPO_PATH, { recursive: true, force: true });}
  });

  describe('ask_user pending choice (flat format)', () => {
    it('PreToolUse ask_user stores pending choice in internal map', async () => {
      const sessionId = randomUUID();
      dbModule.upsertSession(makeSession(sessionId, repoId));

      const payload: NormalizedPayload = {
        hook_event_name: 'PreToolUse',
        session_id: sessionId,
        tool_name: 'ask_user',
        tool_input: {
          question: 'Which option do you prefer?',
          choices: ['Option A', 'Option B', 'Option C'],
        },
        cwd: TEST_REPO_PATH,
      };
      await detector.handleHookPayload(payload);

      const pending = detector.getPendingChoice(sessionId);
      expect(pending).not.toBeNull();
      expect(pending?.question).toBe('Which option do you prefer?');
      expect(pending?.choices).toEqual(['Option A', 'Option B', 'Option C']);
    });

    it('PostToolUse ask_user removes pending choice from internal map', async () => {
      const sessionId = randomUUID();
      dbModule.upsertSession(makeSession(sessionId, repoId));

      await detector.handleHookPayload({
        hook_event_name: 'PreToolUse',
        session_id: sessionId,
        tool_name: 'ask_user',
        tool_input: { question: 'Pick?', choices: ['A', 'B'] },
        cwd: TEST_REPO_PATH,
      });
      expect(detector.getPendingChoice(sessionId)).not.toBeNull();

      await detector.handleHookPayload({
        hook_event_name: 'PostToolUse',
        session_id: sessionId,
        tool_name: 'ask_user',
        cwd: TEST_REPO_PATH,
      });
      expect(detector.getPendingChoice(sessionId)).toBeNull();
    });

    it('PreToolUse for a non-ask_user tool does not store a pending choice', async () => {
      const sessionId = randomUUID();
      dbModule.upsertSession(makeSession(sessionId, repoId));

      await detector.handleHookPayload({
        hook_event_name: 'PreToolUse',
        session_id: sessionId,
        tool_name: 'run_shell_command',
        tool_input: { command: 'ls -la' },
        cwd: TEST_REPO_PATH,
      });

      expect(detector.getPendingChoice(sessionId)).toBeNull();
    });
  });

  describe('SessionEnd', () => {
    it('SessionEnd for a known session marks it ended', async () => {
      const sessionId = randomUUID();
      dbModule.upsertSession(makeSession(sessionId, repoId));

      await detector.handleHookPayload({
        hook_event_name: 'SessionEnd',
        session_id: sessionId,
        cwd: TEST_REPO_PATH,
      });

      const session = dbModule.getSession(sessionId);
      expect(session?.status).toBe('ended');
    });

    it('SessionEnd for unknown session_id does not throw', async () => {
      await expect(detector.handleHookPayload({
        hook_event_name: 'SessionEnd',
        session_id: randomUUID(),
        cwd: TEST_REPO_PATH,
      })).resolves.not.toThrow();
    });
  });

  describe('cwd validation', () => {
    it('hook with cwd matching no repo is silently discarded', async () => {
      const sessionId = randomUUID();
      await expect(detector.handleHookPayload({
        hook_event_name: 'PreToolUse',
        session_id: sessionId,
        tool_name: 'ask_user',
        tool_input: { question: 'Q?', choices: ['A'] },
        cwd: '/unknown/repo/path',
      })).resolves.not.toThrow();
      expect(detector.getPendingChoice(sessionId)).toBeNull();
    });

    it('hook with no cwd is silently discarded', async () => {
      const sessionId = randomUUID();
      await expect(detector.handleHookPayload({
        hook_event_name: 'SessionStart',
        session_id: sessionId,
      })).resolves.not.toThrow();
    });
  });

  describe('SessionStart', () => {
    it('SessionStart for unknown session creates a new session record', async () => {
      const sessionId = randomUUID();

      await detector.handleHookPayload({
        hook_event_name: 'SessionStart',
        session_id: sessionId,
        cwd: TEST_REPO_PATH,
      });

      const session = dbModule.getSession(sessionId);
      expect(session).not.toBeNull();
      expect(session?.type).toBe('copilot-cli');
      expect(session?.status).toBe('active');
    });
  });
});
