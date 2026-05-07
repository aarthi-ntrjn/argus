# Research: Autonomous E2E Tester Agent

**Branch**: `065-autonomous-e2e-tester` | **Date**: 2026-05-04

---

## Decision 1: Persona Test Workspace Location

**Decision**: New directory `frontend/tests/e2e/persona/` with its own `playwright.persona.config.ts` at repo root.

**Rationale**: The existing `frontend/tests/e2e/real-server/` suite is CI-gated regression coverage. The persona tester is a separate concern — it runs on a schedule, is written as user journeys rather than assertions, and has different pass/fail semantics. Mixing them would conflate two purposes. A dedicated directory and config keeps them independently runnable and independently maintainable.

**Alternatives considered**:
- Reuse `real-server/` directory: Rejected — mixes CI regression tests with the periodic persona tester, complicating both.
- Separate repository: Rejected — violates the assumption that scenarios live alongside product code.

---

## Decision 2: How the Scheduler Triggers Playwright

**Decision**: The backend `TesterService` spawns `npx playwright test --config playwright.persona.config.ts --reporter=json` as a child process. On exit it reads the JSON report file and persists run results to the DB.

**Rationale**: Playwright's `--reporter=json` produces a well-structured output (`playwright-report/results.json`). The backend already uses `setInterval` for the pruning job — the same pattern applies here. Spawning Playwright as a subprocess keeps the tester isolated from the server process and uses the standard Playwright report format without custom instrumentation.

**Alternatives considered**:
- Custom Playwright reporter that POSTs to the backend: More complex, couples test code to backend.
- Running tests in-process via `@playwright/test` programmatic API: Less mature, more brittle across Playwright versions.
- Parsing stdout rather than JSON report: Fragile; JSON report is the official machine-readable format.

---

## Decision 3: Result Storage Schema

**Decision**: Two new tables: `tester_runs` (one row per run) and `tester_scenarios` (one row per scenario per run).

**Rationale**: Matching the granularity of the Playwright JSON report. A run has overall pass/fail; each scenario has its own result. This mirrors how `sessions` and `session_output` are related — a parent record with child detail records. Fits the existing DB pattern exactly.

```sql
CREATE TABLE tester_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('running','passed','failed','error')),
  total_scenarios INTEGER NOT NULL DEFAULT 0,
  passed_scenarios INTEGER NOT NULL DEFAULT 0,
  failed_scenarios INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tester_scenarios (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES tester_runs(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('passed','failed','skipped')),
  duration_ms INTEGER,
  error_message TEXT
);
```

**Alternatives considered**:
- Single table with JSON blob for scenario results: Simpler but not queryable; harder to render per-scenario status in the UI.
- Reuse `sessions` table: Wrong semantic; a tester run is not a user session.

---

## Decision 4: Result Surfacing Strategy

**Decision**: New `TesterPanel` sidebar component in the Argus frontend (matching the `TodoPanel` pattern), plus an optional Slack/Teams notification on run completion.

**Rationale**: The TodoPanel is the closest analogue — a read-optimised panel that shows a list of items fetched via React Query. The same pattern applies: `useTestRuns()` hook, `apiFetch()` call, React Query invalidation. Slack/Teams notifications on failure are additive and use the existing notifier infrastructure.

**Alternatives considered**:
- Embed results in the existing session dashboard: Wrong location — tester results are not session data.
- Results only in Slack/Teams: Requires integration to be configured; UI-only surfacing is always available.

---

## Decision 5: Notification Integration Point

**Decision**: Add `notifyTesterRunCompleted(run, scenarios)` to both `SlackNotifier` and `TeamsNotifier`. This is called directly from `TesterService` after persisting results, conditioned on the integration being active.

**Rationale**: The notifiers already have the scaffolding for posting formatted messages. A new method per notifier follows the established interface pattern without requiring a new `NotificationIntegration` interface method (which would require all notifiers to implement it). The call is made only when the integration's `isRunning` getter returns true.

**Alternatives considered**:
- Add `onTesterRunCompleted` to the `NotificationIntegration` interface: Would require both notifiers to implement it even if unused; over-engineers for a single notification type.
- Separate notification service: Unnecessary abstraction given two notifiers and one event type.

---

## Decision 6: Scheduling Mechanism

**Decision**: Backend `TesterScheduler` service wrapping `setInterval`, with a configurable interval stored in `server_state` (default: 86400000ms / 24h). A POST endpoint `/api/v1/tester/run` allows manual triggering. The schedule can be reconfigured via a PATCH to settings without restart.

**Rationale**: The existing `pruning-job.ts` uses `setInterval` — same pattern, same lifecycle (started in `server.ts`). Storing the interval in `server_state` (already used for other server-level state) avoids a new config file. Manual trigger via API matches the existing pattern for control actions.

**Alternatives considered**:
- Cron expression: More flexible but adds complexity. `setInterval` with a configurable millisecond value is sufficient for daily/hourly scheduling.
- External scheduler (OS cron calling the API): Requires out-of-process setup by the user. Not appropriate for a self-contained local tool.
- The `/schedule` Claude Code skill: Not appropriate — that schedules Claude Code agents, not backend service jobs.

---

## Decision 7: Persona Test Isolation

**Decision**: `playwright.persona.config.ts` uses `start-test-server.mjs` with a dedicated port (7413) and a uniquely-named temp DB (same pattern as `playwright.real.config.ts` which uses 7412). Global setup creates temp git repos; global teardown deletes them and the temp DB.

**Rationale**: Directly reuses the proven isolation pattern from the existing real-server suite. Different port (7413) avoids conflict if both suites run simultaneously.

**Alternatives considered**:
- Docker container: Unnecessary for a local tool; adds a hard dependency.
- Shared port with real-server tests: Creates conflict when both run; isolation requires a unique port.
