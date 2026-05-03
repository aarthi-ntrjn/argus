import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

// psList is still used by session-monitor for liveness checks, but
// ClaudeCodeDetector no longer uses it for PID discovery. These tests
// verify that scan() creates sessions with pid=null,
// and that PID assignment is handled by the session registry scanner.

vi.mock('ps-list', () => ({
  default: vi.fn(async () => []),
}));

// isPidRunning is called by scan() to verify registry entries are live.
// Default: all registry PIDs are considered live.
vi.mock('../../src/services/process-utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/process-utils.js')>();
  return {
    ...actual,
    isPidRunning: vi.fn(() => true),
  };
});

const FAKE_REPO_PATH = 'C:\\pidtestproject';
const FAKE_DIR_NAME = FAKE_REPO_PATH.replace(/[:\\/]/g, '-');

let fakeJsonlFiles: string[] = ['default-session.jsonl'];
let fakeRegistryEntries: Record<string, { pid: number; sessionId: string; cwd: string }> = {};

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    readdirSync: vi.fn((p: unknown, opts?: unknown) => {
      const pathStr = String(p);
      if (opts && typeof opts === 'object' && 'withFileTypes' in opts) {
        return [{ name: FAKE_DIR_NAME, isDirectory: () => true }];
      }
      if (pathStr.includes('sessions')) {
        return Object.values(fakeRegistryEntries).map(e => `${e.pid}.json`);
      }
      return fakeJsonlFiles;
    }),
    readFileSync: vi.fn((p: unknown, _enc?: unknown) => {
      const pathStr = String(p);
      if (pathStr.includes('sessions') && pathStr.endsWith('.json')) {
        const pid = parseInt(pathStr.replace(/^.*[/\\](\d+)\.json$/, '$1'), 10);
        const entry = Object.values(fakeRegistryEntries).find(e => e.pid === pid);
        if (entry) return JSON.stringify({ ...entry, startedAt: Date.now(), kind: 'interactive', entrypoint: 'cli' });
      }
      return actual.readFileSync(p as string, _enc as string);
    }),
    statSync: vi.fn(() => ({ mtime: new Date(), size: 0 })),
  };
});

describe('ClaudeCodeDetector - PID via session registry (not psList)', () => {
  let dbModule: typeof import('../../src/db/database.js');

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-pid-test-${randomUUID()}.db`);
    vi.resetModules();

    fakeJsonlFiles = ['default-session.jsonl'];
    fakeRegistryEntries = { 'default-session': { pid: 1234, sessionId: 'default-session', cwd: FAKE_REPO_PATH } };

    dbModule = await import('../../src/db/database.js');
    dbModule.insertRepository({
      id: 'repo-pid-test',
      path: FAKE_REPO_PATH,
      name: 'pid-test',
      source: 'ui',
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
      branch: null,
    });
  });

  afterEach(() => {
    dbModule.closeDb();
    vi.resetModules();
  });

  it('scan() creates session with pid from registry', async () => {
    fakeJsonlFiles = ['new-pid-session.jsonl'];
    fakeRegistryEntries = { 'new-pid-session': { pid: 5555, sessionId: 'new-pid-session', cwd: FAKE_REPO_PATH } };

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scan();

    const sessions = dbModule.getSessions({ repositoryId: 'repo-pid-test', type: 'claude-code' });
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].pid).toBe(5555);
    expect(sessions[0].pidSource).toBe('session_registry');
  });

  it('scan() re-activates an ended session with pid from registry', async () => {
    const now = new Date().toISOString();
    const sessionId = 'pid-reactivate-session';
    fakeJsonlFiles = [`${sessionId}.jsonl`];
    fakeRegistryEntries = { [sessionId]: { pid: 7777, sessionId, cwd: FAKE_REPO_PATH } };
    dbModule.upsertSession({
      id: sessionId,
      repositoryId: 'repo-pid-test',
      type: 'claude-code',
      launchMode: null,
      pid: null,
      pidSource: null,
      status: 'ended',
      startedAt: now,
      endedAt: now,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
    });

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scan();

    const session = dbModule.getSession(sessionId);
    expect(session?.status).toBe('active');
    expect(session?.pid).toBe(7777);
  });

  it('scan() does not overwrite a PTY-assigned PID', async () => {
    const now = new Date().toISOString();
    const sessionId = 'pty-pid-session';
    fakeJsonlFiles = [`${sessionId}.jsonl`];
    fakeRegistryEntries = { [sessionId]: { pid: 42, sessionId, cwd: FAKE_REPO_PATH } };
    dbModule.upsertSession({
      id: sessionId,
      repositoryId: 'repo-pid-test',
      type: 'claude-code',
      launchMode: 'pty',
      pid: 42,
      pidSource: 'pty_registry',
      status: 'active',
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
    });

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scan();

    const session = dbModule.getSession(sessionId);
    expect(session?.pid).toBe(42);
    expect(session?.pidSource).toBe('pty_registry');
  });
});

