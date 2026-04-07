import type { SessionType } from '../models/index.js';

export interface LaunchCommand {
  sessionType: SessionType;
  cmd: string;
  cmdArgs: string[];
}

export function resolveLaunchCommand(args: string[]): LaunchCommand {
  if (args.length === 0) {
    throw new Error('No command provided. Usage: argus launch <command> [args...]');
  }

  const [cmd, ...cmdArgs] = args;

  if (cmd === 'claude') {
    return { sessionType: 'claude-code', cmd, cmdArgs };
  }

  // Standalone GitHub Copilot CLI (npm install -g @githubnext/github-copilot-cli)
  if (cmd === 'copilot') {
    return { sessionType: 'copilot-cli', cmd, cmdArgs };
  }

  // gh copilot extension (gh extension install github/gh-copilot)
  if (cmd === 'gh' && cmdArgs[0] === 'copilot') {
    return { sessionType: 'copilot-cli', cmd, cmdArgs };
  }

  // Default: assume claude-code for unknown commands
  return { sessionType: 'claude-code', cmd, cmdArgs };
}
