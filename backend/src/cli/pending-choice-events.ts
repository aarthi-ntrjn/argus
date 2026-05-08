import { EventEmitter } from 'events';
import type { PendingChoice as BasePendingChoice } from '../models/index.js';

export interface PendingChoice extends BasePendingChoice {
  sessionId: string;
}

/**
 * Shared event bus for pending choice (AskUserQuestion) events.
 * Mirrors the outputEvents pattern in output-store.ts.
 *
 * Events:
 *   'session.pending_choice'          (choice: PendingChoice)
 *   'session.pending_choice.resolved' (sessionId: string)
 */
export const pendingChoiceEvents = new EventEmitter();
