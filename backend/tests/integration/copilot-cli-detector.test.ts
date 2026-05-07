import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { SessionTypes } from '../../src/models/index.js';

const testRepoId = randomUUID();
const testRepoCwd = join(tmpdir(), `argus-repo-${randomUUID()}`);
const testSessionId = randomUUID();

const mockGetSession = vi.hoisted(() => vi.fn(() => undefined));

const mockUpsertSession = vi.hoisted(() => vi.fn());

// Mock the database module to avoid DB dependency in this unit-style integration test
vi.mock('../../src/db/database.js', () => ({
  getRepositoryByPath: (path: string) => {
    if (path === testRepoCwd) {
      return { id: testRepoId, path: testRepoCwd, name: 'test-repo', source: 'config', addedAt: new Date().toISOString(), lastScannedAt: null };
    }
    return undefined;
  },
  getSession: mockGetSession,
  upsertSession: mockUpsertSession,
  deleteSessionOutput: vi.fn(),
  insertOutput: vi.fn().mockReturnValue(true),
  getMaxSequenceNumber: vi.fn().mockReturnValue(0),
  getServerState: vi.fn().mockReturnValue(null),
  setServerState: vi.fn(),
  getSessions: vi.fn().mockReturnValue([]),
}));

const mockBroadcast = vi.hoisted(() => vi.fn());
vi.mock('../../src/api/ws/event-dispatcher.js', () => ({
  broadcast: mockBroadcast,
}));

const mockHas = vi.hoisted(() => vi.fn().mockReturnValue(false));
const mockClaimForSession = vi.hoisted(() => vi.fn().mockReturnValue(null));
const mockGetClaimedPid = vi.hoisted(() => vi.fn().mockReturnValue(null));
vi.mock('../../src/launch-pty/pty-registry.js', () => ({
  ptyRegistry: {
    claimForSession: mockClaimForSession,
    has: mockHas,
    getClaimedPid: mockGetClaimedPid,
    getPtyLaunchIdForSession: vi.fn().mockReturnValue(undefined),
  },
}));

// Mock ps-list so we can control which PIDs appear running per test.
// Default: no running processes (testPid 99999 is not running).
const mockPsList = vi.hoisted(() => vi.fn(async () => []));
vi.mock('ps-list', () => ({ default: mockPsList }));

// Mock process-utils so isPidRunning and isExpectedProcess are controllable per test.
// copilot-cli-detector uses isPidRunning (not ps-list) for liveness checks.
const mockIsPidRunning = vi.hoisted(() => vi.fn((_pid: number) => false));
const mockIsExpectedProcess = vi.hoisted(() => vi.fn((_pid: number, _type: string) => true));
vi.mock('../../src/utils/process-utils.js', () => ({
  isPidRunning: mockIsPidRunning,
  isExpectedProcess: mockIsExpectedProcess,
  detectYoloModeFromPids: vi.fn().mockReturnValue(null),
}));

// Mock chokidar to prevent unhandled rejections from its internal fs watcher
// setup in test environments that lack full FSEvents support.
vi.mock('chokidar', () => ({
  default: {
    watch: () => ({ on: () => {}, close: () => {} }),
  },
}));

import { CopilotCliDetector } from '../../src/cli/copilot-cli/copilot-cli-detector.js';

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
    // mockReset (not mockClear) so mockReturnValueOnce queues from prior tests
    // don't leak into this one. Re-establish defaults after reset.
    mockClaimForSession.mockReset();
    mockClaimForSession.mockReturnValue(null);
    mockHas.mockReset();
    mockHas.mockReturnValue(false);
    mockGetSession.mockReset();
    mockGetSession.mockReturnValue(undefined);
    mockPsList.mockReset();
    mockPsList.mockResolvedValue([]);
    mockBroadcast.mockClear();
    mockUpsertSession.mockClear();
    mockIsPidRunning.mockReset();
    mockIsPidRunning.mockReturnValue(false);
    mockIsExpectedProcess.mockReset();
    mockIsExpectedProcess.mockReturnValue(true);
  });

  it('detects session directory with lock file', async () => {
    mockIsPidRunning.mockReturnValueOnce(true);
    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    const session = sessions.find((s) => s.id === testSessionId);
    expect(session).toBeDefined();
    expect(session?.pid).toBe(testPid);
  });

  it('skips entry with non-running PID (caller handles ending via dropped-off detection)', async () => {
    // PID not running by default. The base scan() filters out dead-pid entries
    // before calling processSessionEntry, so the entry never produces a session.
    // Sessions tracked as active in the DB are ended by dispatchSessionEvents'
    // dropped-off check (covered by handleSessionEnd-style tests elsewhere).
    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    expect(sessions.find((s) => s.id === testSessionId)).toBeUndefined();
  });

  it('sets launchMode=pty when ptyRegistry has a pending connection for the same cwd', async () => {
    // Session must be running — only active sessions may claim a pending launcher WS
    mockIsPidRunning.mockReturnValueOnce(true);
    mockPsList.mockResolvedValueOnce([{ pid: testPid, name: 'copilot', ppid: 1 }]);
    // Simulate Windows: pid is null until update_pid resolves it; hostPid is the wrapper
    mockClaimForSession.mockReturnValueOnce({ pid: null, hostPid: 12345 });

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    expect(session?.launchMode).toBe('pty');
    expect(session?.pid).toBeNull();
    expect(session?.hostPid).toBe(12345);
    expect(session?.pidSource).toBe('pty_registry');
    expect(mockClaimForSession).toHaveBeenCalledWith(testSessionId, testRepoCwd, 'copilot-cli');
  });

  it('does not claim pending PTY connection for a non-running session', async () => {
    // isRunning = false (default). The base scan() filters out dead-pid entries
    // before processSessionEntry runs, so claimForSession must not be called.
    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();

    expect(sessions.find((s) => s.id === testSessionId)).toBeUndefined();
    expect(mockClaimForSession).not.toHaveBeenCalled();
  });

  it('sets launchMode=null when no pending PTY connection exists for a running session', async () => {
    // isRunning = true so claimForSession IS called, but no pending WS is registered
    mockIsPidRunning.mockReturnValueOnce(true);
    mockPsList.mockResolvedValueOnce([{ pid: testPid, name: 'copilot', ppid: 1 }]);
    mockClaimForSession.mockReturnValueOnce(null);

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    expect(session?.launchMode).toBeNull();
    expect(session?.pidSource).toBe('lockfile');
  });

  it('preserves existing PTY metadata when alreadyClaimed=true, WS disconnected, and process still running (no re-link)', async () => {
    // A real Argus restart re-binds the launcher via promotePendingToSession in launcher.ts
    // BEFORE scan runs, so ptyRegistry.has() is true at scan time. This test covers the
    // distinct case where the launcher process itself died and a new launcher connected for
    // the same repo. We must NOT silently re-bind the new launcher's WS to the existing
    // sessionId: that new launcher just spawned a new CLI process with its own sessionId.
    mockIsPidRunning.mockReturnValueOnce(true);
    mockPsList.mockResolvedValueOnce([{ pid: testPid, name: 'copilot', ppid: 1 }]);
    mockGetSession.mockReturnValueOnce({
      id: testSessionId,
      launchMode: 'pty',
      pid: testPid,
      hostPid: 10000,
      pidSource: 'pty_registry' as const,
      status: 'active',
    });
    mockHas.mockReturnValueOnce(false);

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    expect(session?.launchMode).toBe('pty');
    expect(session?.pid).toBe(testPid);
    expect(session?.hostPid).toBe(10000);
    expect(session?.pidSource).toBe('pty_registry');
    expect(mockClaimForSession).not.toHaveBeenCalled();
  });

  it('skips ended+not-running session and does not re-claim (no re-claim)', async () => {
    // Process not running and already recorded as ended — the scan optimization skips this
    // directory entirely (early return before ptyRegistry.has() is reached).
    // claimForSession must NOT be called.
    mockGetSession.mockReturnValueOnce({
      id: testSessionId,
      launchMode: 'pty',
      pid: 11111,
      hostPid: 10000,
      pidSource: 'pty_registry' as const,
      status: 'ended',
    });
    // No mockHas needed — code returns null before ptyRegistry.has() is called for ended sessions.

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    // Ended + not-running sessions are skipped entirely by the scan optimisation.
    expect(session).toBeUndefined();
    expect(mockClaimForSession).not.toHaveBeenCalled();
  });

  it('sets launchMode=pty when ptyRegistry already has the session before scan', async () => {
    // Simulate: session was claimed in a previous scan cycle and is already in connections
    mockIsPidRunning.mockReturnValueOnce(true);
    mockPsList.mockResolvedValueOnce([{ pid: testPid, name: 'copilot', ppid: 1 }]);
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

  it('preserves user-message summary across subsequent scans (does not reset to workspace.yaml value)', async () => {
    const userMessageSummary = 'fix the login bug';

    // Second scan: process is running, existing session has a user-message summary
    // set by readNewLines after the first scan.
    mockIsPidRunning.mockReturnValueOnce(true);
    mockPsList.mockResolvedValueOnce([{ pid: testPid, name: 'copilot', ppid: 1 }]);
    mockGetSession.mockReturnValueOnce({
      id: testSessionId,
      launchMode: null,
      pid: testPid,
      hostPid: null,
      pidSource: 'lockfile' as const,
      status: 'active',
      summary: userMessageSummary,
    });
    mockClaimForSession.mockReturnValueOnce(null); // no PTY

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    // Summary must be preserved from DB, not reset to workspace.yaml value ("Test session")
    expect(session?.summary).toBe(userMessageSummary);
  });

  it('broadcasts session.updated when summary is updated from a user.message event in events.jsonl', async () => {
    const eventsFile = join(sessionDir, 'events.jsonl');
    writeFileSync(eventsFile, JSON.stringify({
      type: 'user.message',
      timestamp: new Date().toISOString(),
      data: { content: 'fix the login bug' },
    }) + '\n');

    // Session must appear running so watchEventsFile is invoked
    mockIsPidRunning.mockReturnValueOnce(true);
    mockPsList.mockResolvedValueOnce([{ pid: testPid, name: 'copilot', ppid: 1 }]);
    mockClaimForSession.mockReturnValueOnce(null);
    // Existing session has no summary yet
    mockGetSession.mockReturnValue({
      id: testSessionId, launchMode: null, pid: testPid, hostPid: null,
      pidSource: 'lockfile' as const, status: 'active', summary: null, model: null,
    });

    const detector = new CopilotCliDetector(testDir);
    await detector.scan();

    const summaryBroadcast = mockBroadcast.mock.calls.find(
      ([evt]) => evt.type === 'session.updated' && (evt.data as { summary?: string }).summary === 'fix the login bug'
    );
    expect(summaryBroadcast).toBeDefined();
  });

  it('broadcasts session.updated when model is detected from events.jsonl', async () => {
    const eventsFile = join(sessionDir, 'events.jsonl');
    writeFileSync(eventsFile, JSON.stringify({
      type: 'assistant.message',
      timestamp: new Date().toISOString(),
      model: 'claude-opus-4-5',
      data: { content: 'Hello' },
    }) + '\n');

    mockIsPidRunning.mockReturnValueOnce(true);
    mockPsList.mockResolvedValueOnce([{ pid: testPid, name: 'copilot', ppid: 1 }]);
    mockClaimForSession.mockReturnValueOnce(null);
    // Existing session has no model yet
    mockGetSession.mockReturnValue({
      id: testSessionId, launchMode: null, pid: testPid, hostPid: null,
      pidSource: 'lockfile' as const, status: 'active', summary: null, model: null,
    });

    const detector = new CopilotCliDetector(testDir);
    await detector.scan();

    const modelBroadcast = mockBroadcast.mock.calls.find(
      ([evt]) => evt.type === 'session.updated' && (evt.data as { model?: string }).model === 'claude-opus-4-5'
    );
    expect(modelBroadcast).toBeDefined();
  });

  it('preserves launchMode=pty without re-claiming when alreadyClaimed=true and WS is still live', async () => {
    mockIsPidRunning.mockReturnValueOnce(true);
    mockPsList.mockResolvedValueOnce([{ pid: testPid, name: 'copilot', ppid: 1 }]);
    mockGetSession.mockReturnValueOnce({
      id: testSessionId,
      launchMode: 'pty',
      pid: testPid,
      hostPid: 30000,
      pidSource: 'pty_registry' as const,
      status: 'active',
    });
    mockHas.mockReturnValueOnce(true);

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    expect(session?.launchMode).toBe('pty');
    expect(session?.pid).toBe(testPid);
    expect(mockClaimForSession).not.toHaveBeenCalled();
  });

  it('updates lastActivityAt when events.jsonl output arrives (T122 regression)', async () => {
    const staleTimestamp = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago

    // Rewrite workspace.yaml with an old updated_at so lastActivityAt would be stale
    writeFileSync(join(sessionDir, 'workspace.yaml'), `id: ${testSessionId}
cwd: ${testRepoCwd}
summary: Test session
created_at: ${staleTimestamp}
updated_at: ${staleTimestamp}
`);
    // Remove any existing events file so watchEventsFile bootstraps fresh
    const eventsFile = join(sessionDir, 'events.jsonl');
    writeFileSync(eventsFile, JSON.stringify({
      type: 'user.message',
      timestamp: new Date().toISOString(),
      data: { content: 'what does this do?' },
    }) + '\n');

    const beforeScan = new Date().toISOString();

    mockIsPidRunning.mockReturnValueOnce(true);
    mockPsList.mockResolvedValueOnce([{ pid: testPid, name: 'copilot', ppid: 1 }]);
    mockClaimForSession.mockReturnValueOnce(null);
    mockGetSession.mockReturnValue({
      id: testSessionId, launchMode: null, pid: testPid, hostPid: null,
      pidSource: 'lockfile' as const, status: 'active', summary: null, model: null,
      lastActivityAt: staleTimestamp,
    });

    const detector = new CopilotCliDetector(testDir);
    await detector.scan();

    // Expect a session.updated broadcast with lastActivityAt >= beforeScan
    const activityBroadcast = mockBroadcast.mock.calls.find(
      ([evt]) => evt.type === 'session.updated' &&
        typeof (evt.data as { lastActivityAt?: string }).lastActivityAt === 'string' &&
        (evt.data as { lastActivityAt: string }).lastActivityAt >= beforeScan
    );
    expect(activityBroadcast).toBeDefined();

    // Restore workspace.yaml for other tests
    writeFileSync(join(sessionDir, 'workspace.yaml'), `id: ${testSessionId}
cwd: ${testRepoCwd}
summary: Test session
created_at: ${new Date().toISOString()}
updated_at: ${new Date().toISOString()}
`);
  });

  it('preserves a fresher lastActivityAt across subsequent processSessionDir scans (T122 regression)', async () => {
    const staleTimestamp = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
    const freshTimestamp = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago

    // workspace.yaml has an old updated_at
    writeFileSync(join(sessionDir, 'workspace.yaml'), `id: ${testSessionId}
cwd: ${testRepoCwd}
summary: Test session
created_at: ${staleTimestamp}
updated_at: ${staleTimestamp}
`);

    mockIsPidRunning.mockReturnValueOnce(true);
    mockPsList.mockResolvedValueOnce([{ pid: testPid, name: 'copilot', ppid: 1 }]);
    mockClaimForSession.mockReturnValueOnce(null);
    // Existing DB session already has a fresh lastActivityAt (written by a prior readNewLines call)
    mockGetSession.mockReturnValue({
      id: testSessionId, launchMode: null, pid: testPid, hostPid: null,
      pidSource: 'lockfile' as const, status: 'active', summary: null, model: null,
      lastActivityAt: freshTimestamp,
    });

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    // processSessionDir must keep the fresh lastActivityAt, not reset to staleTimestamp
    expect(session?.lastActivityAt).toBe(freshTimestamp);

    // Restore workspace.yaml for other tests
    writeFileSync(join(sessionDir, 'workspace.yaml'), `id: ${testSessionId}
cwd: ${testRepoCwd}
summary: Test session
created_at: ${new Date().toISOString()}
updated_at: ${new Date().toISOString()}
`);
  });

  it('skips entry when PID is alive but belongs to wrong process (PID reuse)', async () => {
    // PID is alive but isExpectedProcess returns false — a recycled PID owned by an unrelated
    // process. The base scan() filters this out via isExpectedProcessAlive before
    // processSessionEntry is called.
    mockIsPidRunning.mockReturnValueOnce(true);
    mockIsExpectedProcess.mockReturnValueOnce(false);

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();

    expect(sessions.find((s) => s.id === testSessionId)).toBeUndefined();
    expect(mockIsExpectedProcess).toHaveBeenCalledWith(testPid, SessionTypes.COPILOT_CLI);
  });

  it('skips PID-reuse entry even when DB has the session as active (dropped-off ends it later)', async () => {
    // Stale lock file + PID recycled by an unrelated process. The DB tracks the session
    // as active, but the live process at this PID is something else. scan() filters
    // out the entry, and dispatchSessionEvents' dropped-off check ends the DB row.
    mockIsPidRunning.mockReturnValueOnce(true);
    mockIsExpectedProcess.mockReturnValueOnce(false);
    mockGetSession.mockReturnValueOnce({
      id: testSessionId,
      launchMode: null,
      pid: testPid,
      hostPid: null,
      pidSource: 'lockfile' as const,
      status: 'active',
    });

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();

    expect(sessions.find((s) => s.id === testSessionId)).toBeUndefined();
    expect(mockIsExpectedProcess).toHaveBeenCalledWith(testPid, SessionTypes.COPILOT_CLI);
  });
});