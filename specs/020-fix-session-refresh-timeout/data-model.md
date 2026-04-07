# Data Model: Fix Session Disappears After 30-Minute Inactivity

**Date**: 2026-04-07
**Branch**: `020-fix-session-refresh-timeout`

## Session Status Transitions (updated)

```
                   ┌─────────┐
                   │ active  │◄────────────────────────┐
                   └────┬────┘                         │
                        │ JSONL mtime > threshold       │ JSONL mtime fresh
                        │ AND PID alive                 │ (idle → active restore)
                        ▼                               │
                   ┌─────────┐                    ┌─────────┐
                   │  idle   │────────────────────►│ active  │
                   └────┬────┘                    └─────────┘
                        │ PID dies (detected on next cycle)
                        ▼
                   ┌─────────┐
                   │  ended  │
                   └─────────┘

Also: active → ended directly if JSONL mtime > threshold AND PID dead (or null)
Also: active → ended directly if JSONL file missing
```

## Config Model Changes

### `ArgusConfig` (backend: `models/index.ts`, frontend: `types.ts`)

**New field**:

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `idleSessionThresholdMinutes` | `number` | `60` | Integer ≥ 1 |

**Full updated shape**:

```typescript
interface ArgusConfig {
  port: number;
  watchDirectories: string[];
  sessionRetentionHours: number;
  outputRetentionMbPerSession: number;
  autoRegisterRepos: boolean;
  idleSessionThresholdMinutes: number;  // NEW — default 60
}
```

## Session Entity (no schema change)

The `sessions` table schema is unchanged. The `status` column already accepts any string value (no CHECK constraint). The `idle` status value was already present in the `SessionStatus` TypeScript union.

```sql
-- No migration required
-- sessions.status already accepts 'idle'
```

## State Rules

| Condition | Result status | `endedAt` |
|-----------|--------------|-----------|
| JSONL mtime fresh | `active` (no change, or restored from `idle`) | null |
| JSONL mtime stale + PID alive | `idle` | null |
| JSONL mtime stale + PID dead or null | `ended` | ISO timestamp |
| JSONL file missing + PID alive | `ended` | ISO timestamp |
| JSONL file missing + PID dead or null | `ended` | ISO timestamp |
| Startup: `idle` session + PID dead | `ended` | ISO timestamp |
| Startup: `idle` session + PID alive | `idle` (unchanged) | null |
