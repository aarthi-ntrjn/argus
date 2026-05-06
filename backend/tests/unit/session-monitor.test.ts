import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

// Mutable so individual tests can control which processes are "running"
let mockPsListResult: Array<{ pid: number; name: string; cmd?: string }> = [
  { pid: 9999, name: 'some-process', cmd: 'some-process' },
];

// Mutable so individual tests can control what branch getCurrentBranch returns
let mockGetCurrentBranchResult: string | null = null;

// Mutable so tests can control the homedir for JSONL path resolution without touching real ~/.claude
let mockHomedir: string = tmpdir();

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => mockHomedir };
});

// Mock ps-list to control which PIDs are "running"
vi.mock('ps-list', () => ({
  default: vi.fn(async () => mockPsListResult),
}));

// Mock process-utils so isPidRunning is driven by the same mockPsListResult array.
// reconcileClaudeCodeSessions uses isPidRunning directly (not ps-list).
const mockIsPidRunning = vi.hoisted(() => vi.fn((_pid: number) => false));
vi.mock('../../src/services/process-utils.js', () => ({
  isPidRunning: mockIsPidRunning,
  detectYoloModeFromPids: vi.fn().mockReturnValue(null),
}));

// Mock config to avoid reading real watch dirs
vi.mock('../../src/config/config-loader.js', () => ({
  loadConfig: () => ({
    port: 7411,
    watchDirectories: [],
    sessionRetentionHours: 24,
    outputRetentionMbPerSession: 10,
    autoRegisterRepos: false,
  }),
}));

// Stub out the detectors so start() doesn't touch the real filesystem
vi.mock('../../src/services/repository-scanner.js', () => ({
  RepositoryScanner: vi.fn().mockImplementation(() => ({
    scan: vi.fn(async () => []),
  })),
  getCurrentBranch: vi.fn((..._args: unknown[]) => mockGetCurrentBranchResult),
}));

vi.mock('../../src/services/copilot-cli-detector.js', () => ({
  CopilotCliDetector: vi.fn().mockImplementation(() => ({
    scan: vi.fn(async () => []),
    stop: vi.fn(),
    scanLockEntries: vi.fn(() => new Map()),
    getPendingChoice: vi.fn(() => null),
    handleHookPayload: vi.fn(async () => {}),
    setSessionCreatedCallback: vi.fn(),
    setSessionUpdatedCallback: vi.fn(),
    setSessionEndedCallback: vi.fn(),
    seedState: vi.fn(),
  })),
}));

vi.mock('../../src/services/claude-code-detector.js', () => ({
  ClaudeCodeDetector: Object.assign(
    vi.fn().mockImplementation(() => ({
      scan: vi.fn(async () => []),
      stop: vi.fn(),
      setSessionCreatedCallback: vi.fn(),
      setSessionUpdatedCallback: vi.fn(),
      setSessionEndedCallback: vi.fn(),
      seedState: vi.fn(),
      getPendingChoice: vi.fn(() => null),
      handleHookPayload: vi.fn(async () => {}),
    })),
    { projectDirName: (p: string) => p.replace(/[:\\/\s]/g, '-') }
  ),
}));

// Capture broadcast calls so tests can assert repository.updated is emitted
const mockBroadcast = vi.hoisted(() => vi.fn());
vi.mock('../../src/api/ws/event-dispatcher.js', () => ({
  broadcast: mockBroadcast,
  addClient: vi.fn(),
  removeClient: vi.fn(),
}));

describe('SessionMonitor.refreshRepositoryBranches', () => {
  let closeDb: () => void;
  let insertRepository: (r: unknown) => void;
  let getRepositories: () => unknown[];
  let SessionMonitor: new () => { start(): Promise<void>; stop(): void };

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-sm-branch-test-${randomUUID()}.db`);
    mkdirSync(tmpdir(), { recursive: true });
    vi.resetModules();
    mockPsListResult = [{ pid: 9999, name: 'some-process', cmd: 'some-process' }];
    mockGetCurrentBranchResult = null;
    const db = await import('../../src/db/database.js');
    closeDb = db.closeDb;
    insertRepository = db.insertRepository as (r: unknown) => void;
    getRepositories = db.getRepositories as () => unknown[];
    const mod = await import('../../src/services/session-monitor.js');
    SessionMonitor = mod.SessionMonitor as unknown as typeof SessionMonitor;
  });

  afterEach(() => {
    closeDb();
    vi.resetModules();
  });

  // T095 regression: branch update must propagate to DB on each scan cycle (not just on window focus)
  it('T095: should update repository branch in DB when git branch changes between scans', async () => {
    insertRepository({
      id: 'repo-branch-test',
      path: '/stub/repo',
      name: 'stub',
      source: 'ui' as const,
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
      branch: 'main',
    });

    // Simulate user switching branch before the next scan cycle
    mockGetCurrentBranchResult = 'feature/my-new-branch';

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const repos = getRepositories() as Array<{ id: string; branch: string | null }>;
    const repo = repos.find(r => r.id === 'repo-branch-test');
    expect(repo?.branch).toBe('feature/my-new-branch');
  });

  it('T095: should not update DB when branch is unchanged', async () => {
    insertRepository({
      id: 'repo-stable-branch',
      path: '/stub/repo',
      name: 'stub',
      source: 'ui' as const,
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
      branch: 'main',
    });

    mockGetCurrentBranchResult = 'main'; // same as stored

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const repos = getRepositories() as Array<{ id: string; branch: string | null }>;
    const repo = repos.find(r => r.id === 'repo-stable-branch');
    expect(repo?.branch).toBe('main');
  });

  // T123 regression: branch change must broadcast repository.updated so frontend refreshes without polling
  it('T123: should broadcast repository.updated when branch changes', async () => {
    mockBroadcast.mockClear();
    insertRepository({
      id: 'repo-broadcast-test',
      path: '/stub/repo',
      name: 'stub',
      source: 'ui' as const,
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
      branch: 'main',
    });

    mockGetCurrentBranchResult = '037-reduce-log-noise';

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const updatedCall = mockBroadcast.mock.calls.find(
      (call) => call[0]?.type === 'repository.updated' && call[0]?.data?.id === 'repo-broadcast-test'
    );
    expect(updatedCall).toBeDefined();
    expect(updatedCall?.[0].data.branch).toBe('037-reduce-log-noise');
  });

  // T123: no broadcast when branch has not changed
  it('T123: should not broadcast repository.updated when branch is unchanged', async () => {
    mockBroadcast.mockClear();
    insertRepository({
      id: 'repo-no-broadcast-test',
      path: '/stub/repo',
      name: 'stub',
      source: 'ui' as const,
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
      branch: 'main',
    });

    mockGetCurrentBranchResult = 'main';

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const updatedCall = mockBroadcast.mock.calls.find(
      (call) => call[0]?.type === 'repository.updated' && call[0]?.data?.id === 'repo-no-broadcast-test'
    );
    expect(updatedCall).toBeUndefined();
  });
});
