import * as logger from '../utils/logger.js';
import { readdirSync, readFileSync } from 'fs';
import { join, normalize } from 'path';
import { homedir } from 'os';
import { getSession, getSessions, upsertSession, updateSessionStatus, getRepositoryByPath, getRepositories } from '../db/database.js';
import { ptyRegistry } from './pty-registry.js';
import { ClaudeJsonlWatcher } from './claude-code-jsonl-watcher.js';
import { detectYoloModeFromPids, isPidRunning, isExpectedProcess } from './process-utils.js';
import { SessionTypes } from '../models/index.js';
import type { Session, Repository } from '../models/index.js';
import type { CliDetector } from './cli-detector.js';
import { BaseCliDetector } from './base-cli-detector.js';


/**
 * Under the hood, Claude Code writes a JSON file per session in ~/.claude/sessions/*.json
 * with the PID and CWD, which we can use for detection and tracking.
 * The hooks are the primary real-time signal, while the registry files are a secondary
 * signal we scan on a timer for reconciliation and edge cases (sessions started without
 * hooks, PID backfill, unclean shutdown detection).
 *
 * Example registry file: ~/.claude/sessions/13232.json
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

/** Parsed entry from one ~/.claude/sessions/*.json file. */
interface ClaudeRegistryEntry {
  sessionId: string;
  pid: number;
  cwd: string;
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
 * Secondary path — registry scan: scan() reads ~/.claude/sessions/*.json on every
 * cycle. This catches sessions that started without hooks (e.g. legacy installs) and
 * backfills the PID once Claude writes it to its registry file. It also detects
 * unclean shutdowns where SessionEnd never fired (registry file disappears).
 *
 * The base scan() pipeline calls readSessionEntries → processSessionEntry per entry
 * → dispatchSessionEvents. Claude's dispatchSessionEvents adds a reconcileActiveSessions
 * safety net that catches PTY sessions that don't appear in the registry scan.
 */
export class ClaudeCodeDetector extends BaseCliDetector<ClaudeRegistryEntry> implements CliDetector {
  private readonly jsonlWatcher = new ClaudeJsonlWatcher();
  protected readonly sessionsDir: string;
  /** PIDs that passed the alive+expected-process guards in the previous scan. */
  private previousAlivePids = new Set<number>();
  /** PIDs that pass the alive+expected-process guards in the current scan. */
  private currentAlivePids = new Set<number>();

  protected readonly logTag = '[ClaudeDetector]';
  protected readonly askUserToolName = 'AskUserQuestion';
  protected readonly toolTypeId = 'claude-code' as const;

  constructor(sessionsDir: string = DEFAULT_SESSIONS_DIR) {
    super();
    this.sessionsDir = sessionsDir;
  }

  /** Reads ~/.claude/sessions/*.json and returns one parsed entry per valid file. */
  protected async readSessionEntries(_force: boolean): Promise<ClaudeRegistryEntry[]> {
    this.currentAlivePids = new Set();
    const files = readdirSync(this.sessionsDir).filter((f) => f.endsWith('.json'));
    const entries: ClaudeRegistryEntry[] = [];
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
   * Per-entry pipeline: liveness + identity guards, repo lookup, then activate.
   * Records the entry's pid in currentAlivePids before the repo check so a
   * removed-repo session still counts as "alive this cycle" for disappearance
   * detection.
   */
  protected async processSessionEntry(entry: ClaudeRegistryEntry): Promise<Session | null> {
    if (!isPidRunning(entry.pid)) return null;
    if (!isExpectedProcess(entry.pid, 'claude-code')) {
      logger.info(`[ClaudeDetector] PID reuse detected: pid ${entry.pid} is running with wrong name, skipping (sessionId=${entry.sessionId})`);
      return null;
    }
    this.currentAlivePids.add(entry.pid);

    const normalizedCwd = normalize(entry.cwd.trimEnd().replace(/[/\\]+$/, ''));
    const repo = getRepositoryByPath(normalizedCwd);
    if (!repo) {
      logger.warn(`[ClaudeDetector] no repo for cwd="${normalizedCwd}" sessionId=${entry.sessionId} — session ignored`);
      return null;
    }

    return this.activateFoundSession(entry.sessionId, repo, entry.pid);
  }

  /**
   * Resolves PTY linkage and decides between fresh-claim, refresh-active,
   * skip-pty-gone, and reactivate paths. Upserts the DB row and watches the
   * JSONL output. Returns the persisted Session; never fires callbacks
   * (dispatchSessionEvents handles created/updated firing).
   */
  private async activateFoundSession(sessionId: string, repo: Repository, claudePid: number): Promise<Session | null> {
    const now = new Date().toISOString();
    const existingSession = getSession(sessionId);
    const linkage = this.resolvePtyLinkage(sessionId, existingSession, repo.path, claudePid, 'session_registry', true);

    if (!existingSession && linkage.freshClaim) {
      logger.info(`[ClaudeDetector] session activated via PTY claim sessionId=${sessionId} hostPid=${linkage.freshClaim.hostPid} pid=${linkage.freshClaim.pid}`);
      return this.createPtySession(sessionId, repo, linkage.freshClaim, now);
    }

    if (existingSession?.status === 'active') {
      const yoloMode = existingSession.yoloMode !== null
        ? existingSession.yoloMode
        : detectYoloModeFromPids(linkage.pid, linkage.hostPid, 'claude-code');
      const pidChanged = existingSession.pid !== linkage.pid || existingSession.pidSource !== linkage.pidSource;
      const yoloResolved = existingSession.yoloMode === null && yoloMode !== null;
      let session = existingSession;
      if (pidChanged || yoloResolved) {
        logger.info(`[ClaudeDetector] pid assigned sessionId=${sessionId} pid=${linkage.pid} (was ${existingSession.pid}) yoloMode=${yoloMode}`);
        session = { ...existingSession, pid: linkage.pid, pidSource: linkage.pidSource, yoloMode };
        upsertSession(session);
      }
      await this.watchJsonlFile(sessionId, repo.path);
      return session;
    }

    // Don't re-activate a PTY session whose launcher has already disconnected:
    // a fresh launcher would be a new CLI process and binding it to the old
    // sessionId would route prompts to the wrong process.
    if (existingSession?.launchMode === 'pty' && !ptyRegistry.has(sessionId)) {
      logger.info(`[ClaudeDetector] skipping re-activation — PTY launcher gone sessionId=${sessionId}`);
      return existingSession;
    }

    this.closeJsonlWatcher(sessionId);
    const base: Session = existingSession ?? {
      id: sessionId,
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
    logger.info(`[ClaudeDetector] session activated sessionId=${sessionId} pid=${linkage.pid}`);
    upsertSession(activated);
    await this.watchJsonlFile(sessionId, repo.path);
    return activated;
  }

  /**
   * Three-stage dispatch:
   *   1. Disappearance: any pid that was alive last cycle but is gone this cycle
   *      means the registry file vanished. End the matching DB session.
   *   2. sigCache diff: fire created for new sessions, updated for changed ones.
   *   3. Reconcile safety net: catches sessions not visible in the registry scan
   *      (e.g. PTY sessions whose registry file never appeared) by checking PID
   *      liveness and repo existence directly.
   */
  protected dispatchSessionEvents(sessions: Session[]): void {
    const now = new Date().toISOString();

    for (const oldPid of this.previousAlivePids) {
      if (this.currentAlivePids.has(oldPid)) continue;
      const activeSessions = getSessions({ status: 'active', type: SessionTypes.CLAUDE_CODE });
      for (const session of activeSessions) {
        if (session.pid === oldPid && session.pidSource === 'session_registry') {
          logger.info(`[ClaudeDetector] session ended, registry file gone sessionId=${session.id} pid=${oldPid}`);
          updateSessionStatus(session.id, 'ended', now);
          this.closeJsonlWatcher(session.id);
          const ended = { ...session, status: 'ended' as const, endedAt: now };
          this.sigCache.delete(session.id);
          this.sessionEndedCallback?.(ended);
        }
      }
    }
    this.previousAlivePids = new Set(this.currentAlivePids);

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

    this.reconcileActiveSessions();
  }

  /**
   * Liveness safety net for sessions not visible in the registry scan (e.g. PTY
   * sessions whose registry file never appeared, or sessions whose repo was
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
          logger.info(`[ClaudeDetector] session ended, repo removed sessionId=${session.id}`);
          updateSessionStatus(session.id, 'ended', now);
          this.closeJsonlWatcher(session.id);
          const ended = { ...session, status: 'ended' as const, endedAt: now };
          this.sigCache.delete(session.id);
          this.sessionEndedCallback?.(ended);
          continue;
        }

        if (session.pid != null && !isPidRunning(session.pid)) {
          logger.info(`[ClaudeDetector] session ended, process gone sessionId=${session.id} pid=${session.pid}`);
          updateSessionStatus(session.id, 'ended', now);
          this.closeJsonlWatcher(session.id);
          const ended = { ...session, status: 'ended' as const, endedAt: now };
          this.sigCache.delete(session.id);
          this.sessionEndedCallback?.(ended);
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

  protected watchJsonlFile(sessionId: string, repoPath: string): Promise<void> {
    return this.jsonlWatcher.watchFile(sessionId, repoPath);
  }

  protected closeJsonlWatcher(sessionId: string): void {
    this.jsonlWatcher.closeWatcher(sessionId);
  }

  stop(): void {
    this.jsonlWatcher.stopAll();
  }
}
