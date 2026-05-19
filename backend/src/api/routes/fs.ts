import { FastifyInstance } from 'fastify';
import { existsSync } from 'fs';
import { normalize } from 'path';
import { expandTilde } from '../../utils/path-sandbox.js';
import { findGitRepos } from '../../services/repository-scanner.js';
import { telemetryService } from '../../services/telemetry-service.js';

export async function fsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/fs/scan-folder', async (request, reply) => {
    const body = request.body as { path?: string };
    const scanPath = body?.path ? normalize(expandTilde(body.path)) : null;
    if (!scanPath) {
      return reply
        .status(400)
        .send({ error: 'MISSING_PATH', message: 'path is required', requestId: request.id });
    }

    if (!existsSync(scanPath)) {
      return reply.status(404).send({
        error: 'PATH_NOT_FOUND',
        message: 'The specified folder does not exist.',
        requestId: request.id,
      });
    }
    app.log.info({ scanPath }, 'Starting recursive git repo scan');
    telemetryService.sendEvent('repo_scan_requested');
    try {
      const repos = await findGitRepos(scanPath);
      app.log.info({ scanPath, count: repos.length }, 'Scan complete');
      return reply.send({ repos });
    } catch (err: unknown) {
      app.log.error({ scanPath, err }, 'Scan failed');
      return reply.status(500).send({
        error: 'SCAN_FAILED',
        message: 'Failed to scan folder.',
        requestId: request.id,
        repos: [],
      });
    }
  });
}
