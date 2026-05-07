# Tasks: Launch Pending Session Card

**Input**: Design documents from `specs/069-launch-pending-card/`
**Branch**: `069-launch-pending-card`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared type changes that both user stories depend on.

- [x] T001 Add `ptyLaunchId?: string | null` field to the `Session` interface in `frontend/src/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend changes that expose `ptyLaunchId` through the HTTP response and update the API layer. Both user stories depend on the frontend receiving a `ptyLaunchId` from the launch response.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for Foundation

> **Write these tests FIRST, ensure they FAIL before implementation.**

- [x] T002 [P] Write unit test asserting `POST /api/v1/sessions/launch-terminal` 202 response body includes a non-empty UUID `ptyLaunchId` field, in `backend/tests/unit/tools-launch-id.test.ts`
- [x] T003 [P] Write unit test asserting `launchInTerminal()` in `frontend/src/services/api.ts` returns `{ ptyLaunchId: string }` on 202 (mock fetch), in `frontend/src/services/api.test.ts` (create if absent)

### Implementation for Foundation

- [x] T004 Modify `buildLaunchCmdWithCwd` and `buildLaunchCmdBase` in `backend/src/api/routes/tools.ts` to accept an optional `launchId: string` parameter and append `--launch-id ${launchId}` to the command string (after T002 is confirmed failing)
- [x] T005 In the `launch-terminal` POST handler in `backend/src/api/routes/tools.ts`, import `randomUUID` from `node:crypto`, generate `const ptyLaunchId = randomUUID()` before calling the command builder, pass it to the builder, and return `reply.status(202).send({ status: 'launched', ptyLaunchId })` (after T004)
- [x] T006 In `backend/src/cli/launch.ts`, extend the arg-parsing loop (lines 42–49) to also parse `--launch-id <uuid>` alongside `--cwd`. If `--launch-id` is present, use that value for `ptyLaunchId` on line 134 instead of calling `randomUUID()` (after T005)
- [x] T007 Update `launchInTerminal` in `frontend/src/services/api.ts`: change the 202 branch to `const body = await res.json() as { ptyLaunchId?: string }; return { ptyLaunchId: body.ptyLaunchId }` and update the return type to `Promise<{ ptyLaunchId?: string; cmd?: string }>` (after T003 is confirmed failing, after T005)

**Checkpoint**: `POST /api/v1/sessions/launch-terminal` returns `{ status: 'launched', ptyLaunchId: '<uuid>' }`. `launchInTerminal()` returns `{ ptyLaunchId }`. Tests T002 and T003 pass.

---

## Phase 3: User Story 1 — Immediate Visual Feedback on Launch (Priority: P1) 🎯 MVP

**Goal**: A placeholder session card with a spinner appears immediately when the user clicks "Launch with Argus" on a successful terminal launch.

**Independent Test**: Click "Launch with Argus" → Claude or Copilot → observe a placeholder card appears in the repo's session list before any real session shows up.

### Tests for User Story 1

> **Write these tests FIRST, ensure they FAIL before implementation.**

- [x] T008 [P] [US1] Write unit tests for `usePendingLaunchers` hook in `frontend/src/hooks/usePendingLaunchers.test.ts`: test `addPending` adds record, `removePending` removes by ptyLaunchId, timeout removes after 30s (use vi.useFakeTimers), multiple simultaneous launchers coexist independently
- [x] T009 [P] [US1] Write component test for `PendingSessionCard` in `frontend/src/components/PendingSessionCard/PendingSessionCard.test.tsx`: renders tool name, animated spinner, "Starting..." label; has no interactive controls (no stop or send-prompt buttons)

### Implementation for User Story 1

- [x] T010 [US1] Create `frontend/src/hooks/usePendingLaunchers.ts`: export `PendingLauncher` type `{ ptyLaunchId, repoPath, tool, createdAt }` and hook `usePendingLaunchers()` returning `{ pendingLaunchers, addPending, removePending }`. `addPending` creates a record, sets a 30s `setTimeout` that calls `removePending`. `removePending` clears the timeout and removes from state. Cleanup on unmount clears all timeouts. (after T008 is confirmed failing)
- [x] T011 [US1] Create `frontend/src/components/PendingSessionCard/PendingSessionCard.tsx`: renders a card that matches the visual style of `SessionCard` but is visually distinct (e.g., dashed border or muted background); shows the tool icon (ClaudeIcon or CopilotIcon), tool name (`Claude Code` or `GitHub Copilot CLI`), an animated spinner (CSS or Tailwind `animate-spin`), and a "Starting..." status label; no interactive controls (after T009 is confirmed failing)
- [x] T012 [US1] Update `LaunchDropdown.tsx`: `handleLaunch` receives the `ptyLaunchId` from `launchInTerminal()`; if the response is not headless (no `cmd`) and `ptyLaunchId` is set, call a new `onLaunchPending(ptyLaunchId: string)` prop. Add `onLaunchPending: (ptyLaunchId: string) => void` to the `Props` interface (after T010, T011)
- [x] T013 [US1] Update `RepoCardProps` interface and `RepoCard.tsx`: add `pendingLaunchers: PendingLauncher[]` and `onLaunchPending: (ptyLaunchId: string) => void` props; render `PendingSessionCard` components above the sessions list for any pending launchers where `launcher.repoPath === repo.path`; pass `onLaunchPending` down to `LaunchDropdown` (after T012)
- [x] T014 [US1] In `DashboardPage.tsx` (or the file that renders the list of `RepoCard`s): call `usePendingLaunchers()`, pass `pendingLaunchers` and `addPending` (wrapped as `onLaunchPending(ptyLaunchId)` that calls `addPending({ ptyLaunchId, repoPath: repo.path, tool })`) down to each `RepoCard`. Register a `useEffect` with `onEvent('session.created', ...)` that calls `removePending(session.ptyLaunchId)` when the session has a `ptyLaunchId`. (after T013)
- [x] T015 [US1] Run `npm run build --workspace=frontend` and fix any TypeScript or build errors introduced in T010–T014

**Checkpoint**: After a successful launch, a placeholder card appears immediately in the repo card and disappears when `session.created` arrives with a matching `ptyLaunchId`.

---

## Phase 4: User Story 2 — Placeholder Removal on Launch Failure (Priority: P2)

**Goal**: Placeholder cards are removed immediately when the backend broadcasts `launcher.pending.gone`, and are removed automatically after 30 seconds as a fallback.

**Independent Test**: Close the launched terminal immediately after it opens — the placeholder card disappears within a few seconds (not waiting 30s timeout).

### Tests for User Story 2

> **Write these tests FIRST, ensure they FAIL before implementation.**

- [x] T016 [P] [US2] Write unit test in `backend/tests/unit/launcher-pending-gone.test.ts` asserting that when the launcher WebSocket closes and `getClaimedId(ptyLaunchId)` returns `null`, `broadcast` is called with `{ type: 'launcher.pending.gone', data: { ptyLaunchId, repoPath, sessionType } }`

### Implementation for User Story 2

- [x] T017 [US2] In `backend/src/api/routes/launcher.ts`, in the `socket.on('close', ...)` handler's `else if (repoPath)` branch (after the existing `ptyRegistry.unregisterPending` call), add a `broadcast({ type: 'launcher.pending.gone', timestamp: new Date().toISOString(), data: { ptyLaunchId, repoPath, sessionType } })` call. `sessionType` is available from the register message (add it to the connection-scope variable). (after T016 is confirmed failing)
- [x] T018 [US2] In `DashboardPage.tsx`, extend the existing `useEffect` from T014 to also register `onEvent('launcher.pending.gone', (data) => { removePending((data as { ptyLaunchId: string }).ptyLaunchId); })` (after T017, after T014)

**Checkpoint**: Closing a terminal immediately removes its placeholder card without waiting for the 30s timeout.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, build verification, full test run.

- [x] T019 Update `README.md` (root or `docs/README-CONTRIBUTORS.md`) to document the "Launch with Argus" pending session card UX behavior — what the placeholder shows, when it disappears, and the 30-second timeout fallback
- [x] T020 [P] Run `npm run lint:fix --workspace=frontend` and `npm run lint:fix --workspace=backend` to auto-fix any lint violations introduced in this feature
- [x] T021 [P] Run `npm run build --workspace=frontend` to confirm the production build succeeds with all changes
- [x] T022 Run `npm run test --workspace=backend` to confirm all backend tests pass
- [x] T023 Run `npm run test --workspace=frontend` to confirm all frontend tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001). BLOCKS all user story work.
- **Phase 3 (US1)**: Depends on Phase 2 completion.
- **Phase 4 (US2)**: Depends on Phase 3 (T014) for the frontend wiring.
- **Phase 5 (Polish)**: Depends on all implementation phases being done.

### Within Phase Dependencies

- T004 → T005 → T006 (command builder, then handler, then CLI)
- T007 (frontend API) depends on T005 (backend returns ptyLaunchId)
- T008, T009 in parallel (tests only, no code yet)
- T010 (after T008 fails) → T011 (after T009 fails) → T012 → T013 → T014 → T015
- T016 (test only) → T017 → T018

### Parallel Opportunities

- T002 and T003 can be written in parallel (different test files).
- T004 and T007 are not parallel: T007 tests the frontend against the backend contract from T005.
- T008 and T009 can be written in parallel (different test files).
- T019, T020, T021 can run in parallel once implementation is done.
