# Contract: WebSocket Event `launcher.pending.gone`

## Overview

Broadcast to all connected frontend clients when a launcher WebSocket disconnects without having claimed a session. This allows the frontend to immediately remove the corresponding placeholder card rather than waiting for the 30-second timeout.

## Channel

Delivered via the existing Argus WebSocket channel (same channel as `session.created`, `session.updated`, `session.ended`).

## Event Shape

```typescript
{
  type: 'launcher.pending.gone';
  timestamp: string;         // ISO 8601, e.g. "2026-05-06T14:23:01.123Z"
  data: {
    ptyLaunchId: string;     // UUID matching the one returned in the 202 launch response
    repoPath: string;        // Absolute path of the repository being launched
    sessionType: 'claude-code' | 'copilot-cli';  // Tool type that was launched
  };
}
```

## Example

```json
{
  "type": "launcher.pending.gone",
  "timestamp": "2026-05-06T14:23:01.123Z",
  "data": {
    "ptyLaunchId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "repoPath": "/Users/dev/my-project",
    "sessionType": "claude-code"
  }
}
```

## Emission Conditions

This event is broadcast **only** when ALL of the following are true:

1. A launcher WebSocket connection closes (via the `socket.on('close', ...)` handler in `launcher.ts`).
2. The `ptyLaunchId` was set (the launcher sent a register message).
3. `ptyRegistry.getClaimedId(ptyLaunchId)` returns `null` or `undefined` — meaning the launcher never claimed a session.
4. `repoPath` is set on the launcher connection.

This event is **NOT** emitted when:
- The launcher disconnects after claiming a session (normal shutdown path).
- The launcher disconnects and `repoPath` is null.
- The launcher was never registered (no `ptyLaunchId`).

## Frontend Handler

```typescript
socket.onEvent('launcher.pending.gone', (data: { ptyLaunchId: string; repoPath: string; sessionType: string }) => {
  removePending(data.ptyLaunchId);
});
```

## Test Cases

| # | Scenario | Condition | Expected |
|---|---|---|---|
| 1 | Normal unclaimed disconnect | Launcher registered, then closed without session | Event broadcast with correct ptyLaunchId, repoPath, sessionType |
| 2 | Launcher closes after claiming | `getClaimedId` returns non-null | Event NOT broadcast |
| 3 | Launcher closes without registering | No register message was sent | Event NOT broadcast (ptyLaunchId is null) |
| 4 | Concurrent launchers | Two launchers disconnect without claiming | Two separate events, each with their own ptyLaunchId |
