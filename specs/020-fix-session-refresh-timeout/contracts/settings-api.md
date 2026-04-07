# API Contract: Settings

**Base path**: `/api/v1/settings`
**Purpose**: Read and update Argus runtime configuration.

---

## GET /api/v1/settings

Returns the current Argus configuration.

### Response: 200 OK

```json
{
  "port": 7411,
  "watchDirectories": [],
  "sessionRetentionHours": 24,
  "outputRetentionMbPerSession": 10,
  "autoRegisterRepos": false,
  "idleSessionThresholdMinutes": 60
}
```

---

## PATCH /api/v1/settings

Partially updates the configuration. Only supplied fields are changed. Persists to `~/.argus/config.json`. Changes to `idleSessionThresholdMinutes` take effect within 5 seconds (next reconciliation cycle).

### Request body (partial)

```json
{
  "idleSessionThresholdMinutes": 45
}
```

Any subset of `ArgusConfig` fields may be provided. Unknown fields are ignored.

### Validation rules

| Field | Rule |
|-------|------|
| `idleSessionThresholdMinutes` | Integer ≥ 1 |
| `sessionRetentionHours` | Integer ≥ 1 |
| `outputRetentionMbPerSession` | Number > 0 |
| `port` | Integer 1024–65535 |

### Response: 200 OK

Returns the full updated config (same shape as GET).

### Response: 400 Bad Request

```json
{
  "error": "INVALID_CONFIG",
  "message": "idleSessionThresholdMinutes must be an integer greater than or equal to 1",
  "requestId": "req-abc123"
}
```

---

## Test Cases

| # | Scenario | Method | Body | Expected status | Expected behavior |
|---|----------|--------|------|-----------------|-------------------|
| 1 | Get default config | GET | — | 200 | Returns all fields including `idleSessionThresholdMinutes: 60` |
| 2 | Update threshold | PATCH | `{ "idleSessionThresholdMinutes": 45 }` | 200 | Returns config with updated value |
| 3 | Partial update (other field) | PATCH | `{ "sessionRetentionHours": 48 }` | 200 | Other fields unchanged |
| 4 | Invalid threshold (zero) | PATCH | `{ "idleSessionThresholdMinutes": 0 }` | 400 | `INVALID_CONFIG` error |
| 5 | Invalid threshold (negative) | PATCH | `{ "idleSessionThresholdMinutes": -10 }` | 400 | `INVALID_CONFIG` error |
| 6 | Invalid threshold (string) | PATCH | `{ "idleSessionThresholdMinutes": "fast" }` | 400 | `INVALID_CONFIG` error |
| 7 | Unknown field ignored | PATCH | `{ "unknownField": true }` | 200 | Config unchanged; unknown field not persisted |
