import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Mock ps-list: use a mutable variable so individual tests can override
let mockPsListResult: Array<{ pid: number; name: string; cmd?: string }> = [
  { pid: 4242, name: 'claude', cmd: 'claude' },
];
vi.mock('ps-list', () => ({
  default: vi.fn(async () => mockPsListResult),
}));

const FAKE_REPO_PATH = 'C:\\testproject';
// Claude dir naming: replace :, \, / with hyphens → 'C--testproject'
const FAKE_DIR_NAME = FAKE_REPO_PATH.replace(/[:\\/]/g, '-');

// Mutable statSync mtime — individual tests can override
let mockMtime = new Date(); // recent by default

// Mock fs so we control what project directories the detector "sees"
// readdirSync returns a fake Claude project dir matching FAKE_REPO_PATH
let fakeReaddirEntries: Array<{ name: string; isDirectory: () => boolean }> = [];
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    readdirSync: vi.fn((_p: unknown, _opts?: unknown) => fakeReaddirEntries),
    statSync: vi.fn(() => ({ mtime: mockMtime })),
  };
});

describe('ClaudeCodeDetector.scanExistingSessions', () => {
  let dbModule: typeof import('../../src/db/database.js');

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-claude-scan-test-${randomUUID()}.db`);
    vi.resetModules();

    // Reset to default: Claude is running, mtime is recent
    mockPsListResult = [{ pid: 4242, name: 'claude', cmd: 'claude' }];
    mockMtime = new Date();

    dbModule = await import('../../src/db/database.js');

    // Reset fake dir entries to the default (one matching dir)
    fakeReaddirEntries = [{ name: FAKE_DIR_NAME, isDirectory: () => true }];

    // Insert a repo matching FAKE_REPO_PATH
    dbModule.insertRepository({
      id: 'repo-scan-test',
      path: FAKE_REPO_PATH,
      name: 'scan-test',
      source: 'ui',
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
    });
  });

  afterEach(() => {
    dbModule.closeDb();
    vi.resetModules();
  });

  it('re-activates an ended session when Claude is running and JSONL file is recent', async () => {
    mockMtime = new Date(); // recent
    const now = new Date().toISOString();
    dbModule.upsertSession({
      id: 'hook-session-was-ended',
      repositoryId: 'repo-scan-test',
      type: 'claude-code',
      pid: null,
      status: 'ended',
      startedAt: now,
      endedAt: now,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
    });

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const session = dbModule.getSession('hook-session-was-ended');
    expect(session?.status).toBe('active');
  });

  it('does NOT re-activate an ended session when JSONL file is older than 30 minutes', async () => {
    // Set mtime to 31 minutes ago
    mockMtime = new Date(Date.now() - 31 * 60 * 1000);
    const now = new Date().toISOString();
    dbModule.upsertSession({
      id: 'hook-session-stale-mtime',
      repositoryId: 'repo-scan-test',
      type: 'claude-code',
      pid: null,
      status: 'ended',
      startedAt: now,
      endedAt: now,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
    });

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const session = dbModule.getSession('hook-session-stale-mtime');
    expect(session?.status).toBe('ended');
  });

  it('does NOT re-activate when Claude is running but no JSONL file exists', async () => {
    // existsSync returns false for the JSONL file (but true for the project dir check)
    const { existsSync } = await import('fs');
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) =>
      typeof p === 'string' && !p.endsWith('.jsonl')
    );

    const now = new Date().toISOString();
    dbModule.upsertSession({
      id: 'hook-session-no-jsonl',
      repositoryId: 'repo-scan-test',
      type: 'claude-code',
      pid: null,
      status: 'ended',
      startedAt: now,
      endedAt: now,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
    });

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const session = dbModule.getSession('hook-session-no-jsonl');
    expect(session?.status).toBe('ended');
  });

  it('creates a new session when Claude is running and no prior session exists', async () => {
    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const sessions = dbModule.getSessions({ repositoryId: 'repo-scan-test', type: 'claude-code' });
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].status).toBe('active');
  });

  it('does nothing when no Claude process is running', async () => {
    mockPsListResult = [{ pid: 1, name: 'other-process', cmd: 'other-process' }];

    const now = new Date().toISOString();
    dbModule.upsertSession({
      id: 'hook-session-no-claude',
      repositoryId: 'repo-scan-test',
      type: 'claude-code',
      pid: null,
      status: 'ended',
      startedAt: now,
      endedAt: now,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
    });

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const session = dbModule.getSession('hook-session-no-claude');
    expect(session?.status).toBe('ended');
  });
});

