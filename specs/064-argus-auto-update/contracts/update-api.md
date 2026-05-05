# API Contract: Update Endpoints

**Feature**: 064-argus-auto-update | **Date**: 2026-05-04

All endpoints are served at `http://127.0.0.1:{port}` (localhost only).

---

## GET /api/v1/update/status

Returns the current update status as known by `UpdateService`.

**Request**: No body, no parameters.

**Response 200**:

```json
{
  "currentVersion": "0.1.14",
  "latestVersion": "0.1.15",
  "updateAvailable": true,
  "lastChecked": "2026-05-04T10:00:00.000Z",
  "updateInProgress": false
}
```

| Field | Type | Nullable |
|---|---|---|
| `currentVersion` | string | No |
| `latestVersion` | string | Yes (null if check not yet complete or failed) |
| `updateAvailable` | boolean | No |
| `lastChecked` | string (ISO 8601) | Yes (null if never checked) |
| `updateInProgress` | boolean | No |

---

## POST /api/v1/update/apply

Triggers a manual update in the background. The running Argus instance continues serving until the user restarts.

**Request**: No body required.

**Response 202** (update started):

```json
{ "started": true }
```

**Response 409** (already in progress):

```json
{ "error": "UPDATE_IN_PROGRESS", "message": "An update is already being applied.", "requestId": "..." }
```

**Response 503** (no update available):

```json
{ "error": "NO_UPDATE_AVAILABLE", "message": "Argus is already up to date.", "requestId": "..." }
```

Error responses follow the §XII structured contract: `{ error, message, requestId }`.

---

## GET /api/health (extended)

Existing health endpoint, extended with update fields. The new fields are optional so older clients are unaffected.

**Additional fields in response**:

```json
{
  "status": "ok",
  "version": "0.1.14",
  "uptime": 123.4,
  "updateAvailable": true,
  "latestVersion": "0.1.15",
  ...
}
```

| Field | Type | Nullable |
|---|---|---|
| `updateAvailable` | boolean | No (false if check not yet complete) |
| `latestVersion` | string | Yes |

---

## PATCH /api/v1/settings (extended)

Existing settings endpoint, extended with `autoUpdate`.

**Request body (partial)**:

```json
{ "autoUpdate": false }
```

`autoUpdate` follows the same semantics as other `ArgusConfig` boolean fields. Persisted to `~/.argus/config.json`.
