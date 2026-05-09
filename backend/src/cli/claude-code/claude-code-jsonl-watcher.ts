import { join } from 'path';
import { homedir } from 'os';
import { parseClaudeJsonlLine } from './claude-code-jsonl-parser.js';
import { JsonlWatcherBase } from '../jsonl-watcher-base.js';
import { broadcast } from '../../api/ws/event-dispatcher.js';
import { pendingChoiceEvents } from '../pending-choice-events.js';

import type { SessionOutput } from '../../models/index.js';

const TOOL_USE_INTERRUPTED_SENTINEL = '[Request interrupted by user for tool use]';

function claudeProjectDirName(repoPath: string): string {
  return repoPath.replace(/[:\\/\s]/g, '-');
}

export class ClaudeJsonlWatcher extends JsonlWatcherBase {
  protected readonly tag = '[ClaudeDetector]';

  protected parseLine(
    line: string,
    sessionId: string,
    seq: number,
    makeId: (blockIndex: number) => string,
  ): SessionOutput[] {
    return parseClaudeJsonlLine(line, sessionId, seq, makeId);
  }

  // Claude Code holds JSONL flush until the user resolves a paused tool approval. Any
  // line that lands after a PreToolUse hook fires therefore signals that approval has
  // already happened. handlePreToolApproval listens for this to cancel or resolve the
  // pending approval card without waiting for tool execution to complete.
  protected override onRawLine(_line: string, sessionId: string): void {
    pendingChoiceEvents.emit('session.jsonl_advanced', sessionId);
  }

  protected override onNewOutputs(sessionId: string, outputs: SessionOutput[]): void {
    const now = new Date().toISOString();

    for (const output of outputs) {
      // Record the tool call ID when AskUserQuestion fires so we can match the result
      if (
        output.type === 'tool_use' &&
        output.toolName === 'AskUserQuestion' &&
        output.toolCallId
      ) {
        this.pendingAskUserCallIds.set(sessionId, output.toolCallId);
      }

      // Any tool_result for a tracked AskUserQuestion call resolves the pending choice
      // (covers normal answer, "clarify" rejection, and interrupt rejection)
      if (
        output.type === 'tool_result' &&
        output.toolCallId &&
        this.pendingAskUserCallIds.get(sessionId) === output.toolCallId
      ) {
        this.pendingAskUserCallIds.delete(sessionId);
        broadcast({
          type: 'session.pending_choice.resolved',
          timestamp: now,
          data: { sessionId },
        });
        pendingChoiceEvents.emit('session.pending_choice.resolved', sessionId);
      }

      // Belt-and-suspenders: interrupt sentinel clears any lingering banner even if
      // the tool_use was not yet tracked (e.g. JSONL read started mid-conversation)
      if (
        output.type === 'message' &&
        output.role === 'user' &&
        output.content === TOOL_USE_INTERRUPTED_SENTINEL
      ) {
        broadcast({ type: 'session.pending_choice.resolved', timestamp: now, data: { sessionId } });
        pendingChoiceEvents.emit('session.pending_choice.resolved', sessionId);
      }
    }
  }

  async watchFile(sessionId: string, repoPath: string): Promise<void> {
    const jsonlPath = join(
      homedir(),
      '.claude',
      'projects',
      claudeProjectDirName(repoPath),
      `${sessionId}.jsonl`,
    );
    await this.attachWatcher(sessionId, jsonlPath);
  }
}
