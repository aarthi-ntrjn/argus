# Contract: Repo Card Link Builders ↔ RepoCard Renderer

There are no HTTP API contracts in this feature. The only "contract" is between the URL-builder helpers in `repoUtils.ts` and the `RepoCard.tsx` component that consumes them.

## Module contract: `frontend/src/utils/repoUtils.ts`

### Function: `parseGitHubRemote`

```ts
parseGitHubRemote(remoteUrl: string | null | undefined): ParsedGitHubRemote | null
```

| Input `remoteUrl` | Output |
|---|---|
| `null` / `undefined` / `''` | `null` |
| `'https://github.com/owner/repo'` | `{ owner: 'owner', repo: 'repo', baseUrl: 'https://github.com/owner/repo' }` |
| `'https://github.com/owner/repo.git'` | `{ owner: 'owner', repo: 'repo', baseUrl: 'https://github.com/owner/repo' }` |
| `'git@github.com:owner/repo.git'` | `{ owner: 'owner', repo: 'repo', baseUrl: 'https://github.com/owner/repo' }` |
| `'https://gitlab.com/owner/repo'` | `null` |
| `'https://github.example.com/owner/repo'` (GHE) | `null` |

### Function: `buildGitHubPrListUrl`

```ts
buildGitHubPrListUrl(remoteUrl: string | null | undefined, branch: string | null | undefined): string | null
```

| Inputs | Output |
|---|---|
| GitHub remote, branch = `'feature/foo'` | `'https://github.com/owner/repo/pulls?q=is%3Apr+is%3Aopen+head%3Afeature%2Ffoo'` |
| GitHub remote, branch = `'master'` | `'https://github.com/owner/repo/pulls?q=is%3Apr+is%3Aopen+head%3Amaster'` |
| GitHub remote, branch = `null` | `null` |
| Non-GitHub remote, any branch | `null` |
| `remoteUrl = null`, any branch | `null` |

### Function: `buildGitHubCommitsUrl`

| Inputs | Output |
|---|---|
| GitHub remote, branch = `'feature/foo'` | `'https://github.com/owner/repo/commits/feature%2Ffoo'` |
| GitHub remote, branch = `'master'` | `'https://github.com/owner/repo/commits'` |
| GitHub remote, branch = `'main'` | `'https://github.com/owner/repo/commits'` |
| GitHub remote, branch = `null` | `null` |
| Non-GitHub remote, any branch | `null` |

### Function: `buildGitHubActionsUrl`

| Inputs | Output |
|---|---|
| GitHub remote, branch = `'feature/foo'` | `'https://github.com/owner/repo/actions?query=branch%3Afeature%2Ffoo'` |
| GitHub remote, branch = `null` | `null` |
| Non-GitHub remote, any branch | `null` |

### Function: `buildGitHubIssuesUrl`

| Inputs | Output |
|---|---|
| GitHub remote (`branch` ignored) | `'https://github.com/owner/repo/issues'` |
| Non-GitHub remote | `null` |

### Function: `buildGitHubHomeUrl`

| Inputs | Output |
|---|---|
| GitHub remote (`branch` ignored) | `'https://github.com/owner/repo'` |
| Non-GitHub remote | `null` |

### Function: `buildGitHubCompareUrl` (existing — unchanged behavior)

Already covered by `frontend/src/__tests__/repoUtils.test.ts`. Refactor MUST keep all existing test cases passing.

## Component contract: `frontend/src/components/RepoCard/RepoCard.tsx`

### Indicator row order (FR-014)

```
[branch chip] [GitCompare] [GitPullRequest] [GitCommit] [PlayCircle] [CircleDot]
```

### Per-indicator render rules

| Indicator | Visible when | Click behavior |
|---|---|---|
| `pr` | `parseGitHubRemote(remoteUrl) !== null && branch !== null` | Open `buildGitHubPrListUrl(...)` in new tab; emit `repo_card_pr_opened`; stop propagation |
| `commits` | same as `pr` | Open `buildGitHubCommitsUrl(...)`; emit `repo_card_commits_opened`; stop propagation |
| `actions` | same as `pr` | Open `buildGitHubActionsUrl(...)`; emit `repo_card_actions_opened`; stop propagation |
| `issues` | `parseGitHubRemote(remoteUrl) !== null` (branch not required) | Open `buildGitHubIssuesUrl(...)`; emit `repo_card_issues_opened`; stop propagation |
| `home` (repo name as link) | `parseGitHubRemote(remoteUrl) !== null` | Wrap `<h2>` content in `<a>`; emit `repo_card_home_opened`; stop propagation |
| `compare` | unchanged | unchanged |

### A11y / DOM contract

- Every indicator MUST set `aria-label` AND `title` to a description of the destination.
- Every indicator MUST set `target="_blank"` and `rel="noopener noreferrer"`.
- Every indicator's click handler MUST call `e.stopPropagation()` before opening the link.
- The repo-name `<a>` (when present) MUST keep the existing text styling (`text-lg md:text-xl font-semibold text-gray-900`) and add an underline-on-hover state.

### Telemetry contract

`postTelemetryEvent` is fire-and-forget; failures are silently swallowed by the existing implementation. No error UX is required when telemetry fails.

## Test case table (drives Phase 4 task generation)

| ID | Layer | Case | Expected |
|---|---|---|---|
| TC-01 | unit | `parseGitHubRemote('https://github.com/o/r.git')` | `{ owner: 'o', repo: 'r', baseUrl: 'https://github.com/o/r' }` |
| TC-02 | unit | `parseGitHubRemote('git@github.com:o/r.git')` | same as TC-01 |
| TC-03 | unit | `parseGitHubRemote('https://gitlab.com/o/r')` | `null` |
| TC-04 | unit | `buildGitHubPrListUrl(GH, 'feature/foo')` | encoded URL per spec |
| TC-05 | unit | `buildGitHubPrListUrl(GH, null)` | `null` |
| TC-06 | unit | `buildGitHubCommitsUrl(GH, 'master')` | `.../commits` (no branch) |
| TC-07 | unit | `buildGitHubCommitsUrl(GH, 'feature/foo')` | `.../commits/feature%2Ffoo` |
| TC-08 | unit | `buildGitHubActionsUrl(GH, 'feature/foo')` | `.../actions?query=branch%3Afeature%2Ffoo` |
| TC-09 | unit | `buildGitHubIssuesUrl(GH)` | `.../issues` |
| TC-10 | unit | `buildGitHubHomeUrl('https://gitlab.com/o/r')` | `null` |
| TC-11 | unit | All builders, `remoteUrl = null` | all `null` |
| TC-12 | component | RepoCard with GitHub remote + feature branch | renders `pr`, `commits`, `actions`, `issues` icons; repo-name is `<a>` |
| TC-13 | component | RepoCard with non-GitHub remote | none of the new icons; repo-name is plain text |
| TC-14 | component | RepoCard with GitHub remote, `branch = null` | only `issues` icon and repo-name link rendered |
| TC-15 | component | Click `pr` indicator | `postTelemetryEvent('repo_card_pr_opened')` called; click does not bubble to card |
| TC-16 | component | Click each of `commits`, `actions`, `issues`, `home` | each emits its corresponding event; none bubble |
| TC-17 | e2e | Real dashboard with a real GitHub remote | indicators render; clicking opens new tab with correct URL |
