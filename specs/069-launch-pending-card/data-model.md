# Data Model: Launch Pending Session Card

## Client-Side Entity: `PendingLauncher`

A `PendingLauncher` is a transient, in-memory-only record created on the frontend when the user initiates a "Launch with Argus" action and receives a successful 202 response. It is never persisted to the database or the server.

### TypeScript Type

```typescript
export interface PendingLauncher {
  /** UUID returned in the 202 response from POST /api/v1/sessions/launch-terminal.
   *  Used to match against session.ptyLaunchId when a real session appears. */
  ptyLaunchId: string;

  /** The repository path that was launched. Used to route the placeholder card to the correct RepoCard. */
  repoPath: string;

  /** The tool that was launched ('claude' or 'copilot'). Displayed in the placeholder card. */
  tool: ToolCommand;

  /** ISO timestamp of when the placeholder was created. Used to enforce the 30s timeout. */
  createdAt: string;

  /** ID of the setTimeout handle used to auto-remove the placeholder after 30s. */
  timeoutHandle: ReturnType<typeof setTimeout>;
}
```

### State Transitions

```
[user clicks Launch]
     │
     ▼
  created (HTTP 202 received, ptyLaunchId in response)
     │
     ├─── session.created arrives with matching ptyLaunchId ──▶ removed (matched)
     │
     ├─── launcher.pending.gone event arrives with ptyLaunchId ─▶ removed (launcher died)
     │
     └─── 30 seconds elapse without match ──────────────────────▶ removed (timeout)
```

### Validation Rules

- `ptyLaunchId` must be a non-empty string (UUID format enforced by backend).
- `repoPath` must be a non-empty string.
- `tool` must be one of `'claude' | 'copilot'`.
- A `PendingLauncher` is created only on HTTP 202, never on 422 (headless) or on network error.
- Multiple `PendingLauncher` records may coexist simultaneously (one per launch action, even for the same repo).

---

## Backend Change: Updated `launch-terminal` 202 Response

The `POST /api/v1/sessions/launch-terminal` endpoint adds `ptyLaunchId` to its 202 response body. No new tables or columns are added — `ptyLaunchId` is generated ephemerally per request.

```typescript
// Before:
{ status: 'launched' }

// After:
{ status: 'launched', ptyLaunchId: string }
```

---

## Backend Change: `launcher.pending.gone` WebSocket Event

A new real-time event broadcast to all frontend clients when a pending (unclaimed) launcher disconnects.

```typescript
interface LauncherPendingGoneEvent {
  type: 'launcher.pending.gone';
  timestamp: string; // ISO 8601
  data: {
    ptyLaunchId: string;
    repoPath: string;
    sessionType: SessionType; // 'claude-code' | 'copilot-cli'
  };
}
```

---

## Frontend Change: `Session` type addition

The existing `Session` interface in `frontend/src/types.ts` gains one optional field:

```typescript
interface Session {
  // ... existing fields ...
  ptyLaunchId?: string | null; // NEW
}
```

This field is already present in the backend DB query result and the backend `Session` model. Adding it to the frontend type allows the `session.created` handler to extract it for placeholder matching.
