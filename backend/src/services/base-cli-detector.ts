import { existsSync } from 'fs';
import type { Session, PendingChoice, SessionType, Repository, PidSource } from '../models/index.js';

/**
 * Common shape every detector's parsed source record carries. Concrete detectors
 * extend this with tool-specific extras (Copilot adds dirPath + workspace.yaml
 * fields; Claude carries no extras and just narrows pid to non-null).
 */
export interface SessionEntry {
  sessionId: string;
  cwd: string;
  pid: number | null;
}
import { broadcast } from '../api/ws/event-dispatcher.js';
import { pendingChoiceEvents } from './pending-choice-events.js';
import { updateSessionStatus, upsertSession, getRepositoryByPath, getSession } from '../db/database.js';
import { parsePendingChoicePayload } from './pending-choice-utils.js';
import { telemetryService } from './telemetry-service.js';
import { normalize } from 'path';
import { ptyRegistry } from './pty-registry.js';
import { detectYoloModeFromPids } from './process-utils.js';
import * as logger from '../utils/logger.js';
import { JsonlWatcherBase } from './jsonl-watcher-base.js';
import type { CliHookPayload } from './cli-detector.js';

/**
 * Shared state and behavior for all CLI session detectors.
 *
 * Defines the canonical scan pipeline (read → process → dispatch) so both Claude
 * and Copilot detectors share the same shape:
 *
 *   scan(force)
 *     → readSessionEntries(force)         // collect parsed entries from disk
 *     → processSessionEntry(entry) per item  // upsert DB row, return Session
 *     → dispatchSessionEvents(sessions)   // diff sigCache, fire callbacks
 *
 * TEntry is the per-detector parsed source record (Claude registry JSON entry,
 * Copilot session-dir entry, etc.) and is private to the concrete detector.
 */
export abstract class BaseCliDetector<TEntry extends SessionEntry = SessionEntry> {
  // Dedup map: last-emitted signature per session, used to avoid redundant callbacks.
  protected readonly sigCache = new Map<string, string>();
  protected readonly pendingChoices = new Map<string, PendingChoice>();
  protected sessionCreatedCallback?: (session: Session) => void;
  protected sessionUpdatedCallback?: (session: Session) => void;
  protected sessionEndedCallback?: (session: Session) => void;

  /** Root directory the detector watches for session sources. */
  protected abstract readonly sessionsDir: string;
  /** Per-detector JSONL watcher (Claude or Copilot). Holds all open file watchers. */
  protected abstract readonly jsonlWatcher: JsonlWatcherBase;
  protected abstract readonly logTag: string;
  /** Hook tool name used for AskUser events, e.g. 'AskUserQuestion' or 'ask_user'. */
  protected abstract readonly askUserToolName: string;
  /** Session type identifier used for PTY registry and session rows. */
  protected abstract readonly toolTypeId: SessionType;

  /** Read parsed entries from the source (session files, session dirs, etc.). */
  protected abstract readSessionEntries(force: boolean): Promise<TEntry[]>;
  /** Process one entry: apply guards, resolve PTY linkage, upsert the session row. */
  protected abstract processSessionEntry(entry: TEntry): Promise<Session | null>;
  /** Diff against sigCache and fire session.created/updated/ended callbacks. */
  protected abstract dispatchSessionEvents(sessions: Session[]): void;

  /**
   * Start watching a session's JSONL output file. Delegates to the detector's watcher.
   * The path argument is detector-specific: Claude expects a repoPath (used to derive
   * the per-session JSONL path), Copilot expects the session dirPath.
   */
  protected watchJsonlFile(sessionId: string, path: string): Promise<void> {
    return this.jsonlWatcher.watchFile(sessionId, path);
  }

  /** Close one session's JSONL watcher. Delegates to the detector's watcher. */
  protected closeJsonlWatcher(sessionId: string): void {
    this.jsonlWatcher.closeWatcher(sessionId);
  }

  /** Server shutdown: release all file watchers held by this detector. */
  stop(): void {
    this.jsonlWatcher.stopWatchers();
  }

  /**
   * Shared sigCache-diff loop used by every detector's dispatchSessionEvents.
   * Fires sessionCreatedCallback for sessions not yet in sigCache, and
   * sessionUpdatedCallback when the signature changed since last cycle.
   *
   * Detectors layer their own pre-step (disappearance detection) and post-step
   * (Claude's reconcile, Copilot's ended one-shot) around this primitive.
   */
  protected fireCreatedAndUpdated(sessions: Session[]): void {
    for (const session of sessions) {
      const sig = this.sessionSignature(session);
      if (!this.sigCache.has(session.id)) {
        this.sigCache.set(session.id, sig);
        this.sessionCreatedCallback?.(session);
      } else if (this.sigCache.get(session.id) !== sig) {
        this.sigCache.set(session.id, sig);
        this.sessionUpdatedCallback?.(session);
      }
    }
  }

  /**
   * Per-cycle scan orchestrator. Reads entries, processes each, dispatches events.
   * Concrete detectors implement the three abstract steps. force=true bypasses
   * any caching the read step may apply (e.g. Copilot's mtime filter).
   */
  async scan(force = false): Promise<Session[]> {
    if (!existsSync(this.sessionsDir)) return [];
    const entries = await this.readSessionEntries(force);
    const sessions: Session[] = [];
    for (const entry of entries) {
      const session = await this.processSessionEntry(entry);
      if (session !== null) sessions.push(session);
    }
    this.dispatchSessionEvents(sessions);
    return sessions;
  }

  /**
   * Determines the PTY linkage state for a session this scan cycle.
   *
   * Branches:
   * - alreadyClaimed (existing.launchMode='pty'): preserve PTY metadata. Apply
   *   disk-wins PID correction when the on-disk PID disagrees with the stored value.
   *   Never re-link a new launcher to a PTY whose original WS has dropped: a fresh
   *   launcher is a fresh CLI process and binding it to the old sessionId would
   *   route prompts to the wrong process.
   * - registryHas: ptyRegistry already knows this sessionId but the DB has not yet
   *   recorded launchMode='pty'. Mark as PTY using the parked pid + ptyLaunchId.
   * - fresh claim: brand-new running session with no DB row, attempt claimForSession
   *   against the pending launcher queue.
   * - default: not PTY. PID comes from disk with the detector-supplied pidSource.
   */
  protected resolvePtyLinkage(
    sessionId: string,
    existingSession: Session | null | undefined,
    repoPath: string,
    diskPid: number | null,
    defaultPidSource: PidSource,
    isRunning: boolean,
  ): {
    launchMode: 'pty' | null;
    pid: number | null;
    hostPid: number | null;
    pidSource: PidSource | null;
    ptyLaunchId: string | null;
    freshClaim: { pid: number | null; hostPid: number; ptyLaunchId: string } | null;
  } {
    const alreadyClaimed = existingSession?.launchMode === 'pty';
    const registryHas = ptyRegistry.has(sessionId);

    if (alreadyClaimed) {
      let pid = existingSession!.pid;
      let pidSource = existingSession!.pidSource;
      if (diskPid !== null && diskPid !== existingSession!.pid) {
        logger.warn(`${this.logTag} alreadyClaimed pid mismatch: disk=${diskPid} stored=${existingSession!.pid} sessionId=${sessionId} — correcting to disk pid`);
        pid = diskPid;
        pidSource = defaultPidSource;
      }
      if (!registryHas && isRunning) {
        logger.info(`${this.logTag} alreadyClaimed + WS gone — keeping existing PTY metadata, not re-linking sessionId=${sessionId}`);
      }
      return {
        launchMode: 'pty',
        pid,
        hostPid: existingSession!.hostPid,
        pidSource,
        ptyLaunchId: existingSession!.ptyLaunchId ?? null,
        freshClaim: null,
      };
    }

    if (registryHas) {
      logger.info(`${this.logTag} ptyRegistry already has sessionId=${sessionId} — marking pty`);
      const parkedPid = ptyRegistry.getClaimedPid(sessionId);
      return {
        launchMode: 'pty',
        pid: parkedPid ?? diskPid,
        hostPid: existingSession?.hostPid ?? null,
        pidSource: 'pty_registry',
        ptyLaunchId: existingSession?.ptyLaunchId ?? ptyRegistry.getPtyLaunchIdForSession(sessionId) ?? null,
        freshClaim: null,
      };
    }

    if (isRunning && !existingSession) {
      const claimed = ptyRegistry.claimForSession(sessionId, repoPath, this.toolTypeId);
      if (claimed) {
        logger.info(`${this.logTag} claimForSession OK sessionId=${sessionId} hostPid=${claimed.hostPid} pid=${claimed.pid}`);
        return {
          launchMode: 'pty',
          pid: claimed.pid,
          hostPid: claimed.hostPid,
          pidSource: 'pty_registry',
          ptyLaunchId: claimed.ptyLaunchId,
          freshClaim: claimed,
        };
      }
    }

    return {
      launchMode: null,
      pid: diskPid,
      hostPid: null,
      pidSource: diskPid != null ? defaultPidSource : null,
      ptyLaunchId: null,
      freshClaim: null,
    };
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
   * Builds and persists a fresh PTY-bound session row. Watches its JSONL output.
   * Returns the persisted Session. Does not fire callbacks — caller decides
   * (hook path fires immediately, scan path defers to dispatchSessionEvents).
   */
  protected async createPtySession(sessionId: string, repo: Repository, claimed: { pid: number | null; hostPid: number; ptyLaunchId: string }, now: string): Promise<Session> {
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
    await this.watchJsonlFile(sessionId, repo.path);
    return session;
  }

  /**
   * Builds or refreshes an active session row in response to a hook event.
   * Returns the persisted Session. Does not fire callbacks — caller decides.
   */
  protected async upsertActiveSession(sessionId: string, repo: Repository, existing: Session | null | undefined, now: string): Promise<Session> {
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
    await this.watchJsonlFile(sessionId, repo.path);
    return updated;
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
        const session = await this.createPtySession(session_id, repo, claimed, now);
        this.sigCache.set(session.id, this.sessionSignature(session));
        this.sessionCreatedCallback?.(session);
        return;
      }
    }

    const session = await this.upsertActiveSession(session_id, repo, existing, now);
    this.sigCache.set(session.id, this.sessionSignature(session));
    if (existing) {
      broadcast({ type: 'session.updated', timestamp: now, data: session });
    } else {
      this.sessionCreatedCallback?.(session);
    }
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
