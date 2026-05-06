import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getSessions, getRepositories } from '../db/database.js';
import { ClaudeJsonlWatcher } from './claude-code-jsonl-watcher.js';
import { isPidRunning } from './process-utils.js';
import { SessionTypes } from '../models/index.js';
import type { Session, Repository } from '../models/index.js';
import type { CliDetector } from './cli-detector.js';
import { BaseCliDetector, type SessionEntry } from './base-cli-detector.js';

/**
 * Under the hood, Claude Code writes a JSON file per session in ~/.claude/sessions/*.json
 * with the PID and CWD, which we can use for detection and tracking.
 * The hooks are the primary real-time signal, while the on-disk session files are a
 * secondary signal we scan on a timer for reconciliation and edge cases (sessions
 * started without hooks, PID backfill, unclean shutdown detection).
 *
 * Example session file: ~/.claude/sessions/13232.json
 * {
 *   "pid": 13232,
 *   "sessionId": "0f63ac9c-1cdf-47fe-abb1-d6b3bef059a1",
 *   "cwd": "C:\\source\\github\\aarthi-ntrjn\\argus",
 *   "startedAt": 1777845541042,
 *   "procStart": "639134171321274940",
 *   "version": "2.1.126",
 *   "peerProtocol": 1,
 *   "kind": "interactive",
 *   "entrypoint": "cli",
 *   "status": "idle",
 *   "updatedAt": 1777845921982
 * }
 */

const DEFAULT_SESSIONS_DIR = join(homedir(), '.claude', 'sessions');

interface SessionProcessJson {
  pid?: number;
  sessionId?: string;
  cwd?: string;
}

/** Parsed entry from one ~/.claude/sessions/*.json file. The on-disk session file always carries a non-null pid. */
interface ClaudeSessionEntry extends SessionEntry {
  pid: number;
}

/**
 * Detects and tracks Claude Code sessions.
 *
 * Detection model: event-driven via two complementary sources.
 *
 * Primary path — HTTP hooks: Claude fires PreToolUse / PostToolUse / SessionEnd events
 * to /hooks/claude on every tool call. handleHookPayload() creates or updates the DB
 * session and fires sessionCreatedCallback immediately.
 *
 * Secondary path — session-file scan: scan() reads ~/.claude/sessions/*.json on every
 * cycle. This catches sessions that started without hooks (e.g. legacy installs) and
 * backfills the PID once Claude writes it to its session file. It also detects
 * unclean shutdowns where SessionEnd never fired (session file disappears).
 *
 * The base scan() pipeline calls readSessionEntries → processSessionEntry per entry
 * → dispatchSessionEvents. Claude's dispatchSessionEvents adds a reconcileActiveSessions
 * safety net that catches PTY sessions that don't appear in the session-file scan.
 */
export class ClaudeCodeDetector extends BaseCliDetector<ClaudeSessionEntry> implements CliDetector {
  protected readonly jsonlWatcher = new ClaudeJsonlWatcher();
  protected readonly sessionsDir: string;
  /**
   * Disappearance-detection bookkeeping. Each scan tracks every pid that
   * passed the alive+expected-process guards into currentAlivePids. At the
   * end of dispatch, the diff (previous \ current) identifies sessions whose
   * file vanished between cycles, so we can end them.
   *
   * Pids are tracked regardless of whether buildSessionFromEntry produced a
   * Session — a no-repo entry still counts as "seen alive this cycle", which
   * keeps disappearance from firing spuriously on entries that were already
   * filtered out earlier in the same cycle.
   *
   * This is the broader of the two scan-set semantics in this codebase: it
   * tracks ALL alive pids. Copilot's activeDirPaths tracks the narrower
   * subset (alive AND yielded an active session) for a different purpose
   * (mtime-filter override).
   */
  private previousAlivePids = new Set<number>();
  private currentAlivePids = new Set<number>();

  protected readonly logTag = '[ClaudeDetector]';
  protected readonly askUserToolName = 'AskUserQuestion';
  protected readonly toolTypeId = 'claude-code' as const;

  constructor(sessionsDir: string = DEFAULT_SESSIONS_DIR) {
    super();
    this.sessionsDir = sessionsDir;
  }

  /** Reads ~/.claude/sessions/*.json and returns one parsed entry per valid file. */
  protected async readSessionEntries(_force: boolean): Promise<ClaudeSessionEntry[]> {
    this.currentAlivePids = new Set();
    const files = readdirSync(this.sessionsDir).filter((f) => f.endsWith('.json'));
    const entries: ClaudeSessionEntry[] = [];
    for (const file of files) {
      try {
        const data = JSON.parse(
          readFileSync(join(this.sessionsDir, file), 'utf-8'),
        ) as SessionProcessJson;
        if (
          typeof data.pid !== 'number' ||
          typeof data.sessionId !== 'string' ||
          typeof data.cwd !== 'string'
        )
          {continue;}
        entries.push({ sessionId: data.sessionId, pid: data.pid, cwd: data.cwd });
      } catch {
        /* skip malformed */
      }
    }
    return entries;
  }

  /**
   * Tracks every alive pid in currentAlivePids so disappearance detection in
   * the next cycle can tell which sessions vanished. Runs before the repo
   * filter, so no-repo entries still count as "seen alive this cycle".
   */
  protected onAliveEntry(entry: ClaudeSessionEntry): void {
    this.currentAlivePids.add(entry.pid);
  }

  protected readonly defaultPidSource = 'session_registry' as const;

  protected resolveWatchPath(_entry: ClaudeSessionEntry, repo: Repository): string {
    return repo.path;
  }

  /** Session timestamps and summary for the reactivation/new-session path. */
  protected buildNewSessionFields(
    _entry: ClaudeSessionEntry,
    existingSession: Session | undefined | null,
    now: string,
  ): { startedAt: string; lastActivityAt: string; summary: string | null } {
    return {
      startedAt: existingSession?.startedAt ?? now,
      lastActivityAt: now,
      summary: existingSession?.summary ?? null,
    };
  }

  /**
   * Three-stage dispatch:
   *   1. Disappearance: any pid that was alive last cycle but is gone this cycle
   *      means the session file vanished. End the matching DB session.
   *   2. sigCache diff (shared): fire created/updated callbacks via the base
   *      fireCreatedAndUpdated helper.
   *   3. reconcileActiveSessions safety net: catches sessions that pid-tracking
   *      cannot reach — repo removed while Claude runs, or Argus restart with
   *      a stale active session whose process and session file are both gone.
   */
  protected dispatchSessionEvents(sessions: Session[]): void {
    const now = new Date().toISOString();

    for (const oldPid of this.previousAlivePids) {
      if (this.currentAlivePids.has(oldPid)) {continue;}
      const activeSessions = getSessions({ status: 'active', type: SessionTypes.CLAUDE_CODE });
      for (const session of activeSessions) {
        if (session.pid === oldPid && session.pidSource === 'session_registry') {
          this.markSessionEnded(session, now, 'session file gone');
        }
      }
    }
    this.previousAlivePids = new Set(this.currentAlivePids);

    this.fireCreatedAndUpdated(sessions);

    this.reconcileActiveSessions();
  }

  /**
   * Ends active/idle Claude sessions that can't be caught by the pid-tracking
   * disappearance detection in dispatchSessionEvents:
   *
   * - Repo removed while Claude is running: the session file and process are
   *   still alive so the pid stays in currentAlivePids, but resolveRepoOrWarn
   *   filters the entry out so it never enters the scan results.
   *
   * - Dead process with no visible session file: happens after an Argus restart
   *   when Claude crashed while Argus was down. previousAlivePids is empty on
   *   first scan so the pid-diff can't fire; the session file is gone so
   *   processSessionEntry is never called.
   */
  private reconcileActiveSessions(): void {
    try {
      const liveSessions = [
        ...getSessions({ status: 'active', type: SessionTypes.CLAUDE_CODE }),
        ...getSessions({ status: 'idle', type: SessionTypes.CLAUDE_CODE }),
      ];
      if (liveSessions.length === 0) {return;}
      const repos = getRepositories();
      const now = new Date().toISOString();
      for (const session of liveSessions) {
        if (!repos.some((r) => r.id === session.repositoryId)) {
          this.markSessionEnded(session, now, 'repo removed');
          continue;
        }
        if (session.pid != null && !isPidRunning(session.pid)) {
          this.markSessionEnded(session, now, 'process gone');
        }
      }
    } catch {
      /* best-effort */
    }
  }
}
