# Implementation Plan: Argus Auto Update

**Branch**: `064-argus-auto-update` | **Date**: 2026-05-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/064-argus-auto-update/spec.md`

## Summary

Add automatic update checking and on-exit update application to Argus. The system queries the npm registry for a newer version of `argus-ai-hub`, displays a persistent badge in the header when one is found, applies the update during graceful shutdown (printing a monitoring-paused notice), and exposes a manual update trigger in the Settings panel. The preference is stored in `~/.argus/config.json` and defaults to enabled.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (backend + frontend), Node.js ≥22
**Primary Dependencies**: Fastify 5.8.4 (backend API), React 18.3.1 + TanStack Query (frontend)
**Storage**: `~/.argus/config.json` via existing `loadConfig`/`saveConfig` in `config-loader.ts`
**Testing**: vitest 3.1.1 (unit + integration), Playwright 1.59.0 (e2e)
**Target Platform**: Node.js server, localhost only (single-user developer tool)
**Performance Goals**: Version check completes within 5 seconds; exit sequence completes within 30 seconds including update
**Constraints**: Update check must not block the UI or startup; applies to global npm install only; no elevated privilege prompts in scope
**Scale/Scope**: Single local user, no concurrent sessions to the update service itself

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| §I Engineering (reliable, observable, testable, reversible) | PASS | UpdateService is a standalone class injectable with mocked deps; `autoUpdate` flag provides reversibility |
| §II Architecture (versioned API boundaries) | PASS | New `/api/v1/update/*` routes with typed contracts |
| §III Code Standards (functions < 50 lines, structured logging) | PASS | Service methods are discrete and small; `createTaggedLogger` used |
| §IV Test-First | PASS | Tests written before implementation per constitution |
| §V Testing (unit + integration + e2e) | PASS | All three layers planned |
| §VI Security (localhost-only exemption applies) | PASS | Service bound to `127.0.0.1`; single local user; §VI exception explicitly declared |
| §VII Observability (structured logs + health endpoint) | PASS | UpdateService logs all check/apply outcomes; health endpoint extended |
| §VIII Performance (localhost tool exemption applies) | PASS | Concurrency target: single user; version check is async and non-blocking |
| §X Definition of Done | PASS | All checklist items planned across phases |
| §XI Documentation | PASS | README update task included |
| §XII Error Handling | PASS | Update failures logged with full context; user-facing messages are human-friendly |

No violations. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/064-argus-auto-update/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── update-api.md    # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code

```text
backend/
├── src/
│   ├── models/
│   │   └── index.ts                  # +autoUpdate to ArgusConfig
│   ├── config/
│   │   └── config-loader.ts          # +autoUpdate default (true)
│   ├── services/
│   │   └── update-service.ts         # NEW: version check, apply, schedule
│   └── api/
│       └── routes/
│           ├── health.ts             # Extend response with updateAvailable, latestVersion
│           ├── settings.ts           # Add autoUpdate to ALLOWED_KEYS
│           └── update.ts             # NEW: GET /api/v1/update/status, POST /api/v1/update/apply
│   └── server.ts                     # Wire UpdateService; on-exit update logic
└── tests/
    ├── unit/
    │   └── update-service.test.ts    # NEW
    └── contract/
        └── update.test.ts            # NEW

frontend/
├── src/
│   ├── services/
│   │   └── api.ts                    # +getUpdateStatus(), extend health response type
│   ├── hooks/
│   │   └── useUpdateStatus.ts        # NEW: polls /api/v1/update/status every 60s
│   ├── components/
│   │   ├── UpdateBadge/
│   │   │   └── UpdateBadge.tsx       # NEW: badge shown in header when update available
│   │   └── SettingsPanel/
│   │       └── SettingsPanel.tsx     # +update info + auto-update toggle
│   └── pages/
│       └── DashboardPage.tsx         # Mount UpdateBadge in header

README.md                             # Document update behaviour and autoUpdate config
```

**Structure Decision**: Option 2 (web application) — existing backend/frontend split. New files follow established patterns: service class singleton in `services/`, Fastify plugin in `api/routes/`, React hook in `hooks/`, component in `components/`.

## Implementation Phases

### Phase 1: Backend Core

**Goal**: UpdateService + config field + API endpoints. No frontend changes yet. Fully testable in isolation.

**Tasks**:
1. Add `autoUpdate: boolean` to `ArgusConfig` in `backend/src/models/index.ts`
2. Add `autoUpdate: true` to DEFAULTS in `backend/src/config/config-loader.ts`
3. Add `autoUpdate` to `ALLOWED_KEYS` in `backend/src/api/routes/settings.ts`
4. Create `backend/src/services/update-service.ts`:
   - `checkForUpdates()`: fetch `https://registry.npmjs.org/argus-ai-hub/latest`, compare semver, cache result in memory with timestamp. Timeout: 5s. Silent on network error.
   - `scheduleChecks()`: calls `checkForUpdates()` at startup and then every 3600s via `setInterval`
   - `getStatus()`: returns `UpdateStatus` from cache
   - `applyUpdate()`: spawns `npm install -g argus-ai-hub@latest`, streams stdout/stderr to logger, resolves on success, rejects on non-zero exit
   - `isUpdateInProgress` flag: prevents concurrent apply calls
   - Logger: `createTaggedLogger('[UpdateService]', '\x1b[33m')` (yellow)
5. Create `backend/src/api/routes/update.ts`:
   - `GET /api/v1/update/status` returns `UpdateStatus`
   - `POST /api/v1/update/apply` triggers manual update async; returns 202 if started, 409 if in progress, 503 if no update available
6. Extend `backend/src/api/routes/health.ts`: include `updateAvailable` and `latestVersion` from `updateService.getStatus()` in the response (requires injecting `updateService` reference via module-level setter, matching pattern used by `setSlackServices`)
7. Wire `UpdateService` in `backend/src/server.ts`: instantiate, call `scheduleChecks()`, pass to health route via setter
8. **Tests** (written first): `backend/tests/unit/update-service.test.ts`, `backend/tests/contract/update.test.ts`

### Phase 2: Exit Integration

**Goal**: Apply update on SIGINT/SIGTERM when enabled. Print monitoring-paused notice.

**Tasks**:
1. Extend SIGINT/SIGTERM handlers in `backend/src/server.ts`:
   - After `telemetryService.sendEvent('app_ended')` and before `process.exit(0)`:
     - If `config.autoUpdate && updateService.hasUpdate() && !updateService.isUpdateInProgress`
     - Print to stdout: `Applying update to v{latestVersion}. Active monitoring paused until update is applied and server is restarted.`
     - Await `updateService.applyUpdate()` with a 25-second hard timeout
     - On failure: log warning, continue to `process.exit(0)`
2. **Tests**: extend `update-service.test.ts` to cover `applyUpdate` timeout and failure paths

### Phase 3: Frontend Notification Badge

**Goal**: Persistent update-available badge visible in the header from any page.

**Tasks**:
1. Extend `getHealth()` return type in `frontend/src/services/api.ts` to include `updateAvailable?: boolean` and `latestVersion?: string`
2. Add `getUpdateStatus()` function to `frontend/src/services/api.ts` hitting `GET /api/v1/update/status`
3. Create `frontend/src/hooks/useUpdateStatus.ts`: wraps `getUpdateStatus` with `useQuery`, `refetchInterval: 60_000`, `staleTime: 55_000`
4. Create `frontend/src/components/UpdateBadge/UpdateBadge.tsx`:
   - Renders a small yellow dot or "Update available" chip when `updateAvailable === true`
   - Uses `Badge` shared component; no raw styled spans
   - Includes `title` and `aria-label` with version info for accessibility
5. Mount `UpdateBadge` in `DashboardPage.tsx` header, adjacent to the settings gear button (inside the `relative` wrapper `div` at line 289)
6. **Tests**: `UpdateBadge.test.tsx` unit tests for visible/hidden states

### Phase 4: Settings Panel Integration

**Goal**: Auto-update toggle and update details in the Settings panel.

**Tasks**:
1. Extend `GeneralSettingsContent` (or `SettingsPanel`) to show:
   - Current version (already present as changelog link)
   - "Update available: v{latestVersion}" notice when applicable, using the `Badge` component
   - "Update now" button (uses `Button` shared component, `variant="primary"`, `size="sm"`) that calls `POST /api/v1/update/apply`
   - Progress state during manual apply (disable button, show "Updating..." label)
   - Restart prompt after successful manual apply: a dismissible banner using existing error banner pattern but with blue/info styling
   - Error message on failure following UX Error Message rules (CLAUDE.md)
2. Add auto-update toggle: a `Checkbox` component labelled "Auto-update on exit" bound to `settings.autoUpdate` via the existing `onToggle` prop mechanism
3. **Tests**: SettingsPanel tests for all update UI states

### Phase 5: Documentation

**Tasks**:
1. Update `README.md`: add "Auto Update" section describing default behaviour, how to disable, and the monitoring-paused exit notice
2. Update `docs/README-CONTRIBUTORS.md`: describe the `UpdateService` and the new `/api/v1/update/*` endpoints

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Update source | npm registry JSON API (`registry.npmjs.org`) | Argus is distributed via npm; same source as installs; no auth required |
| Semver comparison | String comparison of `major.minor.patch` tuples | Simple, no extra dependency needed for this use case |
| Check interval | 1 hour (`setInterval` in UpdateService) | Matches FR-001; infrequent enough to avoid rate-limiting |
| Update mechanism | Spawn `npm install -g argus-ai-hub@latest` | Same command users run manually; no parallel mechanism needed |
| Preference storage | `autoUpdate` field in `~/.argus/config.json` | Existing config persistence pattern; no new storage mechanism |
| Health endpoint extension | Add `updateAvailable`/`latestVersion` to existing `/api/health` | SettingsPanel already polls this; avoids a second request |
| Separate status endpoint | `GET /api/v1/update/status` | Provides full UpdateStatus for the header badge polling; health endpoint keeps its focused role |
| Badge placement | Adjacent to the settings gear in `DashboardPage` header | Visible from all views; consistent with header-as-action-bar pattern |
| Color assignment | `[UpdateService]` → yellow `\x1b[33m` | Next unassigned color per CLAUDE.md color table |

## Complexity Tracking

No constitution violations to justify.
