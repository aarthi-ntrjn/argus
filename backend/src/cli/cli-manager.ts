import { ClaudeCodeDetector } from './claude-code/claude-code-detector.js';
import { CopilotCliDetector } from './copilot-cli/copilot-cli-detector.js';
import { ClaudeCodeHooksInjector } from './claude-code/claude-code-hooks-injector.js';
import { CopilotHooksInjector } from './copilot-cli/copilot-cli-hooks-injector.js';
import type { Session } from '../models/index.js';
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

  /** Fires when a session's state changes. Must be called before start(). */
  setSessionUpdatedCallback(cb: (session: Session) => void): void {
    this.claudeDetector.setSessionUpdatedCallback(cb);
    this.copilotDetector.setSessionUpdatedCallback(cb);
  }

  /** Fires when either detector ends a session. Must be called before start(). */
  setSessionEndedCallback(cb: (session: Session) => void): void {
    this.claudeDetector.setSessionEndedCallback(cb);
    this.copilotDetector.setSessionEndedCallback(cb);
  }

  /**
   * Seeds both detectors' tracking state with sessions that survived from a previous run.
   * Call before the first scan() to prevent duplicate or spurious events for survivors.
   */
  seedState(sessions: Session[]): void {
    this.claudeDetector.seedState(sessions);
    this.copilotDetector.seedState(sessions);
  }

  // --- Lifecycle ---

  /** Injects hooks into all registered repos/config files. Detector state is initialized by the first scan(true). */
  start(): void {
    this.claudeInjector.injectForAll();
    this.copilotInjector.injectForAll();
  }

  /** Stops both detectors and releases their resources. */
  stop(): void {
    this.claudeDetector.stop();
    this.copilotDetector.stop();
  }

  // --- Per-cycle scan ---

  /** Runs both CLI detector scans; each detector fires session lifecycle callbacks internally. */
  async scan(force = false): Promise<void> {
    await this.claudeDetector.scan(force);
    await this.copilotDetector.scan(force);
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
    return (
      this.claudeDetector.getPendingChoice(sessionId) ??
      this.copilotDetector.getPendingChoice(sessionId)
    );
  }

  /** Clears the pending choice for a session from both detectors. */
  clearPendingChoice(sessionId: string): void {
    this.claudeDetector.clearPendingChoice(sessionId);
    this.copilotDetector.clearPendingChoice(sessionId);
  }

  // --- Hook injection for individual repos ---

  /** Injects hooks for a newly registered repository into both injectors. */
  injectHooksForRepo(repoPath: string): void {
    this.claudeInjector.injectForRepo(repoPath);
    this.copilotInjector.injectForRepo(repoPath);
  }

  /** Removes hooks for a repository being unregistered from both injectors. */
  removeHooksForRepo(repoPath: string): void {
    this.claudeInjector.removeForRepo(repoPath);
    this.copilotInjector.removeForRepo(repoPath);
  }

  /** Removes all hooks from both injectors (called when the last repository is removed). */
  removeAllHooks(): void {
    this.claudeInjector.removeAll();
    this.copilotInjector.removeAll();
  }
}
