import { WebClient } from '@slack/web-api';
import type {
  Session,
  Repository,
  SlackConfig,
  SessionOutput,
  NotificationIntegration,
} from '../../models/index.js';
import { randomUUID } from 'crypto';
import {
  getRepository,
  getSlackThread,
  getSlackThreadByTs,
  upsertSlackThread,
  deleteSlackThread,
} from '../../db/database.js';
import { MessageQueue } from '../../services/message-queue.js';
import type { SessionChange } from '../../services/session-diff-tracker.js';
import type { PendingChoice } from '../../services/pending-choice-events.js';
import {
  SESSION_CREATED,
  SESSION_UPDATED,
  SESSION_ENDED,
  SESSION_AI_RESPONSE,
  SESSION_PENDING_CHOICE,
  REPOSITORY_ADDED,
  REPOSITORY_REMOVED,
} from '../../constants/slack-events.js';
import { createTaggedLogger } from '../../utils/logger.js';
import { loadSlackConfig } from '../../config/slack-config-loader.js';

const log = createTaggedLogger('[SlackNotifier]', '\x1b[32m'); // green

/**
 * Sends Argus session events to a Slack channel as threaded messages.
 * Each session owns one parent message (the thread anchor); updates and output post as replies.
 * Thread anchors are kept in memory and persisted to the DB so they survive server restarts.
 * Supports configurable event filtering via `enabledEventTypes` in the Slack config.
 */
export class SlackNotifier implements NotificationIntegration {
  private config: SlackConfig;
  private client: WebClient | null = null;
  private active = false;
  private workspaceId = '';

  // Thread anchor map: sessionId -> Slack message ts of the parent message
  private readonly threadAnchors = new Map<string, string>();

  private readonly queue: MessageQueue;

  constructor() {
    this.config = { botToken: '', channelId: '', ownerSenderId: '', enabled: false };
    this.queue = new MessageQueue((eventType, sessionId) => {
      log.warn(`Send queue full, dropping ${eventType} for session ${sessionId}`);
    });
  }

  get isRunning(): boolean {
    return this.active;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Loads config, authenticates the bot, and marks the integration active. */
  async initialize(): Promise<boolean> {
    this.active = false;
    const freshConfig = loadSlackConfig();
    if (!freshConfig) {
      log.warn(`Slack integration disabled: no configuration found`);
      return false;
    }
    this.config = freshConfig;
    if (!this.config.botToken || !this.config.channelId || !this.config.ownerSenderId) {
      log.warn(`Slack integration disabled: missing botToken, channelId, or ownerSenderId`);
      return false;
    }
    if (!this.config.enabled) {
      log.info(`Slack integration disabled by configuration`);
      return false;
    }

    this.client = new WebClient(this.config.botToken);

    try {
      const auth = await this.client.auth.test();
      this.workspaceId = (auth.team_id as string | undefined) ?? '';
      log.info(`Workspace ID: ${this.workspaceId}`);
    } catch (err) {
      log.warn(`Failed to fetch workspace ID via auth.test:`, err);
    }

    this.active = true;
    log.info(`Initialized, posting to channel ${this.config.channelId}`);
    return true;
  }

  /** Stops accepting new events and drains the send queue. */
  shutdown(): void {
    this.active = false;
    this.client = null;
    this.queue.drain();
    log.info(`Shutdown complete`);
  }

  get webClient(): WebClient | null {
    return this.client;
  }

  /** Looks up the Argus session that owns the given Slack thread timestamp. */
  getSessionIdByThreadTs(threadTs: string): string | undefined {
    for (const [sessionId, ts] of this.threadAnchors) {
      if (ts === threadTs) {
        return sessionId;
      }
    }
    // Fall back to DB for sessions not yet loaded into the in-memory map
    const thread = getSlackThreadByTs(threadTs);
    if (thread) {
      this.threadAnchors.set(thread.sessionId, threadTs); // warm the cache
      return thread.sessionId;
    }
    return undefined;
  }

  // -------------------------------------------------------------------------
  // Session lifecycle
  // -------------------------------------------------------------------------

  /** Opens a new Slack thread for the session, or reconnects to an existing one after a server restart. */
  async onSessionCreated(session: Session): Promise<void> {
    log.info(`slack.session.created.received: session=${session.id} status=${session.status}`);
    if (!this.active || !this.client) {
      return;
    }
    if (!this.isEventEnabled(SESSION_CREATED)) {
      log.info(`slack.session.created.skipped: event not enabled`);
      return;
    }

    const repo = session.repositoryId ? getRepository(session.repositoryId) : undefined;
    const blocks = buildSessionStartBlocks(session, repo);

    // Restore a persisted thread anchor (e.g. after server restart)
    const existingThreadTs =
      this.threadAnchors.get(session.id) ?? getSlackThread(session.id)?.slackThreadTs ?? null;
    if (existingThreadTs) {
      this.threadAnchors.set(session.id, existingThreadTs);
      log.info(`slack.thread.reused: session=${session.id} ts=${existingThreadTs}`);
    } else {
      log.info(`slack.thread.creating: session=${session.id} repo=${repo?.name ?? '(unknown)'}`);
    }

    this.queue.enqueue(
      async () => {
        try {
          const threadTs = this.threadAnchors.get(session.id);
          const result = await this.client!.chat.postMessage({
            channel: this.config.channelId,
            text: `AI session started: ${session.id} (${session.type})`,
            blocks,
            ...(threadTs ? { thread_ts: threadTs } : {}),
          });
          if (result.ts) {
            // Update anchor when: (a) no prior anchor (new session), or (b) we tried to thread
            // but the message landed as a new top-level post because the parent was deleted
            // (stale anchor after channel cleanup). In case (b), Slack returns success but the
            // message's thread_ts equals its own ts, indicating it became a new thread root.
            const msg = result.message as { thread_ts?: string } | undefined;
            const resultThreadTs = msg?.thread_ts;
            const isNewTopLevel = !threadTs || !resultThreadTs || resultThreadTs === result.ts;
            if (isNewTopLevel) {
              this.threadAnchors.set(session.id, result.ts);
              upsertSlackThread({
                id: randomUUID(),
                sessionId: session.id,
                slackThreadTs: result.ts,
                slackChannelId: this.config.channelId,
                workspaceId: this.workspaceId,
                createdAt: new Date().toISOString(),
              });
              log.info(`slack.thread.created: session=${session.id} ts=${result.ts}`);
            } else {
              log.info(`slack.thread.reused.notified: session=${session.id} ts=${result.ts}`);
            }
          }
        } catch (err) {
          const slackErr = err as { data?: { error?: string } } | null;
          if (slackErr?.data?.error === 'message_not_found') {
            // Stale anchor: the parent message was deleted (e.g. after channel cleanup).
            // Clear the stale anchor and retry as a new top-level post.
            log.warn(`slack.thread.stale.detected: session=${session.id}`);
            this.threadAnchors.delete(session.id);
            deleteSlackThread(session.id);
            try {
              const result = await this.client!.chat.postMessage({
                channel: this.config.channelId,
                text: `AI session started: ${session.id} (${session.type})`,
                blocks,
              });
              if (result.ts) {
                this.threadAnchors.set(session.id, result.ts);
                upsertSlackThread({
                  id: randomUUID(),
                  sessionId: session.id,
                  slackThreadTs: result.ts,
                  slackChannelId: this.config.channelId,
                  workspaceId: this.workspaceId,
                  createdAt: new Date().toISOString(),
                });
                log.info(`slack.thread.stale.recovered: session=${session.id} ts=${result.ts}`);
              }
            } catch (retryErr) {
              log.error(`slack.thread.stale.recover.failed: session=${session.id}`, retryErr);
            }
          } else {
            log.error(`slack.thread.create.failed: session=${session.id}`, err);
          }
        }
      },
      SESSION_CREATED,
      session.id,
    );
  }

  /** Posts a final status reply to the session thread and removes its thread anchor. */
  async onSessionEnded(session: Session): Promise<void> {
    log.info(`slack.session.ended.received: session=${session.id} status=${session.status}`);
    if (!this.active || !this.client) {
      return;
    }
    if (!this.isEventEnabled(SESSION_ENDED)) {
      log.info(`slack.session.ended.skipped: event not enabled`);
      return;
    }

    const threadTs = this.threadAnchors.get(session.id);
    if (!threadTs) {
      log.warn(`slack.session.ended.skipped: no thread anchor for session=${session.id}`);
    }
    const blocks = buildSessionEndBlocks(session);
    this.queue.enqueue(
      async () => {
        try {
          await this.client!.chat.postMessage({
            channel: this.config.channelId,
            text: `AI session ended: ${session.id} (${session.status})`,
            blocks,
            ...(threadTs ? { thread_ts: threadTs } : {}),
          });
          this.threadAnchors.delete(session.id);
          deleteSlackThread(session.id);
          log.info(`slack.session.ended.posted: session=${session.id} status=${session.status}`);
        } catch (err) {
          log.error(`slack.session.end.notify.failed: session=${session.id}`, err);
        }
      },
      SESSION_ENDED,
      session.id,
    );
  }

  /** Posts a reply to the session thread if any tracked fields changed since the last update. */
  async onSessionUpdated(session: Session, changes: SessionChange[]): Promise<void> {
    log.debug(`slack.session.updated.received: session=${session.id} status=${session.status}`);
    if (!this.active || !this.client) {
      return;
    }
    if (changes.length === 0) {
      return;
    }
    if (!this.isEventEnabled(SESSION_UPDATED)) {
      return;
    }

    log.info(
      `slack.session.updated.posting: session=${session.id} changes=${changes.map((c) => c.label).join(',')}`,
    );
    const blocks = buildSessionUpdatedBlocks(session, changes);
    this.queue.enqueue(
      async () => {
        // Resolve thread anchor: check in-memory first, then fall back to DB for sessions
        // detected after server restart where the anchor was persisted but not yet loaded.
        let threadTs = this.threadAnchors.get(session.id);
        if (!threadTs) {
          const stored = getSlackThread(session.id);
          if (stored) {
            threadTs = stored.slackThreadTs;
            this.threadAnchors.set(session.id, threadTs);
          }
        }
        if (!threadTs) {
          log.error(`slack.session.updated.skipped: no thread anchor for session=${session.id}`);
          return;
        }
        try {
          await this.client!.chat.postMessage({
            channel: this.config.channelId,
            text: `Session updated: ${session.id}`,
            blocks,
            thread_ts: threadTs,
          });
          log.debug(`slack.session.updated.posted: session=${session.id}`);
        } catch (err) {
          log.error(`slack.session.update.notify.failed: session=${session.id}`, err);
        }
      },
      SESSION_UPDATED,
      session.id,
    );
  }

  /** Posts pre-filtered assistant/user messages as a reply to the session thread. */
  async onSessionOutput(sessionId: string, outputs: SessionOutput[]): Promise<void> {
    if (!this.active || !this.client) {
      return;
    }
    if (!this.isEventEnabled(SESSION_AI_RESPONSE)) {
      return;
    }

    const text = outputs
      .map((o) => (o.role === 'user' ? `*You said:* ${o.content}` : o.content))
      .join('\n\n');
    this.queue.enqueue(
      async () => {
        const threadTs = this.threadAnchors.get(sessionId);
        if (!threadTs) {
          return;
        }
        try {
          await this.client!.chat.postMessage({
            channel: this.config.channelId,
            text,
            thread_ts: threadTs,
          });
          log.debug(`slack.session.output.posted: session=${sessionId} chars=${text.length}`);
        } catch (err) {
          log.error(`slack.session.output.failed: session=${sessionId}`, err);
        }
      },
      SESSION_AI_RESPONSE,
      sessionId,
    );
  }

  /** Posts an interactive Block Kit message to the session thread asking the user to choose. */
  async onPendingChoice(choice: PendingChoice): Promise<void> {
    if (!this.active || !this.client) {
      return;
    }
    if (!this.isEventEnabled(SESSION_PENDING_CHOICE)) {
      return;
    }

    const blocks = buildPendingChoiceBlocks(choice);
    this.queue.enqueue(
      async () => {
        const threadTs = this.threadAnchors.get(choice.sessionId);
        if (!threadTs) {
          return;
        }
        try {
          await this.client!.chat.postMessage({
            channel: this.config.channelId,
            text: `Action required: ${choice.question}`,
            blocks,
            thread_ts: threadTs,
          });
          log.info(`slack.pending_choice.posted: session=${choice.sessionId}`);
        } catch (err) {
          log.error(`slack.pending_choice.failed: session=${choice.sessionId}`, err);
        }
      },
      SESSION_PENDING_CHOICE,
      choice.sessionId,
    );
  }

  /** Broadcasts a repository-added event to the channel. */
  async onRepositoryAdded(repo: Repository): Promise<void> {
    await this.postEvent('', REPOSITORY_ADDED, repo);
  }

  /** Broadcasts a repository-removed event to the channel. */
  async onRepositoryRemoved(repo: Repository): Promise<void> {
    await this.postEvent('', REPOSITORY_REMOVED, repo);
  }

  // -------------------------------------------------------------------------
  // Generic event
  // -------------------------------------------------------------------------

  async postEvent(
    sessionId: string,
    eventType: string,
    payload: Session | Repository,
  ): Promise<void> {
    if (!this.active || !this.client) {
      return;
    }
    if (!this.isEventEnabled(eventType)) {
      return;
    }

    const blocks = buildEventBlocks(eventType, payload);
    this.queue.enqueue(
      async () => {
        // Resolve thread anchor at execution time so any preceding SESSION_CREATED job in the
        // queue has already run and set the anchor before we look it up.
        const threadTs = sessionId ? this.threadAnchors.get(sessionId) : undefined;
        if (sessionId && !threadTs) {
          log.error(`No thread anchor for ${eventType} session ${sessionId}, cannot post`);
          return;
        }
        try {
          await this.client!.chat.postMessage({
            channel: this.config.channelId,
            text: `Argus event: ${eventType}`,
            blocks,
            ...(threadTs ? { thread_ts: threadTs } : {}),
          });
        } catch (err) {
          log.error(`Failed to post event ${eventType} for session ${sessionId}:`, err);
        }
      },
      eventType,
      sessionId,
    );
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private isEventEnabled(eventType: string): boolean {
    if (!this.config.enabledEventTypes) {
      return true;
    }
    return this.config.enabledEventTypes.includes(eventType);
  }
}

// -------------------------------------------------------------------------
// Block Kit builders
// -------------------------------------------------------------------------

function buildSessionStartBlocks(session: Session, repo: Repository | undefined) {
  const connected = session.launchMode === 'pty' ? 'connected' : 'not connected';
  const yolo = session.yoloMode === true ? 'yes' : session.yoloMode === false ? 'no' : 'unknown';
  const pid = session.pid != null ? `\`${session.pid}\`` : 'unknown';
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'AI Session Started', emoji: false },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Session:* \`${session.id}\`` },
        { type: 'mrkdwn', text: `*Type:* ${session.type}` },
        { type: 'mrkdwn', text: `*Model:* ${session.model ?? 'unknown'}` },
        { type: 'mrkdwn', text: `*Started:* ${session.startedAt}` },
        { type: 'mrkdwn', text: `*Repo:* ${repo?.name ?? 'unknown'}` },
        { type: 'mrkdwn', text: `*Branch:* ${repo?.branch ?? 'unknown'}` },
        { type: 'mrkdwn', text: `*Repo path:* ${repo?.path ?? 'unknown'}` },
        { type: 'mrkdwn', text: `*Connection:* ${connected}` },
        { type: 'mrkdwn', text: `*Yolo:* ${yolo}` },
        { type: 'mrkdwn', text: `*PID:* ${pid}` },
      ],
    },
  ];
}

function buildSessionEndBlocks(session: Session) {
  const duration = session.endedAt
    ? formatDuration(new Date(session.startedAt), new Date(session.endedAt))
    : 'unknown';
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'AI Session Ended', emoji: false },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Session:* \`${session.id}\`` },
        { type: 'mrkdwn', text: `*Status:* ${session.status}` },
        { type: 'mrkdwn', text: `*Duration:* ${duration}` },
        { type: 'mrkdwn', text: `*Ended:* ${session.endedAt ?? 'unknown'}` },
      ],
    },
  ];
}

function buildSessionUpdatedBlocks(session: Session, changes: SessionChange[]) {
  const lines = changes.map(({ label, from, to }) => `\u2022 *${label}:* ${from} \u2192 ${to}`);
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Session Updated* \`${session.id}\`\n${lines.join('\n')}`,
      },
    },
  ];
}

function buildPendingChoiceBlocks(choice: PendingChoice) {
  const optionLines =
    choice.choices.length > 0 ? choice.choices.map((c, i) => `${i + 1}. ${c}`).join('\n') : '';
  const text = optionLines
    ? `*Action Required*\n*Question:* ${choice.question}\n*Options:*\n${optionLines}`
    : `*Action Required*\n*Question:* ${choice.question}`;
  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text },
    },
  ];
}

function buildEventBlocks(eventType: string, payload: Session | Repository) {
  const summary = 'id' in payload ? `\`${payload.id}\`` : JSON.stringify(payload).slice(0, 120);
  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Event:* \`${eventType}\`\n*Subject:* ${summary}` },
    },
  ];
}

function formatDuration(start: Date, end: Date): string {
  const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
}
