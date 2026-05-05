# Data Model: Argus Auto Update

**Phase**: 1 | **Date**: 2026-05-04 | **Feature**: [spec.md](spec.md)

## Entities

### UpdateStatus

Represents the result of the most recent version check. Held in memory by `UpdateService` and served via `GET /api/v1/update/status` and the extended `/api/health` response.

| Field | Type | Description |
|---|---|---|
| `currentVersion` | `string` | Installed version from `package.json` |
| `latestVersion` | `string \| null` | Latest published version from npm registry; `null` if check has not completed or failed |
| `updateAvailable` | `boolean` | `true` when `latestVersion` is semver-greater than `currentVersion` |
| `lastChecked` | `string \| null` | ISO 8601 timestamp of last successful check; `null` if never checked |
| `updateInProgress` | `boolean` | `true` while `applyUpdate()` is running |

**Validation rules**:
- `updateAvailable` is `false` whenever `latestVersion` is `null`
- `updateInProgress` is `false` until `applyUpdate()` is called; reset to `false` on resolve or reject

**State transitions**:
```
idle (updateAvailable=false, updateInProgress=false)
  → [checkForUpdates succeeds, newer version found]
      → update-available (updateAvailable=true, updateInProgress=false)
          → [applyUpdate called]
              → updating (updateInProgress=true)
                  → [success] → idle (updateAvailable=false)
                  → [failure] → update-available (updateInProgress=false)
  → [checkForUpdates fails or up-to-date]
      → idle
```

---

### UpdatePreference (extends ArgusConfig)

User preference controlling whether the update is applied automatically on exit. Persisted in `~/.argus/config.json`.

| Field | Type | Default | Description |
|---|---|---|---|
| `autoUpdate` | `boolean` | `true` | When `true`, the exit handler applies any pending update before terminating |

**Validation rules**:
- Writable via `PATCH /api/v1/settings` (key added to `ALLOWED_KEYS`)
- No other constraints; any boolean value is valid
