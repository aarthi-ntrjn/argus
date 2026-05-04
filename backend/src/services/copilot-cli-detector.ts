import { readdirSync, readFileSync, statSync } from 'fs';
import * as logger from '../utils/logger.js';
import { join, normalize } from 'path';
import { homedir } from 'os';
import { load as yamlLoad } from 'js-yaml';
import { randomUUID } from 'crypto';
import { upsertSession, getRepositoryByPath, getSession, getSessions, updateSessionStatus, getServerState, setServerState } from '../db/database.js';
import { CopilotJsonlWatcher } from './copilot-cli-jsonl-watcher.js';
import { detectYoloModeFromPids, isPidRunning, isExpectedProcess } from './process-utils.js';
import { SessionTypes } from '../models/index.js';
import type { Session } from '../models/index.js';
import type { CliDetector } from './cli-detector.js';
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

/** Parsed entry from one ~/.copilot/session-state/<id>/ directory. */
interface CopilotDirEntry {
  dirPath: string;
  workspace: WorkspaceYaml;
  pid: number | null;
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
 *
 * The base scan() pipeline calls readSessionEntries (mtime-filtered dir walk) →
 * processSessionEntry per dir → dispatchSessionEvents (sigCache diff + dropped-off
 * detection). Active dirs are always re-checked next cycle so session ends are
 * detected promptly.
 */
export class CopilotCliDetector extends BaseCliDetector<CopilotDirEntry> implements CliDetector {
  private readonly jsonlWatcher = new CopilotJsonlWatcher();
  protected readonly sessionsDir: string;
  private lastScanTime: number;
  /** Dirs that ended this scan cycle with an active session. Re-checked next cycle. */
  private activeDirPaths = new Set<string>();

  protected readonly logTag = '[CopilotDetector]';
  protected readonly askUserToolName = 'ask_user';
  protected readonly toolTypeId = 'copilot-cli' as const;

  constructor(sessionsDir: string = DEFAULT_SESSIONS_DIR) {
    super();
    this.sessionsDir = sessionsDir;
    const stored = getServerState('copilot_last_scan_time');
    this.lastScanTime = stored ? parseInt(stored, 10) : 0;
  }

  /**
   * Walks sessionsDir and returns one parsed entry per dir to process this cycle.
   *
   * Applies mtime filtering to skip stale directories while always re-checking
   * any directory that had an active session in the previous cycle.
   * When force=true (triggered by repo add or first scan), skips the mtime filter.
   *
   * Resets activeDirPaths so processSessionEntry can repopulate it as it iterates.
   */
  protected async readSessionEntries(force: boolean): Promise<CopilotDirEntry[]> {
    const t0 = Date.now();
    const previousActive = this.activeDirPaths;
    const dirsToProcess = new Set<string>();

    try {
      const entries = readdirSync(this.sessionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirPath = join(this.sessionsDir, entry.name);
        if (previousActive.has(dirPath) || force) {
          dirsToProcess.add(dirPath);
          continue;
        }
        try {
          if (statSync(dirPath).mtimeMs > this.lastScanTime) dirsToProcess.add(dirPath);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    this.activeDirPaths = new Set();
    this.lastScanTime = t0;
    setServerState('copilot_last_scan_time', String(t0));

    const result: CopilotDirEntry[] = [];
    for (const dirPath of dirsToProcess) {
      const data = this.readDirEntry(dirPath);
      if (data) result.push({ dirPath, workspace: data.workspace, pid: data.pid });
    }
    return result;
  }

  /**
   * Per-entry pipeline: liveness + identity guards, repo lookup, PTY linkage,
   * upsert, watch JSONL. Returns the persisted Session, or null if the entry
   * should be skipped (no repo, already-ended-and-not-running, etc.).
   *
   * Records active dirPaths so they are always re-checked next cycle to detect
   * the eventual end transition.
   */
  protected async processSessionEntry(entry: CopilotDirEntry): Promise<Session | null> {
    const tDir = Date.now();
    const session = await this.buildSessionFromEntry(entry);
    const dirMs = Date.now() - tDir;
    if (dirMs > 50) {
      logger.info(`[CopilotDetector] slow dir (${dirMs}ms): ${entry.dirPath}`);
    }
    if (session?.status === 'active') this.activeDirPaths.add(entry.dirPath);
    return session;
  }

  /**
   * Builds the Session row from a directory entry, applying liveness guards and
   * PTY linkage. Pure of dispatch concerns: it upserts the DB row and starts the
   * watcher, but does not fire callbacks.
   */
  private async buildSessionFromEntry(entry: CopilotDirEntry): Promise<Session | null> {
    const { dirPath, workspace, pid } = entry;
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
    if (!repo) {
      logger.warn(`[CopilotDetector] no repo for cwd="${workspace.cwd ?? 'none'}" sessionId=${sessionId} — session ignored`);
      return null;
    }

    const status = isRunning ? 'active' : 'ended';
    const toIso = (val: string | Date | undefined): string =>
      val ? (val instanceof Date ? val.toISOString() : val) : new Date().toISOString();

    const linkage = this.resolvePtyLinkage(sessionId, existingSession, repo.path, pid, 'lockfile', isRunning);

    const yoloMode = existingSession?.yoloMode != null
      ? existingSession.yoloMode
      : isRunning ? detectYoloModeFromPids(linkage.pid, linkage.hostPid, SessionTypes.COPILOT_CLI) : null;

    const session: Session = {
      id: sessionId,
      repositoryId: repo.id,
      type: SessionTypes.COPILOT_CLI,
      launchMode: linkage.launchMode,
      pid: linkage.pid,
      hostPid: linkage.hostPid,
      pidSource: linkage.pidSource,
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
      ptyLaunchId: linkage.ptyLaunchId,
    };

    upsertSession(session);

    if (isRunning) {
      await this.jsonlWatcher.watchFile(sessionId, dirPath);
    }

    return session;
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

  // Reads workspace.yaml and the lock file for a single session directory.
  // Returns null if the workspace file is missing or malformed.
  private readDirEntry(dirPath: string): { workspace: WorkspaceYaml; pid: number | null } | null {
    const workspaceFile = join(dirPath, 'workspace.yaml');
    try {
      const workspace = yamlLoad(readFileSync(workspaceFile, 'utf-8')) as WorkspaceYaml;
      const lockFile = this.findLockFile(dirPath);
      const pid = lockFile ? this.extractPid(lockFile) : null;
      return { workspace, pid };
    } catch { return null; }
  }

  /**
   * Two-stage dispatch:
   *   1. Dropped-off detection: any DB active/idle session not seen in this scan
   *      had its workspace dir cleaned up by the OS. Mark ended and fire callback.
   *   2. sigCache diff: fire created for new sessions, updated for changed ones,
   *      and ended (one-shot) for sessions that ended this cycle.
   */
  protected dispatchSessionEvents(sessions: Session[]): void {
    const currentIds = new Set(sessions.map((s) => s.id));
    const now = new Date().toISOString();

    const dbActiveSessions = getSessions().filter((s) => s.type === 'copilot-cli' && (s.status === 'active' || s.status === 'idle'));
    for (const session of dbActiveSessions) {
      if (!currentIds.has(session.id)) {
        updateSessionStatus(session.id, 'ended', now);
        this.sessionEndedCallback?.({ ...session, status: 'ended', endedAt: now });
        this.sigCache.delete(session.id);
      }
    }

    for (const session of sessions) {
      if (!this.sigCache.has(session.id)) {
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
        // sigCache.has() gates the one-shot fire: cleared here and in handleSessionEnd.
        // If a SessionEnd hook already fired, sigCache is already cleared — no double fire.
        if (this.sigCache.has(session.id)) {
          this.sessionEndedCallback?.(session);
          this.sigCache.delete(session.id);
        }
      }
    }
  }

  protected watchJsonlFile(sessionId: string, repoPath: string): Promise<void> {
    return this.jsonlWatcher.watchFile(sessionId, repoPath);
  }

  protected closeJsonlWatcher(sessionId: string): void {
    this.jsonlWatcher.closeWatcher(sessionId);
  }

  stop(): void {
    this.jsonlWatcher.stopWatchers();
  }
}
