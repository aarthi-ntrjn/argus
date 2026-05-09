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

### Function: `buildGitHubPrUrl`

```ts
buildGitHubPrUrl(remoteUrl: string | null | undefined, branch: string | null | undefined): string | null
```

| Inputs | Output |
|---|---|
| GitHub remote, branch = `'feature/foo'` | `'https://github.com/owner/repo/pull/new/feature%2Ffoo'` |
| GitHub remote, branch = `'master'` | `'https://github.com/owner/repo/pull/new/master'` |
| GitHub remote, branch = `null` | `null` |
| Non-GitHub remote, any branch | `null` |
| `remoteUrl = null`, any branch | `null` |

### Function: `buildGitHubHomeUrl`

| Inputs | Output |
|---|---|
| GitHub remote (`branch` ignored) | `'https://github.com/owner/repo'` |
| Non-GitHub remote | `null` |

### Function: `buildGitHubBranchUrl`

| Inputs | Output |
|---|---|
| GitHub remote, branch = `'feature/foo'` | `'https://github.com/owner/repo/tree/feature%2Ffoo'` |
| GitHub remote, branch = `'master'` | `'https://github.com/owner/repo/tree/master'` |
| GitHub remote, branch = `null` | `null` |
| Non-GitHub remote, any branch | `null` |

### Function: `buildGitHubCompareUrl` (existing — unchanged behavior)

Already covered by `frontend/src/__tests__/repoUtils.test.ts`. Refactor MUST keep all existing test cases passing.

## Component contract: `frontend/src/components/RepoCard/RepoCard.tsx`

### Indicator row order (FR-014)

```
[branch chip — clickable on GitHub] [GitCompare] [GitPullRequest]
```

### Per-indicator render rules

| Indicator | Visible when | Click behavior |
|---|---|---|
| `pr` | `parseGitHubRemote(remoteUrl) !== null && branch !== null` | Open `buildGitHubPrUrl(...)` in new tab; emit `repo_card_pr_opened`; stop propagation |
| `home` (repo name as link) | `parseGitHubRemote(remoteUrl) !== null` | Wrap `<h2>` content in `<a>`; emit `repo_card_home_opened`; stop propagation |
| `branch` (branch chip as link) | `parseGitHubRemote(remoteUrl) !== null && branch !== null` | Replace branch-chip `<span>` with `<a>` linking to `buildGitHubBranchUrl(...)`; emit `repo_card_branch_opened`; stop propagation; preserve existing chip styling |
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
| TC-04 | unit | `buildGitHubPrUrl(GH, 'feature/foo')` | `.../pull/new/feature%2Ffoo` |
| TC-05 | unit | `buildGitHubPrUrl(GH, null)` | `null` |
| TC-10 | unit | `buildGitHubHomeUrl('https://gitlab.com/o/r')` | `null` |
| TC-11 | unit | All builders, `remoteUrl = null` | all `null` |
| TC-12 | component | RepoCard with GitHub remote + feature branch | renders `pr`, `branch` indicators; repo-name is `<a>` |
| TC-13 | component | RepoCard with non-GitHub remote | none of the new indicators; repo-name is plain text |
| TC-14 | component | RepoCard with GitHub remote, `branch = null` | only repo-name link rendered |
| TC-15 | component | Click `pr` indicator | `postTelemetryEvent('repo_card_pr_opened')` called; click does not bubble to card |
| TC-16 | component | Click each of `branch`, `home` | each emits its corresponding event; none bubble |
| TC-17 | e2e | Real dashboard with a real GitHub remote | indicators render; clicking opens new tab with correct URL |
