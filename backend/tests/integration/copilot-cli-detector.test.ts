import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const testRepoId = randomUUID();
const testRepoCwd = join(tmpdir(), `argus-repo-${randomUUID()}`);
const testSessionId = randomUUID();

const mockGetSession = vi.hoisted(() => vi.fn(() => undefined));

// Mock the database module to avoid DB dependency in this unit-style integration test
vi.mock('../../src/db/database.js', () => ({
  getRepositoryByPath: (path: string) => {
    if (path === testRepoCwd) {
      return { id: testRepoId, path: testRepoCwd, name: 'test-repo', source: 'config', addedAt: new Date().toISOString(), lastScannedAt: null };
    }
    return undefined;
  },
  getSession: mockGetSession,
  upsertSession: vi.fn(),
}));

const mockHas = vi.hoisted(() => vi.fn().mockReturnValue(false));
const mockClaimForSession = vi.hoisted(() => vi.fn().mockReturnValue(null));
vi.mock('../../src/services/pty-registry.js', () => ({
  ptyRegistry: {
    claimForSession: mockClaimForSession,
    has: mockHas,
  },
}));

// Mock ps-list so we can control which PIDs appear running per test.
// Default: no running processes (testPid 99999 is not running).
const mockPsList = vi.hoisted(() => vi.fn(async () => []));
vi.mock('ps-list', () => ({ default: mockPsList }));

import { CopilotCliDetector } from '../../src/services/copilot-cli-detector.js';

describe('CopilotCliDetector', () => {
  let testDir: string;
  let sessionDir: string;
  const testPid = 99999; // unlikely to exist

  beforeAll(() => {
    testDir = join(tmpdir(), `argus-test-${randomUUID()}`);
    sessionDir = join(testDir, testSessionId);
    mkdirSync(sessionDir, { recursive: true });

    // Create workspace.yaml
    writeFileSync(join(sessionDir, 'workspace.yaml'), `id: ${testSessionId}
cwd: ${testRepoCwd}
summary: Test session
created_at: ${new Date().toISOString()}
updated_at: ${new Date().toISOString()}
`);

    // Create inuse lock file
    writeFileSync(join(sessionDir, `inuse.${testPid}.lock`), '');
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    mockClaimForSession.mockClear();
    mockHas.mockClear();
    mockGetSession.mockClear();
    mockPsList.mockClear();
    mockPsList.mockResolvedValue([]); // default: no running processes
  });

  it('detects session directory with lock file', async () => {
    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    const session = sessions.find((s) => s.id === testSessionId);
    expect(session).toBeDefined();
    expect(session?.pid).toBe(testPid);
  });

  it('marks session as ended when PID not running', async () => {
    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);
    expect(session?.status).toBe('ended');
  });

  it('sets launchMode=pty when ptyRegistry has a pending connection for the same cwd', async () => {
    // Session must be running — only active sessions may claim a pending launcher WS
    mockPsList.mockResolvedValueOnce([{ pid: testPid, name: 'test', ppid: 1 }]);
    mockClaimForSession.mockReturnValueOnce({ pid: 12345 });

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    expect(session?.launchMode).toBe('pty');
    expect(session?.pid).toBe(12345);
    expect(session?.pidSource).toBe('pty_registry');
    expect(mockClaimForSession).toHaveBeenCalledWith(testSessionId, testRepoCwd);
  });

  it('does not claim pending PTY connection for a non-running (ended) session', async () => {
    // isRunning = false (default mockPsList returns [] — testPid not running)
    // The pending WS should NOT be claimed by an ended session so a new active session
    // in the same cwd can claim it instead. Do NOT set mockReturnValueOnce here —
    // claimForSession must not be called at all.

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    expect(session?.launchMode).toBeNull();
    expect(mockClaimForSession).not.toHaveBeenCalled();
  });

  it('sets launchMode=null when no pending PTY connection exists for a running session', async () => {
    // isRunning = true so claimForSession IS called, but no pending WS is registered
    mockPsList.mockResolvedValueOnce([{ pid: testPid, name: 'test', ppid: 1 }]);
    mockClaimForSession.mockReturnValueOnce(null);

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    expect(session?.launchMode).toBeNull();
    expect(session?.pidSource).toBe('lockfile');
  });

  it('re-claims a new pending WS when alreadyClaimed=true, WS disconnected, and process still running (Argus restart)', async () => {
    // Make testPid appear running so the re-link path is exercised
    mockPsList.mockResolvedValueOnce([{ pid: testPid, name: 'test', ppid: 1 }]);
    // Simulate: DB has launchMode:'pty' but in-memory WS is gone (Argus restarted)
    mockGetSession.mockReturnValueOnce({
      id: testSessionId,
      launchMode: 'pty',
      pid: 11111,
      pidSource: 'pty_registry' as const,
      status: 'active',
    });
    mockHas.mockReturnValueOnce(false);
    mockClaimForSession.mockReturnValueOnce({ pid: 22222 });

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    expect(session?.launchMode).toBe('pty');
    expect(session?.pid).toBe(22222);
    expect(session?.pidSource).toBe('pty_registry');
    expect(mockClaimForSession).toHaveBeenCalledWith(testSessionId, testRepoCwd);
  });

  it('preserves launchMode=pty when alreadyClaimed=true and WS disconnected but process ended (no re-claim)', async () => {
    // Process not running — WS closed because session ended, not because of backend restart.
    // launchMode must be preserved as a historical record; claimForSession must NOT be called.
    mockGetSession.mockReturnValueOnce({
      id: testSessionId,
      launchMode: 'pty',
      pid: 11111,
      pidSource: 'pty_registry' as const,
      status: 'ended',
    });
    mockHas.mockReturnValueOnce(false);

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    expect(session?.launchMode).toBe('pty');
    expect(session?.pid).toBe(11111); // preserved from existingSession
    expect(mockClaimForSession).not.toHaveBeenCalled();
  });

  it('sets launchMode=pty when ptyRegistry already has the session (workspace_id claimed before scan)', async () => {
    // Simulate: workspace_id message arrived before this scan, session is in connections
    mockPsList.mockResolvedValueOnce([{ pid: testPid, name: 'test', ppid: 1 }]);
    mockHas.mockReturnValueOnce(true); // ptyRegistry.has(sessionId) = true
    // getSession returns undefined (first scan) — session not in DB yet
    mockGetSession.mockReturnValueOnce(undefined);

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    expect(session?.launchMode).toBe('pty');
    expect(session?.pidSource).toBe('pty_registry');
    expect(mockClaimForSession).not.toHaveBeenCalled();
  });

  it('preserves launchMode=pty without re-claiming when alreadyClaimed=true and WS is still live', async () => {
    mockGetSession.mockReturnValueOnce({
      id: testSessionId,
      launchMode: 'pty',
      pid: 33333,
      pidSource: 'pty_registry' as const,
      status: 'active',
    });
    mockHas.mockReturnValueOnce(true);

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    expect(session?.launchMode).toBe('pty');
    expect(session?.pid).toBe(33333);
    expect(mockClaimForSession).not.toHaveBeenCalled();
  });
});