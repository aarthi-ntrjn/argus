import type { FastifyPluginAsync } from 'fastify';
import { getRepositoryByPath, getSession } from '../../db/database.js';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOOK_BODY_LIMIT = 64 * 1024; // 64 KB

const VALID_COPILOT_EVENTS = new Set(['sessionStart', 'sessionEnd', 'preToolUse', 'postToolUse']);

const EVENT_TO_PASCAL: Record<string, string> = {
  sessionStart: 'SessionStart',
  sessionEnd: 'SessionEnd',
  preToolUse: 'PreToolUse',
  postToolUse: 'PostToolUse',
};

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
  app.post<{ Body: HookPayload }>(
    '/hooks/claude',
    { bodyLimit: HOOK_BODY_LIMIT, logLevel: 'warn' },
    async (req, reply) => {
      const payload = req.body;
      const eventName = payload?.hook_event_name;
      const isLifecycle = eventName === 'SessionStart' || eventName === 'SessionEnd';

      if (!isLifecycle && eventName !== 'AskUserQuestion') {
        return reply.send({ ok: true });
      }

      const sessionId = payload.session_id;

      // FR-006: session_id must be a UUID v4
      if (typeof sessionId !== 'string' || !UUID_V4_RE.test(sessionId)) {
        return reply.status(400).send({
          error: 'INVALID_SESSION_ID',
          message: 'session_id must be a valid UUID v4',
          requestId: req.id,
        });
      }

      // FR-004: reject if payload carries a pid that conflicts with the stored session pid
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

      req.log.debug({ hookEvent: payload.hook_event_name, payload }, 'hook received');

      if (_cliManager) {
        await _cliManager.handleClaudeHookPayload(payload);
      }
      return reply.send({ ok: true });
    },
  );

  app.post<{ Querystring: { event?: string }; Body: CopilotRawPayload }>(
    '/hooks/copilot',
    { bodyLimit: HOOK_BODY_LIMIT, logLevel: 'warn' },
    async (req, reply) => {
      const body = req.body ?? {};
      const event = req.query.event;
      const isLifecycle = event === 'sessionStart' || event === 'sessionEnd';

      if (!isLifecycle && body.toolName !== 'ask_user') {
        return reply.send({ ok: true });
      }

      if (!event || !VALID_COPILOT_EVENTS.has(event)) {
        return reply.status(400).send({
          error: 'INVALID_HOOK_EVENT',
          message:
            'event query parameter must be one of: sessionStart, sessionEnd, preToolUse, postToolUse',
          requestId: req.id,
        });
      }

      const rawSessionId = body.sessionId;
      const cwd = typeof body.cwd === 'string' ? body.cwd : undefined;

      // Validate sessionId: if present, must be UUID v4; if absent, cwd must match a repo
      if (rawSessionId !== undefined) {
        if (typeof rawSessionId !== 'string' || !UUID_V4_RE.test(rawSessionId)) {
          return reply.status(400).send({
            error: 'INVALID_SESSION_ID',
            message: 'sessionId must be a valid UUID v4, or cwd must match a registered repository',
            requestId: req.id,
          });
        }
      } else {
        // No sessionId — require cwd to match a repo
        const repo = cwd ? getRepositoryByPath(cwd) : null;
        if (!repo) {
          return reply.status(400).send({
            error: 'INVALID_SESSION_ID',
            message: 'sessionId must be a valid UUID v4, or cwd must match a registered repository',
            requestId: req.id,
          });
        }
      }

      // Parse toolArgs JSON string into tool_input object
      let toolInput: Record<string, unknown> | undefined;
      if (typeof body.toolArgs === 'string') {
        try {
          toolInput = JSON.parse(body.toolArgs) as Record<string, unknown>;
        } catch {
          toolInput = undefined;
        }
      }

      // Normalize to HookPayload (internal format matching ClaudeCodeDetector)
      const normalized: HookPayload = {
        hook_event_name: EVENT_TO_PASCAL[event]!,
        session_id: typeof rawSessionId === 'string' ? rawSessionId : '',
        cwd,
        tool_name:
          typeof body.toolName === 'string'
            ? (TOOL_NAME_MAP[body.toolName] ?? body.toolName)
            : undefined,
        tool_input: toolInput,
      };

      req.log.debug(
        { hookEvent: normalized.hook_event_name, sessionId: normalized.session_id },
        'copilot hook received',
      );

      if (_cliManager) {
        await _cliManager.handleCopilotHookPayload(normalized);
      }
      return reply.send({ ok: true });
    },
  );
};

export default hooksRoutes;
