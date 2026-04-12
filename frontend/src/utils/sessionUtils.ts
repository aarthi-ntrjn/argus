import type { Session, SessionOutput } from '../types';

export const INACTIVE_THRESHOLD_MS = 20 * 60 * 1000;

export function isInactive(session: Session, thresholdMs = INACTIVE_THRESHOLD_MS): boolean {
  if (session.status === 'completed' || session.status === 'ended') return false;
  return Date.now() - new Date(session.lastActivityAt).getTime() > thresholdMs;
}

export interface PendingChoice {
  question: string;
  choices: string[];
}

const CHOICE_TOOL_NAMES = ['ask_user', 'AskUserQuestion'] as const;

export function detectPendingChoice(items: SessionOutput[]): PendingChoice | null {
  let lastResultSeq = -1;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.type === 'tool_result' && item.sequenceNumber > lastResultSeq) {
      lastResultSeq = item.sequenceNumber;
    }
    if (item.type === 'tool_use' && item.toolName !== null && (CHOICE_TOOL_NAMES as readonly string[]).includes(item.toolName)) {
      if (lastResultSeq > item.sequenceNumber) return null;
      try {
        const parsed = JSON.parse(item.content) as Record<string, unknown>;
        const question = typeof parsed.question === 'string' ? parsed.question : '';
        const rawChoices = Array.isArray(parsed.choices) ? parsed.choices : Array.isArray(parsed.options) ? parsed.options : [];
        const choices = rawChoices.filter((c): c is string => typeof c === 'string');
        return { question, choices };
      } catch {
        return { question: '', choices: [] };
      }
    }
  }
  return null;
}
