import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { load as yamlLoad } from 'js-yaml';
import { randomUUID } from 'crypto';
import { upsertSession, getSession, getSessions, getServerState, setServerState } from '../db/database.js';
import { CopilotJsonlWatcher } from './copilot-cli-jsonl-watcher.js';
import { detectYoloModeFromPids } from './process-utils.js';
import { SessionTypes } from '../models/index.js';
import type { Session } from '../models/index.js';
import type { CliDetector } from './cli-detector.js';
import { BaseCliDetector, type SessionEntry } from './base-cli-detector.js';

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
 * Parsed entry from one ~/.copilot/session-state/<id>/ directory.
 * Adds workspace.yaml-sourced fields beyond the common SessionEntry: the
 * session-dir path (for the JSONL watcher) and the seed values for the
 * Session row's summary/timestamps.
 */
interface CopilotSessionEntry extends SessionEntry {
  dirPath: string;
  summary: string | null;
  startedAt: string | Date;
  updatedAt: string | Date;
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
export class CopilotCliDetector extends BaseCliDetector<CopilotSessionEntry> implements CliDetector {
  protected readonly jsonlWatcher = new CopilotJsonlWatcher();
  protected readonly sessionsDir: string;
  private lastScanTime: number;
  /**
   * Mtime-filter override set. readSessionEntries skips dirs whose mtime
   * hasn't changed since lastScanTime, but always re-processes dirs in this
   * set so we promptly detect when an active session ends.
   *
   * Only dirs whose buildSessionFromEntry produced a status='active' Session
   * are added — dirs that yielded null (no repo, etc.) don't need re-checking
   * because they'd just yield null again. This is the narrower of the two
   * scan-set semantics: alive AND yielded an active session.
   *
   * Claude's currentAlivePids tracks a broader set (every alive pid) for a
   * different purpose (disappearance detection).
   */
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
   *
   * force=true bypasses the mtime filter and processes every directory. Two
   * callers need it:
   *   1. First scan after server startup: in-memory activeDirPaths is empty, so
   *      idle sessions whose dirs predate lastScanTime would be missed.
   *   2. Repo add: a newly-registered repo may already have running sessions
   *      whose dir mtime is older than this scan; without force they would be
   *      skipped until something touched the dir.
   *
   * Resets activeDirPaths so processSessionEntry can repopulate it as it iterates.
   */
  protected async readSessionEntries(force: boolean): Promise<CopilotSessionEntry[]> {
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

    const result: CopilotSessionEntry[] = [];
    for (const dirPath of dirsToProcess) {
      const data = this.readDirEntry(dirPath);
      if (!data) continue;
      const cwd = data.workspace.cwd;
      if (!cwd) continue;
      const nowIso = new Date().toISOString();
      result.push({
        sessionId: data.workspace.id ?? randomUUID(),
        cwd,
        pid: data.pid,
        dirPath,
        summary: data.workspace.summary ?? null,
        startedAt: data.workspace.created_at ?? nowIso,
        updatedAt: data.workspace.updated_at ?? nowIso,
      });
    }
    return result;
  }

  /**
   * Per-entry pipeline: delegates to buildSessionFromEntry and records active
   * dirPaths so they are always re-checked next cycle (used by the mtime filter
   * in readSessionEntries) to detect the eventual end transition.
   */
  protected async processSessionEntry(entry: CopilotSessionEntry): Promise<Session | null> {
    const session = await this.buildSessionFromEntry(entry);
    if (session?.status === 'active') this.activeDirPaths.add(entry.dirPath);
    return session;
  }

  /**
   * Builds the Session row from a directory entry. The base scan() has already
   * filtered out dead/PID-reused entries, so any entry reaching here has a live
   * process. Upserts a status='active' row and starts the JSONL watcher. Does
   * not fire callbacks. Returns null only when no repo is registered for the cwd.
   */
  private async buildSessionFromEntry(entry: CopilotSessionEntry): Promise<Session | null> {
    const { sessionId, cwd, pid, dirPath, summary, startedAt, updatedAt } = entry;

    const existingSession = getSession(sessionId);

    const repo = this.resolveRepoOrWarn(entry);
    if (!repo) return null;

    const toIso = (val: string | Date): string =>
      val instanceof Date ? val.toISOString() : val;

    const linkage = this.resolvePtyLinkage(sessionId, existingSession, repo.path, pid, 'lockfile', true);

    const yoloMode = existingSession?.yoloMode != null
      ? existingSession.yoloMode
      : detectYoloModeFromPids(linkage.pid, linkage.hostPid, SessionTypes.COPILOT_CLI);

    const updatedAtIso = toIso(updatedAt);
    const session: Session = {
      id: sessionId,
      repositoryId: repo.id,
      type: SessionTypes.COPILOT_CLI,
      launchMode: linkage.launchMode,
      pid: linkage.pid,
      hostPid: linkage.hostPid,
      pidSource: linkage.pidSource,
      status: 'active',
      startedAt: toIso(startedAt),
      endedAt: null,
      lastActivityAt: existingSession?.lastActivityAt && existingSession.lastActivityAt > updatedAtIso
        ? existingSession.lastActivityAt
        : updatedAtIso,
      summary: existingSession?.summary ?? summary,
      expiresAt: null,
      model: existingSession?.model ?? null,
      reconciled: true,
      yoloMode,
      ptyLaunchId: linkage.ptyLaunchId,
    };

    upsertSession(session);
    await this.watchJsonlFile(sessionId, dirPath);
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
   *   1. End-detection: any DB active/idle session not in this cycle's results
   *      means its lockfile is gone, its dir was cleaned up, or its repo was
   *      removed. Mark ended and fire callback.
   *   2. sigCache diff (shared): fire created/updated callbacks via the base
   *      fireCreatedAndUpdated helper for sessions still active.
   */
  protected dispatchSessionEvents(sessions: Session[]): void {
    const currentIds = new Set(sessions.map((s) => s.id));
    const now = new Date().toISOString();

    const dbActiveSessions = getSessions().filter((s) => s.type === 'copilot-cli' && (s.status === 'active' || s.status === 'idle'));
    for (const session of dbActiveSessions) {
      if (!currentIds.has(session.id)) {
        this.markSessionEnded(session, now, 'no longer detected');
      }
    }

    this.fireCreatedAndUpdated(sessions);
  }
}
