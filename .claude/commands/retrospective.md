---
description: Scan Claude Code session histories for user-specified behavioral patterns such as cyclic reasoning, user corrections, decision reversals, and repeated failures.
---

## User Input

```text
$ARGUMENTS
```

The text after `/retrospective` is the pattern or analysis query. You **MUST** use it. Do not proceed if it is empty — ask the user to describe the pattern they want to search for.

## What This Skill Does

You are a conversation quality analyst. Your job is to scan Claude Code session JSONL files, reconstruct conversation threads, and surface instances of the pattern the user described.

Supported built-in pattern categories (infer from the user's description):

| Pattern | What to look for |
|---|---|
| **cycles** | Identical or near-identical tool calls within the same session, repeated error messages, phrases like "let me try again" or "I'll take a different approach" appearing 2+ times |
| **user corrections** | User messages containing corrective language: "no,", "not that", "I said", "actually", "that's wrong", "don't", "stop", "you missed", "wait", "not what I asked", "please don't", "wrong direction" |
| **decision reversals** | Assistant abandoning a stated plan: "actually, let me", "on second thought", "I was wrong", reverting a file change made earlier in the same session |
| **failed tool loops** | Same tool (e.g., Edit, Bash) called 3+ times on the same file/command with the same or similar input within a short span |
| **escalation to user** | Assistant asking clarification questions after already receiving a clear instruction, or asking the same question twice |
| **custom** | Any pattern the user describes in plain language — reason about what signals would indicate it |

---

## Step 1: Clarify the Pattern

Read `$ARGUMENTS` and determine:

1. Which built-in category applies, or describe what custom signals to look for
2. Whether the user wants to scope to: a specific project path, a date range, or all sessions
3. Whether the user wants a summary count or detailed excerpts per match

If `$ARGUMENTS` is ambiguous, make a reasonable assumption and state it before proceeding.

---

## Step 2: Discover JSONL Files

### Claude Code sessions

Run the following to list all session JSONL files across all projects:

```bash
find ~/.claude/projects -name "*.jsonl" -type f 2>/dev/null | sort
```

If the user scoped to a specific project, filter to that project's subdirectory. The directory name is the project path with path separators replaced by `-` (e.g., `C--source-github-artynuts-argus`).

Also check the global history file:

```bash
ls -la ~/.claude/history.jsonl 2>/dev/null
```

Note: the global history file contains only prompt text and metadata, not full conversations. Focus on the per-session JSONL files for deep analysis.

### GitHub Copilot sessions

Copilot conversations in VS Code are stored in SQLite databases under `%APPDATA%\Code\User\workspaceStorage\`. These are not directly readable as text. If the user asks for Copilot analysis, report that Copilot sessions require SQLite tooling and suggest they export conversations manually, or note this limitation clearly.

---

## Step 3: Parse Each Session

For each JSONL file found, read it and reconstruct the conversation thread.

Each line is a JSON object. The relevant types are:

```
type: "user"      -> message.content is the human turn (string or array)
type: "assistant" -> message.content is an array of content blocks
                     - {type: "text", text: "..."}          assistant prose
                     - {type: "tool_use", name: "...", input: {...}}  tool call
                     - {type: "thinking", thinking: "..."}   internal reasoning
type: "attachment" -> hook output, ignore for pattern analysis
```

Build an ordered list of turns per session:

```
[timestamp] [role] [content summary]
```

For tool calls, record: `tool_name(key_argument_or_path)`.

---

## Step 4: Apply Pattern Detection

Scan the reconstructed turn sequence for the target pattern. Use these heuristics:

### Cycle Detection

A cycle is present if within a session:
- The same tool name with the same or near-identical primary argument appears 3 or more times within a 10-turn window
- The assistant text contains "let me try", "try again", "different approach", "I apologize", "let me reconsider" two or more times
- A Bash command that previously produced an error is re-run unchanged

### User Correction Detection

A correction is present if a user turn:
- Starts with or contains any of: "no,", "no.", "actually,", "wait,", "that's not", "I said", "not that", "don't", "stop doing", "you missed", "wrong", "incorrect", "that is wrong", "please don't", "not what I asked"
- Follows an assistant turn that made a concrete decision or code change (not just a clarifying question)
- Overrides a tool action the assistant just took (e.g., "revert that", "undo that change")

### Decision Reversal Detection

A reversal is present if the assistant:
- Writes or edits a file, then later reverts or rewrites the same file with contradictory content
- States a plan explicitly ("I will...") then within 5 turns abandons it with "actually" or "on second thought"

### Custom Pattern

Reason about the user's description. Identify 3-5 textual or structural signals that would indicate the pattern, state them, then scan for them.

---

## Step 5: Collect Findings

For each match found, record:

```
Session: [file path]
Timestamp: [ISO timestamp of the triggering turn]
Project: [cwd from the JSONL if available]
Pattern: [which pattern matched]
Context:
  [3-5 turns of conversation surrounding the match, with roles and abbreviated content]
Confidence: HIGH | MEDIUM | LOW
```

Group findings by session. If a session has no matches, omit it from the output.

---

## Step 6: Report

Present a structured report:

```
# Retrospective: [pattern description]
Scope: [files scanned, date range if applicable]
Sessions scanned: N
Sessions with matches: M

## Summary

[2-3 sentence description of what was found overall]

## Findings

### [Session file name] — [project name]
[For each match in this session: timestamp, pattern, 3-5 line context excerpt]

...

## Observations

[Patterns across sessions: e.g., "Corrections most common when file editing was involved",
"Cycles tend to occur on Bash commands, not file reads", etc.]
```

If no matches are found, state that clearly and suggest alternative patterns the user might try.

---

## Constraints

- Do not modify any files during this analysis. This skill is read-only.
- If a JSONL file is too large to read in full, read the first 500 lines and the last 200 lines, then note that the middle was skipped.
- Truncate conversation excerpts to 3 lines per turn in the report to keep output concise.
- Do not include content from `type: "thinking"` blocks in the report (those are internal reasoning, not visible behavior).
