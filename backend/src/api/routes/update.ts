import type { FastifyPluginAsync } from 'fastify';
import type { UpdateService } from '../../services/update-service.js';

let updateServiceRef: UpdateService | null = null;

export function setUpdateServiceForRoutes(service: UpdateService): void {
  updateServiceRef = service;
}

const updateRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/update/status', async (_req, reply) => {
    if (!updateServiceRef) {
      return reply.send({
        currentVersion: '0.0.0',
        latestVersion: null,
        updateAvailable: false,
        lastChecked: null,
        updateInProgress: false,
      });
    }
    return reply.send(updateServiceRef.getStatus());
  });

  app.post('/api/v1/update/apply', async (req, reply) => {
    if (!updateServiceRef) {
      return reply.status(503).send({
        error: 'NO_UPDATE_AVAILABLE',
        message: 'Argus is already up to date.',
        requestId: req.id,
      });
    }

    if (updateServiceRef.isUpdateInProgress) {
      return reply.status(409).send({
        error: 'UPDATE_IN_PROGRESS',
        message: 'An update is already being applied.',
        requestId: req.id,
      });
    }

    if (!updateServiceRef.hasUpdate()) {
      return reply.status(503).send({
        error: 'NO_UPDATE_AVAILABLE',
        message: 'Argus is already up to date.',
        requestId: req.id,
      });
    }

    try {
      await updateServiceRef.applyUpdate();
      return reply.status(200).send({ applied: true });
    } catch (err) {
      app.log.warn({ err }, 'Manual update failed');
      return reply.status(500).send({
        error: 'UPDATE_FAILED',
        message: err instanceof Error ? err.message : 'Update failed.',
        requestId: req.id,
      });
    }
  });
};

export default updateRoutes;
