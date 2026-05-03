import { ClaudeCodeDetector } from './claude-code-detector.js';
import { CopilotCliDetector } from './copilot-cli-detector.js';
import { ClaudeCodeHooksInjector } from './claude-code-hooks-injector.js';
import { CopilotHooksInjector } from './copilot-cli-hooks-injector.js';
import type { Session, ClaudeSessionRegistryEntry } from '../models/index.js';
import type { CliHookPayload } from './cli-detector.js';

/**
 * Single point of ownership for all CLI session detectors and their lifecycle.
 *
 * CliManager owns the Claude Code and Copilot CLI detectors, their hook injectors,
 * and the Claude session registry. It provides a unified API so that SessionMonitor,
 * route handlers, and the server startup code never need to reference individual
 * detectors directly.
 *
 * Both detectors are push-based: scan() fires session lifecycle callbacks internally.
 * CliManager's three setters wire the same callback to both detectors.
 */
export class CliManager {
  private claudeDetector: ClaudeCodeDetector;
  private copilotDetector: CopilotCliDetector;
  private claudeInjector: ClaudeCodeHooksInjector;
  private copilotInjector: CopilotHooksInjector;

  constructor() {
    this.claudeDetector = new ClaudeCodeDetector();
    this.copilotDetector = new CopilotCliDetector();
    this.claudeInjector = new ClaudeCodeHooksInjector();
    this.copilotInjector = new CopilotHooksInjector();
  }

  /** Fires when either detector creates a new session. Must be called before start(). */
  setSessionCreatedCallback(cb: (session: Session) => void): void {
    this.claudeDetector.setSessionCreatedCallback(cb);
    this.copilotDetector.setSessionCreatedCallback(cb);
  }

  /** Fires when a session's state changes (Copilot only — Claude updates go through reconcileClaudeCodeSessions). Must be called before start(). */
  setSessionUpdatedCallback(cb: (session: Session) => void): void {
    this.copilotDetector.setSessionUpdatedCallback(cb);
  }

  /** Fires when either detector ends a session. Must be called before start(). */
  setSessionEndedCallback(cb: (session: Session) => void): void {
    this.claudeDetector.setSessionEndedCallback(cb);
    this.copilotDetector.setSessionEndedCallback(cb);
  }

  /**
   * Seeds Copilot tracking state with sessions that survived from a previous run.
   * Call before the first scan() to prevent duplicate session.created events for survivors.
   */
  seedCopilotState(sessions: Session[]): void {
    this.copilotDetector.seedState(sessions);
  }

  // --- Lifecycle ---

  /** Injects hooks into all registered repos/config files, then starts both detectors. */
  async start(): Promise<void> {
    this.claudeInjector.injectForAll();
    this.copilotInjector.injectForAll();
    await this.claudeDetector.start();
    await this.copilotDetector.start();
  }

  /** Stops both detectors and releases their resources. */
  stop(): void {
    this.claudeDetector.stop();
    this.copilotDetector.stop();
  }

  // --- Per-cycle scan ---

  /** Runs both CLI detector scans; each detector fires session lifecycle callbacks internally. */
  async scan(force = false): Promise<void> {
    await this.claudeDetector.scan();
    await this.copilotDetector.scan(force);
  }

  // --- Startup reconciliation data ---

  /** Returns the current Claude session registry entries (used at startup to reconcile stale sessions). */
  claudeRegistryEntries(): ClaudeSessionRegistryEntry[] {
    return this.claudeDetector.getRegistryEntries();
  }

  /** Returns the Copilot lock-file registry (session ID to PID) for startup reconciliation. */
  scanLockEntries(): Map<string, number> {
    return this.copilotDetector.scanLockEntries();
  }

  // --- Watcher management ---

  /** Closes the JSONL file watcher for a specific Claude session. */
  closeClaudeSessionWatcher(sessionId: string): void {
    this.claudeDetector.closeSessionWatcher(sessionId);
  }

  // --- Hook payload routing ---

  /** Dispatches an incoming Claude hook payload to the Claude detector. */
  async handleClaudeHookPayload(payload: CliHookPayload): Promise<void> {
    await this.claudeDetector.handleHookPayload(payload);
  }

  /** Dispatches an incoming Copilot hook payload to the Copilot detector. */
  async handleCopilotHookPayload(payload: CliHookPayload): Promise<void> {
    await this.copilotDetector.handleHookPayload(payload);
  }

  // --- Pending choice (for the send-prompt route) ---

  /** Returns the pending question for a session, checking both detectors. */
  getPendingChoice(sessionId: string): unknown {
    return this.claudeDetector.getPendingChoice(sessionId) ?? this.copilotDetector.getPendingChoice(sessionId);
  }

  /** Clears the pending choice for a session from both detectors. */
  clearPendingChoice(sessionId: string): void {
    this.claudeDetector.clearPendingChoice(sessionId);
    this.copilotDetector.clearPendingChoice(sessionId);
  }

  // --- Hook injection for individual repos ---

  /** Injects Copilot hooks into a newly registered repository. Claude hooks are global and do not need per-repo injection. */
  injectHooksForRepo(repoPath: string): void {
    this.copilotInjector.injectForRepo(repoPath);
  }

  /** Removes Copilot hooks from a repository being unregistered. */
  removeHooksForRepo(repoPath: string): void {
    this.copilotInjector.removeForRepo(repoPath);
  }

  /** Re-injects Claude hooks globally (e.g., after a new repo is added). */
  reinjectClaudeHooks(): void {
    this.claudeInjector.injectForAll();
  }

  /** Removes all Claude hooks (called when the last repository is removed). */
  removeAllClaudeHooks(): void {
    this.claudeInjector.removeAll();
  }

}
