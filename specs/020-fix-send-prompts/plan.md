# Implementation Plan: Fix Send Prompts (PTY Launcher)

**Branch**: `020-fix-send-prompts` | **Date**: 2026-04-07 | **Spec**: [spec.md](./spec.md)

## Summary

Implement a PTY launcher (`argus launch <tool>`) that spawns Claude Code or GitHub Copilot CLI inside a pseudo-terminal owned by Argus. The backend holds a WebSocket connection to each launcher process and routes `send_prompt` ControlActions through it. PTY-launched sessions gain full two-way control; hook-detected sessions remain read-only. `node-pty` provides cross-platform PTY support (Windows ConPTY + POSIX PTY).

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 22  
**Primary Dependencies**: node-pty (new), Fastify 5, better-sqlite3, ws, @fastify/websocket  
**Storage**: SQLite (better-sqlite3) — adding `launch_mode` column to sessions table  
**Testing**: Vitest 3 (unit), existing integration test patterns  
**Target Platform**: Windows 10+ (ConPTY) + macOS (POSIX PTY)  
**Project Type**: Local developer tool — single user, localhost only  
**Performance Goals**: Prompt delivery under 500ms p95  
**Constraints**: PTY handles are in-memory; backend restart drops PTY connections (sessions become read-only until restarted)  
**Scale/Scope**: §VIII exception applies — single-user localhost tool, target ≥10 concurrent PTY sessions

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Reliable, observable, debuggable | PASS | ControlAction lifecycle tracks every send attempt |
| §II Versioned API boundaries | PASS | Existing REST API unchanged; new `/launcher` WS endpoint versioned |
| §III Functions < 50 lines | PASS | PTY manager, launcher, and controller split into small focused modules |
| §IV Test-first | PASS | Tests written before implementation in each phase |
| §V Unit + integration tests | PASS | Unit tests for PTY manager and sendPrompt; integration tests for launcher route |
| §VI Auth/authz | EXCEPTION | §VI exception: service bound to 127.0.0.1 for single local user (v1 local tool) |
| §VII Structured logs + health | PASS | pino structured logging added to launcher and PTY manager |
| §VIII 10k users | EXCEPTION | §VIII exception: single-user local tool; target ≥10 concurrent PTY sessions |
| §IX AI code review | PASS | All AI-generated code reviewed before merge |
| §X Definition of Done | PASS | Tests, docs, README update included |
| §XI README updated | PASS | README updated with `argus launch` usage instructions |
| §XII Error handling | PASS | Structured error contract on all failure paths; human-friendly UX errors |

## Architecture

### Component Overview

```
User's terminal
    │ stdin/stdout
    ▼
[argus-launch process]  ←──── node-pty ────►  [claude / gh copilot]
    │
    │ WebSocket (/launcher)
    ▼
[Argus backend]
    ├── PtyRegistry (Map<sessionId, LauncherSocket>)
    ├── SessionController.sendPrompt() → PtyRegistry.write()
    └── SQLite sessions (launch_mode = 'pty')
```

### New WebSocket endpoint: `/launcher`

The launcher process (running in the user's terminal) connects here and registers itself. The backend routes send_prompt actions back through this connection.

Messages from launcher → backend:
- `{ type: 'register', sessionId, pid, sessionType, cwd }` — on startup
- `{ type: 'prompt_delivered', actionId }` — after writing to PTY
- `{ type: 'prompt_failed', actionId, error }` — if PTY write fails
- `{ type: 'session_ended', sessionId }` — when the process exits

Messages from backend → launcher:
- `{ type: 'send_prompt', actionId, prompt }` — delivery instruction

### New files

```
backend/src/
  cli/
    launch.ts              # argus launch entrypoint
  services/
    pty-registry.ts        # Map<sessionId, LauncherWebSocket>
  api/routes/
    launcher.ts            # /launcher WebSocket route
```

### Modified files

```
backend/src/
  services/session-controller.ts   # sendPrompt() routes via PtyRegistry
  db/schema.ts                     # add launch_mode column
  db/database.ts                   # migration + upsertSession update
  models/index.ts                  # Session.launchMode field, SessionType union
  server.ts                        # register launcher route
backend/package.json               # add node-pty dependency
frontend/src/
  types.ts                         # Session.launchMode field
  components/SessionCard/SessionCard.tsx        # PTY capability badge
  components/SessionPromptBar/SessionPromptBar.tsx  # disable input for read-only sessions
```

## Phase 0: Research

See [research.md](./research.md).

## Phase 1: Design

See [data-model.md](./data-model.md) and [contracts/](./contracts/).

## Implementation Phases

### Phase 1: Backend foundation
- Add `node-pty` dependency
- Add `launch_mode` column migration
- Create `PtyRegistry` service
- Add `/launcher` WebSocket route
- Update `SessionController.sendPrompt()` to route via PtyRegistry

### Phase 2: Launcher CLI
- Create `backend/src/cli/launch.ts`
- Spawn target command in PTY
- Proxy user terminal stdin/stdout through PTY
- Connect to Argus backend `/launcher` WebSocket
- Register session on connect, handle send_prompt, emit session_ended

### Phase 3: Frontend
- Add `launchMode` to `Session` type
- Show "prompt-capable" vs "read-only" indicator on SessionCard
- Disable SessionPromptBar with tooltip for read-only sessions

### Phase 4: Polish
- README update with `argus launch` usage
- Full test run + build check
