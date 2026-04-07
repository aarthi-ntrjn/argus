import type { FastifyPluginAsync } from 'fastify';
import { spawnSync } from 'child_process';
import { platform } from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// Resolve argus repo root from this file's location.
// Source:   backend/src/api/routes/  -> 4 levels up = repo root
// Compiled: backend/dist/api/routes/ -> 4 levels up = repo root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARGUS_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// Base command (no --cwd): safe to copy and run manually from any directory.
// The user runs it from their repo and process.cwd() will be correct.
function buildLaunchCmdBase(tool: 'claude' | 'copilot'): string {
  const toolArg = tool === 'copilot' ? 'gh copilot suggest' : 'claude';
  return `npm --prefix "${ARGUS_ROOT}" run launch --workspace=backend -- ${toolArg}`;
}

// Full command with --cwd baked in: used when the backend spawns the terminal.
// npm --workspace changes cwd to the workspace root, so we must pass --cwd explicitly.
function buildLaunchCmdWithCwd(tool: 'claude' | 'copilot', repoPath: string): string {
  return `${buildLaunchCmdBase(tool)} --cwd "${repoPath}"`;
}

function isInstalled(cmd: string): boolean {
  const checker = platform() === 'win32' ? 'where' : 'which';
  const result = spawnSync(checker, [cmd], { encoding: 'utf-8', timeout: 3000 });
  return result.status === 0;
}

// gh copilot is a gh extension — gh being on PATH is not enough.
// Run `gh copilot --version` and treat exit 0 as "extension installed".
function isCopilotExtensionInstalled(): boolean {
  if (!isInstalled('gh')) return false;
  const result = spawnSync('gh', ['copilot', '--version'], { encoding: 'utf-8', timeout: 5000 });
  return result.status === 0;
}

function openTerminalWithCommand(cmd: string): void {
  if (platform() === 'win32') {
    // Prefer Windows Terminal; fall back to a plain PowerShell window.
    const wtAvailable = spawnSync('where', ['wt.exe'], { encoding: 'utf-8', timeout: 2000 }).status === 0;
    if (wtAvailable) {
      // wt.exe new-tab opens a new tab running PowerShell with the launch command.
      spawn('wt.exe', ['new-tab', '--', 'powershell', '-NoExit', '-Command', cmd], {
        detached: true, stdio: 'ignore',
      }).unref();
    } else {
      spawn('cmd.exe', ['/c', 'start', 'powershell', '-NoExit', '-Command', cmd], {
        detached: true, stdio: 'ignore', shell: false,
      }).unref();
    }
  } else {
    // macOS: open a new Terminal window running the command.
    // Escape double-quotes inside the AppleScript string literal.
    const escaped = cmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `tell application "Terminal"\n  do script "${escaped}"\n  activate\nend tell`;
    spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' }).unref();
  }
}

const toolsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/tools', async (_req, reply) => {
    const hasClaude = isInstalled('claude');
    const hasCopilot = isCopilotExtensionInstalled();
    return reply.send({
      claude: hasClaude,
      copilot: hasCopilot,
      // Base commands (no --cwd): the user appends --cwd <their-repo> when copying.
      claudeCmd: hasClaude ? buildLaunchCmdBase('claude') : undefined,
      copilotCmd: hasCopilot ? buildLaunchCmdBase('copilot') : undefined,
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
      const cmd = repoPath
        ? buildLaunchCmdWithCwd(tool, repoPath)
        : buildLaunchCmdBase(tool);
      openTerminalWithCommand(cmd);
      return reply.status(202).send({ status: 'launched' });
    }
  );
};

export default toolsRoutes;
