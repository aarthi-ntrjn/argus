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
 *   'session.tool_result_seen'        (sessionId: string) — a non-AskUserQuestion tool
 *                                     completed in the JSONL stream; used to cancel the
 *                                     pending-approval debounce timer before it fires.
 */
export const pendingChoiceEvents = new EventEmitter();
