import type { Session, PendingChoice, SessionType, Repository } from '../models/index.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { pendingChoiceEvents } from './pending-choice-events.js';
import { updateSessionStatus, upsertSession, getRepositoryByPath, getSession } from '../db/database.js';
import { parsePendingChoicePayload } from './pending-choice-utils.js';
import { telemetryService } from './telemetry-service.js';
import { normalize } from 'path';
import { ptyRegistry } from './pty-registry.js';
import { detectYoloModeFromPids } from './process-utils.js';
import * as logger from '../utils/logger.js';
import type { CliHookPayload } from './cli-detector.js';

/**
 * Shared state and behavior for all CLI session detectors.
 *
 * Provides:
 * - sigCache: change-detection fingerprint map (sessionId -> JSON signature)
 * - pendingChoices: in-flight AskUser prompts waiting for a response
 * - Callback setters for session lifecycle events
 * - getPendingChoice() / clearPendingChoice() accessors
 * - sessionSignature() fingerprint helper
 *
 * Concrete detectors extend this class and implement the CliDetector interface.
 */
export abstract class BaseCliDetector {
  // Dedup map: last-emitted signature per session, used to avoid redundant callbacks.
  protected readonly sigCache = new Map<string, string>();
  protected readonly pendingChoices = new Map<string, PendingChoice>();
  protected sessionCreatedCallback?: (session: Session) => void;
  protected sessionUpdatedCallback?: (session: Session) => void;
  protected sessionEndedCallback?: (session: Session) => void;

  /** Close the JSONL output watcher for the given session. */
  protected abstract closeJsonlWatcher(sessionId: string): void;
  /** Start watching the JSONL output file for the given session. */
  protected abstract watchJsonlFile(sessionId: string, repoPath: string): Promise<void>;
  /**
   * Synchronously reads session process entries from disk.
   * Used by getSessionPidMap() for startup stale-session reconciliation.
   * Each subclass reads from its own on-disk format (JSON files or YAML dirs).
   */
  protected abstract readSessionPidEntries(): Iterable<{ sessionId: string; pid: number }>;

  /** Log tag prefix for this detector, e.g. '[ClaudeDetector]'. */
  protected abstract readonly logTag: string;
  /** Hook tool name used for AskUser events, e.g. 'AskUserQuestion' or 'ask_user'. */
  protected abstract readonly askUserToolName: string;
  /** Session type identifier used for PTY registry and session rows. */
  protected abstract readonly toolTypeId: SessionType;

  /**
   * Returns a sessionId-to-PID map for startup stale-session reconciliation only.
   * Delegates discovery to readSessionPidEntries() so each subclass can use its
   * own on-disk format without duplicating the map-building logic.
   */
  getSessionPidMap(): Map<string, number> {
    const result = new Map<string, number>();
    for (const entry of this.readSessionPidEntries()) {
      result.set(entry.sessionId, entry.pid);
    }
    return result;
  }

  /**
   * Seeds tracking state with sessions that survived from a previous run.
   * Filters to only this detector's session type using toolTypeId.
   * Call before the first scan() to prevent spurious created/updated events on startup.
   */
  seedState(sessions: Session[]): void {
    for (const session of sessions) {
      if (session.type !== this.toolTypeId) continue;
      this.sigCache.set(session.id, this.sessionSignature(session));
    }
  }

  /**
   * Creates a new session linked to a PTY launcher (terminal tab in Argus UI).
   * Called when a PTY claim succeeds from a hook event (or scan, for Claude).
   */
  protected async createPtySession(sessionId: string, repo: Repository, claimed: { pid: number | null; hostPid: number; ptyLaunchId: string }, now: string): Promise<void> {
    const yoloMode = detectYoloModeFromPids(claimed.pid, claimed.hostPid, this.toolTypeId);
    const session: Session = {
      id: sessionId,
      repositoryId: repo.id,
      type: this.toolTypeId,
      launchMode: 'pty',
      pid: claimed.pid,
      hostPid: claimed.hostPid,
      pidSource: 'pty_registry',
      status: 'active',
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
      reconciled: true,
      yoloMode,
      ptyLaunchId: claimed.ptyLaunchId,
    };
    upsertSession(session);
    this.sigCache.set(session.id, this.sessionSignature(session));
    this.sessionCreatedCallback?.(session);
    await this.watchJsonlFile(sessionId, repo.path);
  }

  /**
   * Creates or updates a session in response to a hook event.
   * On first event: fires sessionCreatedCallback (seeds sigCache).
   * On subsequent events: updates sigCache and broadcasts session.updated.
   */
  protected async upsertAndBroadcastSession(sessionId: string, repo: Repository, existing: Session | null | undefined, now: string): Promise<void> {
    const session: Session = existing ?? {
      id: sessionId,
      repositoryId: repo.id,
      type: this.toolTypeId,
      launchMode: null,
      pid: null,
      hostPid: null,
      pidSource: null,
      status: 'active',
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
      reconciled: true,
      yoloMode: null,
    };
    const updated = { ...session, status: 'active' as const, lastActivityAt: now };
    upsertSession(updated);
    this.sigCache.set(updated.id, this.sessionSignature(updated));
    if (existing) {
      broadcast({ type: 'session.updated', timestamp: now, data: updated });
    } else {
      this.sessionCreatedCallback?.(updated);
    }
    await this.watchJsonlFile(sessionId, repo.path);
  }

  setSessionCreatedCallback(cb: (session: Session) => void): void {
    this.sessionCreatedCallback = cb;
  }

  setSessionUpdatedCallback(cb: (session: Session) => void): void {
    this.sessionUpdatedCallback = cb;
  }

  setSessionEndedCallback(cb: (session: Session) => void): void {
    this.sessionEndedCallback = cb;
  }

  getPendingChoice(sessionId: string): PendingChoice | null {
    return this.pendingChoices.get(sessionId) ?? null;
  }

  clearPendingChoice(sessionId: string): void {
    if (!this.pendingChoices.has(sessionId)) return;
    this.pendingChoices.delete(sessionId);
    const now = new Date().toISOString();
    broadcast({ type: 'session.pending_choice.resolved', timestamp: now, data: { sessionId } });
    pendingChoiceEvents.emit('session.pending_choice.resolved', sessionId);
  }

  protected sessionSignature(session: Session): string {
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

  /**
   * Primary real-time update path. Called for every hook event the AI tool fires.
   *
   * Routes by event name:
   * - SessionEnd: mark ended, close JSONL watcher, fire sessionEndedCallback.
   * - PreToolUse / PostToolUse (ask user): manage pending-choice state.
   * - All others: upsert session in DB, fire sessionCreatedCallback on first event or
   *   broadcast session.updated on subsequent events.
   */
  async handleHookPayload(payload: CliHookPayload): Promise<void> {
    const { hook_event_name, session_id, cwd } = payload;
    if (!session_id) return;

    const normalizedCwd = cwd ? normalize(cwd.trimEnd().replace(/[/\\]+$/, '')) : null;
    const repo = normalizedCwd ? getRepositoryByPath(normalizedCwd) : null;
    if (!repo) {
      logger.warn(`${this.logTag} no repo for cwd="${normalizedCwd ?? 'none'}" sessionId=${session_id} hook=${hook_event_name} — hook ignored`);
      return;
    }

    const existing = getSession(session_id);
    const now = new Date().toISOString();

    if (hook_event_name === 'SessionEnd') {
      return this.handleSessionEnd(existing, session_id, now);
    }
    if (hook_event_name === 'PreToolUse' && payload.tool_name === this.askUserToolName) {
      return this.handlePreAskQuestion(session_id, existing, payload, now);
    }
    if (hook_event_name === 'PostToolUse' && payload.tool_name === this.askUserToolName) {
      return this.handlePostAskQuestion(session_id, existing, now);
    }

    if (!existing) {
      const claimed = normalizedCwd ? ptyRegistry.claimForSession(session_id, normalizedCwd, this.toolTypeId) : null;
      if (claimed) {
        return this.createPtySession(session_id, repo, claimed, now);
      }
    }

    await this.upsertAndBroadcastSession(session_id, repo, existing, now);
  }

  protected handleSessionEnd(existing: Session | null | undefined, sessionId: string, now: string): void {
    if (!existing) return;
    updateSessionStatus(sessionId, 'ended', now);
    this.closeJsonlWatcher(sessionId);
    const ended = { ...existing, status: 'ended' as const, endedAt: now };
    this.sigCache.delete(sessionId);
    this.pendingChoices.delete(sessionId);
    broadcast({ type: 'session.ended', timestamp: now, data: ended });
    telemetryService.sendEvent('session_ended', {
      sessionType: existing.type,
      sessionId: existing.id,
      launchMode: existing.launchMode === 'pty' ? 'connected' : 'readonly',
      yoloMode: existing.yoloMode,
    });
  }

  protected handlePreAskQuestion(sessionId: string, existing: Session | null | undefined, payload: CliHookPayload, now: string): void {
    if (!existing) return;
    const { question, choices, allQuestions } = parsePendingChoicePayload(payload.tool_input ?? {});
    this.pendingChoices.set(sessionId, { question, choices, allQuestions });
    broadcast({ type: 'session.pending_choice', timestamp: now, data: { sessionId, question, choices, allQuestions } });
    pendingChoiceEvents.emit('session.pending_choice', { sessionId, question, choices, allQuestions });
  }

  protected handlePostAskQuestion(sessionId: string, existing: Session | null | undefined, now: string): void {
    if (!existing) return;
    this.pendingChoices.delete(sessionId);
    broadcast({ type: 'session.pending_choice.resolved', timestamp: now, data: { sessionId } });
    pendingChoiceEvents.emit('session.pending_choice.resolved', sessionId);
  }
}
