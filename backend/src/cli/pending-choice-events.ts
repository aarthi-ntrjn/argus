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
 *   'session.jsonl_advanced'          (sessionId: string) — a new line landed in the
 *                                     Claude Code JSONL stream. Claude Code holds the
 *                                     JSONL flush until the user approves a paused tool
 *                                     call, so any post-PreToolUse line means approval
 *                                     has happened. Used to cancel or resolve the
 *                                     pending-approval card.
 *   'session.permission_requested'    (sessionId: string, kind: string, commandText: string)
 *                                     — Copilot CLI emitted permission.requested in JSONL;
 *                                     the approval card should be shown immediately.
 *   'session.permission_resolved'     (sessionId: string)
 *                                     — Copilot CLI tool.execution_complete matched the
 *                                     pending permission toolCallId; resolve the card.
 */
export const pendingChoiceEvents = new EventEmitter();
