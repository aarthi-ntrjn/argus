import * as logger from '../utils/logger.js';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, normalize } from 'path';
import { homedir } from 'os';

import { getSession, getSessions, upsertSession, updateSessionStatus, getRepositoryByPath, getRepositories } from '../db/database.js';
import { ptyRegistry } from './pty-registry.js';
import { ClaudeJsonlWatcher } from './claude-code-jsonl-watcher.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
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

const DEFAULT_SESSIONS_DIR= join(homedir(), '.claude', 'sessions');

interface SessionProcessJson {
  pid?: number;
  sessionId?: string;
  cwd?: string;
  startedAt?: number;
  procStart?: string;
  version?: string;
  peerProtocol?: number;
  kind?: string;
  entrypoint?: string;
  status?: string;
  updatedAt?: number;
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
 * Reconciliation: reconcileActiveSessions() (called at the end of every scan()) checks
 * all active DB sessions for liveness (process dead, repo removed) and fires
 * sessionEndedCallback on failure or sessionUpdatedCallback when a tracked field changes.
 */
export class ClaudeCodeDetector extends BaseCliDetector implements CliDetector {
  private readonly jsonlWatcher = new ClaudeJsonlWatcher();
  private readonly sessionsDir: string;
  private previousRegistryPids = new Set<number>();

  protected readonly logTag = '[ClaudeDetector]';
  protected readonly askUserToolName = 'AskUserQuestion';
  protected readonly toolTypeId = 'claude-code' as const;

  constructor(sessionsDir: string = DEFAULT_SESSIONS_DIR) {
    super();
    this.sessionsDir = sessionsDir;
  }

  /**
   * Per-cycle scan.Two responsibilities:
   *
   * 1. Registry sweep: read ~/.claude/sessions/*.json, backfill PIDs for hook-created
   *    sessions, and detect new sessions that started without hooks firing.
   *    Fires sessionCreatedCallback for genuinely new sessions.
   *    Detects registry-file disappearance as an unclean session end.
   *
   * 2. Reconciliation: call reconcileActiveSessions() to detect liveness failures
   *    (process died, repo deleted) and emit sessionUpdated/sessionEnded accordingly.
   *
   * Always returns []. ClaudeCodeDetector is fully push-based — all session events
   * are delivered via callbacks, not via the return value.
   */
  async scan(): Promise<Session[]> {
    const registryEntries = this.scanSessionFiles();
    const currentPids = new Set<number>();
    const now = new Date().toISOString();

    for (const entry of registryEntries) {
      // Guard 1: process is running (cheap signal-0 check)
      // Guard 2: verify the process is actually the expected AI tool (catches recycled PIDs)
      if (!isPidRunning(entry.pid)) continue;
      if (!isExpectedProcess(entry.pid, 'claude-code')) {
        logger.info(`[ClaudeDetector] PID reuse detected: pid ${entry.pid} is running with wrong name, skipping (sessionId=${entry.sessionId})`);
        continue;
      }

      currentPids.add(entry.pid);

      const normalizedCwd = normalize(entry.cwd.trimEnd().replace(/[/\\]+$/, ''));
      const repo = getRepositoryByPath(normalizedCwd);
      if (!repo) { 
        logger.warn(`[ClaudeDetector] no repo for cwd="${normalizedCwd}" sessionId=${entry.sessionId} — session ignored`); 
        continue; 
      }

      // Backfill PID from registry if the session was created via hooks without a PID.
      // Skip PTY-sourced PIDs — the PTY registry is more authoritative.
      const existing = getSession(entry.sessionId);
      if (existing && existing.pidSource !== 'pty_registry') {
        const pidChanged = existing.pid !== entry.pid || existing.pidSource !== 'session_registry';
        const yoloMode = existing.yoloMode !== null ? existing.yoloMode : detectYoloModeFromPids(entry.pid, null, 'claude-code');
        const yoloResolved = existing.yoloMode === null && yoloMode !== null;
        if (pidChanged || yoloResolved) {
          logger.info(`[ClaudeDetector] pid assigned sessionId=${entry.sessionId} pid=${entry.pid} (was ${existing.pid}) yoloMode=${yoloMode}`);
          const updated = { ...existing, pid: entry.pid, pidSource: 'session_registry' as const, yoloMode };
          upsertSession(updated);
          broadcast({ type: 'session.updated', timestamp: now, data: updated });
        }
      }

      await this.activateFoundSession(entry.sessionId, repo, entry.pid);
    }

    // Detect sessions whose registry file disappeared (unclean shutdown, SessionEnd hook not fired).
    for (const oldPid of this.previousRegistryPids) {
      if (currentPids.has(oldPid)) continue;
      const activeSessions = getSessions({ status: 'active', type: SessionTypes.CLAUDE_CODE });
      for (const session of activeSessions) {
        if (session.pid === oldPid && session.pidSource === 'session_registry') {
          logger.info(`[ClaudeDetector] session ended, registry file gone sessionId=${session.id} pid=${oldPid}`);
          updateSessionStatus(session.id, 'ended', now);
          this.jsonlWatcher.closeWatcher(session.id);
          const ended = { ...session, status: 'ended' as const, endedAt: now };
          this.sigCache.delete(session.id);
          this.sessionEndedCallback?.(ended);
        }
      }
    }
    this.previousRegistryPids = currentPids;

    this.reconcileActiveSessions();
    return [];
  }

  // Reads ~/.claude/sessions/*.json and returns the pid/sessionId/cwd for each valid entry.
  private scanSessionFiles(): Array<{ pid: number; sessionId: string; cwd: string }> {
    if (!existsSync(this.sessionsDir)) return [];
    const files = readdirSync(this.sessionsDir).filter(f => f.endsWith('.json'));
    const entries: Array<{ pid: number; sessionId: string; cwd: string }> = [];
    for (const file of files) {
      try {
        const data = JSON.parse(readFileSync(join(this.sessionsDir, file), 'utf-8')) as SessionProcessJson;
        if (typeof data.pid !== 'number' || typeof data.sessionId !== 'string' || typeof data.cwd !== 'string') continue;
        entries.push({ pid: data.pid, sessionId: data.sessionId, cwd: data.cwd });
      } catch { /* skip malformed */ }
    }
    return entries;
  }

  /**
   * Called from the registry scan when a session is found for the first time
   * (hook-created session without a registry file yet, or a hooks-free session).
   * Attempts to link a PTY; fires sessionCreatedCallback.
   */
  private async activateFoundSession(sessionId: string, repo: Repository, claudePid: number | null): Promise<void> {
    const now = new Date().toISOString();
    const existingSession = getSession(sessionId);

    if (!existingSession) {
      const claimed = ptyRegistry.claimForSession(sessionId, repo.path, 'claude-code');
      if (claimed) {
        logger.info(`[ClaudeDetector] session activated via PTY claim sessionId=${sessionId} hostPid=${claimed.hostPid} pid=${claimed.pid}`);
        await this.createPtySession(sessionId, repo, claimed, now);
        return;
      }
    }

    if (existingSession?.status === 'active') {
      await this.watchJsonlFile(sessionId, repo.path);
      return;
    }

    // Don't re-activate a PTY session whose launcher has already disconnected.
    // When the terminal closes, the WS close handler calls ptyRegistry.unregister(),
    // so has() being false means the launcher is gone and the session should stay ended.
    if (existingSession?.launchMode === 'pty' && !ptyRegistry.has(sessionId)) {
      logger.info(`[ClaudeDetector] skipping re-activation — PTY launcher gone sessionId=${sessionId}`);
      return;
    }
    this.jsonlWatcher.closeWatcher(sessionId);
    const base: Session = existingSession ?? {
      id: sessionId,
      repositoryId: repo.id,
      type: 'claude-code',
      launchMode: null,
      pid: claudePid,
      hostPid: null,
      pidSource: claudePid !== null ? 'session_registry' as const : null,
      status: 'active',
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
      reconciled: true,
      yoloMode: claudePid ? detectYoloModeFromPids(claudePid, null, 'claude-code') : null,
    };
    const isNewSession = !existingSession;
    const activated = { ...base, status: 'active' as const, endedAt: null as null, lastActivityAt: now, pid: claudePid };
    logger.info(`[ClaudeDetector] session activated sessionId=${sessionId} pid=${claudePid}`);
    upsertSession(activated);
    if (isNewSession) {
      this.sigCache.set(activated.id, this.sessionSignature(activated));
      this.sessionCreatedCallback?.(activated);
    }
    await this.watchJsonlFile(sessionId, repo.path);
  }

  /**
   * Checks all active Claude Code DB sessions for liveness and field changes.
   * Called at the end of every scan() cycle.
   *
   * - Repo removed: end the session immediately.
   * - Process dead: end the session (catches crashes not covered by SessionEnd hook).
   * - Field change: fire sessionUpdatedCallback (deduped via sigCache).
   *
   * First time a session is seen here its sig is seeded without firing updated,
   * preventing a spurious update event on the cycle right after creation.
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
        const repo = repos.find(r => r.id === session.repositoryId);
        if (!repo) {
          logger.info(`[ClaudeDetector] session ended, repo removed sessionId=${session.id}`);
          updateSessionStatus(session.id, 'ended', now);
          this.jsonlWatcher.closeWatcher(session.id);
          const ended = { ...session, status: 'ended' as const, endedAt: now };
          this.sigCache.delete(session.id);
          this.sessionEndedCallback?.(ended);
          continue;
        }

        if (session.pid != null && !isPidRunning(session.pid)) {
          logger.info(`[ClaudeDetector] session ended, process gone sessionId=${session.id} pid=${session.pid}`);
          updateSessionStatus(session.id, 'ended', now);
          this.jsonlWatcher.closeWatcher(session.id);
          const ended = { ...session, status: 'ended' as const, endedAt: now };
          this.sigCache.delete(session.id);
          this.sessionEndedCallback?.(ended);
          continue;
        }

        const sig = this.sessionSignature(session);
        if (!this.sigCache.has(session.id)) {
          // First time seeing this session in the reconcile loop — seed without firing updated.
          this.sigCache.set(session.id, sig);
        } else if (this.sigCache.get(session.id) !== sig) {
          this.sigCache.set(session.id, sig);
          this.sessionUpdatedCallback?.(session);
        }
      }
    } catch { /* best-effort */ }
  }

  closeSessionWatcher(sessionId: string): void {
    this.jsonlWatcher.closeWatcher(sessionId);
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

