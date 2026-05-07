# API Contract: Tester Endpoints

**Base path**: `/api/v1/tester`

---

## GET /api/v1/tester/runs

Returns the most recent tester runs (newest first).

**Query params**: `?limit=N` (default 20, max 100)

**Response 200**:
```json
[
  {
    "id": "uuid",
    "startedAt": "2026-05-04T09:00:00.000Z",
    "endedAt": "2026-05-04T09:03:12.000Z",
    "status": "passed",
    "totalScenarios": 5,
    "passedScenarios": 5,
    "failedScenarios": 0
  }
]
```

---

## GET /api/v1/tester/runs/:id

Returns a single run with its scenario results.

**Response 200**:
```json
{
  "id": "uuid",
  "startedAt": "2026-05-04T09:00:00.000Z",
  "endedAt": "2026-05-04T09:03:12.000Z",
  "status": "failed",
  "totalScenarios": 5,
  "passedScenarios": 4,
  "failedScenarios": 1,
  "scenarios": [
    {
      "id": "uuid",
      "runId": "uuid",
      "name": "Add repository and verify dashboard",
      "status": "passed",
      "durationMs": 1823,
      "errorMessage": null
    },
    {
      "id": "uuid",
      "runId": "uuid",
      "name": "Launch session and send prompt",
      "status": "failed",
      "durationMs": 4201,
      "errorMessage": "Session did not appear as active within 10 seconds"
    }
  ]
}
```

**Response 404**:
```json
{ "error": "NOT_FOUND", "message": "Tester run not found" }
```

---

## POST /api/v1/tester/run

Triggers a manual run immediately. Returns 409 if a run is already in progress.

**Request body**: none

**Response 202**:
```json
{ "id": "uuid", "startedAt": "2026-05-04T09:05:00.000Z", "status": "running" }
```

**Response 409**:
```json
{ "error": "CONFLICT", "message": "A tester run is already in progress" }
```

---

## GET /api/v1/tester/settings

Returns the current tester schedule configuration.

**Response 200**:
```json
{
  "scheduleEnabled": true,
  "intervalMs": 86400000
}
```

---

## PATCH /api/v1/tester/settings

Updates schedule configuration. Takes effect immediately without restart.

**Request body**:
```json
{
  "scheduleEnabled": true,
  "intervalMs": 3600000
}
```

**Response 200**: same shape as GET

**Response 400**:
```json
{ "error": "VALIDATION_ERROR", "message": "intervalMs must be 0 or a positive integer" }
```
