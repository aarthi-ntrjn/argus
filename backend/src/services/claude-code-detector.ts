import * as logger from '../utils/logger.js';
import { normalize } from 'path';

import { getSession, getSessions, upsertSession, updateSessionStatus, getRepositoryByPath, getRepositories } from '../db/database.js';
import { ptyRegistry } from './pty-registry.js';
import { ClaudeSessionRegistry } from './claude-code-session-registry.js';
import { ClaudeJsonlWatcher } from './claude-code-jsonl-watcher.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { detectYoloModeFromPids, isPidRunning, isExpectedProcess } from './process-utils.js';
import { SessionTypes } from '../models/index.js';
import type { Session, Repository, PendingChoice } from '../models/index.js';
import { pendingChoiceEvents } from './pending-choice-events.js';
import { parsePendingChoicePayload } from './pending-choice-utils.js';
import { telemetryService } from './telemetry-service.js';
import type { CliDetector, CliHookPayload } from './cli-detector.js';

export class ClaudeCodeDetector implements CliDetector {
  private jsonlWatcher = new ClaudeJsonlWatcher();
  private pendingChoices = new Map<string, PendingChoice>();
  private sessionCreatedCallback?: (session: Session) => void;
  private sessionUpdatedCallback?: (session: Session) => void;
  private sessionEndedCallback?: (session: Session) => void;
  private registry = new ClaudeSessionRegistry();
  private previousRegistryPids = new Set<number>();
  // Dedup map: last-emitted signature per session, used by reconcileActiveSessions().
  private lastEmittedSigs = new Map<string, string>();

  setSessionCreatedCallback(cb: (session: Session) => void): void {
    this.sessionCreatedCallback = cb;
  }

  setSessionUpdatedCallback(cb: (session: Session) => void): void {
    this.sessionUpdatedCallback = cb;
  }

  /** Wires the callback fired when a session ends due to a disappeared registry file. */
  setSessionEndedCallback(cb: (session: Session) => void): void {
    this.sessionEndedCallback = cb;
  }

  /**
   * Seeds tracking state with sessions that survived from a previous run.
   * Call before the first scan() to prevent spurious session.updated events on startup.
   */
  seedState(sessions: Session[]): void {
    for (const session of sessions) {
      if (session.type !== SessionTypes.CLAUDE_CODE) continue;
      this.lastEmittedSigs.set(session.id, this.sessionSignature(session));
    }
  }

  /** Returns a sessionId-to-PID map for startup stale-session reconciliation only. */
  getRegistryEntries(): Map<string, number> {
    const result = new Map<string, number>();
    for (const entry of this.registry.scanEntries()) {
      result.set(entry.sessionId, entry.pid);
    }
    return result;
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


  /** One-time startup: nothing to initialize for Claude Code before the first scan. */
  async start(): Promise<void> {}

  async scan(): Promise<Session[]> {
    const registryEntries = this.registry.scanEntries();
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
      if (!repo) { logger.warn(`[ClaudeDetector] no repo for cwd="${normalizedCwd}" sessionId=${entry.sessionId} — session ignored`); continue; }

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
          this.lastEmittedSigs.delete(session.id);
          this.sessionEndedCallback?.(ended);
        }
      }
    }
    this.previousRegistryPids = currentPids;

    this.reconcileActiveSessions();
    return [];
  }

  private reconcileActiveSessions(): void {
    try {
      const liveSessions = getSessions({ status: 'active', type: SessionTypes.CLAUDE_CODE });
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
          this.lastEmittedSigs.delete(session.id);
          this.sessionEndedCallback?.(ended);
          continue;
        }

        if (session.pid != null && !isPidRunning(session.pid)) {
          logger.info(`[ClaudeDetector] session ended, process gone sessionId=${session.id} pid=${session.pid}`);
          updateSessionStatus(session.id, 'ended', now);
          this.jsonlWatcher.closeWatcher(session.id);
          const ended = { ...session, status: 'ended' as const, endedAt: now };
          this.lastEmittedSigs.delete(session.id);
          this.sessionEndedCallback?.(ended);
          continue;
        }

        const sig = this.sessionSignature(session);
        if (!this.lastEmittedSigs.has(session.id)) {
          // First time seeing this session in the reconcile loop — seed without firing updated.
          this.lastEmittedSigs.set(session.id, sig);
        } else if (this.lastEmittedSigs.get(session.id) !== sig) {
          this.lastEmittedSigs.set(session.id, sig);
          this.sessionUpdatedCallback?.(session);
        }
      }
    } catch { /* best-effort */ }
  }

  private sessionSignature(session: Session): string {
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

  async handleHookPayload(payload: CliHookPayload): Promise<void> {
    const { hook_event_name, session_id, cwd } = payload;
    if (!session_id) return;

    const normalizedCwd = cwd ? normalize(cwd.trimEnd().replace(/[/\\]+$/, '')) : null;
    const repo = normalizedCwd ? getRepositoryByPath(normalizedCwd) : null;
    if (!repo) { logger.warn(`[ClaudeDetector] no repo for cwd="${normalizedCwd ?? 'none'}" sessionId=${session_id} hook=${hook_event_name} — hook ignored`); return; }

    const existing = getSession(session_id);
    const now = new Date().toISOString();

    if (hook_event_name === 'SessionEnd') {
      return this.handleSessionEnd(existing, session_id, now);
    }
    if (hook_event_name === 'PreToolUse' && payload.tool_name === 'AskUserQuestion') {
      return this.handlePreAskQuestion(session_id, existing, payload, now);
    }
    if (hook_event_name === 'PostToolUse' && payload.tool_name === 'AskUserQuestion') {
      return this.handlePostAskQuestion(session_id, existing, now);
    }

    if (!existing) {
      const claimed = normalizedCwd ? ptyRegistry.claimForSession(session_id, normalizedCwd, 'claude-code') : null;
      if (claimed) {
        return this.createPtySession(session_id, repo, claimed, now);
      }
    }

    this.upsertAndBroadcastSession(session_id, repo, existing, now);
    await this.jsonlWatcher.watchFile(session_id, repo.path);
  }

  private handleSessionEnd(existing: Session | null | undefined, sessionId: string, now: string): void {
    if (!existing) return;
    updateSessionStatus(sessionId, 'ended', now);
    this.jsonlWatcher.closeWatcher(sessionId);
    const ended = { ...existing, status: 'ended' as const, endedAt: now };
    broadcast({ type: 'session.ended', timestamp: now, data: ended });
    telemetryService.sendEvent('session_ended', {
      sessionType: existing.type,
      sessionId: existing.id,
      launchMode: existing.launchMode === 'pty' ? 'connected' : 'readonly',
      yoloMode: existing.yoloMode,
    });
  }

  private handlePreAskQuestion(sessionId: string, existing: Session | null | undefined, payload: CliHookPayload, now: string): void {
    if (!existing) return;
    const { question, choices, allQuestions } = parsePendingChoicePayload(payload.tool_input ?? {});
    this.pendingChoices.set(sessionId, { question, choices, allQuestions });
    broadcast({ type: 'session.pending_choice', timestamp: now, data: { sessionId, question, choices, allQuestions } });
    pendingChoiceEvents.emit('session.pending_choice', { sessionId, question, choices, allQuestions });
  }

  private handlePostAskQuestion(sessionId: string, existing: Session | null | undefined, now: string): void {
    if (!existing) return;
    this.pendingChoices.delete(sessionId);
    broadcast({ type: 'session.pending_choice.resolved', timestamp: now, data: { sessionId } });
    pendingChoiceEvents.emit('session.pending_choice.resolved', sessionId);
  }

  private async createPtySession(sessionId: string, repo: Repository, claimed: { pid: number | null; hostPid: number; ptyLaunchId: string }, now: string): Promise<void> {
    const yoloMode = detectYoloModeFromPids(claimed.pid, claimed.hostPid, 'claude-code');
    const session: Session = {
      id: sessionId,
      repositoryId: repo.id,
      type: 'claude-code',
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
    this.lastEmittedSigs.set(session.id, this.sessionSignature(session));
    this.sessionCreatedCallback?.(session);
    await this.jsonlWatcher.watchFile(sessionId, repo.path);
  }

  private upsertAndBroadcastSession(sessionId: string, repo: Repository, existing: Session | null | undefined, now: string): void {
    const session: Session = existing ?? {
      id: sessionId,
      repositoryId: repo.id,
      type: 'claude-code',
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
    session.status = 'active';
    session.lastActivityAt = now;
    upsertSession(session);
    if (existing) {
      broadcast({ type: 'session.updated', timestamp: now, data: session });
    } else {
      this.lastEmittedSigs.set(session.id, this.sessionSignature(session));
      this.sessionCreatedCallback?.(session);
    }
  }

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
      await this.jsonlWatcher.watchFile(sessionId, repo.path);
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
      this.lastEmittedSigs.set(activated.id, this.sessionSignature(activated));
      this.sessionCreatedCallback?.(activated);
    }
    await this.jsonlWatcher.watchFile(sessionId, repo.path);
  }

  closeSessionWatcher(sessionId: string): void {
    this.jsonlWatcher.closeWatcher(sessionId);
  }

  stop(): void {
    this.jsonlWatcher.stopAll();
  }
}

