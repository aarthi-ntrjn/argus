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
 * Both detectors are push-based: scan() fires session lifecycle callbacks internally
 * and returns the discovered sessions. Callers that only care about callbacks can
 * ignore the return value.
 */
export interface CliDetector {
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
}
