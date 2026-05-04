import type { Session, PendingChoice } from '../models/index.js';

/**
 * Shared state and behavior for all CLI session detectors.
 *
 * Provides:
 * - sigCache: change-detection fingerprint map (sessionId -> JSON signature)
 * - pendingChoices: in-flight AskUser prompts waiting for a response
 * - Callback setters for session lifecycle events
 * - getPendingChoice() accessor
 * - sessionSignature() fingerprint helper
 *
 * Concrete detectors extend this class and implement the CliDetector interface.
 * clearPendingChoice() is NOT here because each detector broadcasts differently.
 */
export abstract class BaseCliDetector {
  // Dedup map: last-emitted signature per session, used to avoid redundant callbacks.
  protected readonly sigCache = new Map<string, string>();
  protected readonly pendingChoices = new Map<string, PendingChoice>();
  protected sessionCreatedCallback?: (session: Session) => void;
  protected sessionUpdatedCallback?: (session: Session) => void;
  protected sessionEndedCallback?: (session: Session) => void;

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
}
