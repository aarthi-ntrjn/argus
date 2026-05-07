import type { WebSocket } from 'ws';
import type {
  Session,
  Repository,
  SessionOutput,
  ControlAction,
  PendingChoiceItem,
  SessionType,
} from '../../models/index.js';
import type { UpdateStatus } from '../../services/update-service.js';

export interface IntegrationStatusPayload {
  integrationsEnabled: boolean;
  slack: {
    connectionStatus: 'connected' | 'stopped' | 'unconfigured';
    notifier: { running: boolean } | null;
    listener: { running: boolean } | null;
  };
  teams: {
    connectionStatus: 'connected' | 'stopped' | 'unconfigured';
    notifier: { running: boolean } | null;
    listener: { running: boolean } | null;
  };
}

export type WsEventType =
  | 'session.created'
  | 'session.updated'
  | 'session.ended'
  | 'session.pending_choice'
  | 'session.pending_choice.resolved'
  | 'session.output.batch'
  | 'action.updated'
  | 'repository.added'
  | 'repository.updated'
  | 'repository.removed'
  | 'update.status'
  | 'launcher.pending.gone';

export type WsEvent =
  | { type: 'session.created'; timestamp: string; data: Session }
  | { type: 'session.updated'; timestamp: string; data: Session }
  | { type: 'session.ended'; timestamp: string; data: Session }
  | {
      type: 'launcher.pending.gone';
      timestamp: string;
      data: { ptyLaunchId: string; repoPath: string; sessionType: SessionType };
    }
  | {
      type: 'session.pending_choice';
      timestamp: string;
      data: {
        sessionId: string;
        question: string;
        choices: string[];
        allQuestions?: PendingChoiceItem[];
      };
    }
  | { type: 'session.pending_choice.resolved'; timestamp: string; data: { sessionId: string } }
  | {
      type: 'session.output.batch';
      timestamp: string;
      data: { sessionId: string; outputs: SessionOutput[] };
    }
  | { type: 'action.updated'; timestamp: string; data: ControlAction }
  | { type: 'repository.added'; timestamp: string; data: Repository }
  | { type: 'repository.updated'; timestamp: string; data: Repository }
  | { type: 'repository.removed'; timestamp: string; data: { id: string } }
  | { type: 'update.status'; timestamp: string; data: UpdateStatus }
  | { type: 'integration.status'; timestamp: string; data: IntegrationStatusPayload };

const clients = new Set<WebSocket>();

export function addClient(ws: WebSocket): void {
  clients.add(ws);
  ws.on('close', () => removeClient(ws));
  ws.on('error', () => removeClient(ws));
}

export function removeClient(ws: WebSocket): void {
  clients.delete(ws);
}

export function broadcast(event: WsEvent): void {
  const message = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === 1) {
      try {
        client.send(message);
      } catch {
        removeClient(client);
      }
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}
