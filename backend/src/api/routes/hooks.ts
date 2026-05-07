import type { FastifyPluginAsync } from 'fastify';
import { getSession } from '../../db/database.js';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOOK_BODY_LIMIT = 64 * 1024; // 64 KB

// Copilot uses camelCase event names over the wire; normalize to PascalCase internally.
const EVENT_TO_PASCAL: Record<string, string> = {
  sessionStart: 'SessionStart',
  sessionEnd: 'SessionEnd',
  preToolUse: 'PreToolUse',
  postToolUse: 'PostToolUse',
};

// Copilot tool names that map to their canonical internal equivalents.
const TOOL_NAME_MAP: Record<string, string> = {
  ask_user: 'ask_user',
};

interface HookPayload {
  hook_event_name: string;
  session_id: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: unknown;
  [key: string]: unknown;
}

interface CopilotRawPayload {
  sessionId?: string;
  cwd?: string;
  toolName?: string;
  toolArgs?: string;
  [key: string]: unknown;
}

let _cliManager: {
  handleClaudeHookPayload(p: HookPayload): Promise<void>;
  handleCopilotHookPayload(p: HookPayload): Promise<void>;
} | null = null;

export function setCliManager(manager: {
  handleClaudeHookPayload(p: HookPayload): Promise<void>;
  handleCopilotHookPayload(p: HookPayload): Promise<void>;
}): void {
  _cliManager = manager;
}

const hooksRoutes: FastifyPluginAsync = async (app) => {
  // Receives hook payloads injected by Claude Code into running sessions.
  // Processes SessionStart, SessionEnd, and all PreToolUse/PostToolUse events.
  // AskUserQuestion tool events surface ask_user prompts; all other tool events
  // surface tool approval prompts (bash commands, file writes, etc.).
  app.post<{ Body: HookPayload }>(
    '/hooks/claude',
    { bodyLimit: HOOK_BODY_LIMIT, logLevel: 'warn' },
    async (req, reply) => {
      const payload = req.body;
      const eventName = payload?.hook_event_name;
      const isLifecycle = eventName === 'SessionStart' || eventName === 'SessionEnd';
      const isToolUse = eventName === 'PreToolUse' || eventName === 'PostToolUse';

      if (!isLifecycle && !isToolUse) {
        return reply.send({ ok: true });
      }

      const sessionId = payload.session_id;

      // Validate session_id before filtering by tool_name so invalid IDs are always rejected.
      if (typeof sessionId !== 'string' || !UUID_V4_RE.test(sessionId)) {
        return reply.status(400).send({
          error: 'INVALID_SESSION_ID',
          message: 'session_id must be a valid UUID v4',
          requestId: req.id,
        });
      }

      // Reject if the payload's pid conflicts with the pid already stored for this session.
      if ('pid' in payload && typeof payload.pid === 'number') {
        const existing = getSession(sessionId);
        if (existing?.pid !== null && existing?.pid !== undefined && existing.pid !== payload.pid) {
          return reply.status(409).send({
            error: 'SESSION_PID_CONFLICT',
            message: 'Session already has an established PID',
            requestId: req.id,
          });
        }
      }

      req.log.debug({ hookEvent: payload.hook_event_name, payload }, 'claude-code hook received');

      if (_cliManager) {
        await _cliManager.handleClaudeHookPayload(payload);
      }
      return reply.send({ ok: true });
    },
  );

  // Receives hook payloads injected by Copilot CLI into running sessions.
  // Processes SessionStart, SessionEnd, and all preToolUse/postToolUse events.
  // ask_user tool events surface ask_user prompts; all other tool events
  // surface tool approval prompts (bash commands, file writes, etc.).
  app.post<{ Querystring: { event?: string }; Body: CopilotRawPayload }>(
    '/hooks/copilot',
    { bodyLimit: HOOK_BODY_LIMIT, logLevel: 'warn' },
    async (req, reply) => {
      const body = req.body ?? {};
      const event = req.query.event;

      // Reject missing or unrecognized event values before any further processing.
      if (!event || !(event in EVENT_TO_PASCAL)) {
        return reply.status(400).send({
          error: 'INVALID_HOOK_EVENT',
          message:
            'event query parameter must be one of: sessionStart, sessionEnd, preToolUse, postToolUse',
          requestId: req.id,
        });
      }

      const sessionId = body.sessionId;

      // Validate that sessionId is a well-formed UUID v4 string.
      if (typeof sessionId !== 'string' || !UUID_V4_RE.test(sessionId)) {
        return reply.status(400).send({
          error: 'INVALID_SESSION_ID',
          message: 'sessionId must be a valid UUID v4',
          requestId: req.id,
        });
      }

      // toolArgs arrives as a JSON string; parse it into a structured object.
      let toolInput: Record<string, unknown> | undefined;
      if (typeof body.toolArgs === 'string') {
        try {
          toolInput = JSON.parse(body.toolArgs) as Record<string, unknown>;
        } catch {
          toolInput = undefined;
        }
      }

      // Normalize Copilot's camelCase wire format to the shared HookPayload shape.
      const cwd = typeof body.cwd === 'string' ? body.cwd : undefined;
      const normalized: HookPayload = {
        hook_event_name: EVENT_TO_PASCAL[event]!,
        session_id: sessionId,
        cwd,
        tool_name:
          typeof body.toolName === 'string'
            ? (TOOL_NAME_MAP[body.toolName] ?? body.toolName)
            : undefined,
        tool_input: toolInput,
      };

      req.log.debug(
        { hookEvent: normalized.hook_event_name, sessionId: normalized.session_id },
        'copilot-cli hook received',
      );

      if (_cliManager) {
        await _cliManager.handleCopilotHookPayload(normalized);
      }
      return reply.send({ ok: true });
    },
  );
};

export default hooksRoutes;
