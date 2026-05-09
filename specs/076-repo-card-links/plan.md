# Implementation Plan: Show Useful Repository Links on Repo Cards

**Branch**: `076-repo-card-links` | **Date**: 2026-05-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/076-repo-card-links/spec.md`

## Summary

Extend `RepoCard` so each card shows a small set of icon links pointing into GitHub, all derived purely client-side from `repo.remoteUrl` + `repo.branch`. Indicators added: open-PR list (P1), commits on branch (P2), repo home as a wrapper around the repo name (P2), Actions filtered to branch (P3), and issues list (P3). The existing branch chip and compare icon stay unchanged. No backend, no GitHub API call, no async loading state.

The work is essentially: add five URL-builder helpers to `repoUtils.ts`, render them in `RepoCard.tsx` next to the existing `GitCompare` icon, and emit a distinct telemetry event per click (consistent with the existing `repo_diff_opened` event).

## Technical Context

**Language/Version**: TypeScript 5.x (frontend workspace)
**Primary Dependencies**: React 18, lucide-react (icons), Tailwind, Vitest, Playwright
**Storage**: N/A (no persisted state in this feature)
**Testing**: Vitest + React Testing Library for unit/component, Playwright for e2e
**Target Platform**: Browser (existing Argus dashboard at `http://127.0.0.1:7411`)
**Project Type**: Web (frontend-only change in this feature)
**Performance Goals**: No measurable regression in dashboard render (<10% delta with 20 repo cards, per SC-004)
**Constraints**: Must work for HTTPS and SSH GitHub remotes; must hide all GitHub-specific indicators on non-GitHub remotes; must not call any external API
**Scale/Scope**: Single-user localhost developer tool (constitution §VI/§VIII exemptions apply)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Note |
|---|---|---|
| §I Engineering | PASS | Pure UI addition; reversible; testable in isolation. |
| §II Architecture | PASS | No service boundaries changed. |
| §III Code Standards | PASS | Helpers will stay <50 lines; will use named constants for URL fragments per CLAUDE.md "no magic strings". |
| §IV Test-First | PASS | Vitest unit tests for URL builders and RepoCard component will be written and seen failing before implementation. |
| §V Testing Requirements | PASS | Unit (URL builders), component (RepoCard rendering), e2e (Playwright sc-spec) all planned. |
| §VI Security & Compliance | EXCEPTION | Single-user localhost tool; existing exemption applies. New `target="_blank"` links MUST use `rel="noopener noreferrer"` (FR-003). |
| §VII Observability | PASS | Each indicator emits a distinct telemetry event (FR-013). |
| §VIII Performance | EXCEPTION | Single-user localhost tool; existing exemption applies. SC-004 sets the actual bound. |
| §IX AI Usage | PASS | AI generates implementation; human review on PR. |
| §X Definition of Done | PASS | Tests, README, security review covered in Polish phase. |
| §XI Documentation | PASS | README update task included in Polish phase. |
| §XII Error Handling | N/A | No API errors raised by this feature; URL builders return either a string or `null`. |

No unjustified violations. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/076-repo-card-links/
├── plan.md              # This file
├── research.md          # Phase 0 — URL pattern decisions
├── data-model.md        # Phase 1 — entities (RepoCardLink, RepositoryRemote)
├── contracts/
│   └── repo-card-links.md   # The "contract" between repoUtils builders and RepoCard renderer
├── checklists/
│   └── requirements.md  # Already created by /speckit.specify
├── spec.md              # Already exists
└── tasks.md             # Created by /speckit.tasks
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   └── RepoCard/
│   │       └── RepoCard.tsx              # Render new indicators
│   ├── utils/
│   │   └── repoUtils.ts                  # New URL builders + GitHub remote parser
│   └── services/
│       └── api.ts                        # postTelemetryEvent (existing, reused)
└── tests/
    ├── __tests__/
    │   ├── repoUtils.test.ts             # Extend with new builder tests
    │   └── RepoCard.test.tsx             # New component test
    └── e2e/
        └── sc-076-repo-card-links.spec.ts  # New Playwright e2e
```

**Structure Decision**: Frontend-only change inside the existing `frontend/` workspace. No new top-level directories. The existing `repoUtils.ts` already owns GitHub URL construction (`buildGitHubCompareUrl`); new builders live alongside it and share a single GitHub-remote parser to satisfy CLAUDE.md "no code duplication".

## Complexity Tracking

> No constitution violations require justification.

## Notes for downstream phases

- The existing `RepoCard.tsx` calls `buildGitHubCompareUrl(repo.remoteUrl, repo.branch)` twice (line 94 and line 96) when rendering the compare link. The new code path SHOULD compute the parsed-remote info once per render and reuse it across all builders to avoid repeated parsing. This is a small refactor of the existing compare-link block, justified by the new shared parser.
- The repo name's home link (US3) requires changing the existing `<h2>` to render as either `<a>` (when GitHub remote) or `<h2>` (otherwise). Tests must cover both.
- Branch chip, compare icon, and remove-button MUST remain in their current positions and behaviors — only additions in this feature.
