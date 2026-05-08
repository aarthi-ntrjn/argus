# Tool Approval Surface

This document describes how Argus intercepts, classifies, surfaces, and handles tool
approval prompts from Claude Code and Copilot CLI sessions. It covers both yolo mode and
the full non-yolo approval pipeline, including tier-aware choices and auto-approval suppression.

---

## Background: Why Argus needs to intercept approvals

Claude Code and Copilot CLI both pause execution when a tool needs user approval and wait
for input on stdin (the PTY). Without Argus, the user must be present at the terminal to
respond. Argus intercepts the approval event via HTTP hooks before the terminal prompt is
shown, mirrors the choices in its UI, and injects the selected response back into the PTY.

---

## Hook injection

Argus registers hooks with both AI tools at startup, using their native hook mechanisms.
The hooks fire HTTP POST requests to the Argus server on every tool lifecycle event.

### Claude Code

Claude Code reads hooks from `~/.claude/settings.json` (global, not per-repo). Argus
injects six entries via `ClaudeCodeHooksInjector.injectForAll()` on startup:

| Event | Matcher | Purpose |
|---|---|---|
| `SessionStart` | (all) | Detect session creation |
| `SessionEnd` | (all) | Detect session termination |
| `PreToolUse` | `AskUserQuestion` | Intercept ask_user prompts |
| `PostToolUse` | `AskUserQuestion` | Resolve ask_user prompts |
| `PreToolUse` | (all) | Intercept every tool approval |
| `PostToolUse` | (all) | Resolve every tool approval |

Hook command (fire-and-forget, stdin carries JSON payload):

```bash
curl -sf -X POST http://127.0.0.1:{port}/hooks/claude \
  -H "Content-Type: application/json" -d @- 2>/dev/null || true
```

The blank matcher on `PreToolUse`/`PostToolUse` catches every tool call, including
auto-approved ones. This is intentional: Argus needs the PostToolUse signal to know
when an auto-approved tool has resolved so it can cancel the pending broadcast timer.

### Copilot CLI

Copilot CLI reads hooks from a per-repo file at `.github/hooks/hooks.json`. Argus
injects via `CopilotHooksInjector.injectForRepo()` for every registered repository.
Four events are used: `sessionStart`, `sessionEnd`, `preToolUse`, `postToolUse` (no
per-tool matcher — Copilot fires a single preToolUse for all tools).

Hook commands include both bash and PowerShell variants for cross-platform support:

```bash
curl -sf -X POST 'http://127.0.0.1:{port}/hooks/copilot?event=preToolUse' \
  -H "Content-Type: application/json" -d @- 2>/dev/null || true
```

Stale Argus entries (from any previous port) are stripped before re-injection on every
server restart, so the files stay clean across port changes.

---

## Yolo mode

When a session is running in yolo mode (`session.yoloMode = true`), the AI tool has been
started with `--yolo` / `--allow-all` (Copilot) or `bypassPermissions` / `--dangerously-skip-permissions`
(Claude Code). In this mode:

- The AI tool auto-approves every tool call without showing an interactive prompt.
- `PreToolUse` hooks still fire, but `handlePreToolApproval` returns immediately on
  `existing.yoloMode === true` — no pending choice is stored, no timer is started, no
  UI event is broadcast.
- `ask_user` prompts are unaffected by yolo mode: they always surface because they
  represent questions the agent has for the user, not permission gates.

Argus detects yolo mode by inspecting the process command line of the session's PID
during the scan cycle (`detectYoloModeFromPids` in `process-utils.ts`).

---

## Non-yolo mode: the full pipeline

### Step 1 — PreToolUse hook fires

When Claude Code or Copilot is about to execute a tool, it fires `PreToolUse` with a
JSON payload containing `tool_name` and `tool_input`. The hook reaches
`BaseCliDetector.handlePreToolApproval()`.

### Step 2 — Build the pending choice

`buildToolApprovalChoice(toolName, toolInput)` constructs the choices to display:

- The question label is `"<ToolName>: <primaryInput>"` where `primaryInput` is the
  first non-empty string found in `tool_input`, checked in priority order:
  `command` → `file_path` → `path` → first string value.
- The choice list is tier-aware (see Tier model below).

The result is stored in `pendingChoices.set(sessionId, { type: 'tool_approval', ... })`.

### Step 3 — 500ms debounce timer

Instead of broadcasting `session.pending_choice` immediately, Argus starts a 500ms
timer. This is the auto-approval suppression gate:

- Tools with an existing allow rule are auto-approved by the AI tool. Claude Code and
  Copilot both process the allow rule and fire `PostToolUse` within milliseconds.
- If `PostToolUse` arrives before the timer fires, `handlePostToolApproval` cancels the
  timer, deletes the pending choice, and returns without broadcasting. The UI never sees
  the event: no flicker, no approval card shown.
- If the timer fires without a `PostToolUse`, the tool is genuinely waiting for user
  input. The broadcast fires and the approval card appears in the Argus UI.

```
PreToolUse
  │
  ├─ store pendingChoice
  └─ start 300ms timer
        │
        ├── PostToolUse arrives within 300ms?
        │     → cancel timer, delete choice, broadcast nothing (auto-approved)
        │
        └── 300ms elapses with no PostToolUse?
              → broadcast session.pending_choice (user action required)
```

### Step 4 — UI renders the approval card

The frontend receives `session.pending_choice` via WebSocket and stores it in the
React Query cache under `['session-pending-choice', sessionId]`. `SessionCard` renders
`PendingChoicePanel` in place of the session summary.

The panel shows:
- The question (tool name + primary input value)
- Tier-appropriate choice buttons (see Tier model)
- A "Type an answer" button (for ask_user flows only — irrelevant for tool approvals)
- An Esc interrupt button

### Step 5 — User responds

**Clicking a choice button** in `PendingChoicePanel`:
- Calls `sendPrompt(session.id, "1")` (or "2", "3")
- POST to `/api/sessions/:id/send` with `{ prompt: "1" }`
- `skipEnter` is `false` for `tool_approval` type (only `true` for `ask_user`)
- The PTY launcher writes `"1\r"` into the session's stdin
- Claude Code / Copilot processes the selection

**Typing a number in `SessionPromptBar`** and pressing Enter:
- Calls `sendPrompt(session.id, "1")`
- Same path as clicking a button
- `implicitChoiceNumber` is NOT wired for `tool_approval` pending choices, so the prompt
  bar sends the text directly without the two-step ask_user wrapper

### Step 6 — PostToolUse resolves the choice

After the user selects and the AI tool processes the decision, `PostToolUse` fires.
`handlePostToolApproval` broadcasts `session.pending_choice.resolved`, which clears the
approval card from the UI.

---

## Tier model

The choices shown depend on which tool is requesting approval. The tier controls how
long a "don't ask again" approval persists.

### Claude Code

| Tier | Tools | Choices | Persistence |
|---|---|---|---|
| Bash tier | `Bash`, `computer` | Yes / Yes, don't ask again for this project / No | Permanent per project directory |
| Edit tier | `Edit`, `Write`, `MultiEdit`, `NotebookEditCell`, `str_replace_editor`, `str_replace_based_edit_tool` | Yes / Yes, don't ask again for this session / No | Session-scoped only |
| Unknown | Any other tool | Yes / Yes, don't ask again for this session / No | Session-scoped (safe default) |

Bash-tier tools map to Claude Code's built-in "permanent per project" approval
semantics. Edit-tier tools map to its "session" approval semantics. Unknown tools
default to the session tier.

Claude Code's built-in read-only set (`ls`, `cat`, `grep`, `find`, `head`, `tail`,
`wc`, `diff`, `stat`, `du`, `cd`, read-only git forms) is handled by Claude Code itself
before the hook fires. These never reach `handlePreToolApproval` as a blocking prompt,
though the blank-matcher hooks do still fire and are resolved immediately by PostToolUse.

### Copilot CLI

Copilot CLI collapses tools into kinds rather than named tools. The approval prompt
always offers three choices with session-or-once granularity (no in-prompt permanent
option — permanent rules require `--allow-tool` CLI flags):

| Tier | Tools | Choices |
|---|---|---|
| Copilot tier | `run_shell_command`, `bash`, `shell`, `edit` | Yes, allow once / Yes, allow for this session / No, reject |

---

## ask_user vs tool_approval: the type discriminator

Both approval flows use the same `PendingChoice` model and the same `session.pending_choice`
WebSocket event. A `type` field distinguishes them:

```typescript
interface PendingChoice {
  type: 'ask_user' | 'tool_approval';
  question: string;
  choices: string[];
  allQuestions?: PendingChoiceItem[];
}
```

The distinction matters in two places:

1. **`skipEnter` in `/api/sessions/:id/send`**: for `ask_user`, the user may type an
   additional freeform answer after selecting an option, so the choice number is sent
   without Enter (it stays in the PTY buffer until the full answer is submitted via
   `sendChoiceWithPrompt`). For `tool_approval`, the number is the complete response,
   so Enter is appended immediately.

2. **`implicitChoiceNumber` in `SessionCard`**: for `ask_user`, the "Type an answer"
   option's number is pre-wired into `SessionPromptBar` so the bar can submit both the
   choice and the typed text together. For `tool_approval`, the prompt bar sends text
   directly with no choice prefix.

### ask_user flow

Claude Code's `AskUserQuestion` tool fires two dedicated hook events with their own
matcher (`PreToolUse / AskUserQuestion`, `PostToolUse / AskUserQuestion`). There is no
debounce timer — the broadcast is immediate because there is no auto-approval for user
questions. The choices are parsed from the tool payload via `parsePendingChoicePayload`.

Copilot CLI uses the same `preToolUse` / `postToolUse` hook events for ask_user as for
tool approvals, distinguished by the presence of a `question` / `choices` payload
structure versus a `tool_name` structure.

---

## PTY send path

All user responses travel through the same PTY send path:

```
Frontend sendPrompt(sessionId, "1")
  → POST /api/sessions/:id/send  { prompt: "1" }
  → skipEnter = pendingChoice?.type === 'ask_user'
  → SessionController.sendPrompt(id, "1", skipEnter=false)
  → ptyRegistry.send(id, "1\r")     ← "\r" always appended for tool_approval
  → PTY stdin buffer
  → Claude Code / Copilot processes selection
```

For ask_user with a freeform answer, the two-step path is used:

```
Frontend sendChoiceWithPrompt(sessionId, choiceNumber, answerText)
  → POST /api/sessions/:id/send-with-choice
  → launcher.sendChoiceWithAnswer(choiceNumber, answerText)
  → writes choiceNumber + "\r"
  → writes answerText + "\r"
```

---

## Cleanup on session end

When a session ends, `handleSessionEnd` cancels all pending approval broadcast timers
for that session and removes its entry from `pendingChoices`. This prevents memory leaks
and stale approval cards from appearing after a session terminates mid-tool.
