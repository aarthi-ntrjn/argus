import type { FastifyPluginAsync } from 'fastify';
import { spawnSync } from 'child_process';
import { platform } from 'os';
import { spawn } from 'child_process';

function isInstalled(cmd: string): boolean {
  const checker = platform() === 'win32' ? 'where' : 'which';
  const result = spawnSync(checker, [cmd], { encoding: 'utf-8', timeout: 3000 });
  return result.status === 0;
}

function openTerminalWithCommand(cmd: string, repoPath?: string): void {
  const cdCmd = repoPath
    ? (platform() === 'win32' ? `cd /d "${repoPath}" && ` : `cd '${repoPath}' && `)
    : '';
  const fullCmd = `${cdCmd}${cmd}`;

  if (platform() === 'win32') {
    // Try Windows Terminal first, fall back to cmd
    const wtResult = spawnSync('where', ['wt.exe'], { encoding: 'utf-8', timeout: 2000 });
    if (wtResult.status === 0) {
      spawn('wt.exe', ['new-tab', '--', 'powershell', '-NoExit', '-Command', fullCmd], {
        detached: true, stdio: 'ignore',
      }).unref();
    } else {
      spawn('cmd.exe', ['/c', 'start', 'powershell', '-NoExit', '-Command', fullCmd], {
        detached: true, stdio: 'ignore', shell: false,
      }).unref();
    }
  } else {
    // macOS
    const script = `tell application "Terminal" to do script "${fullCmd.replace(/"/g, '\\"')}"`;
    spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' }).unref();
  }
}

const toolsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/tools', async (_req, reply) => {
    return reply.send({
      claude: isInstalled('claude'),
      copilot: isInstalled('gh'),
    });
  });

  app.post<{ Body: { tool: 'claude' | 'copilot'; repoPath?: string } }>(
    '/api/v1/sessions/launch-terminal',
    {
      schema: {
        body: {
          type: 'object',
          required: ['tool'],
          properties: {
            tool: { type: 'string', enum: ['claude', 'copilot'] },
            repoPath: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { tool, repoPath } = req.body;
      const cmd = tool === 'copilot'
        ? 'npm run launch --workspace=backend -- gh copilot suggest'
        : 'npm run launch --workspace=backend -- claude';
      openTerminalWithCommand(cmd, repoPath);
      return reply.status(202).send({ status: 'launched' });
    }
  );
};

export default toolsRoutes;
