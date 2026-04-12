import { execSync } from 'child_process';
import { platform } from 'os';
import type { SessionType } from '../models/index.js';

const YOLO_FLAGS: Record<SessionType, string> = {
  'claude-code': '--dangerously-skip-permissions',
  'copilot-cli': '--allow-all',
};

/**
 * Inspect a running process's command line to detect yolo mode flags.
 * Returns true if the process was launched with the yolo flag for its session type.
 */
export function detectYoloMode(pid: number, type: SessionType): boolean {
  try {
    const cmdLine = getProcessCommandLine(pid);
    if (!cmdLine) return false;
    return cmdLine.includes(YOLO_FLAGS[type]);
  } catch {
    return false;
  }
}

function getProcessCommandLine(pid: number): string | null {
  try {
    if (platform() === 'win32') {
      const out = execSync(
        `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' -ErrorAction SilentlyContinue).CommandLine"`,
        { encoding: 'utf-8', timeout: 3000 }
      ).trim();
      return out || null;
    } else {
      const out = execSync(`ps -o args= -p ${pid}`, {
        encoding: 'utf-8',
        timeout: 3000,
      }).trim();
      return out || null;
    }
  } catch {
    return null;
  }
}

/**
 * Check yolo mode by inspecting multiple PIDs (pid and hostPid).
 * The hostPid (e.g., powershell.exe on Windows) often contains the full
 * command including yolo flags, while the tool pid may not.
 */
export function detectYoloModeFromPids(
  pid: number | null,
  hostPid: number | null,
  type: SessionType
): boolean {
  if (hostPid != null && detectYoloMode(hostPid, type)) return true;
  if (pid != null && pid !== hostPid && detectYoloMode(pid, type)) return true;
  return false;
}
