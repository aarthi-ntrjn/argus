# Data Model: PTY Launcher

## Schema Change: sessions table

Add `launch_mode` column:

```sql
ALTER TABLE sessions ADD COLUMN launch_mode TEXT CHECK(launch_mode IN ('pty', 'detected'));
```

- `'pty'`: session was started via `argus launch`; PTY write channel is (or was) available
- `'detected'`: session was detected via hooks or directory scan; read-only
- `NULL`: legacy sessions before this feature (treated as `'detected'`)

## Updated Session TypeScript model

```typescript
export type SessionLaunchMode = 'pty' | 'detected';

export interface Session {
  id: string;
  repositoryId: string;
  type: SessionType;          // 'claude-code' | 'copilot-cli'
  launchMode: SessionLaunchMode | null;  // NEW
  pid: number | null;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  summary: string | null;
  expiresAt: string | null;
  model: string | null;
}
```

## PtyRegistry (in-memory, not persisted)

```typescript
interface LauncherConnection {
  ws: WebSocket;
  sessionId: string;
  pid: number;
  connectedAt: string;
}

// Map<sessionId, LauncherConnection>
```

Lost on backend restart. Frontend uses `session.launchMode === 'pty'` for persistent display. PtyRegistry is used only for active routing.

## WebSocket message types

### Launcher → Backend

```typescript
// On connect
{ type: 'register'; sessionId: string; pid: number; sessionType: 'claude-code' | 'copilot-cli'; cwd: string }

// After successful PTY write
{ type: 'prompt_delivered'; actionId: string }

// After failed PTY write
{ type: 'prompt_failed'; actionId: string; error: string }

// When tool process exits
{ type: 'session_ended'; sessionId: string; exitCode: number | null }
```

### Backend → Launcher

```typescript
// Deliver a prompt
{ type: 'send_prompt'; actionId: string; prompt: string }
```

## ControlAction lifecycle for PTY sessions

| Step | Status |
|------|--------|
| sendPrompt() called | `pending` |
| Launcher not connected | `failed` (immediate) |
| send_prompt sent over WS | `pending` (waiting for ack) |
| Launcher acks `prompt_delivered` | `completed` |
| Launcher acks `prompt_failed` | `failed` |
| No ack within 10s timeout | `failed` |
