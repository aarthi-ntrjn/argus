import type { SessionChange } from '../integration/session-diff-tracker.js';
export type { SessionChange };

export type SessionType = 'copilot-cli' | 'claude-code';

export const SessionTypes = {
  CLAUDE_CODE: 'claude-code' as const,
  COPILOT_CLI: 'copilot-cli' as const,
} as const;

export type ToolCommand = 'claude' | 'copilot';

export const ToolCommands = {
  CLAUDE: 'claude' as const,
  COPILOT: 'copilot' as const,
} as const;
export type SessionLaunchMode = 'pty' | 'detected';
export type SessionStatus = 'active' | 'idle' | 'waiting' | 'error' | 'completed' | 'ended';
export type PidSource = 'session_registry' | 'pty_registry' | 'lockfile';
export type ControlActionType = 'stop' | 'send_prompt' | 'interrupt';
export type ControlActionStatus = 'pending' | 'sent' | 'completed' | 'failed' | 'not_supported';
export type RepositorySource = 'config' | 'ui';
export type OutputType = 'message' | 'tool_use' | 'tool_result' | 'error' | 'status_change';
export type OutputRole = 'user' | 'assistant';

export interface Repository {
  id: string;
  path: string;
  name: string;
  source: RepositorySource;
  addedAt: string;
  lastScannedAt: string | null;
  branch: string | null;
  remoteUrl?: string | null;
}

export interface Session {
  id: string;
  repositoryId: string;
  type: SessionType;
  launchMode: SessionLaunchMode | null;
  pid: number | null;
  hostPid: number | null;
  pidSource: PidSource | null;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  summary: string | null;
  expiresAt: string | null;
  model: string | null;
  reconciled: boolean;
  yoloMode: boolean | null;
  ptyLaunchId?: string | null;
  ptyConnected?: boolean | null;
  isResting?: boolean;
}

export interface SessionOutput {
  id: string;
  sessionId: string;
  timestamp: string;
  type: OutputType;
  content: string;
  toolName: string | null;
  toolCallId: string | null;
  role: OutputRole | null;
  sequenceNumber: number;
  isMeta?: boolean;
}

export interface ControlAction {
  id: string;
  sessionId: string;
  type: ControlActionType;
  payload: Record<string, unknown> | null;
  status: ControlActionStatus;
  createdAt: string;
  completedAt: string | null;
  result: string | null;
  source: string | null;
}

export interface TodoItem {
  id: string;
  userId: string;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SlackConfig {
  botToken: string;
  appToken?: string;
  channelId: string;
  enabled: boolean;
  enabledEventTypes?: string[];
  ownerSenderId: string;
}

export interface ArgusConfig {
  port: number;
  watchDirectories: string[];
  sessionRetentionHours: number;
  outputRetentionMbPerSession: number;
  autoRegisterRepos: boolean;
  yoloMode: boolean;
  restingThresholdMinutes: number;
  telemetryEnabled: boolean;
  telemetryPromptSeen: boolean;
  integrationsDisabled: boolean;
  autoUpdate: boolean;
  updateCheckIntervalHours: number;
}

export type TelemetryEventType =
  | 'app_started'
  | 'app_ended'
  | 'session_started'
  | 'session_ended'
  | 'session_prompt_sent'
  | 'update_available'
  | 'update_attempt'
  | 'session_stopped'
  | 'todo_added'
  | 'todo_deleted'
  | 'todo_done'
  | 'repo_diff_opened'
  | 'repo_card_home_opened'
  | 'repo_card_branch_opened'
  | 'repo_card_pr_opened'
  | 'repo_scan'
  | 'repo_added'
  | 'repo_removed'
  | 'request_error'
  | 'integration_started'
  | 'integration_stopped'
  | 'session_interrupted'
  | 'session_choice_made'
  | 'session_tool_rejected';

export const TELEMETRY_EVENT_TYPES = new Set<TelemetryEventType>([
  'app_started',
  'app_ended',
  'session_started',
  'session_ended',
  'session_prompt_sent',
  'session_stopped',
  'todo_added',
  'todo_deleted',
  'todo_done',
  'repo_diff_opened',
  'repo_card_home_opened',
  'repo_card_branch_opened',
  'repo_card_pr_opened',
  'repo_scan',
  'repo_added',
  'repo_removed',
  'request_error',
  'integration_started',
  'integration_stopped',
  'update_available',
  'update_attempt',
  'session_interrupted',
  'session_choice_made',
  'session_tool_rejected',
]);

export interface TelemetryEvent {
  installationId: string;
  type: TelemetryEventType;
  appVersion: string;
  timestamp: string;
  sessionType?: string;
}

export interface PendingChoiceItem {
  question: string;
  choices: string[];
  descriptions?: string[];
  header?: string;
}

export interface PendingChoice {
  type: 'ask_user' | 'tool_approval';
  question: string;
  choices: string[];
  allQuestions?: PendingChoiceItem[];
}

export interface TeamsConfig {
  enabled: boolean;
  teamId: string;
  channelId: string;
  ownerSenderId: string;
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
}

export interface TeamsThread {
  id: string;
  sessionId: string;
  teamsThreadId: string;
  teamsChannelId: string;
  tenantId: string;
  createdAt: string;
}

export interface SlackThread {
  id: string;
  sessionId: string;
  slackThreadTs: string;
  slackChannelId: string;
  workspaceId: string;
  createdAt: string;
}

export interface NotificationIntegration {
  readonly isRunning: boolean;
  initialize(): Promise<boolean>;
  onSessionCreated(session: Session): Promise<void>;
  onSessionUpdated(session: Session, changes: SessionChange[]): Promise<void>;
  onSessionEnded(session: Session): Promise<void>;
  onSessionOutput(sessionId: string, outputs: SessionOutput[]): Promise<void>;
  onPendingChoice(choice: PendingChoice): Promise<void>;
  onRepositoryAdded(repo: Repository): Promise<void>;
  onRepositoryRemoved(repo: Repository): Promise<void>;
  shutdown(): void;
}

export interface NotificationListener {
  readonly isRunning: boolean;
  initialize(): Promise<boolean>;
  shutdown(): void;
}
