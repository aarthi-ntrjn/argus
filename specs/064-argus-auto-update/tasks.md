# Tasks: Argus Auto Update

**Branch**: `064-argus-auto-update` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Phase 1: Setup — Shared Type and Config Foundations

**Goal**: Extend `ArgusConfig` and the config loader with the `autoUpdate` field. All later phases depend on this gate.

**Independent Test**: Backend compiles and existing settings tests pass with the new field present and defaulting to `true`.

- [x] T001 [US1 US2 US3 US4] Add `autoUpdate: boolean` to `ArgusConfig` interface in `backend/src/models/index.ts`
- [x] T002 [P] [US1 US2 US3 US4] Add `autoUpdate: true` to `DEFAULTS` in `backend/src/config/config-loader.ts`
- [x] T003 [P] [US1 US2 US3 US4] Add `'autoUpdate'` to `ALLOWED_KEYS` set in `backend/src/api/routes/settings.ts`

> **CRITICAL GATE**: T001–T003 must be complete before any Phase 2 task starts.

---

## Phase 2: Foundational — UpdateService and API Routes

**Goal**: Backend `UpdateService` with version checking, update application, and REST endpoints. All tests written first per §IV.

**Independent Test**: `GET /api/v1/update/status` returns well-shaped JSON; `POST /api/v1/update/apply` returns 202/409/503 correctly; unit tests for `UpdateService` all pass.

- [x] T004 [US1 US2] Write failing unit tests for `UpdateService` in `backend/tests/unit/update-service.test.ts` — covers: `checkForUpdates()` returns updateAvailable when newer version exists, returns false when up-to-date, silently catches network errors; `hasUpdate()` reflects cached state; `getStatus()` returns all `UpdateStatus` fields; `applyUpdate()` resolves on zero exit code, rejects on non-zero exit code, rejects after 25-second timeout; `isUpdateInProgress` is set true during apply and cleared after
- [x] T005 [US1 US2] Implement `backend/src/services/update-service.ts` to make T004 pass: `checkForUpdates()`, `scheduleChecks()`, `getStatus()`, `applyUpdate()`, `hasUpdate()`, `isUpdateInProgress` flag; logger `createTaggedLogger('[UpdateService]', '\x1b[33m')`
- [x] T006 [P] [US1 US3] Write failing contract tests for update routes in `backend/tests/contract/update.test.ts` — covers: `GET /api/v1/update/status` response shape; `POST /api/v1/update/apply` returns 202 when update available and not in progress, 409 when in progress, 503 when no update available
- [x] T007 [US1 US3] Create `backend/src/api/routes/update.ts` to make T006 pass: `GET /api/v1/update/status` returns `UpdateStatus`; `POST /api/v1/update/apply` returns 202/409/503 per contract
- [x] T008 [P] [US1] Add `setUpdateService()` module-level setter and extend `/api/health` handler and schema in `backend/src/api/routes/health.ts` to include `updateAvailable` (boolean) and `latestVersion` (string, optional)
- [x] T009 [US1 US2 US3] Wire `UpdateService` in `backend/src/server.ts`: instantiate `updateService`, call `updateService.scheduleChecks()`, call `setUpdateService(updateService)` for health route, register update routes via `app.register(updateRoutes)`

> T004 and T006 can run in parallel (`[P]`). T005 depends on T004. T007 depends on T005 and T006. T008 depends on T005. T009 depends on T005, T007, and T008.

---

## Phase 3: P1 — Update Notification Badge (US1) and Exit Integration (US2)

**Goal**: Persistent update-available badge in the header visible from any page; auto-apply update on graceful shutdown.

**Independent Test (US1)**: Running a version older than latest shows a yellow badge in the DashboardPage header within 60 seconds of launch, on all pages. Running the latest version shows no badge.

**Independent Test (US2)**: Stopping Argus with `autoUpdate: true` and an update available prints the monitoring-paused message, applies the update, and exits within 30 seconds.

- [ ] T010 [P] [US1] Write failing unit tests for `UpdateBadge` component in `frontend/src/components/UpdateBadge/UpdateBadge.test.tsx` — covers: badge renders when `updateAvailable=true` with correct `aria-label` and version text; badge is absent when `updateAvailable=false`
- [ ] T011 [P] [US1] Extend `getHealth()` return type in `frontend/src/services/api.ts` to add `updateAvailable?: boolean` and `latestVersion?: string`; add `getUpdateStatus()` function calling `GET /api/v1/update/status`; add `UpdateStatus` response type
- [ ] T012 [US1] Create `frontend/src/hooks/useUpdateStatus.ts`: `useQuery({ queryKey: ['update-status'], queryFn: getUpdateStatus, refetchInterval: 60_000, staleTime: 55_000 })`
- [ ] T013 [US1] Create `frontend/src/components/UpdateBadge/UpdateBadge.tsx` to make T010 pass: renders a `Badge` (shared component) with `aria-label="Update available: v{latestVersion}"` and `title` when `updateAvailable` is true; no output otherwise
- [ ] T014 [US1] Mount `UpdateBadge` in `frontend/src/pages/DashboardPage.tsx` inside the `<div className="relative" ref={settingsRef}>` wrapper adjacent to the settings gear button; pass `updateAvailable` and `latestVersion` from `useUpdateStatus()`
- [ ] T015 [P] [US2] Write failing tests in `backend/tests/unit/update-service.test.ts` for the exit-handler path: `applyUpdate()` times out after 25 seconds and resolves (does not reject) so exit continues; `applyUpdate()` emits a log warning on non-zero exit code
- [ ] T016 [US2] Extend SIGINT and SIGTERM handlers in `backend/src/server.ts` to make T015 pass: after `telemetryService.sendEvent('app_ended')`, if `config.autoUpdate && updateService.hasUpdate() && !updateService.isUpdateInProgress`, print `Applying update to v{latestVersion}. Active monitoring paused until update is applied and server is restarted.` to stdout, await `updateService.applyUpdate()` with 25-second timeout wrapper, log warning on failure, then continue to `process.exit(0)`

> T010 and T011 can run in parallel (`[P]`). T015 can run in parallel with T010/T011 (`[P]`). T012 depends on T011. T013 depends on T010 and T011. T014 depends on T012 and T013. T016 depends on T015 and T009.

---

## Phase 4: P2 — Manual Update Trigger (US3)

**Goal**: "Update now" button in the Settings panel triggers an immediate update; shows progress and restart prompt on completion.

**Independent Test**: Clicking "Update now" in the Settings panel while an update is available shows a progress state, then a "Restart to apply" banner on success or an error message on failure.

- [ ] T017 [US3] Write failing tests for SettingsPanel update UI in `frontend/src/components/SettingsPanel/SettingsPanel.test.tsx` — covers: "Update available: v{latestVersion}" notice visible when `updateAvailable=true`; "Update now" button present and clickable; button shows "Updating..." and is disabled during in-progress state; restart banner appears after successful apply; error banner appears on failed apply with actionable message
- [ ] T018 [US3] Add `applyUpdate()` API function to `frontend/src/services/api.ts` calling `POST /api/v1/update/apply`; handle 409 and 503 error responses per §XII UX rules
- [ ] T019 [US3] Extend `frontend/src/components/SettingsPanel/SettingsPanel.tsx` to make T017 pass: add `useUpdateStatus()` call; render `Badge` with update-available notice; add `Button` (`variant="primary"`, `size="sm"`) labelled "Update now" that calls `applyUpdate()`; manage `isUpdating` local state to show "Updating..." and disable button; show dismissible blue restart banner on success using existing banner pattern; show dismissible red error banner on failure following UX Error Message rules

---

## Phase 5: P3 — Update Preference Control (US4)

**Goal**: Auto-update toggle in the Settings panel; preference persists to `~/.argus/config.json`.

**Independent Test**: Unchecking "Auto-update on exit" in Settings, then stopping Argus with an update available produces no update step and no monitoring-paused message.

- [ ] T020 [US4] Write failing tests for auto-update toggle in `frontend/src/components/SettingsPanel/SettingsPanel.test.tsx` — covers: `Checkbox` labelled "Auto-update on exit" renders; it is checked when `argusSettings.autoUpdate` is true (default); unchecking calls `patchSetting({ autoUpdate: false })`
- [ ] T021 [US4] Add "Auto-update on exit" `Checkbox` (shared component) to `frontend/src/components/SettingsPanel/SettingsPanel.tsx` to make T020 pass: call `useArgusSettings()` for `argusSettings` and `patchSetting`; bind checkbox to `argusSettings.autoUpdate ?? true`; on change call `patchSetting({ autoUpdate: checked })`

---

## Phase 6: Polish and Cross-Cutting

**Goal**: Documentation complete, full test suite passes, frontend build succeeds.

- [ ] T022 [P] [US1 US2 US3 US4] Update `README.md`: add "Auto Update" section describing default on-exit update behavior, how to disable (`autoUpdate: false` in config or via Settings), and the monitoring-paused message shown during exit
- [ ] T023 [P] [US1 US2 US3 US4] Update `docs/README-CONTRIBUTORS.md`: document `UpdateService` (location, responsibilities, logger color), `GET /api/v1/update/status`, `POST /api/v1/update/apply`, and the `autoUpdate` config field
- [ ] T024 [US1 US2 US3 US4] Run full backend test suite (`npm run test --workspace=backend`) and confirm all tests pass
- [ ] T025 [US1 US2 US3 US4] Run full frontend test suite (`npm run test --workspace=frontend`) and confirm all tests pass
- [ ] T026 [US1 US2 US3 US4] Run `npm run build --workspace=frontend` and confirm clean build with no type errors
