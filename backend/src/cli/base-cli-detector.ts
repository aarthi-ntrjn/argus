import { existsSync } from 'fs';
import type {
  Session,
  PendingChoice,
  SessionType,
  Repository,
  PidSource,
} from '../models/index.js';

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
import {
  updateSessionStatus,
  upsertSession,
  getRepositoryByPath,
  getSession,
} from '../db/database.js';
import { parsePendingChoicePayload, buildToolApprovalChoice, isClaudeReadOnlyBashCommand } from './pending-choice-utils.js';
import { telemetryService } from '../services/telemetry-service.js';
import { ptyRegistry } from '../launch-pty/pty-registry.js';
import { detectYoloModeFromPids, isPidRunning, isExpectedProcess } from '../utils/process-utils.js';
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
  // Timers that delay broadcasting tool-approval pending choices. If PostToolUse
  // arrives before a timer fires, the choice was auto-approved by a permission rule
  // and the timer is cancelled — no UI is ever shown.
  private readonly pendingApprovalTimers = new Map<string, ReturnType<typeof setTimeout>>();
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

  /**
   * Default pid source label for disk-sourced pids (used when no PTY is involved).
   * Claude: 'session_registry'. Copilot: 'lockfile'.
   */
  protected abstract readonly defaultPidSource: PidSource;

  /** Read parsed entries from the source (session files, session dirs, etc.). */
  protected abstract readSessionEntries(force: boolean): Promise<TEntry[]>;

  /**
   * Returns the path argument to pass to watchJsonlFile for a given entry.
   * Claude passes repo.path (the watcher derives the JSONL path from it).
   * Copilot passes entry.dirPath (the session directory containing events.jsonl).
   */
  protected abstract resolveWatchPath(entry: TEntry, repo: Repository): string;

  /**
   * Returns the three session fields that differ between detectors for the
   * reactivation/new-session path (path 4 in buildSessionFromEntry).
   * Called only when no fast-path applied (no fresh PTY claim, session not
   * currently active, PTY launcher still present or session is non-PTY).
   */
  protected abstract buildNewSessionFields(
    entry: TEntry,
    existingSession: Session | null | undefined,
    now: string,
  ): { startedAt: string; lastActivityAt: string; summary: string | null };

  /** Diff against sigCache and fire session.created/updated/ended callbacks. */
  protected abstract dispatchSessionEvents(sessions: Session[]): void;

  /** Optional hook: called for every entry that passed the alive check, before the repo filter. */
  protected onAliveEntry(_entry: TEntry): void {}
  /** Optional hook: called after buildSessionFromEntry returns, for post-build bookkeeping. */
  protected onSessionBuilt(_entry: TEntry, _session: Session | null): void {}

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
        const prev = this.sigCache.get(session.id)!;
        this.sigCache.set(session.id, sig);
        logger.info(
          `${this.logTag} session.updated sessionId=${session.id} changed=${this.signatureDiff(prev, sig)}`,
        );
        this.sessionUpdatedCallback?.(session);
      }
    }
  }

  /**
   * Scan-detected end-of-session: marks the session ended in the DB, closes its
   * JSONL watcher, clears the sigCache entry, and fires sessionEndedCallback.
   * Hook-driven ends go through handleSessionEnd instead (which broadcasts +
   * sends telemetry rather than firing the callback).
   */
  protected markSessionEnded(session: Session, now: string, reason: string): void {
    const pidSuffix = session.pid != null ? ` pid=${session.pid}` : '';
    logger.info(`${this.logTag} session ended, ${reason} sessionId=${session.id}${pidSuffix}`);
    updateSessionStatus(session.id, 'ended', now);
    this.closeJsonlWatcher(session.id);
    this.sigCache.delete(session.id);
    this.sessionEndedCallback?.({ ...session, status: 'ended' as const, endedAt: now });
  }

  /** Logs the "no repo for this cwd" warning used by both detectors' buildSessionFromEntry. */
  protected warnNoRepo(cwd: string, sessionId: string): void {
    logger.warn(`${this.logTag} no repo for cwd="${cwd}" sessionId=${sessionId} — session ignored`);
  }

  /**
   * Repo lookup helper for buildSessionFromEntry. Returns the matching
   * Repository, or null after logging the "no repo" warning so the caller
   * can early-return without repeating the same boilerplate.
   */
  protected resolveRepoOrWarn(entry: SessionEntry): Repository | null {
    const repo = getRepositoryByPath(entry.cwd);
    if (!repo) {
      this.warnNoRepo(entry.cwd, entry.sessionId);
      return null;
    }
    return repo;
  }

  /**
   * Liveness + identity check: returns true only when the pid is alive AND the
   * process at that pid is actually this detector's AI tool. Logs a "PID reuse
   * detected" warning when the pid is alive but the process is something else
   * (stale on-disk source pointing at a recycled OS pid).
   */
  protected isExpectedProcessAlive(pid: number | null, sessionId: string): boolean {
    if (pid === null) {
      return false;
    }
    if (!isPidRunning(pid)) {
      return false;
    }
    if (!isExpectedProcess(pid, this.toolTypeId)) {
      logger.info(
        `${this.logTag} PID reuse detected: pid ${pid} is running with wrong name, skipping (sessionId=${sessionId})`,
      );
      return false;
    }
    return true;
  }

  /**
   * Per-cycle scan orchestrator. Reads entries, filters out entries whose source
   * process isn't alive (or is the wrong process via PID reuse), processes the
   * survivors, then dispatches events. Sessions whose source died are ended via
   * dispatchSessionEvents' dropped-off detection.
   *
   * force=true bypasses any caching the read step may apply (e.g. Copilot's
   * mtime filter).
   *
   * Logs an info-level "slow processSessionEntry" line when a single entry
   * takes more than 50ms, and a warn-level "slow scan" line when the whole
   * cycle does.
   */
  async scan(force = false): Promise<Session[]> {
    if (!existsSync(this.sessionsDir)) {
      return [];
    }
    const scanStart = Date.now();
    const entries = await this.readSessionEntries(force);
    const sessions: Session[] = [];
    for (const entry of entries) {
      const entryStart = Date.now();
      let session: Session | null = null;
      if (this.isExpectedProcessAlive(entry.pid, entry.sessionId)) {
        this.onAliveEntry(entry);
        const repo = this.resolveRepoOrWarn(entry);
        if (repo) {
          session = await this.buildSessionFromEntry(entry, repo);
          this.onSessionBuilt(entry, session);
        }
      }
      const entryMs = Date.now() - entryStart;
      if (entryMs > 50) {
        logger.warn(
          `${this.logTag} slow processSessionEntry (${entryMs}ms): sessionType=${this.toolTypeId} sessionId=${entry.sessionId} pid=${entry.pid}`,
        );
      }
      if (session !== null) {
        sessions.push(session);
      }
    }
    this.dispatchSessionEvents(sessions);
    const scanMs = Date.now() - scanStart;
    if (scanMs > 50) {
      logger.warn(
        `${this.logTag} slow scan (${scanMs}ms): entries=${entries.length} sessions=${sessions.length}`,
      );
    }
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
        logger.warn(
          `${this.logTag} alreadyClaimed pid mismatch: disk=${diskPid} stored=${existingSession!.pid} sessionId=${sessionId} — correcting to disk pid`,
        );
        pid = diskPid;
        pidSource = defaultPidSource;
      }
      if (!registryHas && isRunning) {
        logger.info(
          `${this.logTag} alreadyClaimed + WS gone — keeping existing PTY metadata, not re-linking sessionId=${sessionId}`,
        );
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
        ptyLaunchId:
          existingSession?.ptyLaunchId ?? ptyRegistry.getPtyLaunchIdForSession(sessionId) ?? null,
        freshClaim: null,
      };
    }

    if (isRunning && !existingSession) {
      const claimed = ptyRegistry.claimForSession(sessionId, repoPath, this.toolTypeId);
      if (claimed) {
        logger.info(
          `${this.logTag} claimForSession OK sessionId=${sessionId} hostPid=${claimed.hostPid} pid=${claimed.pid}`,
        );
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
      if (session.type !== this.toolTypeId) {
        continue;
      }
      this.sigCache.set(session.id, this.sessionSignature(session));
    }
  }

  /**
   * Shared scan-path session builder. Called for every entry that passed the alive
   * check and resolved to a registered repo. Handles four cases in order:
   *
   * 1. Fresh PTY claim: brand-new session claimed by a waiting PTY launcher.
   * 2. Already active: update pid/yoloMode only when something changed.
   * 3. Dead PTY launcher: skip re-activation to avoid routing prompts to
   *    the wrong process (a fresh launcher is a new CLI process).
   * 4. New or ended session: (re)activate using disk data via buildNewSessionFields.
   *
   * Detectors no longer override this; they only supply the three small abstracts
   * (defaultPidSource, resolveWatchPath, buildNewSessionFields) that encode the
   * fields that genuinely differ between Claude and Copilot.
   */
  protected async buildSessionFromEntry(entry: TEntry, repo: Repository): Promise<Session | null> {
    const now = new Date().toISOString();
    const existingSession = getSession(entry.sessionId);
    const linkage = this.resolvePtyLinkage(
      entry.sessionId,
      existingSession,
      repo.path,
      entry.pid,
      this.defaultPidSource,
      true,
    );
    const watchPath = this.resolveWatchPath(entry, repo);

    if (!existingSession && linkage.freshClaim) {
      logger.info(
        `${this.logTag} session activated via PTY claim sessionId=${entry.sessionId} hostPid=${linkage.freshClaim.hostPid} pid=${linkage.freshClaim.pid}`,
      );
      return this.createPtySession(entry.sessionId, repo, linkage.freshClaim, now, watchPath);
    }

    if (existingSession?.status === 'active') {
      const yoloMode =
        existingSession.yoloMode !== null
          ? existingSession.yoloMode
          : detectYoloModeFromPids(linkage.pid, linkage.hostPid, this.toolTypeId);
      const pidChanged =
        existingSession.pid !== linkage.pid || existingSession.pidSource !== linkage.pidSource;
      const yoloResolved = existingSession.yoloMode === null && yoloMode !== null;
      let session = existingSession;
      if (pidChanged || yoloResolved) {
        logger.info(
          `${this.logTag} pid assigned sessionId=${entry.sessionId} pid=${linkage.pid} (was ${existingSession.pid}) yoloMode=${yoloMode}`,
        );
        session = { ...existingSession, pid: linkage.pid, pidSource: linkage.pidSource, yoloMode };
        upsertSession(session);
      }
      await this.watchJsonlFile(entry.sessionId, watchPath);
      return session;
    }

    // Don't re-activate a PTY session whose launcher has already disconnected:
    // a fresh launcher would be a new CLI process and binding it to the old
    // sessionId would route prompts to the wrong process.
    if (existingSession?.launchMode === 'pty' && !ptyRegistry.has(entry.sessionId)) {
      logger.info(
        `${this.logTag} skipping re-activation — PTY launcher gone sessionId=${entry.sessionId}`,
      );
      return existingSession;
    }

    this.closeJsonlWatcher(entry.sessionId);
    const fields = this.buildNewSessionFields(entry, existingSession, now);
    const base: Session = existingSession ?? {
      id: entry.sessionId,
      repositoryId: repo.id,
      type: this.toolTypeId,
      launchMode: linkage.launchMode,
      pid: linkage.pid,
      hostPid: linkage.hostPid,
      pidSource: linkage.pidSource,
      status: 'active',
      endedAt: null,
      expiresAt: null,
      model: null,
      reconciled: true,
      yoloMode: linkage.pid
        ? detectYoloModeFromPids(linkage.pid, linkage.hostPid, this.toolTypeId)
        : null,
      ptyLaunchId: linkage.ptyLaunchId,
      ...fields,
    };
    const activated = {
      ...base,
      status: 'active' as const,
      endedAt: null as null,
      pid: linkage.pid,
      ...fields,
    };
    logger.info(`${this.logTag} session activated sessionId=${entry.sessionId} pid=${linkage.pid}`);
    upsertSession(activated);
    await this.watchJsonlFile(entry.sessionId, watchPath);
    return activated;
  }

  /**
   * Builds and persists a fresh PTY-bound session row. Watches its JSONL output.
   * Returns the persisted Session. Does not fire callbacks — caller decides
   * (hook path fires immediately, scan path defers to dispatchSessionEvents).
   *
   * watchPath is the path passed to watchJsonlFile. Scan-path callers supply
   * resolveWatchPath(entry, repo); hook-path callers omit it and fall back to
   * repo.path (acceptable — the file rarely exists yet when the first hook fires).
   */
  protected async createPtySession(
    sessionId: string,
    repo: Repository,
    claimed: { pid: number | null; hostPid: number; ptyLaunchId: string },
    now: string,
    watchPath?: string,
  ): Promise<Session> {
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
    await this.watchJsonlFile(sessionId, watchPath ?? repo.path);
    return session;
  }

  /**
   * Builds or refreshes an active session row in response to a hook event.
   * Returns the persisted Session. Does not fire callbacks — caller decides.
   */
  protected async upsertActiveSession(
    sessionId: string,
    repo: Repository,
    existing: Session | null | undefined,
    now: string,
  ): Promise<Session> {
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
    if (!this.pendingChoices.has(sessionId)) {
      return;
    }
    this.pendingChoices.delete(sessionId);
    const now = new Date().toISOString();
    broadcast({ type: 'session.pending_choice.resolved', timestamp: now, data: { sessionId } });
    pendingChoiceEvents.emit('session.pending_choice.resolved', sessionId);
  }

  protected sessionSignature(session: Session): string {
    return JSON.stringify({
      status: session.status,
      summary: session.summary,
      model: session.model,
      pid: session.pid,
      hostPid: session.hostPid,
      pidSource: session.pidSource,
      launchMode: session.launchMode,
      endedAt: session.endedAt,
    });
  }

  protected signatureDiff(prev: string, next: string): string {
    const a = JSON.parse(prev) as Record<string, unknown>;
    const b = JSON.parse(next) as Record<string, unknown>;
    return Object.keys(b)
      .filter((k) => a[k] !== b[k])
      .join(',');
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
    if (!session_id) {
      return;
    }

    const repo = cwd ? getRepositoryByPath(cwd) : null;
    if (!repo) {
      logger.warn(
        `${this.logTag} no repo for cwd="${cwd ?? 'none'}" sessionId=${session_id} hook=${hook_event_name} — hook ignored`,
      );
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
    if (
      hook_event_name === 'PreToolUse' &&
      payload.tool_name &&
      payload.tool_name !== this.askUserToolName
    ) {
      return this.handlePreToolApproval(session_id, existing, payload, now);
    }
    if (
      hook_event_name === 'PostToolUse' &&
      payload.tool_name &&
      payload.tool_name !== this.askUserToolName
    ) {
      return this.handlePostToolApproval(session_id, existing, now);
    }

    if (!existing) {
      const claimed = cwd ? ptyRegistry.claimForSession(session_id, cwd, this.toolTypeId) : null;
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

  protected handleSessionEnd(
    existing: Session | null | undefined,
    sessionId: string,
    now: string,
  ): void {
    if (!existing) {
      return;
    }
    updateSessionStatus(sessionId, 'ended', now);
    this.closeJsonlWatcher(sessionId);
    const ended = { ...existing, status: 'ended' as const, endedAt: now };
    this.sigCache.delete(sessionId);
    this.pendingChoices.delete(sessionId);
    const pendingTimer = this.pendingApprovalTimers.get(sessionId);
    if (pendingTimer !== undefined) {
      clearTimeout(pendingTimer);
      this.pendingApprovalTimers.delete(sessionId);
    }
    broadcast({ type: 'session.ended', timestamp: now, data: ended });
    telemetryService.sendEvent('session_ended', {
      sessionType: existing.type,
      sessionId: existing.id,
      launchMode: existing.launchMode === 'pty' ? 'connected' : 'readonly',
      yoloMode: existing.yoloMode,
    });
  }

  protected handlePreAskQuestion(
    sessionId: string,
    existing: Session | null | undefined,
    payload: CliHookPayload,
    now: string,
  ): void {
    if (!existing) {
      return;
    }
    const { question, choices, allQuestions } = parsePendingChoicePayload(payload.tool_input ?? {});
    this.pendingChoices.set(sessionId, { type: 'ask_user', question, choices, allQuestions });
    broadcast({
      type: 'session.pending_choice',
      timestamp: now,
      data: { sessionId, question, choices, allQuestions },
    });
    pendingChoiceEvents.emit('session.pending_choice', {
      sessionId,
      question,
      choices,
      allQuestions,
    });
  }

  protected handlePostAskQuestion(
    sessionId: string,
    existing: Session | null | undefined,
    now: string,
  ): void {
    if (!existing) {
      return;
    }
    this.pendingChoices.delete(sessionId);
    broadcast({ type: 'session.pending_choice.resolved', timestamp: now, data: { sessionId } });
    pendingChoiceEvents.emit('session.pending_choice.resolved', sessionId);
  }

  protected handlePreToolApproval(
    sessionId: string,
    existing: Session | null | undefined,
    payload: CliHookPayload,
    now: string,
  ): void {
    if (!existing) {
      return;
    }
    // In yolo mode the tool is auto-approved — no interactive prompt is shown.
    if (existing.yoloMode) {
      return;
    }
    const toolName = payload.tool_name ?? 'Unknown';
    // Claude Code's built-in read-only Bash commands are always auto-approved. PostToolUse
    // does fire for them (~400ms after PreToolUse), but for faster commands the gap can be
    // shorter than the debounce timer. Skipping known read-only commands here is a
    // belt-and-suspenders guard on top of the timer-cancellation path below.
    if (
      toolName === 'Bash' &&
      isClaudeReadOnlyBashCommand(
        typeof payload.tool_input?.command === 'string' ? payload.tool_input.command : '',
      )
    ) {
      return;
    }
    const { question, choices, allQuestions } = buildToolApprovalChoice(
      toolName,
      payload.tool_input ?? {},
    );
    this.pendingChoices.set(sessionId, { type: 'tool_approval', question, choices, allQuestions });

    // Cancel the approval card if the JSONL stream shows the tool already completed
    // (auto-approved by a rule) before the debounce timer fires.
    const cancelOnToolResult = (sid: string) => {
      if (sid !== sessionId) {
        return;
      }
      pendingChoiceEvents.off('session.tool_result_seen', cancelOnToolResult);
      clearTimeout(timer);
      this.pendingApprovalTimers.delete(sessionId);
      this.pendingChoices.delete(sessionId);
    };
    pendingChoiceEvents.on('session.tool_result_seen', cancelOnToolResult);

    // Delay the broadcast. PostToolUse (HTTP) and the JSONL tool_result_seen event both
    // cancel this timer if the tool was auto-approved. If neither fires within 500ms the
    // tool is genuinely waiting for the user, so we show the approval card.
    const timer = setTimeout(() => {
      pendingChoiceEvents.off('session.tool_result_seen', cancelOnToolResult);
      this.pendingApprovalTimers.delete(sessionId);
      if (!this.pendingChoices.has(sessionId)) {
        return;
      }
      broadcast({
        type: 'session.pending_choice',
        timestamp: now,
        data: { sessionId, question, choices, allQuestions },
      });
      pendingChoiceEvents.emit('session.pending_choice', {
        sessionId,
        question,
        choices,
        allQuestions,
      });
    }, 500);
    this.pendingApprovalTimers.set(sessionId, timer);
  }

  protected handlePostToolApproval(
    sessionId: string,
    existing: Session | null | undefined,
    now: string,
  ): void {
    if (!existing) {
      return;
    }
    // Cancel any pending broadcast timer — the tool was resolved before being shown.
    const timer = this.pendingApprovalTimers.get(sessionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.pendingApprovalTimers.delete(sessionId);
      this.pendingChoices.delete(sessionId);
      return;
    }
    this.pendingChoices.delete(sessionId);
    broadcast({ type: 'session.pending_choice.resolved', timestamp: now, data: { sessionId } });
    pendingChoiceEvents.emit('session.pending_choice.resolved', sessionId);
  }
}
