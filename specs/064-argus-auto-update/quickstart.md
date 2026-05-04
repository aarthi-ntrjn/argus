# Quickstart: Argus Auto Update (Dev Reference)

**Feature**: 064-argus-auto-update | **Date**: 2026-05-04

## How It Works

1. At startup, `UpdateService` fetches the latest version from the npm registry and compares it to the running version.
2. If a newer version exists, the header badge lights up and the Settings panel shows an update notice.
3. When the user stops Argus (`Ctrl+C` or `SIGTERM`) with auto update enabled, the exit handler prints a brief notice and runs `npm install -g argus-ai-hub@latest` before terminating.
4. The user can also click "Update now" in Settings to apply the update immediately, then restart manually.

## Key Files

| File | Role |
|---|---|
| `backend/src/services/update-service.ts` | Core logic: version check, apply, schedule |
| `backend/src/api/routes/update.ts` | `GET /api/v1/update/status`, `POST /api/v1/update/apply` |
| `backend/src/api/routes/health.ts` | Extended with `updateAvailable`, `latestVersion` |
| `backend/src/server.ts` | Wires service; exit handler update logic |
| `backend/src/models/index.ts` | `ArgusConfig.autoUpdate` field |
| `frontend/src/hooks/useUpdateStatus.ts` | Polls update status every 60s |
| `frontend/src/components/UpdateBadge/UpdateBadge.tsx` | Header badge |
| `frontend/src/components/SettingsPanel/SettingsPanel.tsx` | Update UI in settings |

## Running Tests

```bash
# Backend unit + contract
npm run test --workspace=backend

# Frontend unit
npm run test --workspace=frontend

# E2E
npm run test:e2e
```

## Configuration

`autoUpdate` is stored in `~/.argus/config.json` alongside other Argus settings.

```json
{ "autoUpdate": true }
```

Set it to `false` to disable auto update on exit. The update badge still appears when an update is available.

## npm Registry Endpoint

Version checks hit: `https://registry.npmjs.org/argus-ai-hub/latest`

The response `.version` field is compared as `major.minor.patch` integer tuples against the running version.

## Exit Sequence with Update

```
SIGINT/SIGTERM received
  → send telemetry app_ended
  → if autoUpdate && hasUpdate && !updateInProgress:
      print "Applying update to v{latestVersion}. Active monitoring paused until update is applied and server is restarted."
      await applyUpdate() (25s timeout)
      on failure: log warning, continue
  → shutdown integrations
  → app.close()
  → process.exit(0)
```
