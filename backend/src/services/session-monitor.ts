import { EventEmitter } from 'events';
import { RepositoryScanner } from './repository-scanner.js';
import { CliManager } from './cli-manager.js';
import { loadConfig } from '../config/config-loader.js';
import {
  getSessions,
  getRepository,
  getRepositories,
  updateRepositoryBranch,
} from '../db/database.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { getCurrentBranch } from './repository-scanner.js';
import * as logger from '../utils/logger.js';
import type { Session, Repository } from '../models/index.js';

export interface SessionMonitorEvents {
  'session.created': (session: Session) => void;
  'session.updated': (session: Session) => void;
  'session.ended': (session: Session) => void;
  'repository.added': (repo: Repository) => void;
  'repository.removed': (repo: Repository) => void;
}

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
    this.cliManager.start();

    const activeSessions = getSessions({ status: 'active' });

    // Notify subscribers of sessions that were already active from a previous run.
    for (const session of activeSessions) {
      this.emit('session.created', session);
    }

    // Seed detectors so the first scan doesn't re-fire session.created for existing sessions.
    this.cliManager.seedState(activeSessions);

    // Force scan: cleans up dead sessions, finds new ones started while server was down.
    await this.runScan(true);
    this.scanInterval = setInterval(() => this.runScan(), 5000);
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
              broadcast({
                type: 'repository.updated',
                timestamp: new Date().toISOString(),
                data: updated,
              });
            }
          }
        } catch {
          /* ignore — branch refresh is best-effort */
        }
      }),
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
        if (!session.lastActivityAt) {
          continue;
        }
        const age = now - new Date(session.lastActivityAt).getTime();
        if (age >= thresholdMs) {
          if (!this.restingNotifiedSessions.has(session.id)) {
            this.restingNotifiedSessions.add(session.id);
            logger.info(
              `[SessionMonitor] resting transition sessionId=${session.id} lastActivityAt=${session.lastActivityAt} ageMin=${Math.round(age / 60000)}`,
            );
            this.emit('session.updated', { ...session, isResting: true });
          }
        } else {
          if (this.restingNotifiedSessions.has(session.id)) {
            this.restingNotifiedSessions.delete(session.id);
            logger.info(
              `[SessionMonitor] session.updated sessionId=${session.id} reason=activity-resumed`,
            );
            this.emit('session.updated', { ...session, isResting: false });
          }
        }
      }
    } catch (err) {
      this.emit('error', err);
    }
  }
}
