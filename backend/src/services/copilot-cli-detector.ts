import { readdirSync, existsSync, readFileSync, statSync } from 'fs';
import * as logger from '../utils/logger.js';
import { join, normalize } from 'path';
import { homedir } from 'os';
import { load as yamlLoad } from 'js-yaml';
import { randomUUID } from 'crypto';
import { upsertSession, getRepositoryByPath, getSession, getSessions, updateSessionStatus, getServerState, setServerState } from '../db/database.js';
import { ptyRegistry } from './pty-registry.js';
import { telemetryService } from './telemetry-service.js';
import { CopilotJsonlWatcher } from './copilot-cli-jsonl-watcher.js';
import { detectYoloModeFromPids, isPidRunning, isExpectedProcess } from './process-utils.js';
import { SessionTypes } from '../models/index.js';
import type { Session, PidSource, PendingChoice } from '../models/index.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { pendingChoiceEvents } from './pending-choice-events.js';
import { parsePendingChoicePayload } from './pending-choice-utils.js';
import type { CliDetector, CliHookPayload } from './cli-detector.js';
import { BaseCliDetector } from './base-cli-detector.js';

/**
 * Copilot CLI writes one subdirectory per session under ~/.copilot/session-state/.
 * Each subdirectory contains a workspace.yaml with session metadata and an
 * inuse.<PID>.lock file while the session is running. Lock file absence signals
 * that the session has ended (clean or unclean).
 *
 * Example session directory: ~/.copilot/session-state/<session-id>/
 * workspace.yaml:
 * {
 *   "id": "0f63ac9c-1cdf-47fe-abb1-d6b3bef059a1",
 *   "cwd": "C:\\source\\github\\argus",
 *   "summary": "...",
 *   "created_at": "2026-05-03T18:00:00.000Z",
 *   "updated_at": "2026-05-03T18:05:00.000Z"
 * }
 * inuse.13232.lock  (empty file; name encodes the PID)
 */
const DEFAULT_SESSIONS_DIR = join(homedir(), '.copilot', 'session-state');

interface WorkspaceYaml {
  id?: string;
  cwd?: string;
  summary?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
}

/**
 * Detects and tracks Copilot CLI sessions.
 *
 * Detection model: event-driven via HTTP hooks, backed by a directory scan.
 *
 * Primary path — HTTP hooks: Copilot fires SessionStart / PreToolUse / SessionEnd events
 * to /hooks/copilot on every tool call. handleHookPayload() creates or updates the DB
 * session and fires sessionCreatedCallback immediately for new sessions.
 *
 * Secondary path — directory scan: scan() walks ~/.copilot/session-state/ on every cycle.
 * This catches sessions that started without hooks (e.g. legacy installs or missed events)
 * and detects unclean shutdowns where SessionEnd never fired (lock file disappears).
 * Mtime filtering skips unchanged directories; directories with active sessions are always
 * re-checked to detect process exit.
 *
 * Change detection: processSessionEvents() diffs the scan result against sigCache /
 * knownIds / activeMap and fires sessionCreatedCallback, sessionUpdatedCallback, or
 * sessionEndedCallback exactly once per transition. Hook-created sessions are pre-seeded
 * into these maps so the next scan cycle does not re-fire the same event.
 */
export class CopilotCliDetector extends BaseCliDetector implements CliDetector {
  private readonly jsonlWatcher = new CopilotJsonlWatcher();
  private readonly sessionsDir: string;
  private lastScanTime: number;
  private activeDirPaths = new Set<string>();
  // Session tracking maps — seeded on startup and updated by hooks and scan().
  private readonly knownIds = new Set<string>();
  private readonly activeMap = new Map<string, Session>();

  constructor(sessionsDir: string = DEFAULT_SESSIONS_DIR) {
    super();
    this.sessionsDir = sessionsDir;
    const stored = getServerState('copilot_last_scan_time');
    this.lastScanTime = stored ? parseInt(stored, 10) : 0;
  }

  /**
   * Seeds tracking state with sessions that survived from a previous run.
   * Call before the first scan() to prevent duplicate session.created events.
   */
  seedState(sessions: Session[]): void {
    for (const session of sessions) {
      this.knownIds.add(session.id);
      this.sigCache.set(session.id, this.sessionSignature(session));
      if (session.status === 'active') this.activeMap.set(session.id, session);
    }
  }

  /**
   * One-time startup: seed activeDirPaths from the DB so sessions that were active
   * when the server stopped are re-checked on the first scan, even if their directory
   * mtime predates lastScanTime.
   */
  async start(): Promise<void> {
    this.initActiveDirsFromDb();
  }

  // Reads active copilot-cli sessions from the DB and finds their on-disk dirs.
  private initActiveDirsFromDb(): void {
    if (!existsSync(this.sessionsDir)) return;
    const activeSessions = getSessions({ type: SessionTypes.COPILOT_CLI, status: 'active' });
    if (activeSessions.length === 0) return;
    const activeIds = new Set(activeSessions.map(s => s.id));
    try {
      const entries = readdirSync(this.sessionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirPath = join(this.sessionsDir, entry.name);
        const workspaceFile = join(dirPath, 'workspace.yaml');
        if (!existsSync(workspaceFile)) continue;
        try {
          const workspace = yamlLoad(readFileSync(workspaceFile, 'utf-8')) as WorkspaceYaml;
          if (workspace.id && activeIds.has(workspace.id)) this.activeDirPaths.add(dirPath);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  /**
   * Per-cycle scan. Two responsibilities:
   *
   * 1. Directory sweep: walk sessionsDir for new or changed directories.
   *    Applies mtime filtering to skip stale directories while always re-checking
   *    any directory that had an active session in the previous cycle.
   *    When force=true (triggered by repo add), skips the mtime filter entirely.
   *
   * 2. Event dispatch: calls processSessionEvents() with all discovered sessions
   *    to fire sessionCreatedCallback / sessionUpdatedCallback / sessionEndedCallback.
   *
   * Returns the discovered sessions, but callers (CliManager/SessionMonitor) ignore
   * the return value. CopilotCliDetector is fully push-based via callbacks.
   */
  async scan(force = false): Promise<Session[]> {
    if (!existsSync(this.sessionsDir)) return [];
    const t0 = Date.now();

    // Collect dirs to process:
    // 1. Dirs modified since last scan — may contain new sessions.
    //    When force=true (triggered by repo add) skip the mtime filter so we catch
    //    sessions whose dir predates the last scan (e.g. after a repo remove+re-add).
    // 2. Dirs that had an active session last scan — detect if they have ended.
    const dirsToProcess = new Set<string>();
    let totalDirs = 0;

    try {
      const entries = readdirSync(this.sessionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        totalDirs++;
        const dirPath = join(this.sessionsDir, entry.name);

        if (this.activeDirPaths.has(dirPath)) {
          dirsToProcess.add(dirPath);
          continue;
        }

        if (force) {
          dirsToProcess.add(dirPath);
          continue;
        }

        try {
          if (statSync(dirPath).mtimeMs > this.lastScanTime) dirsToProcess.add(dirPath);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    const sessions: Session[] = [];
    const newActiveDirPaths = new Set<string>();

    for (const dirPath of dirsToProcess) {
      const tDir = Date.now();
      const session = await this.processSessionDir(dirPath);
      const dirMs = Date.now() - tDir;
      if (dirMs > 50) {
        logger.info(`[CopilotDetector] slow dir (${dirMs}ms): ${dirPath}`);
      }
      if (session) {
        sessions.push(session);
        if (session.status === 'active') newActiveDirPaths.add(dirPath);
      }
    }

    this.activeDirPaths = newActiveDirPaths;
    this.lastScanTime = t0;
    setServerState('copilot_last_scan_time', String(t0));

    this.processSessionEvents(sessions);
    return sessions;
  }

  /**
   * Reads one session directory and returns the current session state or null.
   *
   * Requires workspace.yaml (session metadata). If a lock file is also present,
   * the session is considered running — lock file absence means ended. Performs
   * two liveness guards to avoid false positives from PID reuse:
   *   1. isPidRunning() — cheap signal-0 check.
   *   2. isExpectedProcess() — verifies the process name matches the AI tool.
   *
   * Calls resolvePtyLinkage() to associate the session with a PTY launcher if
   * one is waiting in the registry.
   */
  private async processSessionDir(dirPath: string): Promise<Session | null> {
    const workspaceFile = join(dirPath, 'workspace.yaml');
    if (!existsSync(workspaceFile)) return null;

    let workspace: WorkspaceYaml;
    try {
      workspace = yamlLoad(readFileSync(workspaceFile, 'utf-8')) as WorkspaceYaml;
    } catch { return null; }

    const lockFile = this.findLockFile(dirPath);
    const pid = lockFile ? this.extractPid(lockFile) : null;

    const sessionId = workspace.id ?? randomUUID();
    const existingSession = getSession(sessionId);

    // Guard 1: process is running (cheap signal-0 check)
    // Guard 2: verify the process at this PID is actually the expected AI tool — catches
    //   stale lock files pointing to recycled PIDs (PID reuse by an unrelated process).
    const pidAlive = pid !== null && isPidRunning(pid);
    const isRunning = pidAlive && isExpectedProcess(pid!, SessionTypes.COPILOT_CLI);
    if (pidAlive && !isRunning) {
      logger.info(`[CopilotDetector] PID reuse detected: pid ${pid} is running with wrong name — skipping (sessionId=${sessionId} existingStatus=${existingSession?.status ?? 'new'})`);
    }

    // Skip directories for sessions already recorded as ended: no lock file means
    // nothing has changed since we last marked them ended.
    if (!isRunning && existingSession?.status === 'ended') return null;

    const repo = workspace.cwd ? getRepositoryByPath(normalize(workspace.cwd)) : null;
    if (!repo) { logger.warn(`[CopilotDetector] no repo for cwd="${workspace.cwd ?? 'none'}" sessionId=${sessionId} — session ignored`); return null; }

    const status = isRunning ? 'active' : 'ended';
    const toIso = (val: string | Date | undefined): string =>
      val ? (val instanceof Date ? val.toISOString() : val) : new Date().toISOString();

    const { launchMode, resolvedPid, resolvedHostPid, resolvedPidSource, resolvedPtyLaunchId } =
      this.resolvePtyLinkage(sessionId, existingSession, repo, pid, isRunning);

    const yoloMode = existingSession?.yoloMode != null
      ? existingSession.yoloMode
      : isRunning ? detectYoloModeFromPids(resolvedPid, resolvedHostPid, SessionTypes.COPILOT_CLI) : null;
    const session: Session = {
      id: sessionId,
      repositoryId: repo.id,
      type: SessionTypes.COPILOT_CLI,
      launchMode,
      pid: resolvedPid,
      hostPid: resolvedHostPid,
      pidSource: resolvedPidSource,
      status,
      startedAt: toIso(workspace.created_at),
      endedAt: status === 'ended' ? toIso(workspace.updated_at) : null,
      lastActivityAt: existingSession?.lastActivityAt && existingSession.lastActivityAt > toIso(workspace.updated_at)
        ? existingSession.lastActivityAt
        : toIso(workspace.updated_at),
      summary: existingSession?.summary ?? workspace.summary ?? null,
      expiresAt: null,
      model: existingSession?.model ?? null,
      reconciled: true,
      yoloMode,
      ptyLaunchId: resolvedPtyLaunchId,
    };

    upsertSession(session);

    if (isRunning) {
      await this.jsonlWatcher.watchFile(sessionId, dirPath);
    }

    return session;
  }

  /**
   * Resolves PTY linkage for a session directory.
   *
   * Copilot sessions may be launched from the Argus UI (pty) or externally (null).
   * This method determines which case applies and returns the final pid/hostPid/
   * launchMode values by consulting the ptyRegistry.
   *
   * Three cases:
   * - Already claimed (pty in DB): preserve pty metadata; correct any lockfile PID
   *   mismatch; attempt re-link if the WebSocket disconnected and reconnected.
   * - Registry has this sessionId (WS connected before lock file appeared): claim it.
   * - New running session: try claimForSession() against the pending WS queue.
   */
  private resolvePtyLinkage(
    sessionId: string,
    existingSession: Session | null | undefined,
    repo: { path: string },
    pid: number | null,
    isRunning: boolean,
  ): { launchMode: 'pty' | null; resolvedPid: number | null; resolvedHostPid: number | null; resolvedPidSource: PidSource | null; resolvedPtyLaunchId: string | null } {
    const alreadyClaimed = existingSession?.launchMode === 'pty';
    const registryHas = ptyRegistry.has(sessionId);

    let launchMode: 'pty' | null = null;
    let resolvedPid = pid;
    let resolvedHostPid: number | null = existingSession?.hostPid ?? null;
    let resolvedPidSource: PidSource | null = pid != null ? 'lockfile' : null;
    let resolvedPtyLaunchId: string | null = existingSession?.ptyLaunchId ?? null;

    if (alreadyClaimed) {
      launchMode = 'pty';
      resolvedPid = existingSession!.pid;
      resolvedHostPid = existingSession!.hostPid;
      resolvedPidSource = existingSession!.pidSource;
      // The lockfile PID is ground truth: it is written by the Copilot process itself and
      // is always authoritative for which process owns this session. Correct any stale DB
      // value so the row converges within one scan cycle.
      if (pid !== null && pid !== existingSession!.pid) {
        logger.warn(`[CopilotDetector] alreadyClaimed pid mismatch: lockfile=${pid} stored=${existingSession!.pid} sessionId=${sessionId} — correcting to lockfile pid`);
        resolvedPid = pid;
        resolvedPidSource = 'lockfile';
      }
      if (!registryHas && isRunning) {
        logger.info(`[CopilotDetector] alreadyClaimed + WS gone + isRunning — attempting re-link sessionId=${sessionId}`);
        const claimed = ptyRegistry.claimForSession(sessionId, repo.path, 'copilot-cli');
        if (claimed) {
          resolvedPid = claimed.pid;
          resolvedHostPid = claimed.hostPid;
          resolvedPidSource = 'pty_registry';
          resolvedPtyLaunchId = claimed.ptyLaunchId;
          logger.info(`[CopilotDetector] re-link OK sessionId=${sessionId} hostPid=${claimed.hostPid} pid=${claimed.pid}`);
        } else {
          logger.info(`[CopilotDetector] re-link MISS — no pending WS yet for sessionId=${sessionId}`);
        }
      }
    } else if (registryHas) {
      logger.info(`[CopilotDetector] ptyRegistry already has sessionId=${sessionId} — marking pty`);
      launchMode = 'pty';
      resolvedPidSource = 'pty_registry';
      resolvedPtyLaunchId = existingSession?.ptyLaunchId ?? ptyRegistry.getPtyLaunchIdForSession(sessionId) ?? null;
      const parkedPid = ptyRegistry.getClaimedPid(sessionId);
      if (parkedPid != null) {
        resolvedPid = parkedPid;
        logger.info(`[CopilotDetector] using parked resolved pid=${parkedPid} for sessionId=${sessionId}`);
      }
    } else if (isRunning && existingSession == null) {
      logger.info(`[CopilotDetector] isRunning + not claimed — trying claimForSession sessionId=${sessionId} repoPath="${repo.path}"`);
      const claimed = ptyRegistry.claimForSession(sessionId, repo.path, 'copilot-cli');
      if (claimed) {
        launchMode = 'pty';
        resolvedPid = claimed.pid;
        resolvedHostPid = claimed.hostPid;
        resolvedPidSource = 'pty_registry';
        resolvedPtyLaunchId = claimed.ptyLaunchId;
        logger.info(`[CopilotDetector] claimForSession OK sessionId=${sessionId} hostPid=${claimed.hostPid} pid=${claimed.pid}`);
      } else {
        logger.info(`[CopilotDetector] claimForSession MISS — no pending WS — sessionId=${sessionId} will be read-only`);
      }
    }

    return { launchMode, resolvedPid, resolvedHostPid, resolvedPidSource, resolvedPtyLaunchId };
  }


  /**
   * Returns a sessionId-to-PID map for startup stale-session reconciliation only.
   * Equivalent of ClaudeCodeDetector.getRegistryEntries() — scans inuse.<PID>.lock files.
   */
  getRegistryEntries(): Map<string, number> {
    const result = new Map<string, number>();
    if (!existsSync(this.sessionsDir)) return result;

    try {
      const entries = readdirSync(this.sessionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirPath = join(this.sessionsDir, entry.name);
        const workspaceFile = join(dirPath, 'workspace.yaml');
        if (!existsSync(workspaceFile)) continue;

        try {
          const workspace = yamlLoad(readFileSync(workspaceFile, 'utf-8')) as WorkspaceYaml;
          if (!workspace.id) continue;

          const lockFile = this.findLockFile(dirPath);
          const pid = lockFile ? this.extractPid(lockFile) : null;
          if (pid != null) {
            result.set(workspace.id, pid);
          }
        } catch { /* skip malformed */ }
      }
    } catch { /* ignore */ }

    return result;
  }

  stop(): void {
    this.jsonlWatcher.stopWatchers();
  }

  /** No-op: Copilot manages JSONL watchers internally in scan(). */
  closeSessionWatcher(_sessionId: string): void {}

  clearPendingChoice(sessionId: string): void {
    this.pendingChoices.delete(sessionId);
  }

  /**
   * Primary real-time update path. Called for every hook event Copilot fires.
   *
   * Routes by event name:
   * - SessionEnd: mark ended, close JSONL watcher, clean up tracking state, broadcast directly.
   * - PreToolUse / PostToolUse (ask_user): manage pending-choice state, broadcast directly.
   * - SessionStart or other events: create or update the DB session.
   *   If a PTY claim succeeds, creates a pty-mode session immediately.
   *   Otherwise, falls back to a read-only session (no pid/launchMode).
   *   New sessions: fire sessionCreatedCallback (seeds knownIds/sigCache/activeMap so the next
   *   scan cycle does not re-fire the event). Existing sessions: broadcast session.updated
   *   directly, matching ClaudeCodeDetector's hook-update path.
   */
  async handleHookPayload(payload: CliHookPayload): Promise<void> {
    const { hook_event_name, session_id, cwd } = payload;
    if (!session_id) return;

    const normalizedCwd = cwd ? normalize(cwd.trimEnd().replace(/[/\\]+$/, '')) : null;
    const repo = normalizedCwd ? getRepositoryByPath(normalizedCwd) : null;
    if (!repo) {
      logger.warn(`[CopilotDetector] no repo for cwd="${normalizedCwd ?? 'none'}" sessionId=${session_id} hook=${hook_event_name} — hook ignored`);
      return;
    }

    const existing = getSession(session_id);
    const now = new Date().toISOString();

    if (hook_event_name === 'SessionEnd') {
      if (!existing) return;
      updateSessionStatus(session_id, 'ended', now);
      this.jsonlWatcher.closeWatcher(session_id);
      const ended = { ...existing, status: 'ended' as const, endedAt: now };
      this.activeMap.delete(session_id);
      this.sigCache.delete(session_id);
      broadcast({ type: 'session.ended', timestamp: now, data: ended });
      this.pendingChoices.delete(session_id);
      telemetryService.sendEvent('session_ended', {
        sessionType: existing.type,
        sessionId: existing.id,
        launchMode: existing.launchMode === 'pty' ? 'connected' : 'readonly',
        yoloMode: existing.yoloMode,
      });
      return;
    }

    if (hook_event_name === 'PreToolUse' && payload.tool_name === 'ask_user') {
      if (!existing) return;
      const { question, choices, allQuestions } = parsePendingChoicePayload(payload.tool_input ?? {});
      this.pendingChoices.set(session_id, { question, choices, allQuestions });
      broadcast({ type: 'session.pending_choice', timestamp: now, data: { sessionId: session_id, question, choices, allQuestions } });
      pendingChoiceEvents.emit('session.pending_choice', { sessionId: session_id, question, choices, allQuestions });
      return;
    }

    if (hook_event_name === 'PostToolUse' && payload.tool_name === 'ask_user') {
      if (!existing) return;
      this.pendingChoices.delete(session_id);
      broadcast({ type: 'session.pending_choice.resolved', timestamp: now, data: { sessionId: session_id } });
      pendingChoiceEvents.emit('session.pending_choice.resolved', session_id);
      return;
    }

    // SessionStart or other events: create/update session
    if (!existing) {
      const claimed = normalizedCwd ? ptyRegistry.claimForSession(session_id, normalizedCwd, 'copilot-cli') : null;
      if (claimed) {
        const yoloMode = detectYoloModeFromPids(claimed.pid, claimed.hostPid, 'copilot-cli');
        const ptySession: Session = {
          id: session_id,
          repositoryId: repo.id,
          type: SessionTypes.COPILOT_CLI,
          launchMode: 'pty',
          pid: claimed.pid,
          hostPid: claimed.hostPid,
          pidSource: 'pty_registry' as PidSource,
          status: 'active',
          startedAt: now,
          endedAt: null,
          lastActivityAt: now,
          summary: null,
          expiresAt: null,
          model: null,
          reconciled: true,
          yoloMode,
        };
        upsertSession(ptySession);
        this.knownIds.add(session_id);
        this.sigCache.set(session_id, this.sessionSignature(ptySession));
        this.activeMap.set(session_id, ptySession);
        this.sessionCreatedCallback?.(ptySession);
        await this.jsonlWatcher.watchFile(session_id, repo.path);
        return;
      }
    }

    const session: Session = existing ?? {
      id: session_id,
      repositoryId: repo.id,
      type: SessionTypes.COPILOT_CLI,
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

    const updated = { ...session, lastActivityAt: now };
    upsertSession(updated);

    if (existing) {
      this.sigCache.set(session_id, this.sessionSignature(updated));
      broadcast({ type: 'session.updated', timestamp: now, data: updated });
    } else {
      this.knownIds.add(session_id);
      this.sigCache.set(session_id, this.sessionSignature(updated));
      this.activeMap.set(session_id, updated);
      this.sessionCreatedCallback?.(updated);
    }

    await this.jsonlWatcher.watchFile(session_id, repo.path);
  }

  private findLockFile(dirPath: string): string | null {
    try {
      const files = readdirSync(dirPath);
      return files.find((f) => f.startsWith('inuse.') && f.endsWith('.lock')) ?? null;
    } catch { return null; }
  }

  private extractPid(lockFile: string): number | null {
    const match = lockFile.match(/inuse\.(\d+)\.lock/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Diff-based event dispatch. Called after every scan() with the full set of
   * sessions found in that cycle.
   *
   * - Sessions absent from the scan but present in activeMap: fire sessionEndedCallback
   *   (process exited cleanly — workspace dir was cleaned up).
   * - Sessions seen for the first time (not in knownIds): fire sessionCreatedCallback.
   * - Sessions with a changed signature: fire sessionUpdatedCallback.
   * - Sessions with status 'ended' that are still in activeMap: fire sessionEndedCallback
   *   once, then remove from activeMap (ended sessions remain on disk — only fire once).
   */
  private processSessionEvents(sessions: Session[]): void {
    const currentIds = new Set(sessions.map(s => s.id));
    const now = new Date().toISOString();

    // Detect sessions that dropped off the scan (process exited and workspace dir cleaned up).
    for (const [id, session] of this.activeMap) {
      if (!currentIds.has(id)) {
        const stored = getSession(id);
        if (stored?.status !== 'ended') {
          updateSessionStatus(id, 'ended', now);
          this.sessionEndedCallback?.({ ...session, status: 'ended', endedAt: now });
        }
        this.activeMap.delete(id);
        this.sigCache.delete(id);
      }
    }

    for (const session of sessions) {
      if (!this.knownIds.has(session.id)) {
        this.knownIds.add(session.id);
        this.sigCache.set(session.id, this.sessionSignature(session));
        this.sessionCreatedCallback?.(session);
      } else {
        const sig = this.sessionSignature(session);
        if (this.sigCache.get(session.id) !== sig) {
          this.sigCache.set(session.id, sig);
          this.sessionUpdatedCallback?.(session);
        }
      }

      if (session.status === 'ended') {
        // Only fire once — ended sessions remain on disk and re-appear on every scan.
        if (this.activeMap.has(session.id)) {
          this.sessionEndedCallback?.(session);
          this.activeMap.delete(session.id);
          this.sigCache.delete(session.id);
        }
      } else if (session.status === 'active') {
        this.activeMap.set(session.id, session);
      }
    }
  }

}
