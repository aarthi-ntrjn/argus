# Data Model: Autonomous E2E Tester Agent

**Branch**: `065-autonomous-e2e-tester` | **Date**: 2026-05-04

---

## Entities

### TesterRun

One record per execution of the full persona scenario suite.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `started_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `ended_at` | TEXT | nullable | ISO 8601 timestamp; null while running |
| `status` | TEXT | NOT NULL, CHECK | `running` / `passed` / `failed` / `error` |
| `total_scenarios` | INTEGER | NOT NULL DEFAULT 0 | Count of scenarios attempted |
| `passed_scenarios` | INTEGER | NOT NULL DEFAULT 0 | Count of passing scenarios |
| `failed_scenarios` | INTEGER | NOT NULL DEFAULT 0 | Count of failing scenarios |

**State transitions**: `running` → `passed` | `failed` | `error`

---

### TesterScenario

One record per scenario within a run.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `run_id` | TEXT | NOT NULL, FK → tester_runs | Parent run |
| `name` | TEXT | NOT NULL | Human-readable scenario name, e.g. "Add repository and verify dashboard" |
| `status` | TEXT | NOT NULL, CHECK | `passed` / `failed` / `skipped` |
| `duration_ms` | INTEGER | nullable | Wall-clock ms for this scenario |
| `error_message` | TEXT | nullable | Plain-language failure description; null on pass |

---

## SQL Schema

```sql
CREATE TABLE IF NOT EXISTS tester_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('running','passed','failed','error')),
  total_scenarios INTEGER NOT NULL DEFAULT 0,
  passed_scenarios INTEGER NOT NULL DEFAULT 0,
  failed_scenarios INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tester_scenarios (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES tester_runs(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('passed','failed','skipped')),
  duration_ms INTEGER,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_tester_runs_started ON tester_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tester_scenarios_run ON tester_scenarios(run_id);
```

---

## TypeScript Models

```typescript
// backend/src/models/index.ts additions

export interface TesterRun {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: 'running' | 'passed' | 'failed' | 'error';
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
}

export interface TesterScenario {
  id: string;
  runId: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number | null;
  errorMessage: string | null;
}
```

---

## Relationships

```
tester_runs 1 ──── * tester_scenarios
```

A run has zero or more scenario results. Scenarios are created after the Playwright run completes (parsed from the JSON report). During a run only the `tester_runs` row exists with `status = 'running'`.

---

## Settings

Tester configuration is stored in the existing `server_state` table using well-known keys:

| Key | Default | Description |
|---|---|---|
| `tester.schedule.intervalMs` | `86400000` (24h) | How often to run automatically; `0` = disabled |
| `tester.schedule.enabled` | `true` | Master on/off for scheduled runs |
