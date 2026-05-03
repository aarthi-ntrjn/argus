import { ClaudeCodeDetector } from './claude-code-detector.js';
import { CopilotCliDetector } from './copilot-cli-detector.js';
import { ClaudeCodeHooksInjector } from './claude-code-hooks-injector.js';
import { CopilotHooksInjector } from './copilot-cli-hooks-injector.js';
import { getSession, updateSessionStatus } from '../db/database.js';
import type { Session, ClaudeSessionRegistryEntry } from '../models/index.js';
import type { CliHookPayload } from './cli-detector.js';

export interface CopilotSessionCallbacks {
  onCreated: (session: Session) => void;
  onUpdated: (session: Session) => void;
  onEnded: (session: Session) => void;
}

/**
 * Single point of ownership for all CLI session detectors and their lifecycle.
 *
 * CliManager owns the Claude Code and Copilot CLI detectors, their hook injectors,
 * and the Claude session registry. It provides a unified API so that SessionMonitor,
 * route handlers, and the server startup code never need to reference individual
 * detectors directly.
 */
export class CliManager {
  private claudeDetector: ClaudeCodeDetector;
  private copilotDetector: CopilotCliDetector;
  private claudeInjector: ClaudeCodeHooksInjector;
  private copilotInjector: CopilotHooksInjector;

  // Copilot session tracking state (mirrors what was in SessionMonitor's runScan loop)
  private copilotKnownIds = new Set<string>();
  private copilotSigCache = new Map<string, string>();
  private copilotActiveMap = new Map<string, Session>();
  private copilotCallbacks: CopilotSessionCallbacks | null = null;

  constructor() {
    this.claudeDetector = new ClaudeCodeDetector();
    this.copilotDetector = new CopilotCliDetector();
    this.claudeInjector = new ClaudeCodeHooksInjector();
    this.copilotInjector = new CopilotHooksInjector();
  }

  /**
   * Wires the callback that fires when Claude creates a new session via a hook event.
   * Must be called before start().
   */
  setSessionCreatedCallback(cb: (session: Session) => void): void {
    this.claudeDetector.setSessionCreatedCallback(cb);
  }

  /**
   * Wires the callback that fires when a Claude session ends (registry file disappeared).
   * Must be called before start().
   */
  setClaudeSessionEndedCallback(cb: (session: Session) => void): void {
    this.claudeDetector.setSessionEndedCallback(cb);
  }

  /**
   * Registers callbacks for Copilot session lifecycle events fired during scan().
   * Must be called before start().
   */
  setCopilotSessionCallbacks(cbs: CopilotSessionCallbacks): void {
    this.copilotCallbacks = cbs;
  }

  /**
   * Seeds Copilot tracking state with sessions that survived from a previous run.
   * Call before the first scan() to prevent duplicate session.created events for survivors.
   */
  seedCopilotState(sessions: Session[]): void {
    for (const session of sessions) {
      this.copilotKnownIds.add(session.id);
      this.copilotSigCache.set(session.id, this.sessionSignature(session));
      if (session.status === 'active') this.copilotActiveMap.set(session.id, session);
    }
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

  /** Runs all CLI detector scans and fires Copilot session lifecycle callbacks for any changes. */
  async scan(force = false): Promise<void> {
    await this.claudeDetector.scan();
    this.processCopilotSessions(await this.copilotDetector.scan(force));
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

  // --- Internal: Copilot session lifecycle processing ---

  private sessionSignature(session: Session): string {
    return JSON.stringify({
      status: session.status,
      lastActivityAt: session.lastActivityAt,
      summary: session.summary,
      model: session.model,
      pid: session.pid,
      hostPid: session.hostPid,
      pidSource: session.pidSource,
      launchMode: session.launchMode,
      endedAt: session.endedAt,
    });
  }

  private processCopilotSessions(sessions: Session[]): void {
    const currentIds = new Set(sessions.map(s => s.id));
    const now = new Date().toISOString();

    // Detect sessions that dropped off the scan (process exited and workspace dir cleaned up)
    for (const [id, session] of this.copilotActiveMap) {
      if (!currentIds.has(id)) {
        // Another code path (PTY dismiss, etc.) may have already marked it ended.
        const stored = getSession(id);
        if (stored?.status !== 'ended') {
          updateSessionStatus(id, 'ended', now);
          this.copilotCallbacks?.onEnded({ ...session, status: 'ended', endedAt: now });
        }
        this.copilotActiveMap.delete(id);
        this.copilotSigCache.delete(id);
      }
    }

    for (const session of sessions) {
      if (!this.copilotKnownIds.has(session.id)) {
        this.copilotKnownIds.add(session.id);
        this.copilotSigCache.set(session.id, this.sessionSignature(session));
        this.copilotCallbacks?.onCreated(session);
      } else {
        const sig = this.sessionSignature(session);
        if (this.copilotSigCache.get(session.id) !== sig) {
          this.copilotSigCache.set(session.id, sig);
          this.copilotCallbacks?.onUpdated(session);
        }
      }

      if (session.status === 'ended') {
        // Only fire onEnded once — ended sessions remain on disk and re-appear on every scan.
        if (this.copilotActiveMap.has(session.id)) {
          this.copilotCallbacks?.onEnded(session);
          this.copilotActiveMap.delete(session.id);
          this.copilotSigCache.delete(session.id);
        }
      } else if (session.status === 'active') {
        this.copilotActiveMap.set(session.id, session);
      }
    }
  }
}
