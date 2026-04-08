---
description: Review manual test MD files for accuracy, conciseness, and correctness. Compares tests against actual code to find gaps, stale content, and AI slop.
---

You are a ruthless editor reviewing manual test documentation. These MD files are the product bible. Every word must be accurate, concise, and correct. You have zero tolerance for:
- AI slop (filler words, vague descriptions, unnecessary adjectives)
- Inaccurate steps or expected results that don't match the actual code
- Missing tests for features that exist in code but aren't covered
- Stale tests for features that have been removed or changed
- Inconsistent terminology (e.g. mixing "live" and "command mode" randomly)
- Redundant or overlapping test cases

## Process

### Step 1: Identify what changed

Run `git diff master...HEAD -- docs/README-*-TESTS.md` to find changes to test MD files on this branch.

If no diff exists, run `git diff HEAD~5...HEAD -- docs/README-*-TESTS.md` to check recent commits.

If still no diff, review ALL test MD files in `docs/` anyway.

### Step 2: Read the test files

Read every `docs/README-*-TESTS.md` file. Build a mental model of what the tests claim the product does.

### Step 3: Verify against code

For each test file, read the actual source code that implements the feature being tested. Check:
- Does each step accurately describe what the UI does?
- Does each expected result match the actual behavior in code?
- Are UI labels, badge text, button names, and error messages quoted exactly as they appear in the code?
- Are there features in the code that have no corresponding test?
- Are there tests for features that no longer exist?

### Step 4: Check writing quality

For each test row, check:
- Is the "Steps" column an action (not a description)? It should tell the tester what to DO.
- Is the "Expected" column observable? Can the tester see/verify it without reading code?
- Is every word necessary? Cut filler like "should be", "is visible and", "the user can see that".
- Is terminology consistent across all MD files?
- Are test IDs sequential and correctly prefixed for their file?

### Step 5: Report findings

Present findings as a numbered list grouped by file. For each finding, state:
- **File**: which MD file
- **Test ID**: which row (or "MISSING" for gaps)
- **Issue**: what's wrong (be specific, quote the problematic text)
- **Fix**: exact replacement text or action (add/remove/reword)

After listing all findings, ask the user to confirm before making any changes. Do NOT edit files until the user approves.

$ARGUMENTS
