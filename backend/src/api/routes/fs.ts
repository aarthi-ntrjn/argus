import { FastifyInstance } from 'fastify';
import { readdirSync, existsSync, lstatSync } from 'fs';
import { join, normalize, basename } from 'path';
import { getRepositories } from '../../db/database.js';
import { isPathWithinBoundary } from '../../utils/path-sandbox.js';
import { homedir } from 'os';

function getAllowedBoundaries(): string[] {
  return [homedir(), ...getRepositories().map(r => r.path)];
}

export function findGitRepos(dirPath: string, results: Array<{ path: string; name: string }> = []): Array<{ path: string; name: string }> {
  // If this dir is itself a git repo, add it and don't recurse into it
  if (existsSync(join(dirPath, '.git'))) {
    results.push({ path: dirPath, name: basename(dirPath) });
    return results;
  }
  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = join(dirPath, entry.name);
    try {
      const stat = lstatSync(fullPath);
      if (stat.isSymbolicLink() || !stat.isDirectory()) continue;
    } catch {
      continue;
    }
    findGitRepos(fullPath, results);
  }
  return results;
}

export async function fsRoutes(app: FastifyInstance) {
  app.post('/api/v1/fs/scan-folder', async (request, reply) => {
    const body = request.body as { path?: string };
    const scanPath = body?.path ? normalize(body.path) : null;
    if (!scanPath) {
      return reply.status(400).send({ error: 'MISSING_PATH', message: 'path is required', requestId: request.id });
    }

    // FR-008/FR-009: reject paths outside safe boundaries
    if (!isPathWithinBoundary(scanPath, getAllowedBoundaries())) {
      return reply.status(403).send({
        error: 'PATH_OUTSIDE_BOUNDARY',
        message: 'Path is outside the allowed directory boundary',
        requestId: request.id,
      });
    }

    if (!existsSync(scanPath)) {
      return reply.status(404).send({ error: 'PATH_NOT_FOUND', message: 'The specified folder does not exist.', requestId: request.id });
    }
    app.log.info({ scanPath }, 'Starting recursive git repo scan');
    try {
      const repos = findGitRepos(scanPath);
      app.log.info({ scanPath, count: repos.length }, 'Scan complete');
      return reply.send({ repos });
    } catch (err) {
      app.log.error({ scanPath, err }, 'Scan failed');
      return reply.status(500).send({ error: 'SCAN_FAILED', message: 'Failed to scan folder.', requestId: request.id, repos: [] });
    }
  });

}
