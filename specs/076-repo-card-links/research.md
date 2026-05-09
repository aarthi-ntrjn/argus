# Phase 0 Research: Repo Card Links

All decisions below are derived from the spec and the in-session clarification on 2026-05-09. There are no remaining unknowns.

## Decision 1: PR-detection strategy

**Decision**: No PR detection. The PR indicator is a static URL link to GitHub's filtered open-PR list for the current branch.

**Rationale**: Confirmed in clarification (Session 2026-05-09). GitHub itself handles 0/1/N PRs on the destination page (empty-state with "New pull request" button, single-PR list, or filtered list). This eliminates the need for a GitHub API token, removes auth concerns, makes the feature pure-frontend, and avoids a backend round-trip per card.

**Alternatives considered**:
- Shell out to `gh pr list`: rejected — adds a backend dependency, requires `gh` to be installed and authenticated, introduces latency per scan.
- GitHub REST API with a user-supplied PAT: rejected — requires a settings UI and token storage; security surface not justified for a UX shortcut.
- Unauthenticated GitHub API: rejected — 60 req/hr/IP rate limit, fails on private repos.

## Decision 2: URL patterns

**Decision**: Use the following GitHub URL patterns, with `<branch>` URL-encoded:

| Indicator | URL pattern |
|---|---|
| Open-PR list (P1) | `https://github.com/<owner>/<repo>/pulls?q=is%3Apr+is%3Aopen+head%3A<branch>` |
| Commits on branch (P2) | `https://github.com/<owner>/<repo>/commits/<branch>` |
| Repo home (P2) | `https://github.com/<owner>/<repo>` |
| Actions on branch (P3) | `https://github.com/<owner>/<repo>/actions?query=branch%3A<branch>` |
| Issues list (P3) | `https://github.com/<owner>/<repo>/issues` |
| Compare (existing) | `https://github.com/<owner>/<repo>/compare/master...<branch>` (or `/compare` on default branch) |

**Rationale**: These are GitHub's stable, documented URL structures; they have been the same since 2014+ and require no API call. The PR query uses `is%3Aopen` so the user only sees open PRs (matching the spec's "open pull request" wording).

**Alternatives considered**:
- `https://github.com/<owner>/<repo>/pull/new/<branch>` for the PR indicator: shows "Open a pull request" form and a banner if a PR exists. Rejected because it puts the user in a "create" context even when they only wanted to *see* the PR; the filtered list is a better default landing.
- `?q=...` vs `?query=...` for actions: GitHub uses `query=` on the Actions page specifically.

## Decision 3: Default-branch handling for commits

**Decision**: Treat `master` and `main` as default branches and link to `/commits` (no branch suffix). For any other branch, link to `/commits/<branch>`.

**Rationale**: Mirrors the existing behavior in `buildGitHubCompareUrl`, which already special-cases `master` and `main`. Keeps the new code consistent with the existing helper.

**Alternatives considered**:
- Always include the branch in the URL: rejected — harmless but unnecessary network redirect when the branch is already the default.

## Decision 4: GitHub remote parsing

**Decision**: Add a single shared helper `parseGitHubRemote(remoteUrl)` that returns `{ owner, repo, baseUrl } | null`. Refactor `buildGitHubCompareUrl` to call it. All new builders call the same helper.

**Rationale**: CLAUDE.md "no code duplication" rule. The existing `buildGitHubCompareUrl` already inlines the same GitHub URL parsing; with five more builders we would duplicate it five times. One shared parser is the right abstraction now.

**Alternatives considered**:
- Inline the parsing in each builder: rejected — direct violation of the no-duplication rule.
- Use a third-party lib (e.g. `parse-github-url`): rejected — adds a dependency for ~20 lines of regex.

## Decision 5: Icon library

**Decision**: Use `lucide-react` icons (already a dep used by the existing `GitCompare` icon).

| Indicator | Icon |
|---|---|
| Open PR | `GitPullRequest` |
| Commits | `GitCommit` |
| Actions | `PlayCircle` (or `Activity` if PlayCircle is unavailable) |
| Issues | `CircleDot` |
| Repo home | (no icon — repo name itself becomes the link) |
| Compare (existing) | `GitCompare` (unchanged) |

**Rationale**: Stay within the existing icon set; matches visual weight of the current `GitCompare` icon at 14px.

## Decision 6: Telemetry event names

**Decision**: One distinct event per indicator kind, namespaced by indicator:

| Indicator | Event name |
|---|---|
| Open PR | `repo_card_pr_opened` |
| Commits | `repo_card_commits_opened` |
| Actions | `repo_card_actions_opened` |
| Issues | `repo_card_issues_opened` |
| Repo home | `repo_card_home_opened` |
| Compare (existing) | `repo_diff_opened` (unchanged) |

**Rationale**: Distinct events let the team measure which indicators get used (per FR-013) and prune unused ones. The existing event keeps its current name to preserve historical comparison.

**Alternatives considered**:
- Single `repo_card_link_opened` event with a `kind` payload: rejected — `postTelemetryEvent` currently only accepts `type`; expanding the API is out of scope.

## Decision 7: Test scope

**Decision**:

- **Unit (Vitest)**: extend `repoUtils.test.ts` with cases for each new builder, covering HTTPS remote, SSH remote, default branch, non-default branch, branch needing URL-encoding (e.g. `feat/foo bar`), non-GitHub remote (returns `null`), null branch, null remote.
- **Component (Vitest + RTL)**: new `RepoCard.test.tsx` covering: indicators visible on GitHub remote, hidden on non-GitHub remote, repo-name renders as `<a>` on GitHub remote and as plain text otherwise, click on each indicator stops propagation and emits the right telemetry event (mock `postTelemetryEvent`).
- **E2E (Playwright)**: new `sc-076-repo-card-links.spec.ts` covering one full happy path (GitHub remote, feature branch → click each indicator → assert `target="_blank"` and href values).

**Rationale**: Mirrors the layered test pattern already used by `repoUtils.test.ts` (unit) + existing component tests + existing `sc-###` Playwright specs. SC-005 explicitly enumerates the URL-correctness test cases; covering them at the unit layer is the cheapest and most reliable spot.
