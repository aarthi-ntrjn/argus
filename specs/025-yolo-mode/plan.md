# Implementation Plan: Yolo Mode Launch Setting

**Branch**: `025-yolo-mode` | **Date**: 2026-04-11 | **Spec**: specs/025-yolo-mode/spec.md
**Input**: Feature specification from `/specs/025-yolo-mode/spec.md`

## Summary

Add a persistent `yoloMode` backend setting that, when enabled (after user confirms a warning dialog), injects `--dangerously-skip-permissions` into all Claude Code launch commands and `--allow-all` into all Copilot launch commands. Injection applies to both the PTY launch path (backend spawns terminal) and the clipboard copy path (frontend copies command string).

## Technical Context

**Language/Version**: TypeScript 5.x (backend Node.js 20, frontend React 18 + Vite)
**Primary Dependencies**: Fastify (backend API), React Query (frontend data fetching), Tailwind CSS (frontend styling)
**Storage**: `~/.argus/config.json` (existing key-value config file managed by `config-loader.ts`)
**Testing**: Vitest + Supertest (backend), Vitest + React Testing Library (frontend)
**Target Platform**: Windows 11 / macOS (localhost only)
**Project Type**: Web application (frontend + backend monorepo)
**Performance Goals**: No new async paths; config read is synchronous and already fast
**Constraints**: Setting must survive server restart (backend config, not localStorage)
**Scale/Scope**: Single-user localhost tool

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering (reliable, observable, testable) | PASS | Config fallback already handles corrupt file; yolo state logged at launch |
| §II Architecture (versioned API, no cross-db access) | PASS | Extends existing `/api/v1/settings` endpoint |
| §III Code Standards (readable, < 50 lines/fn) | PASS | All new functions are < 20 lines |
| §IV Test-First (tests before implementation) | PASS | Tests written first per task ordering |
| §V Testing (unit + integration + e2e per feature) | PASS | Backend contract tests + frontend component tests |
| §VI Security (auth/authz or localhost exception) | EXCEPTION | Single-user localhost tool; §VI exception declared in spec |
| §VII Observability (structured logs) | PASS | Log yolo mode state at PTY spawn time |
| §VIII Performance (p95 < 500ms, or exception) | EXCEPTION | Single-user localhost tool; §VIII exception declared in spec |
| §IX AI Usage | N/A | |
| §X Definition of Done | PASS | All DoD items included in final phase |
| §XI Documentation (README update) | PASS | README update task in final phase |
| §XII Error Handling | PASS | Config load already has fallback; UX error messages are human-friendly |

## Project Structure

### Documentation (this feature)

```text
specs/025-yolo-mode/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # N/A — no new database entities
└── tasks.md             # Phase 2 output (from /speckit.tasks)
```

### Source Code (affected files)

```text
backend/
├── src/
│   ├── models/
│   │   └── index.ts                        # Add yoloMode to ArgusConfig
│   ├── config/
│   │   └── config-loader.ts                # Add yoloMode default
│   └── api/routes/
│       ├── settings.ts                     # Add yoloMode to ALLOWED_KEYS
│       └── tools.ts                        # Inject yolo flags when yoloMode is true
└── tests/
    ├── contract/
    │   ├── settings.test.ts                # Add yoloMode GET/PATCH tests
    │   └── tools.test.ts                   # New: test yolo flag injection
    └── unit/
        └── yolo-flags.test.ts              # New: unit test for flag logic

frontend/
├── src/
│   ├── types.ts                            # Add yoloMode to ArgusConfig
│   ├── hooks/
│   │   └── useArgusSettings.ts             # New: React Query hook for backend settings
│   └── components/
│       ├── SettingsPanel/
│       │   └── SettingsPanel.tsx           # Add yolo mode toggle section
│       └── YoloWarningDialog/
│           └── YoloWarningDialog.tsx       # New: warning confirmation dialog
└── src/__tests__/
    ├── SettingsPanel.test.tsx              # Extend with yolo mode tests
    └── YoloWarningDialog.test.tsx          # New: dialog tests

README.md                                   # Document yolo mode
```

## Phase 0: Research

See `research.md`.

## Phase 1: Design

No new database entities required. The `ArgusConfig` interface gains one scalar boolean field. See below for the exact contract changes.

### ArgusConfig extension

```typescript
// backend/src/models/index.ts  AND  frontend/src/types.ts
export interface ArgusConfig {
  port: number;
  watchDirectories: string[];
  sessionRetentionHours: number;
  outputRetentionMbPerSession: number;
  autoRegisterRepos: boolean;
  yoloMode: boolean;              // NEW
}
```

Default in `config-loader.ts`:
```typescript
const DEFAULTS: ArgusConfig = {
  ...
  yoloMode: false,
};
```

### Flag injection in `tools.ts`

```typescript
const YOLO_FLAGS: Record<'claude' | 'copilot', string> = {
  claude: '--dangerously-skip-permissions',
  copilot: '--allow-all',
};

function buildLaunchCmdBase(tool: 'claude' | 'copilot', yoloMode = false): string {
  const toolArg = tool === 'copilot' ? 'copilot' : 'claude';
  const base = `npm --prefix "${ARGUS_ROOT}" run launch --workspace=backend -- ${toolArg}`;
  return yoloMode ? `${base} ${YOLO_FLAGS[tool]}` : base;
}
```

Route handlers load config and pass `yoloMode`:
- `GET /api/v1/tools` returns `claudeCmd` and `copilotCmd` with yolo flags when enabled.
- `POST /api/v1/sessions/launch-terminal` builds the PTY command with yolo flags when enabled.

### YoloWarningDialog contract

```typescript
interface YoloWarningDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
```

Dialog contains:
- Title: "Enable Yolo Mode"
- Body: Warning text about bypassing all permission checks and safety prompts.
- Two buttons: "Enable Yolo Mode" (destructive/red) and "Cancel".

### useArgusSettings hook

```typescript
function useArgusSettings(): {
  settings: ArgusConfig | undefined;
  isLoading: boolean;
  patchSetting: (patch: Partial<ArgusConfig>) => Promise<void>;
}
```

Uses `useQuery` for fetch and `useMutation` + `queryClient.invalidateQueries` for updates.

### SettingsPanel changes

- Add a section separator and a "Launch Behaviour" heading.
- Add a checkbox/toggle row for "Yolo Mode".
- When toggling on: intercept the change, show `YoloWarningDialog`. Confirm saves; cancel reverts.
- When toggling off: directly call `patchSetting({ yoloMode: false })` with no dialog.
- When `yoloMode` is true: show a yellow warning label next to the toggle text.

## API Contract

### GET /api/v1/settings

No breaking change. Response now always includes `yoloMode: boolean`.

```json
{
  "port": 7411,
  "watchDirectories": [],
  "sessionRetentionHours": 24,
  "outputRetentionMbPerSession": 10,
  "autoRegisterRepos": false,
  "yoloMode": false
}
```

### PATCH /api/v1/settings

No breaking change. `yoloMode` is now an accepted key.

```json
// Request
{ "yoloMode": true }

// Response: full updated config
{ ..., "yoloMode": true }
```

### GET /api/v1/tools (behavioural change)

When `yoloMode` is `true`, `claudeCmd` and `copilotCmd` include the yolo flag:

```json
{
  "claude": true,
  "copilot": true,
  "claudeCmd": "npm --prefix \"/path/to/argus\" run launch --workspace=backend -- claude --dangerously-skip-permissions",
  "copilotCmd": "npm --prefix \"/path/to/argus\" run launch --workspace=backend -- copilot --allow-all"
}
```

### POST /api/v1/sessions/launch-terminal (behavioural change)

When `yoloMode` is `true`, the spawned terminal command includes the yolo flag for the given tool.
