import type { FastifyPluginAsync } from 'fastify';
import { SlackNotifier } from './slack/slack-notifier.js';
import { SlackListener } from './slack/slack-listener.js';
import { TeamsNotifier } from './teams/teams-notifier.js';
import { TeamsListener } from './teams/teams-listener.js';
import { setIntegrationEnabled, getIntegrationEnabled } from '../db/database.js';
import { telemetryService } from '../services/telemetry-service.js';
import { loadSlackConfig } from '../config/slack-config-loader.js';
import { loadTeamsConfig } from '../config/teams-config-loader.js';
import {
  getSlackConnectionStatus,
  getTeamsConnectionStatus,
} from './integration-status.js';
import { setSlackServices } from '../api/routes/health.js';
import type { SessionMonitor } from '../services/session-monitor.js';
import { broadcast, type IntegrationStatusPayload } from '../api/ws/event-dispatcher.js';
import { createTaggedLogger } from '../utils/logger.js';
import { outputEvents } from '../services/output-store.js';
import { pendingChoiceEvents } from '../services/pending-choice-events.js';
import type { PendingChoice } from '../services/pending-choice-events.js';
import type {
  Session,
  Repository,
  SessionOutput,
  NotificationIntegration,
} from '../models/index.js';
import { SessionDiffTracker } from '../services/session-diff-tracker.js';
import { getSessions } from '../db/database.js';
import {
  SESSION_CREATED,
  SESSION_UPDATED,
  SESSION_ENDED,
  REPOSITORY_ADDED,
  REPOSITORY_REMOVED,
} from '../constants/slack-events.js';
import type { App } from '@microsoft/teams.apps';

const log = createTaggedLogger('[Integrations]', '\x1b[33m'); // yellow

let slackNotifier: SlackNotifier | null = null;
let slackListener: SlackListener | null = null;
let teamsNotifier: TeamsNotifier | null = null;
let teamsListener: TeamsListener | null = null;
let integrationsEnabled = false;
let monitor: SessionMonitor | null = null;
let eventsWired = false;
const diffTracker = new SessionDiffTracker();

function activeNotifiers(): NotificationIntegration[] {
  return [slackNotifier, teamsNotifier].filter(
    (n): n is NotificationIntegration => n !== null && n.isRunning,
  );
}

function dispatch(label: string, fn: (n: NotificationIntegration) => Promise<void>): void {
  for (const notifier of activeNotifiers()) {
    fn(notifier).catch((err) => {
      log.error(`${label} error`, err);
    });
  }
}

function wireEvents(): void {
  if (eventsWired || !monitor) {
    return;
  }
  eventsWired = true;
  monitor.on(SESSION_CREATED, (session: Session) => {
    diffTracker.seed(session);
    dispatch('session.created', (n) => n.onSessionCreated(session));
  });
  monitor.on(SESSION_UPDATED, (session: Session) => {
    const changes = diffTracker.update(session);
    if (!changes || changes.length === 0) {
      return;
    }
    dispatch('session.updated', (n) => n.onSessionUpdated(session, changes));
  });
  monitor.on(SESSION_ENDED, (session: Session) => {
    dispatch('session.ended', (n) => n.onSessionEnded(session));
    diffTracker.clear(session.id);
  });
  monitor.on(REPOSITORY_ADDED, (repo: Repository) => {
    dispatch('repository.added', (n) => n.onRepositoryAdded(repo));
  });
  monitor.on(REPOSITORY_REMOVED, (repo: Repository) => {
    dispatch('repository.removed', (n) => n.onRepositoryRemoved(repo));
  });
  outputEvents.on('session.output.batch', (sessionId: string, outputs: SessionOutput[]) => {
    const relevant = outputs.filter(
      (o) =>
        o.type === 'message' &&
        o.content.trim() &&
        !o.isMeta &&
        (o.role === 'assistant' || o.role === 'user'),
    );
    if (relevant.length === 0) {
      return;
    }
    dispatch('session.output', (n) => n.onSessionOutput(sessionId, relevant));
  });
  pendingChoiceEvents.on('session.pending_choice', (choice: PendingChoice) => {
    dispatch('pending_choice', (n) => n.onPendingChoice(choice));
  });
}

export async function initializeIntegrations(
  enabled: boolean,
  teamsApp: App | null,
  mon: SessionMonitor,
): Promise<void> {
  integrationsEnabled = enabled;
  monitor = mon;

  if (!enabled) {
    wireEvents();
    return;
  }

  slackNotifier = new SlackNotifier();
  if (getIntegrationEnabled('slack') !== false) {
    const initialized = await slackNotifier.initialize();
    if (initialized && slackNotifier.webClient) {
      const slackConfig = loadSlackConfig()!;
      slackListener = new SlackListener(slackConfig, slackNotifier.webClient, slackNotifier);
      await slackListener.initialize();
    }
  }
  setSlackServices(slackNotifier, slackListener);

  if (teamsApp) {
    teamsNotifier = new TeamsNotifier(teamsApp);
    teamsListener = new TeamsListener(teamsApp);
    await teamsListener.initialize();
    if (getIntegrationEnabled('teams') !== false) {
      await teamsNotifier.initialize();
    }
  }

  for (const session of getSessions({ status: 'active' })) {
    diffTracker.seed(session);
  }

  wireEvents();
}

export function shutdownIntegrations(): void {
  teamsNotifier?.shutdown();
  teamsListener?.shutdown();
  slackListener?.shutdown();
  slackNotifier?.shutdown();
}

export function getIntegrationRunningStatus(): { slack: string; teams: string } {
  return {
    slack: slackNotifier == null ? 'na' : slackNotifier.isRunning ? 'on' : 'off',
    teams: teamsNotifier == null ? 'na' : teamsNotifier.isRunning ? 'on' : 'off',
  };
}

function buildStatusPayload(): IntegrationStatusPayload {
  const slackConfig = loadSlackConfig();
  const teamsConfig = loadTeamsConfig();
  const slackRunning = slackNotifier?.isRunning === true;
  const teamsRunning = teamsNotifier?.isRunning === true;
  return {
    integrationsEnabled,
    slack: {
      connectionStatus: getSlackConnectionStatus(slackConfig, slackRunning),
      notifier: slackNotifier ? { running: slackRunning } : null,
      listener: slackListener ? { running: slackListener.isRunning } : null,
    },
    teams: {
      connectionStatus: getTeamsConnectionStatus(teamsConfig, teamsRunning),
      notifier: teamsNotifier ? { running: teamsRunning } : null,
      listener: teamsListener ? { running: teamsListener.isRunning } : null,
    },
  };
}

function broadcastStatus(): void {
  broadcast({
    type: 'integration.status',
    timestamp: new Date().toISOString(),
    data: buildStatusPayload(),
  });
}

const integrationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/v1/integrations', async (_request, reply) => {
    return reply.send(buildStatusPayload());
  });

  fastify.post('/api/v1/integrations/slack/start', async (_request, reply) => {
    if (!slackNotifier) {
      return reply
        .status(503)
        .send({ error: 'Slack integration not available. Enable integrations in settings.' });
    }
    const started = await slackNotifier.initialize();
    // Create listener on demand if not yet created and notifier is now connected
    if (started && !slackListener && slackNotifier.webClient) {
      const config = loadSlackConfig();
      if (config) {
        slackListener = new SlackListener(config, slackNotifier.webClient, slackNotifier);
        setSlackServices(slackNotifier, slackListener);
      }
    }
    if (slackListener) {
      await slackListener.initialize();
    }
    setIntegrationEnabled('slack', true);
    telemetryService.setIntegrationStatus('slack', 'on');
    telemetryService.sendEvent('integration_started', { integration_platform: 'slack' });
    broadcastStatus();
    return reply.send({ started });
  });

  fastify.post('/api/v1/integrations/slack/stop', async (_request, reply) => {
    if (!slackNotifier) {
      return reply.status(503).send({ error: 'Slack not configured' });
    }
    slackListener?.shutdown();
    slackNotifier.shutdown();
    setIntegrationEnabled('slack', false);
    telemetryService.setIntegrationStatus('slack', 'off');
    telemetryService.sendEvent('integration_stopped', { integration_platform: 'slack' });
    broadcastStatus();
    return reply.send({ stopped: true });
  });

  fastify.post('/api/v1/integrations/teams/start', async (_request, reply) => {
    if (!teamsNotifier) {
      return reply.status(503).send({ error: 'Teams not configured' });
    }
    const started = await teamsNotifier.initialize();
    teamsListener?.initialize();
    setIntegrationEnabled('teams', true);
    telemetryService.setIntegrationStatus('teams', 'on');
    telemetryService.sendEvent('integration_started', { integration_platform: 'teams' });
    broadcastStatus();
    return reply.send({ started });
  });

  fastify.post('/api/v1/integrations/teams/stop', async (_request, reply) => {
    if (!teamsNotifier) {
      return reply.status(503).send({ error: 'Teams not configured' });
    }
    teamsListener?.shutdown();
    teamsNotifier.shutdown();
    setIntegrationEnabled('teams', false);
    telemetryService.setIntegrationStatus('teams', 'off');
    telemetryService.sendEvent('integration_stopped', { integration_platform: 'teams' });
    broadcastStatus();
    return reply.send({ stopped: true });
  });
};

export default integrationsRoutes;
