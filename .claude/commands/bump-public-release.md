---
description: Full release pipeline — bump version, push to public, and publish to npm — in one command.
---

## Invocation rules

**ONLY execute this skill when the user explicitly types `/bump-public-release` as a standalone command.**
Do NOT execute it in response to any paraphrase or implied intent. The user must type the exact slash command `/bump-public-release`.

If this skill was not triggered by the exact command `/release`, stop immediately without taking any action.

---

## User Input

```text
$ARGUMENTS
```

Optional. If a bump type is provided (e.g. `/release patch`, `/release minor`, `/release major`), pass it to Phase 1. Otherwise ask the user during Phase 1.

---

## Outline

You are running the full release pipeline for this project. Execute the three phases below in order. Do not skip any phase. Report progress clearly at the start of each phase.

---

## Phase 1 — Bump version (`/bump-version`)

Execute every step from the `/bump-version` skill inline:

### Step 0 — Verify we are on master

```bash
git branch --show-current
git status --porcelain
```

If not on `master`, stop: "This skill must be run from `master`."
If there are uncommitted changes (other than `package.json`), stop and tell the user to commit or stash them first.

### Step 1 — Determine the bump type

If `$ARGUMENTS` contains a valid bump type (`patch`, `minor`, `major`) or a version string, use it directly.

Otherwise ask:
```
Which version bump?
  1. patch  (bug fixes — x.y.Z)
  2. minor  (new features — x.Y.0)
  3. major  (breaking changes — X.0.0)
  4. custom (enter a specific version)
```

Wait for the user's choice before proceeding.

### Step 2 — Bump package.json

```bash
npm version <patch|minor|major|custom-version> --no-git-tag-version
node -e "console.log(require('./package.json').version)"
```

Check the tag does not already exist:
```bash
git tag -l v<version>
git ls-remote origin "refs/tags/v<version>"
```

If the tag already exists, stop: "Tag v<version> already exists. The version has already been released."

### Step 3 — Commit the version bump

```bash
git add package.json package-lock.json
git commit -m "chore: bump version to v<version>

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Step 4 — Update the changelog

Execute every step from the `/update-changelog` skill inline:

1. Read the new version from `package.json`.
2. Find the previous tag: `git describe --tags --abbrev=0`
3. Collect commits since last tag: `git --no-pager log <previous-tag>..HEAD --pretty=format:"%h %s" --no-merges`
4. Categorize and write the changelog entry following the rules in `/update-changelog` (feat→Added, fix→Fixed, perf/refactor→Changed, omit ci/chore/test/style/build).
5. Prepend the new section to `CHANGELOG.md` immediately after the preamble.
6. Commit:
```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for v<version>

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

If changelog generation fails for any reason, stop and report the error. Do not proceed to tagging.

### Step 5 — Push master to origin

```bash
git push origin master
```

### Step 6 — Create and push the annotated tag

```bash
git tag -a v<version> -m "Release v<version>"
git push origin v<version>
```

### Phase 1 checkpoint — report

```
## Phase 1 complete — version bumped to v<version>

- package.json updated
- CHANGELOG updated
- Tag v<version> created and pushed to origin

Starting Phase 2: push to public...
```

---

## Phase 2 — Push to public (`/push-to-public`)

Execute every step from the `/push-to-public` skill inline:

### Step 1 — Collect changes since last public sync

```bash
git fetch public
git --no-pager log public/master..HEAD --pretty=format:"%h %s" --no-merges
git --no-pager diff public/master..HEAD --stat
```

If there are no new commits, note it and skip to Phase 3.

### Step 2 — Generate PR title and description

Using the commit list and diff stat, write:

- **Title**: A single concise sentence (under 72 characters) summarising the release. Do not use generic phrases like "Sync from private". Include the version number.
- **Body**: A structured markdown description with:
  - A short paragraph (2-4 sentences) summarising what this release brings.
  - A `## Changes` section with bullet points grouped by area (Backend, Frontend, CI, Docs). Each bullet should be human-readable, not a raw commit subject.
  - A `## Commits` section with the raw commit log as a code block.
- Do NOT use em dashes.

### Step 3 — Run the publish script

```bash
node scripts/publish.mjs --title "<generated title>" --body "<generated body>"
```

Stream the output so the user can follow CI poll progress.

### Phase 2 checkpoint — report

```
## Phase 2 complete — pushed to public

- PR title: <title>
- Public repo: <url>
- CI: ✅ passed
- Merged: ✅

Starting Phase 3: publish to npm...
```

If the script fails, stop and report the error clearly. Do not proceed to Phase 3.

---

## Phase 3 — Publish to npm (`/npm-release`)

Execute every step from the `/npm-release` skill inline:

### Step 1 — Verify the tag exists on origin

```bash
git ls-remote origin "refs/tags/v<version>"
```

If not found, stop: "Tag v<version> is not on origin. Something went wrong in Phase 1."

### Step 2 — Run the publish-npm script

```bash
node scripts/publish-npm.mjs
```

If the script fails, stop and report the error with the fix needed.

### Step 3 — Locate the triggered workflow run

Wait ~5 seconds then:
```bash
gh run list --repo aarthi-ntrjn/argus --workflow=publish-npm.yml --limit=5 --json databaseId,status,conclusion,headBranch,createdAt
```

Find the run whose `headBranch` matches the tag. Note its `databaseId`.

If no run appears after two attempts (10 seconds apart), report: "The workflow did not appear. Check https://github.com/aarthi-ntrjn/argus/actions manually."

### Step 4 — Poll until complete

Poll every 15 seconds:
```bash
gh run view <databaseId> --repo aarthi-ntrjn/argus --json status,conclusion,jobs
```

Print a one-line status update each poll. Stop when `status` is `completed`.

---

## Final report

**On success:**

```
## Release complete

- Version: v<version>
- Tag pushed to origin and public
- Public repo synced: ✅
- npm published: ✅
- npm package: https://www.npmjs.com/package/argus-ai-hub
- Workflow: https://github.com/aarthi-ntrjn/argus/actions/runs/<databaseId>
```

**On failure at any phase:**

Report which phase failed, the exact error, and what the user needs to fix before re-running. Note any steps that already completed so the user knows where to resume.
