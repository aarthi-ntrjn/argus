import * as logger from '../utils/logger.js';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getSession, getSessions, upsertSession, getRepositoryByPath, getRepositories } from '../db/database.js';
import { ptyRegistry } from './pty-registry.js';
import { ClaudeJsonlWatcher } from './claude-code-jsonl-watcher.js';
import { detectYoloModeFromPids, isPidRunning } from './process-utils.js';
import { SessionTypes } from '../models/index.js';
import type { Session } from '../models/index.js';
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
        const data = JSON.parse(readFileSync(join(this.sessionsDir, file), 'utf-8')) as SessionProcessJson;
        if (typeof data.pid !== 'number' || typeof data.sessionId !== 'string' || typeof data.cwd !== 'string') continue;
        entries.push({ sessionId: data.sessionId, pid: data.pid, cwd: data.cwd });
      } catch { /* skip malformed */ }
    }
    return entries;
  }

  /**
   * Per-entry bookkeeping wrapper. The base scan() has already filtered out
   * dead/PID-reused entries, so any entry reaching here has a live process.
   * Records the entry's pid in currentAlivePids before delegating to
   * buildSessionFromEntry — pids are tracked even when buildSessionFromEntry
   * returns null (e.g. no repo) so disappearance detection treats the pid as
   * "still seen this cycle".
   */
  protected async processSessionEntry(entry: ClaudeSessionEntry): Promise<Session | null> {
    this.currentAlivePids.add(entry.pid);
    return this.buildSessionFromEntry(entry);
  }

  /**
   * Builds the Session row from one entry. Looks up the repo, resolves PTY
   * linkage, and decides between fresh-claim, refresh-active, skip-pty-gone,
   * and reactivate paths. Upserts the DB row and watches the JSONL output.
   * Returns the persisted Session; never fires callbacks (dispatchSessionEvents
   * handles created/updated firing).
   */
  private async buildSessionFromEntry(entry: ClaudeSessionEntry): Promise<Session | null> {
    const repo = getRepositoryByPath(entry.cwd);
    if (!repo) {
      this.warnNoRepo(entry.cwd, entry.sessionId);
      return null;
    }

    const now = new Date().toISOString();
    const existingSession = getSession(entry.sessionId);
    const linkage = this.resolvePtyLinkage(entry.sessionId, existingSession, repo.path, entry.pid, 'session_registry', true);

    if (!existingSession && linkage.freshClaim) {
      logger.info(`[ClaudeDetector] session activated via PTY claim sessionId=${entry.sessionId} hostPid=${linkage.freshClaim.hostPid} pid=${linkage.freshClaim.pid}`);
      return this.createPtySession(entry.sessionId, repo, linkage.freshClaim, now);
    }

    if (existingSession?.status === 'active') {
      const yoloMode = existingSession.yoloMode !== null
        ? existingSession.yoloMode
        : detectYoloModeFromPids(linkage.pid, linkage.hostPid, 'claude-code');
      const pidChanged = existingSession.pid !== linkage.pid || existingSession.pidSource !== linkage.pidSource;
      const yoloResolved = existingSession.yoloMode === null && yoloMode !== null;
      let session = existingSession;
      if (pidChanged || yoloResolved) {
        logger.info(`[ClaudeDetector] pid assigned sessionId=${entry.sessionId} pid=${linkage.pid} (was ${existingSession.pid}) yoloMode=${yoloMode}`);
        session = { ...existingSession, pid: linkage.pid, pidSource: linkage.pidSource, yoloMode };
        upsertSession(session);
      }
      await this.watchJsonlFile(entry.sessionId, repo.path);
      return session;
    }

    // Don't re-activate a PTY session whose launcher has already disconnected:
    // a fresh launcher would be a new CLI process and binding it to the old
    // sessionId would route prompts to the wrong process.
    if (existingSession?.launchMode === 'pty' && !ptyRegistry.has(entry.sessionId)) {
      logger.info(`[ClaudeDetector] skipping re-activation — PTY launcher gone sessionId=${entry.sessionId}`);
      return existingSession;
    }

    this.closeJsonlWatcher(entry.sessionId);
    const base: Session = existingSession ?? {
      id: entry.sessionId,
      repositoryId: repo.id,
      type: 'claude-code',
      launchMode: linkage.launchMode,
      pid: linkage.pid,
      hostPid: linkage.hostPid,
      pidSource: linkage.pidSource,
      status: 'active',
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
      reconciled: true,
      yoloMode: linkage.pid ? detectYoloModeFromPids(linkage.pid, linkage.hostPid, 'claude-code') : null,
      ptyLaunchId: linkage.ptyLaunchId,
    };
    const activated = { ...base, status: 'active' as const, endedAt: null as null, lastActivityAt: now, pid: linkage.pid };
    logger.info(`[ClaudeDetector] session activated sessionId=${entry.sessionId} pid=${linkage.pid}`);
    upsertSession(activated);
    await this.watchJsonlFile(entry.sessionId, repo.path);
    return activated;
  }

  /**
   * Three-stage dispatch:
   *   1. Disappearance: any pid that was alive last cycle but is gone this cycle
   *      means the session file vanished. End the matching DB session.
   *   2. sigCache diff (shared): fire created/updated callbacks via the base
   *      fireCreatedAndUpdated helper.
   *   3. Reconcile safety net: catches sessions not visible in the session-file
   *      scan (e.g. PTY sessions whose session file never appeared) by checking
   *      PID liveness and repo existence directly.
   */
  protected dispatchSessionEvents(sessions: Session[]): void {
    const now = new Date().toISOString();

    for (const oldPid of this.previousAlivePids) {
      if (this.currentAlivePids.has(oldPid)) continue;
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
   * Liveness safety net for sessions not visible in the session-file scan (e.g.
   * PTY sessions whose session file never appeared, or sessions whose repo was
   * removed). Walks all active+idle Claude sessions in the DB and:
   *
   * - Repo removed: end the session.
   * - Process dead: end the session.
   * - Field change since last cycle: fire sessionUpdatedCallback (deduped via sigCache).
   *
   * The sigCache diff here only catches drifts that processSessionEntry didn't
   * already update for — those will already have been dispatched above.
   */
  private reconcileActiveSessions(): void {
    try {
      const liveSessions = [
        ...getSessions({ status: 'active', type: SessionTypes.CLAUDE_CODE }),
        ...getSessions({ status: 'idle', type: SessionTypes.CLAUDE_CODE }),
      ];
      if (liveSessions.length === 0) return;

      const repos = getRepositories();
      const now = new Date().toISOString();

      for (const session of liveSessions) {
        const repo = repos.find((r) => r.id === session.repositoryId);
        if (!repo) {
          this.markSessionEnded(session, now, 'repo removed');
          continue;
        }

        if (session.pid != null && !isPidRunning(session.pid)) {
          this.markSessionEnded(session, now, 'process gone');
          continue;
        }

        const sig = this.sessionSignature(session);
        if (!this.sigCache.has(session.id)) {
          this.sigCache.set(session.id, sig);
        } else if (this.sigCache.get(session.id) !== sig) {
          this.sigCache.set(session.id, sig);
          this.sessionUpdatedCallback?.(session);
        }
      }
    } catch { /* best-effort */ }
  }
}
