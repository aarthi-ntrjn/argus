---
description: Validate the current feature branch against the project constitution, fix any gaps, then merge into main and push.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty). Any text supplied is treated as additional merge notes or override context.

## Outline

You are a senior engineer performing a pre-merge constitution gate check and merge for the current feature branch. Follow these steps precisely.

---

### Step 1 — Identify the feature branch and context

Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` from the repo root and parse:
- `FEATURE_DIR` — absolute path to the feature spec folder
- Current branch name (from `git branch --show-current`)

If the current branch is `main` or `master`, stop and tell the user: "You are already on the main branch. Checkout a feature branch first."

Record:
- `FEATURE_BRANCH` = current branch name
- `MAIN_BRANCH` = detect by running `git branch --list main master` — use whichever exists; default to `main`

---

### Step 2 — Load the constitution

Read `.specify/memory/constitution.md`. Extract all principles as a checklist. Pay particular attention to the **§X Definition of Done** — these are the mandatory merge gates:

- Code written and reviewed
- Tests written test-first and passing
- Documentation written
- README.md updated to reflect the change
- Metrics and logs added (where applicable to this feature)
- Security reviewed (where applicable)

---

### Step 3 — Run the constitution compliance check

Perform each check below. Record findings as `PASS`, `FAIL`, or `N/A` with evidence.

#### §X Definition of Done

- **Tests passing**: Run the full test suite in this order. If any step fails, **STOP** at step 4 and fix before continuing.
  - Backend: `cd backend && npm test`
  - Frontend build: `cd frontend && npm run build` (build must succeed)
  - E2E mock tests (Tier 1): `npm run test:e2e` from repo root — runs all mock-based Playwright tests against the Vite dev server on port 7411. The dev server must be running (`npm run dev`).
  - E2E real-server tests (Tier 2): `npm run test:e2e:real` from repo root — requires the real backend running on port 7412 (`npm run dev:real` or equivalent). If the real server is not available, note this as `N/A` and do not block the merge, but report it clearly.

- **README updated**: Check if `README.md` was modified in this branch:
  ```
  git --no-pager diff main..HEAD -- README.md
  ```
  If the diff is empty and the feature added user-facing or architectural changes, mark as **FAIL**.

- **Documentation written**: Confirm that `specs/<feature>/` contains `spec.md`, `plan.md`, and `tasks.md` with tasks marked complete. If any unchecked `[ ]` task items remain, list them.

#### §IV Test-First

- Check that test files exist for new backend/frontend code added in this branch:
  ```
  git --no-pager diff --name-only main..HEAD
  ```
  For each new non-test source file, verify a corresponding test file exists or that tests were added to an existing test file. Mark **FAIL** if new source has zero test coverage.

#### §II Coding Style

Run lint and format across both workspaces:

```
npm run lint:fix --workspace=backend
npm run lint:fix --workspace=frontend
npm run format --workspace=backend
npm run format --workspace=frontend
```

If any files were modified, stage and commit them:

```
git add -A
git commit -m "chore(merge-gate): apply lint and format fixes

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push
```

If `lint:fix` exits with errors that are **not** auto-fixable (i.e., files still show errors after `--fix`), mark as **FAIL** and list the files and rules. Fix them before continuing.

#### §III Code Standards

- Spot-check new/modified TypeScript/JavaScript files from the diff for functions exceeding 50 lines. Flag any with `WARN`.

#### §XI Documentation

- If any user-facing behaviour changed, README.md MUST be updated (covered above).
- Check that internal docstrings/comments explain *why* not *what* in complex functions.

#### §XII Error Handling

- Check that any new frontend error display uses the `message` field only (not raw response body or HTTP status).
- Check that new backend error responses follow `{ error, message, requestId }` structure.

---

### Step 4 — Generate coverage snapshot

After all tests pass in Step 3, run all four coverage passes in sequence:

```
npm run test:coverage
npm run test:coverage:e2e
npm run test:coverage:e2e:real
```

`test:coverage` runs both unit test suites (backend + frontend vitest).
`test:coverage:e2e` builds the frontend with Istanbul instrumentation, runs the mock E2E suite, then merges the per-test coverage files.
`test:coverage:e2e:real` runs the real-server E2E suite with `NODE_V8_COVERAGE` set so the backend process dumps raw V8 coverage on exit, then runs `c8 report` to generate the summary.

After all three succeed, run:

```
node scripts/generate-coverage-report.mjs
```

This reads the four `coverage-summary.json` files and writes `reports/coverage.md` with a summary table plus a per-file breakdown for each suite. Missing files (e.g. when a suite is skipped) produce `N/A` rows automatically.

**Do NOT commit or push `reports/coverage.md` here.** The `coverage.yml` workflow will commit it automatically to `<MAIN_BRANCH>` after the push in Step 7 and will also send the Teams/Slack notification. No manual commit is needed.

---

### Step 5 — Fix all FAIL items

For each **FAIL** finding:

1. Describe what is missing and why it violates the constitution.
2. Implement the fix immediately — do not ask permission for constitution-mandated items.
3. After fixing, re-run the relevant check to confirm it now passes.
4. Commit each fix with the message format:
   ```
   fix(merge-gate): <short description of constitution gap addressed>
   
   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
   ```
   Then push: `git push`

For **WARN** items (style, non-blocking): report them but do not block the merge.

Do not proceed to Step 6 until all **FAIL** items are resolved.

---

### Step 6 — Final pre-merge summary

Output a pre-merge report:

```
## Pre-Merge Constitution Report — <FEATURE_BRANCH>

| Check | Status | Notes |
|-------|--------|-------|
| Coding style (lint + format) | ✅ PASS / ❌ FIXED | N files reformatted / no violations |
| Backend tests | ✅ PASS | All N tests passed |
| Frontend build | ✅ PASS | Build succeeded |
| E2E mock tests (Tier 1) | ✅ PASS | N tests passed |
| E2E real-server tests (Tier 2) | ✅ PASS / N/A | N tests passed / server not available |
| PR created / existed | ✅ Created / ✅ Existed | PR URL: <url> |
| CI gate — PR branch | ✅ PASS | Last run: <sha>, all checks green |
| CI gate — main branch | ✅ PASS / ⚠ N/A | Last run: <sha> / No recent run found |
| README updated | ✅ PASS / ❌ FIXED / N/A | ... |
| Tasks complete | ✅ PASS | All T### tasks marked [X] |
| Test-first coverage | ✅ PASS | ... |
| Error handling | ✅ PASS | ... |
| Functions < 50 lines | ✅ PASS / ⚠ WARN | ... |

**Result: READY TO MERGE** ✅
```

---

### Step 6b — PR and CI gate (pre-merge)

This step ensures a PR exists for the feature branch (creating one if needed), waits for CI to complete on both the PR and on `main`, and blocks the merge if either is failing.

#### Detect the remote

Extract `OWNER` and `REPO` from `git remote get-url origin`:
- `https://github.com/OWNER/REPO.git` or `git@github.com:OWNER/REPO.git`

#### Ensure a PR exists

Run:
```
gh pr list --repo <OWNER>/<REPO> --head <FEATURE_BRANCH> --state open --json number,url,title --limit 1
```

If a PR already exists, record its URL and number. Skip to "Wait for CI on the PR" below.

If no PR exists, create one now. Build the PR body from the commit log:
```
git --no-pager log <MAIN_BRANCH>..HEAD --pretty=format:"- %s" --no-merges
```

Then create the PR:
```
gh pr create \
  --repo <OWNER>/<REPO> \
  --title "<one-line summary: use the branch name or the most recent commit subject>" \
  --body "$(cat <<'PRBODY'
## Summary
<bullet points from the commit log above>

## CI gate
Created automatically by /merge to trigger CI before merging.
PRBODY
)" \
  --base <MAIN_BRANCH> \
  --head <FEATURE_BRANCH>
```

Output the PR URL. Record the PR number from the command output.

#### Wait for CI on the PR

After the PR is open, CI should trigger within ~30 seconds. Poll every 15 seconds (up to 3 minutes) until a workflow run appears for this branch:
```
gh run list --repo <OWNER>/<REPO> --branch <FEATURE_BRANCH> --workflow ci.yml --limit 1 --json databaseId,status,conclusion,headSha,url
```

If no run appears after 3 minutes, **STOP**: "CI did not start on the PR after 3 minutes. Check GitHub Actions configuration. PR URL: `<url>`"

Once a run appears, record its `databaseId` as `PR_RUN_ID`. Then poll every 30 seconds (up to 15 minutes) until `status === "completed"`:
```
gh run view <PR_RUN_ID> --repo <OWNER>/<REPO> --json status,conclusion,url
```

If still running after 15 minutes, **STOP**: "CI is still running after 15 minutes. Check manually: `<url>`. Re-run `/merge` once CI completes."

Evaluate the final result:

| conclusion | Action |
|-----------|--------|
| `success` | ✅ PR CI is green — proceed |
| `failure` or `cancelled` | ❌ **STOP** — "CI failed on the PR. Fix the failures and re-run `/merge`. Run URL: `<url>`". Fetch and print the last 50 lines of failed job logs with `gh run view <PR_RUN_ID> --repo <OWNER>/<REPO> --log-failed`. |

#### Check CI on main

Also verify main is currently green before merging on top of it:
```
gh run list --repo <OWNER>/<REPO> --branch <MAIN_BRANCH> --workflow ci.yml --limit 1 --json status,conclusion,headSha,url
```

| status | conclusion | Action |
|--------|-----------|--------|
| `completed` | `success` | ✅ Main is green — proceed |
| `completed` | `failure` or `cancelled` | ❌ **STOP** — "CI is failing on `<MAIN_BRANCH>`. Fix the failure before merging. Run URL: `<url>`" |
| `in_progress` or `queued` | (any) | ❌ **STOP** — "CI is in progress on `<MAIN_BRANCH>`. Wait for it to finish, then re-run `/merge`. Run URL: `<url>`" |
| (no runs returned) | | ⚠️ No recent CI run found on `<MAIN_BRANCH>` — allow but note in the Step 8 report. |

Only continue to Step 7 if both the PR CI and the main CI are green (or main has no recent run).

---

### Step 7 — Merge into main

Before merging, generate a clear PR/merge description by running:
```
git --no-pager log <MAIN_BRANCH>..HEAD --pretty=format:"- %s" --no-merges
```
Use this commit list to write a human-readable summary of all changes coming in. Group related commits into bullet points where possible. This summary goes into the merge commit message body.

Execute the merge:

```
git checkout <MAIN_BRANCH>
git pull origin <MAIN_BRANCH>
git merge --no-ff <FEATURE_BRANCH> -m "merge(<FEATURE_BRANCH>): <one-line feature summary>

<Human-readable summary of all changes in this feature. List the key
changes grouped by area (backend, frontend, infra, docs, etc.). This
must accurately reflect everything coming in — not just the branch name.>

Constitution gate: PASSED
Branch: <FEATURE_BRANCH>

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

If the merge has conflicts, stop and report: list the conflicting files and ask the user to resolve them manually, then re-run `/merge`.

After a clean merge, push to `<MAIN_BRANCH>`:

```
git push origin <MAIN_BRANCH>
```

The `coverage.yml` workflow will trigger automatically on this push, re-run unit coverage, commit the updated `reports/coverage.md` to `<MAIN_BRANCH>`, and send Teams/Slack notifications. No manual coverage commit is needed here.

**Do NOT delete the feature branch yet** — that happens in Step 9 after CI passes.

---

### Step 8 — Report

Output a final merge summary:

- **Branch merged**: `<FEATURE_BRANCH>` → `<MAIN_BRANCH>`
- **Branch deletion**: pending CI result (see Step 9)
- **Constitution gaps fixed**: list any items that were fixed (or "None")
- **Warnings**: list any WARN items for follow-up
- **Tests**: pass count

---

### Step 9 — Monitor CI workflow

After pushing to the main branch, find the triggered GitHub Actions workflow run and monitor it to completion. Note that **two workflows** will trigger on this push: `ci.yml` (tests/lint) and `coverage.yml` (coverage + Teams/Slack notification). Monitor `ci.yml` as the primary gate for branch deletion; `coverage.yml` runs independently and its notification delivery does not block the merge outcome.

#### 8a — Detect the remote

Run `git remote -v` and extract the owner and repo name from the remote URL. For example:
- `https://github.com/acme/myrepo.git` → owner=`acme`, repo=`myrepo`
- `git@github.com:acme/myrepo.git` → owner=`acme`, repo=`myrepo`

#### 8b — Wait briefly and fetch the workflow run

Wait ~5 seconds for GitHub to register the push, then use the `github-mcp-server-actions_list` tool:
```
method: list_workflow_runs
owner: <owner>
repo: <repo>
workflow_runs_filter: { branch: "<MAIN_BRANCH>" }
per_page: 5
```

Find the most recent run whose `head_sha` matches the local merge commit SHA (from `git rev-parse HEAD`). If no exact match, use the most recent run by timestamp.

#### 8c — Output the link

Immediately output the workflow run URL in this format:
```
🔗 CI Workflow: https://github.com/<owner>/<repo>/actions/runs/<run_id>
```

#### 8d — Monitor to completion

Poll every 30 seconds using `github-mcp-server-actions_get`:
```
method: get_workflow_run
owner: <owner>
repo: <repo>
resource_id: <run_id>
```

Continue polling until `status === "completed"`. Then report:

- If `conclusion === "success"`:
  ```
  ✅ CI passed — all checks green.
  ```
  Then delete the feature branch locally and remotely:
  ```
  git branch -d <FEATURE_BRANCH>
  git push origin --delete <FEATURE_BRANCH>
  ```
  Output: `🗑️ Branch <FEATURE_BRANCH> deleted (local + remote).`

- If `conclusion === "failure"` or `conclusion === "cancelled"`:
  ```
  ❌ CI <conclusion> — fetching failed job logs...
  ```
  Use `github-mcp-server-get_job_logs` with `run_id` and `failed_only: true` to retrieve the failed job logs, then print the last 50 lines of each failed job to help diagnose the failure.
  **Do NOT delete the feature branch** — leave it so the user can investigate and fix.
  Output: `⚠️ Branch <FEATURE_BRANCH> NOT deleted — CI failed. Fix the failure and re-run /merge.`

If the workflow is still `in_progress` after 10 minutes of polling, stop and output:
```
⏳ CI still running after 10 minutes. Check manually: <url>
Branch <FEATURE_BRANCH> NOT deleted — delete it manually once CI passes.
```
