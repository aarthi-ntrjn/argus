import { join } from 'path';
import { broadcast } from '../../api/ws/event-dispatcher.js';
import { parseJsonlLine } from './copilot-cli-jsonl-parser.js';
import { JsonlWatcherBase } from '../jsonl-watcher-base.js';
import { pendingChoiceEvents } from '../pending-choice-events.js';
import type { SessionOutput } from '../../models/index.js';

export class CopilotJsonlWatcher extends JsonlWatcherBase {
  protected readonly tag = '[CopilotDetector]';

  // Tracks the toolCallId of a pending permission.requested per session so we can
  // resolve the approval card when tool.execution_complete fires for the same tool.
  private readonly pendingPermissionCallIds = new Map<string, string>();

  protected parseLine(
    line: string,
    sessionId: string,
    seq: number,
    makeId: (blockIndex: number) => string,
  ): SessionOutput[] {
    return parseJsonlLine(line, sessionId, seq, makeId);
  }

  protected override onRawLine(line: string, sessionId: string): void {
    try {
      const event = JSON.parse(line) as { type?: string; data?: Record<string, unknown> };
      const type = event.type;
      const data = event.data;

      if (type === 'permission.requested') {
        const req = data?.permissionRequest as Record<string, unknown> | undefined;
        if (!req) {
          return;
        }
        const toolCallId = typeof req.toolCallId === 'string' ? req.toolCallId : '';
        const kind = typeof req.kind === 'string' ? req.kind : 'shell';
        // Prefer fullCommandText; fall back to intention for write-kind tools.
        const commandText =
          typeof req.fullCommandText === 'string' && req.fullCommandText
            ? req.fullCommandText
            : typeof req.intention === 'string'
              ? req.intention
              : '';

        if (toolCallId) {
          this.pendingPermissionCallIds.set(sessionId, toolCallId);
        }
        pendingChoiceEvents.emit('session.permission_requested', sessionId, kind, commandText);
      } else if (type === 'tool.execution_complete' || type === 'tool.execution_failed') {
        const toolCallId = typeof data?.toolCallId === 'string' ? data.toolCallId : '';
        const pendingId = this.pendingPermissionCallIds.get(sessionId);
        if (pendingId && toolCallId === pendingId) {
          this.pendingPermissionCallIds.delete(sessionId);
          pendingChoiceEvents.emit('session.permission_resolved', sessionId);
        }
      }
    } catch {
      // Ignore malformed lines.
    }
  }

  protected override onNewOutputs(sessionId: string, outputs: SessionOutput[]): void {
    const now = new Date().toISOString();
    for (const output of outputs) {
      if (output.type === 'tool_use' && output.toolName === 'ask_user') {
        let question = '';
        let choices: string[] = [];
        try {
          const parsed = JSON.parse(output.content) as Record<string, unknown>;
          if (typeof parsed.question === 'string') {
            question = parsed.question;
          }
          if (Array.isArray(parsed.choices)) {
            choices = (parsed.choices as unknown[]).filter(
              (c): c is string => typeof c === 'string',
            );
          }
        } catch {
          // content is the raw question string (single-arg ask_user with no choices)
          question = output.content;
        }

        if (output.toolCallId) {
          this.pendingAskUserCallIds.set(sessionId, output.toolCallId);
        }
        const allQuestions = [{ question, choices }];
        broadcast({
          type: 'session.pending_choice',
          timestamp: now,
          data: { sessionId, question, choices, allQuestions },
        });
      } else if (output.type === 'tool_result' && output.toolCallId) {
        const pendingId = this.pendingAskUserCallIds.get(sessionId);
        if (pendingId === output.toolCallId) {
          this.pendingAskUserCallIds.delete(sessionId);
          broadcast({
            type: 'session.pending_choice.resolved',
            timestamp: now,
            data: { sessionId },
          });
        }
      }
    }
  }

  override closeWatcher(sessionId: string): void {
    this.pendingPermissionCallIds.delete(sessionId);
    super.closeWatcher(sessionId);
  }

  override stopWatchers(): void {
    this.pendingPermissionCallIds.clear();
    super.stopWatchers();
  }

  async watchFile(sessionId: string, dirPath: string): Promise<void> {
    await this.attachWatcher(sessionId, join(dirPath, 'events.jsonl'));
  }
}
