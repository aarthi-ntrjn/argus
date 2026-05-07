# Phase 0 Research: Launch Pending Session Card

## Decision 1: Where to generate `ptyLaunchId`

**Decision**: Generate `ptyLaunchId` in `backend/src/api/routes/tools.ts` (the HTTP handler), before opening the terminal. Pass it to the launcher process as `--launch-id <uuid>` in the CLI command string.

**Rationale**: The HTTP handler is the only component that exists before the terminal opens and that can return data to the frontend. The launcher subprocess currently generates its own UUID in `backend/src/cli/launch.ts` (`const ptyLaunchId = randomUUID()`), but the subprocess starts asynchronously after the HTTP response is sent. Moving generation to the handler ensures the ID is known at response time.

**Alternatives considered**:
- **Keep ID in launcher, add registration event**: The backend could broadcast a `launcher.pending.registered` event when the launcher WebSocket connects, and the frontend could match by `repoPath + sessionType`. Rejected: this is async and requires heuristic matching that breaks for two concurrent same-repo/same-tool launches (see FR-007).
- **Frontend-generated UUID**: Frontend generates a local ID and matches `session.created` events by `repoPath + sessionType`. Rejected: same ambiguity problem for concurrent launches.
- **Shared in-memory map before launching**: HTTP handler stores a pre-reserved ID in a server-side map, launcher reads it at startup. Rejected: overly complex; passing via CLI arg is simpler and avoids shared mutable state.

**Implementation**: 
1. In `tools.ts`, import `randomUUID` from `node:crypto`.
2. Generate `ptyLaunchId` before calling `buildLaunchCmdWithCwd`.
3. Append `--launch-id ${ptyLaunchId}` to the command string.
4. Return `reply.status(202).send({ status: 'launched', ptyLaunchId })`.
5. In `launch.ts`, parse `--launch-id` alongside `--cwd` (same loop). If present, use that value; if absent, fall back to `randomUUID()` (for direct CLI invocations not going through Argus).

---

## Decision 2: Where to broadcast `launcher.pending.gone`

**Decision**: In `backend/src/api/routes/launcher.ts`, at the end of the `else if (repoPath)` branch in the `socket.on('close', ...)` handler (line ~349). This branch already handles the "never claimed" path and calls `ptyRegistry.unregisterPending(repoPath, ptyLaunchId)`. We add a `broadcast({ type: 'launcher.pending.gone', data: { ptyLaunchId, repoPath, sessionType } })` call there.

**Rationale**: The `else if (repoPath)` branch is the exact point where the launcher is confirmed to have disconnected without ever claiming a session. No other code path reaches it. Adding the broadcast here is surgical and preserves all existing logic.

**Alternatives considered**:
- **Broadcast from `ptyRegistry.unregisterPending`**: Would create a dependency between `ptyRegistry` and the WebSocket broadcast system, crossing layers.
- **Poll `ptyRegistry` from frontend**: Rejected: polling defeats the purpose of real-time event delivery.

---

## Decision 3: Pending launcher state in frontend

**Decision**: A custom hook `usePendingLaunchers` manages state as a `Map<string, PendingLauncher>` keyed by `ptyLaunchId`. It is called once in `DashboardPage` and the methods (`addPending`, `removePending`) are passed down as props. Socket event handlers for `session.created` and `launcher.pending.gone` call `removePending` when a match is found.

**Rationale**: The pending launcher map is tightly scoped to the dashboard lifetime. React context would be heavier for a transient state that lives only while the dashboard is mounted. A hook keeps the state local to `DashboardPage` and avoids global context. Timeout cleanup is handled inside the hook with `setTimeout` + `useEffect` cleanup.

**Alternatives considered**:
- **React context / Zustand store**: Unnecessary for state that is already owned by `DashboardPage`.
- **React Query cache**: Pending launchers are not server state; putting them in the React Query cache would create confusion between real sessions and placeholders.

---

## Decision 4: How `LaunchDropdown` communicates `ptyLaunchId` upward

**Decision**: Extend `LaunchDropdown`'s `onLaunchSuccess` (or add a new `onPendingLauncher`) prop that receives `{ ptyLaunchId, repoPath, tool }`. `RepoCard` passes this through to `DashboardPage`.

**Rationale**: `LaunchDropdown` is a leaf component that already calls `launchInTerminal()`. The natural React pattern is to propagate state up via callback props. Since `RepoCard` sits between `LaunchDropdown` and `DashboardPage`, it also gets the callback (already follows the same pattern with `onLaunchError`).

---

## Key Findings (pre-existing code)

- `ptyLaunchId` is already stored in the sessions DB table and returned in the backend `Session` model. The frontend `Session` type in `types.ts` just needs `ptyLaunchId?: string | null` added.
- The `session.created` WebSocket event payload is the full `Session` object, so adding `ptyLaunchId` to the frontend type is sufficient for matching.
- `broadcast()` from `event-dispatcher.ts` is the single broadcast mechanism used throughout the backend. No new infrastructure is needed.
- `initSocketHandlers` in `frontend/src/services/socket.ts` wires all real-time event handlers. Adding `launcher.pending.gone` follows the same pattern as existing handlers.
