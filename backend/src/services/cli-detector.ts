import type { Session, PendingChoice } from '../models/index.js';

/**
 * Hook payload sent by an AI CLI tool to Argus's hook HTTP endpoint.
 * Shared between Claude Code and Copilot CLI detectors.
 */
export interface CliHookPayload {
  hook_event_name: string;
  session_id: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: unknown;
  [key: string]: unknown;
}

/**
 * Common lifecycle and protocol contract for all CLI session detectors.
 *
 * Each AI CLI tool has its own detection mechanism:
 *   - Claude Code: pushes sessions via sessionCreatedCallback from hook payloads and a
 *     registry scanner; scan() returns [].
 *   - Copilot CLI: discovers sessions by polling workspace.yaml files on disk;
 *     scan() returns the full discovered Session[].
 *
 * Despite these differences, SessionMonitor interacts with both via this interface
 * for lifecycle management (start/stop) and per-cycle scanning.
 *
 * Asymmetries intentionally preserved:
 *   - scan() return type: Claude pushes via callback so returns []; Copilot returns Session[].
 *   - closeSessionWatcher(): Claude requires explicit watcher teardown per session;
 *     Copilot manages watchers internally in scan(), so this is a no-op.
 */
export interface CliDetector {
  /**
   * One-time startup: initialize internal state before the scan loop begins.
   * Must be called before the first scan(). Must NOT trigger a scan itself —
   * the first runScan() cycle is the uniform entry point for both detectors.
   */
  start(): Promise<void>;

  /**
   * Per-cycle scan. Returns sessions discovered this cycle.
   * Detectors that push sessions via callbacks (e.g. ClaudeCodeDetector) return [].
   */
  scan(): Promise<Session[]>;

  /** Server shutdown: release all file watchers and free resources. */
  stop(): void;

  /** Returns the pending user-choice for the given session, or null. */
  getPendingChoice(sessionId: string): PendingChoice | null;

  /**
   * Process a hook payload received from the AI tool's hook HTTP endpoint.
   * This is the primary real-time update path for both tools.
   */
  handleHookPayload(payload: CliHookPayload): Promise<void>;

  /**
   * Close the per-session output watcher for a session that has ended.
   * No-op for detectors that manage watchers internally (e.g. CopilotCliDetector).
   */
  closeSessionWatcher(sessionId: string): void;
}
