import { describe, it, expect } from 'vitest';
import { derivePreviewState } from '../sessionUtils';
import type { SessionOutput } from '../../types';

function makeItem(overrides: Partial<SessionOutput>): SessionOutput {
  return {
    id: 'out-1',
    sessionId: 'sess-1',
    timestamp: new Date().toISOString(),
    type: 'message',
    content: '',
    toolName: null,
    toolCallId: null,
    role: 'assistant',
    sequenceNumber: 1,
    ...overrides,
  };
}

function assistantMsg(seq: number, content = 'Hello'): SessionOutput {
  return makeItem({ type: 'message', role: 'assistant', content, sequenceNumber: seq });
}

function toolUse(seq: number): SessionOutput {
  return makeItem({ type: 'tool_use', role: null, content: '', sequenceNumber: seq });
}

describe('derivePreviewState', () => {
  // (a) terminated with assistant message → text-only
  it('returns text-only when terminated and assistant message exists', () => {
    const items = [assistantMsg(1, 'Final answer')];
    const result = derivePreviewState(items, true);
    expect(result.kind).toBe('text-only');
    if (result.kind === 'text-only') {
      expect(result.content).toBe('Final answer');
    }
  });

  // (b) terminated without any assistant message → waiting
  it('returns waiting when terminated and no assistant message exists', () => {
    const items = [toolUse(1), toolUse(2)];
    const result = derivePreviewState(items, true);
    expect(result.kind).toBe('waiting');
  });

  // (c) active, no messages, no tool_use → waiting
  it('returns waiting when active and items is empty', () => {
    const result = derivePreviewState([], false);
    expect(result.kind).toBe('waiting');
  });

  // (d) active, tool_use only (no assistant message) → tool-count-only
  it('returns tool-count-only when active with only tool_use items', () => {
    const items = [toolUse(1), toolUse(2), toolUse(3)];
    const result = derivePreviewState(items, false);
    expect(result.kind).toBe('tool-count-only');
    if (result.kind === 'tool-count-only') {
      expect(result.count).toBe(3);
    }
  });

  // (e) active, assistant message then tool_use → text-plus-count
  it('returns text-plus-count when active with assistant message followed by tool_use', () => {
    const items = [assistantMsg(1, 'Working on it'), toolUse(2), toolUse(3)];
    const result = derivePreviewState(items, false);
    expect(result.kind).toBe('text-plus-count');
    if (result.kind === 'text-plus-count') {
      expect(result.content).toBe('Working on it');
      expect(result.count).toBe(2);
    }
  });

  // (f) active, assistant message only (no subsequent tool_use) → text-only
  it('returns text-only when active with assistant message and no subsequent tool_use', () => {
    const items = [toolUse(1), assistantMsg(2, 'Done')];
    const result = derivePreviewState(items, false);
    expect(result.kind).toBe('text-only');
    if (result.kind === 'text-only') {
      expect(result.content).toBe('Done');
    }
  });

  // (g) singular: count===1 → '1 tool call'
  it('returns count of 1 for a single tool_use item', () => {
    const items = [toolUse(1)];
    const result = derivePreviewState(items, false);
    expect(result.kind).toBe('tool-count-only');
    if (result.kind === 'tool-count-only') {
      expect(result.count).toBe(1);
    }
  });

  // (g) plural: count>1 → 'N tool calls'
  it('returns count > 1 for multiple tool_use items', () => {
    const items = [toolUse(1), toolUse(2), toolUse(3), toolUse(4), toolUse(5)];
    const result = derivePreviewState(items, false);
    expect(result.kind).toBe('tool-count-only');
    if (result.kind === 'tool-count-only') {
      expect(result.count).toBe(5);
    }
  });

  // tool-count-only path: 5 tool calls → count === 5
  it('returns count 5 for 5 tool_use items (no assistant message)', () => {
    const items = [toolUse(1), toolUse(2), toolUse(3), toolUse(4), toolUse(5)];
    const result = derivePreviewState(items, false);
    expect(result.kind).toBe('tool-count-only');
    if (result.kind === 'tool-count-only') {
      expect(result.count).toBe(5);
    }
  });

  // terminated with assistant message AND tool_use after → still text-only (count suppressed)
  it('suppresses tool count when session is terminated even if tool_use items exist after assistant msg', () => {
    const items = [assistantMsg(1, 'Last reply'), toolUse(2), toolUse(3)];
    const result = derivePreviewState(items, true);
    expect(result.kind).toBe('text-only');
    if (result.kind === 'text-only') {
      expect(result.content).toBe('Last reply');
    }
  });

  // exactly 1 tool call singular label
  it('count is 1 when exactly one tool_use after assistant message', () => {
    const items = [assistantMsg(1, 'Here you go'), toolUse(2)];
    const result = derivePreviewState(items, false);
    expect(result.kind).toBe('text-plus-count');
    if (result.kind === 'text-plus-count') {
      expect(result.count).toBe(1);
    }
  });

  // exactly 0 tool_use with no assistant message → waiting
  it('returns waiting when active with user-only messages and no tool_use', () => {
    const items = [makeItem({ type: 'message', role: 'user', content: 'hello', sequenceNumber: 1 })];
    const result = derivePreviewState(items, false);
    expect(result.kind).toBe('waiting');
  });

  // Copilot CLI fixture: tool_use with null role → tool-count-only
  it('is platform-agnostic: Copilot CLI tool_use items (null role) are counted', () => {
    const copilotToolUse = makeItem({ type: 'tool_use', role: null, content: '', sequenceNumber: 1 });
    const result = derivePreviewState([copilotToolUse, { ...copilotToolUse, id: 'out-2', sequenceNumber: 2 }], false);
    expect(result.kind).toBe('tool-count-only');
    if (result.kind === 'tool-count-only') {
      expect(result.count).toBe(2);
    }
  });
});
