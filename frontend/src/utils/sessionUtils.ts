import type { Session, SessionOutput } from '../types';

export const INACTIVE_THRESHOLD_MS = 20 * 60 * 1000;

export function isInactive(session: Session, thresholdMs = INACTIVE_THRESHOLD_MS): boolean {
  if (session.status === 'completed' || session.status === 'ended') {
    return false;
  }
  return Date.now() - new Date(session.lastActivityAt).getTime() > thresholdMs;
}

export interface PendingChoiceItem {
  question: string;
  choices: string[];
  descriptions?: string[];
  header?: string;
}

export interface PendingChoice {
  question: string;
  choices: string[];
  allQuestions?: PendingChoiceItem[];
}

export type PreviewState =
  | { kind: 'waiting' }
  | { kind: 'text-only'; content: string }
  | { kind: 'tool-count-only'; count: number }
  | { kind: 'text-plus-count'; content: string; count: number };

/** Derives the preview state for the session card from the output item snapshot. */
export function derivePreviewState(items: SessionOutput[], isTerminated: boolean): PreviewState {
  const lastAssistant = [...items]
    .reverse()
    .find((i) => i.type === 'message' && i.role === 'assistant') ?? null;

  if (isTerminated) {
    return lastAssistant && lastAssistant.content?.trim()
      ? { kind: 'text-only', content: lastAssistant.content.trim() }
      : { kind: 'waiting' };
  }

  const boundary = lastAssistant?.sequenceNumber ?? -1;
  const toolCount = items.filter(
    (i) => i.type === 'tool_use' && i.sequenceNumber > boundary,
  ).length;

  if (toolCount > 0 && lastAssistant) {
    return {
      kind: 'text-plus-count',
      content: lastAssistant.content?.trim() ?? '',
      count: toolCount,
    };
  }
  if (toolCount > 0) {
    return { kind: 'tool-count-only', count: toolCount };
  }
  if (lastAssistant && lastAssistant.content?.trim()) {
    return { kind: 'text-only', content: lastAssistant.content.trim() };
  }
  return { kind: 'waiting' };
}
