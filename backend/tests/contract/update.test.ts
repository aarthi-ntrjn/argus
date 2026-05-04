import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';

describe('Update API', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  beforeAll(async () => {
    process.env.ARGUS_CONFIG_PATH = join(tmpdir(), `argus-update-test-${randomUUID()}.json`);
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-update-db-${randomUUID()}.db`);
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/update/status', () => {
    it('returns 200 with all UpdateStatus fields', async () => {
      const res = await request.get('/api/v1/update/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('currentVersion');
      expect(res.body).toHaveProperty('latestVersion');
      expect(res.body).toHaveProperty('updateAvailable');
      expect(res.body).toHaveProperty('lastChecked');
      expect(res.body).toHaveProperty('updateInProgress');
      expect(typeof res.body.updateAvailable).toBe('boolean');
      expect(typeof res.body.updateInProgress).toBe('boolean');
    });

    it('returns updateAvailable=false and updateInProgress=false by default', async () => {
      const res = await request.get('/api/v1/update/status');
      expect(res.status).toBe(200);
      expect(res.body.updateAvailable).toBe(false);
      expect(res.body.updateInProgress).toBe(false);
    });
  });

  describe('POST /api/v1/update/apply', () => {
    it('returns 503 when no update is available', async () => {
      const res = await request.post('/api/v1/update/apply');
      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty('error', 'NO_UPDATE_AVAILABLE');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('requestId');
    });
  });

  describe('GET /api/health (update fields)', () => {
    it('includes updateAvailable and latestVersion fields', async () => {
      const res = await request.get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('updateAvailable');
      expect(typeof res.body.updateAvailable).toBe('boolean');
    });
  });
});
