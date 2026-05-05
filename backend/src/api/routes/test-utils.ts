import type { FastifyInstance } from 'fastify';
import { createTaggedLogger } from '../../utils/logger.js';

const log = createTaggedLogger('[TestUtils]', '\x1b[33m');

/**
 * Registers a /api/v1/test/shutdown endpoint used only during coverage runs.
 * Calling it allows the server to exit cleanly via process.exit(0), which
 * flushes NODE_V8_COVERAGE data before the process terminates.
 */
export function registerTestRoutes(app: FastifyInstance): void {
  app.post('/api/v1/test/shutdown', async (_req, reply) => {
    log.info('shutdown endpoint called, flushing V8 coverage and exiting');
    await reply.send({ ok: true });
    setTimeout(() => process.exit(0), 100);
  });
}
