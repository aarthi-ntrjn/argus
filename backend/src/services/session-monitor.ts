import { EventEmitter } from 'events';
import psList from 'ps-list';
import { RepositoryScanner } from './repository-scanner.js';
import { CliManager } from './cli-manager.js';
import { loadConfig } from '../config/config-loader.js';
import { getSessions, getSession, getRepository, updateSessionStatus, getRepositories, updateRepositoryBranch } from '../db/database.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { getCurrentBranch } from './repository-scanner.js';
import * as logger from '../utils/logger.js';
import { isPidRunning } from './process-utils.js';
import { isAiToolProcess } from './pid-validator.js';
import { SessionTypes } from '../models/index.js';
import type { Session, Repository } from '../models/index.js';

export interface SessionMonitorEvents {
  'session.created': (session: Session) => void;
  'session.updated': (session: Session) => void;
  'session.ended': (session: Session) => void;
  'repository.added': (repo: Repository) => void;
  'repository.removed': (repo: Repository) => void;
}

// Must match the default restingThresholdMinutes in config-loader.ts
const INACTIVE_THRESHOLD_MS = 20 * 60 * 1000;

export class SessionMonitor extends EventEmitter {
  private scanner: RepositoryScanner;
  private cliManager: CliManager;
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  // Track sessions for which we have already broadcast the resting transition
  private restingNotifiedSessions = new Set<string>();

  constructor() {
    super();
    const config = loadConfig();
    this.scanner = new RepositoryScanner(config.watchDirectories);
    this.cliManager = new CliManager();
    this.cliManager.setSessionCreatedCallback((session) => {
      this.emit('session.created', session);
    });
    this.cliManager.setSessionUpdatedCallback((session) => {
      this.emit('session.updated', session);
    });
    this.cliManager.setSessionEndedCallback((session) => {
      this.restingNotifiedSessions.delete(session.id);
      this.emit('session.ended', session);
    });
  }

  async start(): Promise<void> {
    await this.reconcileStaleSessions();

    const activeSessions = getSessions({ status: 'active' });

    // Emit session.created for sessions already active in the DB from a previous run.
    // reconcileStaleSessions() has already ended any dead ones, so what remains is live.
    for (const session of activeSessions) {
      this.emit('session.created', session);
    }

    // Seed CliManager's Copilot tracking state so the first scan doesn't fire duplicate
    // session.created events for sessions that survived from the previous run.
    this.cliManager.seedCopilotState(activeSessions.filter(s => s.type === SessionTypes.COPILOT_CLI));

    await this.cliManager.start();
    await this.runScan();
    this.scanInterval = setInterval(() => this.runScan(), 5000);
  }

  /**
   * Three-way reconciliation of active DB sessions on startup.
   *
   * Data sources:
   *   1. DB sessions with status active/idle
   *   2. Process registry (source of truth for PIDs, differs by session type):
   *      - claude-code: ~/.claude/sessions/*.json (ClaudeSessionRegistry)
   *      - copilot-cli: inuse.<PID>.lock files in ~/.copilot/session-state/<dir>/
   *   3. Running OS processes (psList) as the liveness check
   *
   * Reconciliation matrix (applied per session using its type-specific registry):
   *   Registry entry exists + PID running     → keep active, reconciled
   *   Registry entry exists + PID NOT running → mark ended, unreconciled (WARNING)
   *   No registry entry + PID running in OS   → mark active, unreconciled (ERROR)
   *   No registry entry + PID NOT running     → mark ended, reconciled
   */
  private async reconcileStaleSessions(): Promise<void> {
    try {
      const sessions = [
        ...getSessions({ status: 'active' }),
        ...getSessions({ status: 'idle' }),
      ];
      if (sessions.length === 0) return;

      // Source 2a: Claude session registry (session ID → registry entry with PID)
      const claudeRegistryEntries = this.cliManager.claudeRegistryEntries();
      const claudeRegistryBySessionId = new Map(claudeRegistryEntries.map(e => [e.sessionId, e.pid]));

      // Source 2b: Copilot lock file registry (session ID → PID)
      const copilotLockEntries = this.cliManager.scanLockEntries();

      // Source 3: Running OS processes (filtered to AI tools only to avoid PID reuse false-positives).
      // On Linux/Mac the copilot binary is often a Node.js script: ps-list name is "node" but
      // the cmd (full command line) contains the copilot path. Check both.
      const processes = await psList();
      const runningPids = new Set(
        processes
          .filter((p) => {
            if (isAiToolProcess(p.name, SessionTypes.CLAUDE_CODE) || isAiToolProcess(p.name, SessionTypes.COPILOT_CLI)) return true;
            const cmd = (p.cmd ?? '').toLowerCase();
            return /[/\\]copilot(\s|$)/.test(cmd) || cmd.includes('claude');
          })
          .map((p) => p.pid)
      );

      const now = new Date().toISOString();

      for (const session of sessions) {
        // Look up the registry PID using the correct registry for this session type
        const registryPid = session.type === SessionTypes.CLAUDE_CODE
          ? claudeRegistryBySessionId.get(session.id) ?? null
          : copilotLockEntries.get(session.id) ?? null;

        const registryLabel = session.type === SessionTypes.CLAUDE_CODE
          ? 'Claude session registry'
          : 'Copilot lock file';

        if (registryPid != null) {
          // Registry has an entry for this session
          if (runningPids.has(registryPid)) {
            // Registry PID is alive: session is genuinely active, reconciled
            updateSessionStatus(session.id, 'active', null, true);
          } else {
            // Registry says this PID should be running, but OS says it's dead
            logger.warn(
              `[reconcile] WARNING: ${session.type} session ${session.id} has ${registryLabel} entry with PID ${registryPid}, but process is not running. Marking ended (unreconciled).`
            );
            updateSessionStatus(session.id, 'ended', now, false);
          }
        } else if (session.pid != null && runningPids.has(session.pid)) {
          // No registry entry, but the DB PID is still a live OS process
          logger.error(
            `[reconcile] ERROR: ${session.type} session ${session.id} has no ${registryLabel} entry, but PID ${session.pid} is still running. Marking active (unreconciled).`
          );
          updateSessionStatus(session.id, 'active', null, false);
        } else {
          // No registry entry and no live process: cleanly ended
          updateSessionStatus(session.id, 'ended', now, true);
        }
      }
    } catch (err) {
      logger.error('[reconcile] Failed to reconcile stale sessions:', err);
    }
  }

  triggerScan(force = false): void {
    this.runScan(force).catch((err) => this.emit('error', err));
  }

  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.cliManager.stop();
  }

  getCliManager(): CliManager {
    return this.cliManager;
  }
  private async refreshRepositoryBranches(): Promise<void> {
    const repos = getRepositories();
    await Promise.all(
      repos.map(async (repo) => {
        try {
          const branch = await getCurrentBranch(repo.path);
          if (branch !== repo.branch) {
            updateRepositoryBranch(repo.id, branch);
            const updated = getRepository(repo.id);
            if (updated) {
              broadcast({ type: 'repository.updated', timestamp: new Date().toISOString(), data: updated });
            }
          }
        } catch { /* ignore — branch refresh is best-effort */ }
      })
    );
  }

  private async runScan(force = false): Promise<void> {
    try {
      const tRun = Date.now();
      await this.scanner.scan();
      await this.refreshRepositoryBranches();
      await this.cliManager.scan(force);
      logger.debug(`[SessionMonitor] runScan total — ${Date.now() - tRun}ms`);

      // Broadcast a session.updated for any active session that just crossed the resting
      // threshold, so already-connected clients flip the badge without a page refresh.
      // Fires once per session; resets if the session becomes active again.
      const now = Date.now();
      const thresholdMs = loadConfig().restingThresholdMinutes * 60_000;
      for (const session of getSessions({ status: 'active' })) {
        if (!session.lastActivityAt) continue;
        const age = now - new Date(session.lastActivityAt).getTime();
        if (age >= thresholdMs) {
          if (!this.restingNotifiedSessions.has(session.id)) {
            this.restingNotifiedSessions.add(session.id);
            logger.info(`[SessionMonitor] resting transition sessionId=${session.id} lastActivityAt=${session.lastActivityAt} ageMin=${Math.round(age / 60000)}`);
            broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: session });
          }
        } else {
          // Session has recent activity — reset so we broadcast again next time it goes resting
          this.restingNotifiedSessions.delete(session.id);
        }
      }
    } catch (err) {
      this.emit('error', err);
    }
  }
}
