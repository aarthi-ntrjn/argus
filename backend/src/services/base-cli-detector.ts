import type { Session, PendingChoice } from '../models/index.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { pendingChoiceEvents } from './pending-choice-events.js';
import { updateSessionStatus } from '../db/database.js';
import { parsePendingChoicePayload } from './pending-choice-utils.js';
import { telemetryService } from './telemetry-service.js';
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

  /**
   * Called at the end of handleSessionEnd() for subclass-specific cleanup.
   * Override to remove the session from any local tracking maps.
   */
  protected onSessionEndedCleanup(_sessionId: string): void {}

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
    this.onSessionEndedCleanup(sessionId);
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
