# Tasks: Tool Call Count in Session Card Preview

**Input**: Design documents from `/specs/077-tool-call-count-preview/`
**Branch**: `077-tool-call-count-preview`
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- No backend changes. No DB schema changes. Pure frontend work.

---

## Phase 1: Foundational (Blocking Prerequisite)

**Purpose**: Extract the `derivePreviewState()` helper that all user story rendering depends on.

**⚠️ CRITICAL**: US1, US2, and US3 all depend on this helper being in place.

- [x] T001 Add `derivePreviewState()` helper and its `PreviewState` discriminated union type to `frontend/src/utils/sessionUtils.ts`. The function signature is: `derivePreviewState(items: SessionOutput[], isTerminated: boolean): PreviewState` where `PreviewState` is `{ kind: 'waiting' } | { kind: 'text-only'; content: string } | { kind: 'tool-count-only'; count: number } | { kind: 'text-plus-count'; content: string; count: number }`. Logic: (1) if isTerminated, find last assistant message → text-only or waiting; (2) find last item with type==='message' && role==='assistant'; (3) count items with type==='tool_use' whose sequenceNumber is greater than the boundary item's sequenceNumber (or all tool_use items if no boundary); (4) return tool-count-only if count>0 and no boundary, text-plus-count if count>0 and boundary exists, text-only if count=0 and boundary exists, waiting otherwise. Import `SessionOutput` from `../types`.
- [x] T002 Write unit tests for `derivePreviewState()` in `frontend/src/utils/__tests__/sessionUtils.test.ts` covering all seven logic branches: (a) terminated with assistant message → text-only, (b) terminated without any message → waiting, (c) active, no messages, no tool_use → waiting, (d) active, tool_use only (no assistant message) → tool-count-only, (e) active, assistant message then tool_use → text-plus-count, (f) active, assistant message only (no subsequent tool_use) → text-only, (g) singular/plural: count===1 → '1 tool call', count>1 → 'N tool calls'. Confirm tests FAIL before T001 is implemented.

**Checkpoint**: `derivePreviewState()` is tested and passing. US phases can now proceed.

---

## Phase 2: User Story 1 — See Progress When AI Is Working (Priority: P1) 🎯 MVP

**Goal**: Replace the current preview's "Waiting for output..." with a live tool call count when the AI is making tool calls but hasn't replied yet.

**Independent Test**: With an active session making tool calls but no new assistant reply, the session card preview shows "Running... N tool calls" and updates as new tool_use events arrive via WebSocket.

- [x] T003 [US1] Update `frontend/src/components/SessionCard/SessionCard.tsx`: remove the existing `previewItem` / `previewContent` derivation (lines 65–72) and replace it with a call to `derivePreviewState(items, isTerminated)` imported from `../../utils/sessionUtils`. Render the preview box content based on the returned `kind`: `waiting` → unchanged italic "Waiting for output..." in gray; `text-only` → existing ReactMarkdown rendering of `content`; `tool-count-only` → plain text `"Running... N tool call(s)"` (no markdown, gray-300 monospace); `text-plus-count` → ReactMarkdown of `content` followed by a `<span>` with `" +N tool call(s)"` appended in gray-400. Use `count === 1 ? '1 tool call' : \`${count} tool calls\`` for the label. Keep the `previewContent` CSS class conditional: truthy when kind is text-only or text-plus-count (for the dark-background color), use gray-500 italic for waiting and gray-300 for tool-count-only.
- [x] T004 [US1] Update `frontend/src/utils/sessionUtils.ts` to export the `PreviewState` type so it is importable in SessionCard.tsx (if not already exported from T001).
- [x] T005 [P] [US1] Add unit test cases to `frontend/src/utils/__tests__/sessionUtils.test.ts` (or extend if already created in T002) specifically verifying the tool-count-only path renders "Running... 5 tool calls" (and "Running... 1 tool call" for count===1).

**Checkpoint**: User Story 1 is complete. Active sessions with tool calls show a count; sessions with no output still show "Waiting for output...".

---

## Phase 3: User Story 2 — See Ongoing Tool Activity After a Reply (Priority: P2)

**Goal**: When tool calls occur after the most recent assistant reply, append the count inline to the reply text.

**Independent Test**: A session that replied and then continued with tool calls shows the reply text + "+N tool calls" appended. A terminated session shows only the text reply with no count.

- [x] T006 [US2] Verify the `text-plus-count` rendering path in `frontend/src/components/SessionCard/SessionCard.tsx` (added in T003) correctly appends "+N tool calls" after the ReactMarkdown block for the assistant message. If the span layout is incorrect (e.g., wrapping issue in line-clamp context), fix it so the text + count appear on the same rendered line within the 2-line preview box.
- [x] T007 [P] [US2] Add unit tests to `frontend/src/utils/__tests__/sessionUtils.test.ts` for the terminated-session guard: given items containing both an assistant message and subsequent tool_use events, `derivePreviewState(items, true)` returns `text-only` (tool count suppressed).

**Checkpoint**: User Stories 1 and 2 complete. Terminated sessions never show a count.

---

## Phase 4: User Story 3 — Consistent Behavior Across Both AI Platforms (Priority: P1)

**Goal**: Confirm that the `tool_use` output type is shared by both Claude Code and Copilot CLI outputs so the frontend logic works without any platform branching.

**Independent Test**: Both a Claude Code session card and a Copilot CLI session card display tool call counts in identical format during active tool use.

- [x] T008 [P] [US3] Verify in `frontend/src/types/index.ts` (or wherever `SessionOutput.type` is defined) that `'tool_use'` is a valid value in the `OutputType` union for both platforms. If both platforms already share the same `OutputType`, add a comment noting parity is structural (no code change needed). If a platform-specific branch exists, remove it so both use the same `derivePreviewState()` logic.
- [x] T009 [P] [US3] Add unit test to `frontend/src/utils/__tests__/sessionUtils.test.ts` for a mixed-platform fixture: given a sequence of items that matches the structure Copilot CLI produces (`type: 'tool_use'`, no role), verify `derivePreviewState()` returns `tool-count-only` with the correct count — confirming the helper is platform-agnostic.

**Checkpoint**: All three user stories are complete and independently testable.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Tests, documentation, and validation across all stories.

- [x] T010 [P] Update existing `frontend/src/utils/__tests__/sessionUtils.test.ts` to add an edge-case test: exactly 1 tool call yields the label "1 tool call" (singular). Exactly 0 tool_use items with no assistant message yields `waiting`.
- [x] T011 [P] Add a snapshot or render test to `frontend/src/__tests__/SessionCard.test.tsx` verifying the preview box shows "Running... 3 tool calls" when `lastOutput` contains 3 `tool_use` items and no assistant message. Ensure the existing "Waiting for output..." snapshot test still passes.
- [x] T012 Add an e2e test `frontend/tests/e2e/sc-077-tool-call-count.spec.ts` for SC-001: using the mock server, seed a session with `tool_use` outputs and no assistant message, load the dashboard, assert the session card preview contains the text "tool call" (case-insensitive). Seed a second session with both an assistant message and subsequent tool_use events and assert the preview contains "+".
- [x] T013 [P] Update `README.md` (repo root) to document the session card preview behavior: list the four preview states and when each is shown. Add to the "Session Cards" or "Dashboard" section if one exists; otherwise add a brief "Session Card Preview" subsection.
- [x] T014 Run `npm run lint:fix --workspace=frontend` and resolve any lint errors introduced by the new code. Confirm `npm run build --workspace=frontend` passes with zero type errors.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately. T002 must FAIL before T001 is implemented (TDD gate).
- **Phase 2 (US1)**: Depends on T001 (helper exists). T003 and T004 can start once T001 is done.
- **Phase 3 (US2)**: Depends on T003 (rendering in place). T006 validates the existing T003 output — minimal new code.
- **Phase 4 (US3)**: Depends on T001 (helper is platform-agnostic by design). T008 and T009 are [P] and can run with Phase 3.
- **Phase 5 (Polish)**: Depends on T003 (SessionCard updated). T010–T013 are [P] and can run in parallel.

### Task Dependencies (precise)

```
T002 → T001 → T003 → T004
                    → T005 [P]
                    → T006
                    → T007 [P]
T001 → T008 [P]
     → T009 [P]
T003 → T010 [P]
     → T011 [P]
     → T012
     → T013 [P]
     → T014
```

### Parallel Opportunities

```bash
# Phase 1: T002 (write failing tests) runs before T001 (implementation)

# Once T001 is done, these can all start together:
T003, T005, T008, T009

# Once T003 is done, these can all start together:
T006, T007, T010, T011, T012, T013, T014
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. T002 — write failing tests for `derivePreviewState()`
2. T001 — implement `derivePreviewState()` (tests go green)
3. T003 — update SessionCard rendering
4. T004 — ensure type export
5. T014 — lint + build
6. **STOP and VALIDATE**: Active session cards show tool call count. "Waiting for output..." unchanged for idle sessions.

### Incremental Delivery

1. Phase 1 (T001–T002) → helper ready
2. Phase 2 (T003–T005) → US1 done, MVP deliverable
3. Phase 3 (T006–T007) → US2 done (text + count)
4. Phase 4 (T008–T009) → US3 confirmed (platform parity)
5. Phase 5 (T010–T014) → polish, e2e, docs

---

## Notes

- No backend changes. No DB schema changes. No new API endpoints.
- `derivePreviewState()` is a pure function — fully unit-testable without DOM or React.
- `session-output-last` cache already receives `tool_use` events via `session.output.batch` WS events; no socket changes needed.
- The `refetchOnWindowFocus: false` rule applies if any new `useQuery` calls are added.
- Commit after each phase using the task ID in the message (e.g., `feat(077): T001-T002 derivePreviewState helper`).
