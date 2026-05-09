# Tasks: Thinking Events in Output Stream and Preview

**Feature**: 074-thinking-events-output
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Phase 1: Setup — extend OutputType

**Goal**: Add `'thinking'` to the shared `OutputType` union so all downstream code recognizes the new type without errors.

**Independent test**: TypeScript compilation passes with no type errors after the change.

- [x] T001 [P1] Add `'thinking'` to `OutputType` in `backend/src/models/index.ts` (line 23)
- [x] T002 [P1] [P] Add `'thinking'` to `OutputType` in `frontend/src/types.ts` (line 20)

---

## Phase 2: Backend — parse thinking blocks (US1, FR-001, FR-002)

**Goal**: The JSONL parser stores `thinking` and `redacted_thinking` content blocks as `SessionOutput` events with `type: 'thinking'`.

**Independent test**: `claude-code-jsonl-parser.test.ts` covers both block types before any implementation runs.

### Test tasks (write first, confirm failing)

- [x] T003 [P2] Add test case to `backend/tests/unit/claude-code-jsonl-parser.test.ts`: `parseClaudeJsonlLine` with a `thinking` block yields a `SessionOutput` with `type: 'thinking'`, correct `content`, and `role: null`
- [x] T004 [P2] [P] Add test case to `backend/tests/unit/claude-code-jsonl-parser.test.ts`: `parseClaudeJsonlLine` with a `redacted_thinking` block yields a `SessionOutput` with `type: 'thinking'` and `content: '[redacted]'`
- [x] T005 [P2] [P] Add test case: assistant entry with mixed blocks (text + thinking + tool_use) yields all three outputs in sequence order
- [x] T006 [P2] [P] Add test case: empty `thinking` text (`block.thinking === ''`) yields `content: ''` (not `'[redacted]'`)

### Implementation tasks

- [x] T007 [P2] Add `thinking?: string` field to `ContentBlock` interface in `backend/src/cli/claude-code/claude-code-jsonl-parser.ts` (line 4-12)
- [x] T008 [P2] In `parseAssistantEntry` (line 128), add `else if (block.type === 'thinking')` branch that pushes `{ type: 'thinking', role: null, content: block.thinking ?? '', toolName: null, toolCallId: null }` — after the existing `tool_use` branch (line 141-153)
- [x] T009 [P2] In `parseAssistantEntry`, add `else if (block.type === 'redacted_thinking')` branch that pushes `{ type: 'thinking', role: null, content: '[redacted]', toolName: null, toolCallId: null }`

---

## Phase 3: Frontend — output stream display (US1, US2, FR-003 to FR-007)

**Goal**: Thinking entries appear in the output pane with a THINK badge, fully expanded in verbose mode, collapsed-but-expandable in focused mode. Redacted entries show "(redacted)" placeholder.

**Independent test**: Vitest unit tests in `sessionDetailUtils.test.ts` and `SessionDetail.test.tsx` pass; thinking entries render correctly in both modes.

### Test tasks (write first, confirm failing)

- [x] T010 [P3] Add test to `frontend/src/__tests__/sessionDetailUtils.test.ts`: in verbose mode, a `thinking` item passes through `buildDisplayItems` as `{ kind: 'single', item }` (not filtered)
- [x] T011 [P3] [P] Add test to `frontend/src/__tests__/sessionDetailUtils.test.ts`: in focused mode, a `thinking` item also passes through as `{ kind: 'single', item }` (thinking is never dropped by the display utils — visibility is handled in the renderer)
- [x] T012 [P3] [P] Add test to `frontend/src/__tests__/SessionDetail.test.tsx`: a thinking output renders a "THINK" badge
- [x] T013 [P3] [P] Add test to `frontend/src/__tests__/SessionDetail.test.tsx`: a thinking output with `content: '[redacted]'` shows "(redacted)" text
- [x] T014 [P3] [P] Add test to `frontend/src/__tests__/SessionDetail.test.tsx`: in focused mode, a thinking entry is rendered in collapsed state (content hidden, expand button visible)
- [x] T015 [P3] [P] Add test to `frontend/src/__tests__/SessionDetail.test.tsx`: clicking the expand toggle on a collapsed thinking entry in focused mode reveals the content

### Implementation tasks

- [x] T016 [P3] Add `thinking` entry to `TYPE_LABELS` in `frontend/src/components/SessionDetail/SessionDetail.tsx` (after line 36): `thinking: { label: 'THINK', light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-900 text-amber-300' }`
- [x] T017 [P3] In `frontend/src/components/SessionDetail/SessionDetail.tsx`, in the render section for `kind: 'single'` items, add a collapsed/expanded state for `thinking` type items in focused mode: show THINK badge and a toggle button; when collapsed, hide content; when expanded, show full text (use local `useState` per item keyed by item id)
- [x] T018 [P3] In the thinking content renderer, display `'(redacted)'` when `item.content === '[redacted]'` and `'(empty)'` when `item.content === ''`; otherwise render as plain preformatted text (not ReactMarkdown, since thinking is not markdown)

---

## Phase 4: Frontend — session card preview (US3, US4, FR-008, FR-009)

**Goal**: Session card preview shows thinking content as primary preview when thinking events exist; tool call count indicator shown when tool_use events exist.

**Independent test**: Vitest unit tests for `SessionCard` preview logic; E2E test validates dashboard card display.

### Test tasks (write first, confirm failing)

- [x] T019 [P4] Add test to `frontend/src/__tests__/SessionCard.test.tsx` (or create if absent): when `items` contains a `thinking` event, `previewContent` shows the thinking text (not the last assistant message)
- [x] T020 [P4] [P] Add test: when `items` has no `thinking` events, preview falls back to the last assistant message (existing behavior unchanged)
- [x] T021 [P4] [P] Add test: when `items` contains `tool_use` events, a tool count indicator is rendered (e.g., "3 tool calls")
- [x] T022 [P4] [P] Add test: when `items` has no `tool_use` events, no tool count indicator is rendered
- [x] T023 [P4] [P] Add test: `content === '[redacted]'` thinking event renders "(redacted)" in the preview

### Implementation tasks

- [x] T024 [P4] In `frontend/src/components/SessionCard/SessionCard.tsx` (lines 65-72), update `previewItem` selection to prefer the first `thinking` item over the last assistant `message`; set `previewContent` to the thinking content (showing "(redacted)" if applicable)
- [x] T025 [P4] Add `toolCallCount` derivation in `SessionCard.tsx`: `const toolCallCount = items.filter(i => i.type === 'tool_use').length`
- [x] T026 [P4] Render the tool call count badge in the `SessionCard` preview area when `toolCallCount > 0`: show a small label like `N tool call(s)` below or alongside the preview text, using the shared `Badge` component

---

## Phase 5: E2E tests (SC-001 to SC-006)

**Goal**: Playwright E2E tests verify the full user flow for both output stream display and session card preview.

- [x] T027 [P5] Create `frontend/tests/e2e/sc-074-thinking-events.spec.ts` with mock API routes for a session that has thinking output events
- [x] T028 [P5] E2E test: output pane in verbose mode shows "THINK" badge for thinking items (SC-002)
- [x] T029 [P5] [P] E2E test: output pane in focused mode shows thinking entry as collapsed; clicking expands it (SC-006)
- [x] T030 [P5] [P] E2E test: output pane shows "(redacted)" placeholder for redacted thinking items
- [x] T031 [P5] [P] E2E test: session card preview shows thinking text when thinking events present (SC-003)
- [x] T032 [P5] [P] E2E test: session card preview shows tool count when tool_use events present
- [x] T033 [P5] [P] E2E test: session card with no thinking or tools is visually unchanged (SC-005 regression check)

---

## Final Phase: Polish and README

**Goal**: All tests pass, build succeeds, README updated.

- [x] T034 Update `README.md` to document thinking block display in the output stream and the session card preview indicators (per §XI)
- [x] T035 Run full backend test suite (`cd backend && npm test`) and confirm all tests pass
- [x] T036 Run frontend build (`cd frontend && npm run build`) and confirm it succeeds
- [x] T037 Run E2E mock tests (`npm run test:e2e`) and confirm all tests pass
