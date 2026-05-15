import path from 'path';
import { SessionTypes, ToolCommands } from '../models/index.js';
import type { SessionType } from '../models/index.js';

const GITHUB_CLI_COMMAND = 'gh';
const WINDOWS_EXECUTABLE_SUFFIX = /\.(cmd|exe|bat)$/i;

function normalizeCommandName(cmd: string): string {
  return path.basename(cmd).replace(WINDOWS_EXECUTABLE_SUFFIX, '');
}

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
  const normalizedCmd = normalizeCommandName(cmd);

  if (normalizedCmd === ToolCommands.CLAUDE) {
    return { sessionType: SessionTypes.CLAUDE_CODE, cmd, cmdArgs };
  }

  // GitHub Copilot CLI (standalone)
  if (normalizedCmd === ToolCommands.COPILOT) {
    return { sessionType: SessionTypes.COPILOT_CLI, cmd, cmdArgs };
  }

  if (cmd === GITHUB_CLI_COMMAND && cmdArgs[0] === ToolCommands.COPILOT) {
    return { sessionType: SessionTypes.COPILOT_CLI, cmd, cmdArgs };
  }

  // Default: assume claude-code for unknown commands
  return { sessionType: SessionTypes.CLAUDE_CODE, cmd, cmdArgs };
}
