# Research: Bash Command Approval Surfacing

**Branch**: `072-bash-approval-surface` | **Feature**: Surface PreToolUse approval prompts in session card

## Decisions

### D-001: Wildcard Hook Matcher for Claude Code

**Decision**: Add a second `PreToolUse` entry in `claude-code-hooks-injector.ts` with an empty matcher string (`''`), in addition to the existing `AskUserQuestion`-only entry.

**Rationale**: Claude Code's settings.json hook structure uses a `matcher` field that filters which tool names trigger the hook. An empty string matches all tool names. The existing `AskUserQuestion` entry already works correctly; adding a second wildcard entry means Argus receives all PreToolUse events without changing the ask_user code path.

**Alternatives Considered**:
- *Replace existing entry with wildcard only* — rejected because the ask_user path has a specific handler; having a separate explicit entry is clearer and easier to reason about.
- *Use a regex matcher* — rejected; Claude Code settings support string matchers, not regex; empty string is the documented wildcard.

**File**: `backend/src/services/claude-code-hooks-injector.ts`

---

### D-002: Copilot CLI Hooks Injector — No Change Required

**Decision**: No changes to `copilot-cli-hooks-injector.ts`.

**Rationale**: Copilot CLI's `hooks.json` already registers `preToolUse` with no matcher field, meaning all PreToolUse events are already forwarded to Argus. The issue is exclusively on the receiving/processing side in `base-cli-detector.ts`.

**File**: `backend/src/services/copilot-cli-hooks-injector.ts` (no changes)

---

### D-003: Handling Non-Ask-User PreToolUse in `base-cli-detector.ts`

**Decision**: In `handleHookPayload`, after the existing ask_user guard, add a new branch for `PreToolUse` where `tool_name !== this.askUserToolName`. Delegate to a new protected method `handlePreToolApproval(sessionId, existing, payload, now)`.

**Rationale**: The existing handler already has clear routing by tool_name. A new method mirrors the pattern of `handlePreAskQuestion`/`handlePostAskQuestion` and keeps the base class cohesive. No subclass changes needed.

**Question Format**: `"<toolName>: <primaryInput>"` where `primaryInput` is the first string value in `tool_input` (for Bash: `tool_input.command`). Extracted via a new `buildToolApprovalChoice` function in `pending-choice-utils.ts`.

**File**: `backend/src/services/base-cli-detector.ts`

---

### D-004: PostToolUse Resolution for Non-Ask-User Tools

**Decision**: In `handleHookPayload`, add a parallel branch for `PostToolUse` where `tool_name !== this.askUserToolName`, delegating to a new protected method `handlePostToolApproval`. It clears `pendingChoices` and broadcasts `session.pending_choice.resolved`.

**Rationale**: This mirrors exactly how `handlePostAskQuestion` works for ask_user tools. The resolution event is the same WS type — frontend `PendingChoicePanel` already dismisses on `session.pending_choice.resolved` regardless of how the choice was created.

**File**: `backend/src/services/base-cli-detector.ts`

---

### D-005: Question Text Format for Tool Approval

**Decision**: Format tool approval questions as: `"<toolName>: <primaryInputValue>"`. If `tool_input` is empty or has no string values, fall back to `"<toolName>"` alone.

**Rationale**: The primary input for the most common tools is:
- `Bash`/`computer` tools: `tool_input.command`
- `Edit`/`Write`: `tool_input.file_path` or `tool_input.path`
- Others: first string value found in `tool_input`

The existing `PendingChoicePanel` renders this as the question text. Using the tool name as prefix makes it immediately clear what is being approved.

**Choices**: Fixed to `["Yes, run it", "No, skip it"]` (same numbered-choice mechanism; PTY receives "1" or "2").

**File**: `backend/src/services/pending-choice-utils.ts` — new `buildToolApprovalChoice(toolName, toolInput)` function

---

### D-006: Frontend — No Changes Required

**Decision**: No changes to any frontend components or WS event types.

**Rationale**: The `session.pending_choice` WS event shape, `PendingChoicePanel`, and the numbered response mechanism are all generic — they work for any `question` + `choices[]` pair. The existing panel already renders, dismisses, and sends responses correctly.

**Files**: No frontend changes.
