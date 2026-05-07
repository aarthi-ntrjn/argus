import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import WebSocket from 'ws';

// Hoist the broadcast mock so the vi.mock factory can reference it.
const { mockBroadcast } = vi.hoisted(() => ({
  mockBroadcast: vi.fn(),
}));

vi.mock('../../src/api/ws/event-dispatcher.js', () => ({
  broadcast: mockBroadcast,
  addClient: vi.fn(),
  removeClient: vi.fn(),
  getClientCount: vi.fn().mockReturnValue(0),
}));

// Prevent child_process.spawn from opening real terminals during server init.
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: vi.fn().mockReturnValue({ on: vi.fn(), unref: vi.fn() }),
    spawnSync: vi.fn().mockReturnValue({ status: 0 }),
  };
});

import { buildServer } from '../../src/server.js';

describe('Launcher — launcher.pending.gone broadcast', () => {
  let app: Awaited<ReturnType<typeof buildServer>>['app'];
  let wsBase: string;

  beforeAll(async () => {
    process.env.ARGUS_CONFIG_PATH = join(tmpdir(), `argus-pending-gone-${randomUUID()}.json`);
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-pending-gone-db-${randomUUID()}.db`);
    const result = await buildServer();
    app = result.app;
    await app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = app.server.address() as { port: number };
    wsBase = `ws://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('broadcasts launcher.pending.gone when a pending launcher disconnects before a session is claimed', async () => {
    mockBroadcast.mockClear();
    const launchId = randomUUID();
    const repoPath = tmpdir();

    const ws = new WebSocket(`${wsBase}/launcher?id=${launchId}`);

    // Wait for the server's 'connected' message.
    await new Promise<void>((resolve, reject) => {
      ws.once('message', () => resolve());
      ws.once('error', reject);
    });

    // Send the register message with pid: null (non-Windows path, no pid to resolve).
    ws.send(
      JSON.stringify({
        type: 'register',
        hostPid: 99999,
        pid: null,
        sessionType: 'claude-code',
        cwd: repoPath,
      }),
    );

    // Give the server a tick to process the register message.
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Close without ever claiming a session.
    ws.close();

    // Wait for the close event to propagate through Fastify.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'launcher.pending.gone',
        data: expect.objectContaining({
          ptyLaunchId: launchId,
          repoPath,
          sessionType: 'claude-code',
        }),
      }),
    );
  });

  it('does NOT broadcast launcher.pending.gone when the launcher had no repoPath (no register sent)', async () => {
    mockBroadcast.mockClear();
    const launchId = randomUUID();

    const ws = new WebSocket(`${wsBase}/launcher?id=${launchId}`);

    // Wait for 'connected' message.
    await new Promise<void>((resolve, reject) => {
      ws.once('message', () => resolve());
      ws.once('error', reject);
    });

    // Close immediately without sending a register message.
    ws.close();

    await new Promise((resolve) => setTimeout(resolve, 50));

    const pendingGoneCalls = mockBroadcast.mock.calls.filter(
      (call) => call[0]?.type === 'launcher.pending.gone',
    );
    expect(pendingGoneCalls).toHaveLength(0);
  });
});
