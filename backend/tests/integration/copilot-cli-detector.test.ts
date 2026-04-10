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
    // PID 99999 should not be running, so status should be 'ended'
    expect(session?.status).toBe('ended');
  });

  it('sets launchMode=pty when ptyRegistry has a pending connection for the same cwd', async () => {
    mockClaimForSession.mockReturnValueOnce({ pid: 12345 });

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    expect(session?.launchMode).toBe('pty');
    expect(session?.pid).toBe(12345);
    expect(session?.pidSource).toBe('pty_registry');
    expect(mockClaimForSession).toHaveBeenCalledWith(testSessionId, testRepoCwd);
  });

  it('sets launchMode=null when no pending PTY connection exists', async () => {
    mockClaimForSession.mockReturnValueOnce(null);

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    expect(session?.launchMode).toBeNull();
    expect(session?.pidSource).toBe('lockfile');
  });

  it('re-claims a new pending WS when alreadyClaimed=true but WS is disconnected (Argus restart scenario)', async () => {
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

  it('downgrades to launchMode=null when alreadyClaimed=true but WS gone and no pending reconnect', async () => {
    mockGetSession.mockReturnValueOnce({
      id: testSessionId,
      launchMode: 'pty',
      pid: 11111,
      pidSource: 'pty_registry' as const,
      status: 'active',
    });
    mockHas.mockReturnValueOnce(false);
    mockClaimForSession.mockReturnValueOnce(null);

    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);

    expect(session?.launchMode).toBeNull();
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