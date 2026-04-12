---
description: Scan Claude Code session histories for user-specified behavioral patterns such as cyclic reasoning, user corrections, decision reversals, and repeated failures.
---

## User Input

```text
$ARGUMENTS
```

### Argument format

```
/retrospective [path1 path2 ...] -- pattern description
```

- **Paths** (optional, before `--`): one or more repository paths or glob patterns, space-separated. Paths may use `*` as a wildcard suffix (e.g., `c:\source\github\artynuts\argus*` matches argus, argus2, argus3). Both Windows-style backslashes and forward slashes are accepted.
- **`--` separator**: required when paths are provided; separates paths from the pattern.
- **Pattern** (required, after `--` or the entire argument when no paths given): the behavioral pattern to search for.

Examples:

```
/retrospective c:\source\github\artynuts\argus -- find AI cycles
/retrospective c:\source\github\artynuts\argus* -- user corrections
/retrospective c:\source\github\artynuts\argus c:\source\github\foo\bar -- decision reversals
/retrospective find AI cycles
```

You **MUST** have a pattern. Do not proceed if the pattern is empty — ask the user to describe what to search for.

If no paths are provided, default to the `cwd` of the current session (the project you are currently running in).

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

## Step 1: Parse Arguments and Clarify the Pattern

Split `$ARGUMENTS` on ` -- ` (space-dash-dash-space):

- If a ` -- ` separator is present: everything before it is the path list, everything after is the pattern.
- If no separator: the entire argument is the pattern; use the current project directory as the scope.

From the path list, extract individual paths by splitting on whitespace. Each path may end with `*` as a glob wildcard.

Then determine:

1. Which built-in pattern category applies, or what custom signals to look for
2. Whether the user wants a summary count or detailed excerpts per match

If the pattern is ambiguous, make a reasonable assumption and state it before proceeding.

---

## Step 2: Discover JSONL Files

### Convert repository paths to Claude directory names

Claude Code stores per-project session files under `~/.claude/projects/`. The subdirectory name for a project is derived from its absolute path by replacing every `:` and `\` (or `/`) with `-`.

Examples:
- `C:\source\github\artynuts\argus` becomes `C--source-github-artynuts-argus`
- `C:\source\github\artynuts\argus2` becomes `C--source-github-artynuts-argus2`
- `/home/user/projects/myapp` becomes `-home-user-projects-myapp`

**Conversion algorithm** for each input path (apply before glob expansion):

1. Replace `:` with `-`
2. Replace `\` and `/` with `-`
3. If a trailing `*` wildcard was present, keep it at the end
4. The result is the directory name pattern to match under `~/.claude/projects/`

For example, `c:\source\github\artynuts\argus*` converts to `c--source-github-artynuts-argus*`.

### List matching project directories

After converting each path, list which project directories under `~/.claude/projects/` match. Run one command per converted pattern (matching is case-insensitive on Windows):

```bash
# For a pattern like c--source-github-artynuts-argus*
ls ~/.claude/projects/ | grep -i "^c--source-github-artynuts-argus"
```

Or list all and let you filter:

```bash
ls ~/.claude/projects/
```

Collect the full set of matching project directories. If none match, report the mismatch clearly: show the input paths, the converted patterns, and the actual directory names found.

### Collect JSONL files from matched directories

For each matched project directory, find all session JSONL files:

```bash
find ~/.claude/projects/C--source-github-artynuts-argus -name "*.jsonl" -type f 2>/dev/null
```

Repeat for each matched directory. Deduplicate if the same file appears from multiple patterns.

### Note on the global history file

`~/.claude/history.jsonl` contains only prompt text and timestamps, not full conversations. Do not use it for pattern analysis.

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
Scope: [input path patterns] -> [matched project directories]
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
