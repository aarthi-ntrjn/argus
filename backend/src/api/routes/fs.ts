import { FastifyInstance } from 'fastify';
import { readdirSync, existsSync } from 'fs';
import { join, dirname, normalize } from 'path';
import { homedir } from 'os';
import { spawnSync } from 'child_process';

export async function fsRoutes(app: FastifyInstance) {
  app.get('/api/v1/fs/browse', async (request, reply) => {
    const query = request.query as { path?: string };
    const dirPath = normalize(query.path ?? homedir());
    if (!existsSync(dirPath)) {
      return reply.status(404).send({ error: 'Path not found' });
    }
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => {
          const fullPath = join(dirPath, e.name);
          const isGitRepo = existsSync(join(fullPath, '.git'));
          return { name: e.name, path: fullPath, isGitRepo };
        });
      const parent = dirname(dirPath) !== dirPath ? dirname(dirPath) : null;
      return { current: dirPath, parent, entries };
    } catch {
      return reply.status(403).send({ error: 'Cannot read directory' });
    }
  });

  app.get('/api/v1/fs/scan', async (request, reply) => {
    const query = request.query as { path?: string };
    const dirPath = normalize(query.path ?? homedir());
    if (!existsSync(dirPath)) {
      return reply.status(404).send({ error: 'Path not found' });
    }
    try {
      const repos = readdirSync(dirPath, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .filter(e => existsSync(join(dirPath, e.name, '.git')))
        .map(e => ({ name: e.name, path: join(dirPath, e.name) }));
      return { scannedPath: dirPath, repos };
    } catch {
      return reply.status(403).send({ error: 'Cannot read directory' });
    }
  });

  app.post('/api/v1/fs/pick-folder', async (_request, reply) => {
    const platform = process.platform;
    let selectedPath: string | null = null;

    try {
      if (platform === 'win32') {
        const ps = [
          'Add-Type -AssemblyName System.Windows.Forms;',
          '$d = New-Object System.Windows.Forms.FolderBrowserDialog;',
          '$d.ShowNewFolderButton = $true;',
          'if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.SelectedPath }',
        ].join(' ');
        const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
          encoding: 'utf-8',
          timeout: 120000,
        });
        if (result.status === 0 && result.stdout?.trim()) {
          selectedPath = result.stdout.trim();
        }
      } else if (platform === 'darwin') {
        const result = spawnSync('osascript', ['-e', 'POSIX path of (choose folder)'], {
          encoding: 'utf-8',
          timeout: 120000,
        });
        if (result.status === 0 && result.stdout?.trim()) {
          selectedPath = result.stdout.trim().replace(/\/$/, '');
        }
      } else {
        const result = spawnSync('zenity', ['--file-selection', '--directory'], {
          encoding: 'utf-8',
          timeout: 120000,
        });
        if (result.status === 0 && result.stdout?.trim()) {
          selectedPath = result.stdout.trim();
        }
      }
    } catch {
      return reply.send({ path: null, error: 'not_supported' });
    }

    return reply.send({ path: selectedPath });
  });
}
