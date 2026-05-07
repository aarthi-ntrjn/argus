import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import supertest from 'supertest';

// vi.mock is hoisted — factory must not reference variables defined after it.
// Use vi.hoisted to create mutable references accessible both in factory and tests.
const { mockSpawn, mockSpawnSync } = vi.hoisted(() => {
  const mockSpawn = vi.fn().mockReturnValue({ on: vi.fn(), unref: vi.fn() });
  const mockSpawnSync = vi.fn().mockReturnValue({ status: 0, error: undefined });
  return { mockSpawn, mockSpawnSync };
});

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, spawn: mockSpawn, spawnSync: mockSpawnSync };
});

import { buildServer } from '../../src/server.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Tools API — launch-terminal returns ptyLaunchId', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  beforeAll(async () => {
    process.env.ARGUS_CONFIG_PATH = join(tmpdir(), `argus-launch-id-test-${randomUUID()}.json`);
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-launch-id-db-${randomUUID()}.db`);
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 202 with a ptyLaunchId UUID on successful terminal launch', async () => {
    mockSpawnSync.mockReturnValue({ status: 0 });
    mockSpawn.mockReturnValue({ on: vi.fn(), unref: vi.fn() });

    const res = await request.post('/api/v1/sessions/launch-terminal').send({ tool: 'claude' });

    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('ptyLaunchId');
    expect(res.body.ptyLaunchId).toMatch(UUID_PATTERN);
  });

  it('returns 202 with repoPath and a unique ptyLaunchId', async () => {
    mockSpawnSync.mockReturnValue({ status: 0 });
    mockSpawn.mockReturnValue({ on: vi.fn(), unref: vi.fn() });

    const res = await request
      .post('/api/v1/sessions/launch-terminal')
      .send({ tool: 'claude', repoPath: tmpdir() });

    expect(res.status).toBe(202);
    expect(res.body.ptyLaunchId).toMatch(UUID_PATTERN);
  });

  it('returns different ptyLaunchId values for concurrent launches', async () => {
    mockSpawnSync.mockReturnValue({ status: 0 });
    mockSpawn.mockReturnValue({ on: vi.fn(), unref: vi.fn() });

    const [res1, res2] = await Promise.all([
      request.post('/api/v1/sessions/launch-terminal').send({ tool: 'claude' }),
      request.post('/api/v1/sessions/launch-terminal').send({ tool: 'claude' }),
    ]);

    expect(res1.status).toBe(202);
    expect(res2.status).toBe(202);
    expect(res1.body.ptyLaunchId).not.toBe(res2.body.ptyLaunchId);
  });

  it('passes --launch-id to the spawned terminal command', async () => {
    mockSpawnSync.mockReturnValue({ status: 0 });
    const spawnedArgs: string[][] = [];
    mockSpawn.mockImplementation((_file: string, args: string[]) => {
      spawnedArgs.push(args);
      return { on: vi.fn(), unref: vi.fn() };
    });

    const res = await request.post('/api/v1/sessions/launch-terminal').send({ tool: 'claude' });
    expect(res.status).toBe(202);

    const { ptyLaunchId } = res.body as { ptyLaunchId: string };
    const allArgs = spawnedArgs.flat().join(' ');
    expect(allArgs).toContain(`--launch-id ${ptyLaunchId}`);
  });
});
