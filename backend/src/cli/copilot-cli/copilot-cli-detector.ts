import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { load as yamlLoad } from 'js-yaml';
import { randomUUID } from 'crypto';
import { getSessions, getServerState, setServerState } from '../../db/database.js';
import { CopilotJsonlWatcher } from './copilot-cli-jsonl-watcher.js';
import { pendingChoiceEvents } from '../pending-choice-events.js';
import { broadcast } from '../../api/ws/event-dispatcher.js';
import { buildCopilotPermissionChoice } from '../pending-choice-utils.js';
import type { Session, Repository } from '../../models/index.js';
import type { CliDetector } from '../cli-detector.js';
import { BaseCliDetector, type SessionEntry } from '../base-cli-detector.js';

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

/** js-yaml may yield Date or string for unquoted vs quoted timestamps. Normalize to ISO string. */
function toIsoString(val: string | Date | undefined): string | null {
  if (val === undefined) {
    return null;
  }
  return val instanceof Date ? val.toISOString() : val;
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
  startedAt: string;
  updatedAt: string;
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
export class CopilotCliDetector
  extends BaseCliDetector<CopilotSessionEntry>
  implements CliDetector
{
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
    this.subscribePermissionEvents();
  }

  /** Drives Copilot approval cards via JSONL permission.requested / permission_resolved events
   * instead of the PreToolUse/PostToolUse hook debounce path (which is batched per-turn). */
  private subscribePermissionEvents(): void {
    pendingChoiceEvents.on(
      'session.permission_requested',
      (sessionId: string, kind: string, commandText: string) => {
        const { question, choices, allQuestions } = buildCopilotPermissionChoice(kind, commandText);
        this.pendingChoices.set(sessionId, {
          type: 'tool_approval',
          question,
          choices,
          allQuestions,
        });
        const now = new Date().toISOString();
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
      },
    );

    pendingChoiceEvents.on('session.permission_resolved', (sessionId: string) => {
      this.pendingChoices.delete(sessionId);
      const now = new Date().toISOString();
      broadcast({ type: 'session.pending_choice.resolved', timestamp: now, data: { sessionId } });
      pendingChoiceEvents.emit('session.pending_choice.resolved', sessionId);
    });
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
        if (!entry.isDirectory()) {
          continue;
        }
        const dirPath = join(this.sessionsDir, entry.name);
        if (previousActive.has(dirPath) || force) {
          dirsToProcess.add(dirPath);
          continue;
        }
        try {
          if (statSync(dirPath).mtimeMs > this.lastScanTime) {
            dirsToProcess.add(dirPath);
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }

    this.activeDirPaths = new Set();
    this.lastScanTime = t0;
    setServerState('copilot_last_scan_time', String(t0));

    const result: CopilotSessionEntry[] = [];
    const nowIso = new Date().toISOString();
    for (const dirPath of dirsToProcess) {
      const data = this.readDirEntry(dirPath);
      if (!data) {
        continue;
      }
      const cwd = data.workspace.cwd;
      if (!cwd) {
        continue;
      }
      result.push({
        sessionId: data.workspace.id ?? randomUUID(),
        cwd,
        pid: data.pid,
        dirPath,
        summary: data.workspace.summary ?? null,
        // js-yaml parses unquoted ISO timestamps as Date and quoted ones as string;
        // normalize both to ISO string here so downstream code only sees strings.
        startedAt: toIsoString(data.workspace.created_at) ?? nowIso,
        updatedAt: toIsoString(data.workspace.updated_at) ?? nowIso,
      });
    }
    return result;
  }

  protected readonly defaultPidSource = 'lockfile' as const;

  protected resolveWatchPath(entry: CopilotSessionEntry, _repo: Repository): string {
    return entry.dirPath;
  }

  /** Session timestamps and summary for the reactivation/new-session path. */
  protected buildNewSessionFields(
    entry: CopilotSessionEntry,
    existingSession: Session | undefined | null,
    _now: string,
  ): { startedAt: string; lastActivityAt: string; summary: string | null } {
    return {
      startedAt: entry.startedAt,
      lastActivityAt:
        existingSession?.lastActivityAt && existingSession.lastActivityAt > entry.updatedAt
          ? existingSession.lastActivityAt
          : entry.updatedAt,
      summary: existingSession?.summary ?? entry.summary,
    };
  }

  /**
   * Records dirPaths of sessions that ended this cycle as 'active'. The mtime
   * filter in readSessionEntries always re-checks these dirs next cycle so we
   * detect the eventual end transition promptly.
   */
  protected onSessionBuilt(entry: CopilotSessionEntry, session: Session | null): void {
    if (session?.status === 'active') {
      this.activeDirPaths.add(entry.dirPath);
    }
  }

  private findLockFile(dirPath: string): string | null {
    try {
      const files = readdirSync(dirPath);
      return files.find((f) => f.startsWith('inuse.') && f.endsWith('.lock')) ?? null;
    } catch {
      return null;
    }
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
    } catch {
      return null;
    }
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

    const dbActiveSessions = getSessions().filter(
      (s) => s.type === 'copilot-cli' && (s.status === 'active' || s.status === 'idle'),
    );
    for (const session of dbActiveSessions) {
      if (!currentIds.has(session.id)) {
        this.markSessionEnded(session, now, 'no longer detected');
      }
    }

    this.fireCreatedAndUpdated(sessions);
  }
}
