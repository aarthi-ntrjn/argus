import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';

describe('Settings API', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  beforeAll(async () => {
    // Isolated config file per test run
    process.env.ARGUS_CONFIG_PATH = join(tmpdir(), `argus-settings-test-${randomUUID()}.json`);
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-settings-db-${randomUUID()}.db`);
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/settings', () => {
    // T017
    it('returns 200 with config including idleSessionThresholdMinutes defaulting to 60', async () => {
      const res = await request.get('/api/v1/settings');
      expect(res.status).toBe(200);
      expect(typeof res.body.idleSessionThresholdMinutes).toBe('number');
      expect(res.body.idleSessionThresholdMinutes).toBe(60);
    });

    it('returns all expected config fields', async () => {
      const res = await request.get('/api/v1/settings');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('port');
      expect(res.body).toHaveProperty('watchDirectories');
      expect(res.body).toHaveProperty('sessionRetentionHours');
      expect(res.body).toHaveProperty('outputRetentionMbPerSession');
      expect(res.body).toHaveProperty('autoRegisterRepos');
      expect(res.body).toHaveProperty('idleSessionThresholdMinutes');
    });
  });

  describe('PATCH /api/v1/settings', () => {
    // T018
    it('updates idleSessionThresholdMinutes and returns the updated config', async () => {
      const res = await request.patch('/api/v1/settings').send({ idleSessionThresholdMinutes: 45 });
      expect(res.status).toBe(200);
      expect(res.body.idleSessionThresholdMinutes).toBe(45);
    });

    it('persists the updated value across GET', async () => {
      await request.patch('/api/v1/settings').send({ idleSessionThresholdMinutes: 90 });
      const res = await request.get('/api/v1/settings');
      expect(res.body.idleSessionThresholdMinutes).toBe(90);
    });

    it('partial update — only supplied fields change', async () => {
      const before = (await request.get('/api/v1/settings')).body;
      await request.patch('/api/v1/settings').send({ idleSessionThresholdMinutes: 45 });
      const after = (await request.get('/api/v1/settings')).body;
      expect(after.port).toBe(before.port);
      expect(after.sessionRetentionHours).toBe(before.sessionRetentionHours);
      expect(after.idleSessionThresholdMinutes).toBe(45);
    });

    // T019
    it('returns 400 INVALID_CONFIG when idleSessionThresholdMinutes is 0', async () => {
      const res = await request.patch('/api/v1/settings').send({ idleSessionThresholdMinutes: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_CONFIG');
    });

    // T020
    it('returns 400 INVALID_CONFIG when idleSessionThresholdMinutes is negative', async () => {
      const res = await request.patch('/api/v1/settings').send({ idleSessionThresholdMinutes: -5 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_CONFIG');
    });

    it('returns 400 INVALID_CONFIG when idleSessionThresholdMinutes is not a number', async () => {
      const res = await request.patch('/api/v1/settings').send({ idleSessionThresholdMinutes: 'fast' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_CONFIG');
    });

    // T021
    it('ignores unknown fields and does not persist them', async () => {
      const res = await request.patch('/api/v1/settings').send({ unknownField: true });
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('unknownField');
    });
  });
});
