# Research: 025-yolo-mode

## Decision Log

### 1. Correct CLI flags

**Decision**: `--dangerously-skip-permissions` for Claude Code, `--allow-all` for GitHub Copilot CLI.

**Rationale**: Confirmed by searching existing test files in `backend/tests/launch-command-resolver.test.ts` and reviewing Claude Code documentation. The user initially guessed `--dangerously-skip-all-permissions` but the actual flag is the shorter form. `--allow-all` for Copilot is the standard bypass flag for the Copilot CLI.

**Alternatives considered**: `--dangerously-skip-all-permissions` (incorrect, too long). `--yes` / `--no-confirm` (Copilot, but `--allow-all` is the canonical bypass flag).

---

### 2. Where to persist yolo mode

**Decision**: Store in backend `ArgusConfig` (`~/.argus/config.json`), not in frontend `localStorage`.

**Rationale**: Yolo mode affects command construction on the backend (PTY launch path). Storing it in `localStorage` would only affect the frontend copy path and would be invisible to the backend PTY launch. Since the spec requires consistent behavior across both paths, it must live in the backend config.

**Alternatives considered**: `localStorage` only (rejected: backend PTY path would not see it). Separate config file (rejected: unnecessary complexity; `ArgusConfig` is the right home).

---

### 3. Flag injection point

**Decision**: Inject flags in `buildLaunchCmdBase()` in `tools.ts` by passing `yoloMode` as a parameter.

**Rationale**: Both the clipboard copy path (`GET /api/v1/tools`) and the PTY launch path (`POST /api/v1/sessions/launch-terminal`) call `buildLaunchCmdBase()`. A single parameter change covers both paths with no duplication.

**Alternatives considered**: Inject at the `launch.ts` CLI level by reading config there (rejected: the CLI does not have access to the backend config; it only receives the command string).

---

### 4. Warning dialog trigger point

**Decision**: Warning dialog is triggered in `SettingsPanel` when the user attempts to toggle yolo mode on.

**Rationale**: The backend does not track whether the warning was shown; it simply stores the boolean. The frontend is responsible for confirming intent before calling `PATCH /api/v1/settings`. This follows the existing pattern for destructive confirmations in UI.

**Alternatives considered**: Server-side confirmation token (rejected: over-engineered for a localhost tool). Backend always shows warning (N/A: backend has no UI).

---

### 5. useArgusSettings hook placement

**Decision**: Create a new `useArgusSettings` hook in `frontend/src/hooks/useArgusSettings.ts`.

**Rationale**: The existing `useSettings` hook manages `DashboardSettings` (localStorage). Yolo mode is a backend setting and requires React Query for caching and invalidation. Keeping them separate avoids mixing concerns.

**Alternatives considered**: Extend `useSettings` to also manage backend settings (rejected: mixes two distinct persistence layers).
