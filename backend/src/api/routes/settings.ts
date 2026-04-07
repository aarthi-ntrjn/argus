import type { FastifyPluginAsync } from 'fastify';
import { loadConfig, saveConfig } from '../../config/config-loader.js';
import type { ArgusConfig } from '../../models/index.js';

const ALLOWED_KEYS = new Set<keyof ArgusConfig>([
  'port', 'watchDirectories', 'sessionRetentionHours',
  'outputRetentionMbPerSession', 'autoRegisterRepos', 'idleSessionThresholdMinutes',
]);

function validatePatch(body: Record<string, unknown>, requestId: string): { error: string; message: string; requestId: string } | null {
  const { idleSessionThresholdMinutes } = body;
  if (idleSessionThresholdMinutes !== undefined) {
    if (typeof idleSessionThresholdMinutes !== 'number' || !Number.isInteger(idleSessionThresholdMinutes) || idleSessionThresholdMinutes < 1) {
      return {
        error: 'INVALID_CONFIG',
        message: 'idleSessionThresholdMinutes must be an integer greater than or equal to 1',
        requestId,
      };
    }
  }
  return null;
}

const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/settings', async (_req, reply) => {
    return reply.send(loadConfig());
  });

  app.patch<{ Body: Record<string, unknown> }>('/api/v1/settings', async (req, reply) => {
    const body = req.body ?? {};
    const validationError = validatePatch(body, req.id);
    if (validationError) return reply.status(400).send(validationError);

    const current = loadConfig();
    // Apply only recognised keys from the patch body
    const updated: ArgusConfig = { ...current };
    for (const key of ALLOWED_KEYS) {
      if (key in body) {
        (updated as Record<string, unknown>)[key] = body[key];
      }
    }
    saveConfig(updated);
    return reply.send(updated);
  });
};

export default settingsRoutes;
