# Research: Argus Auto Update

**Phase**: 0 | **Date**: 2026-05-04 | **Feature**: [spec.md](spec.md)

## npm Registry Version Check

**Decision**: Use `https://registry.npmjs.org/argus-ai-hub/latest` (unauthenticated GET, returns JSON with `version` field)

**Rationale**: The `/latest` dist-tag endpoint is the simplest stable contract — one field (`version`), no auth, low latency. Using `npm view argus-ai-hub version` (subprocess) was considered but spawning a process for a version check is unnecessarily heavy.

**Alternatives considered**:
- `npm view` subprocess: works but spawns a process on every check; rejected
- `npm-check-updates` package: brings in a heavy dependency for a simple check; rejected
- GitHub Releases API: not canonical; version on npm may lag a release; rejected

## Semver Comparison

**Decision**: Parse `major.minor.patch` from both version strings, compare as integer tuples. No library.

**Rationale**: Both versions are well-formed semver from npm. A two-line comparator covers all cases. Pulling in `semver` package is disproportionate.

**Alternatives considered**:
- `semver` npm package: correct and battle-tested, but only needed for pre-release range resolution; rejected as over-engineering for this use case

## Update Application Mechanism

**Decision**: Spawn `npm install -g argus-ai-hub@latest` as a child process, stream output to logger, await exit code.

**Rationale**: This is exactly what users do manually. It respects the user's existing npm prefix and permissions with no new mechanism.

**Alternatives considered**:
- Direct file replacement: fragile, platform-specific, bypasses npm's dependency resolution; rejected
- `npm update -g`: updates to the latest satisfying the installed range, which may not be `latest`; rejected
- Dedicated updater binary: overkill for an npm package; rejected

## Exit Sequence Timeout

**Decision**: 25-second hard timeout on `applyUpdate()` during exit. On timeout, log a warning and proceed to `process.exit(0)`.

**Rationale**: SC-003 requires the exit sequence to complete within 30 seconds. The npm install step is the longest part; 25 seconds leaves a 5-second buffer for the rest of shutdown. If install is still running at 25s, it is likely stalled (slow network, registry down) and proceeding is correct.

## Check Interval

**Decision**: Check at startup, then every 4 hours (14400 seconds) via `setInterval`. The interval is configurable via `updateCheckIntervalHours` in `~/.argus/config.json`.

**Rationale**: 4 hours is a reasonable default for a background update check that avoids unnecessary npm registry traffic. Startup check ensures the badge appears quickly (SC-001) without waiting for the first interval to elapse.

## Frontend Polling

**Decision**: `useUpdateStatus` hook uses TanStack Query `refetchInterval: 60_000`. Separate from the `health` query.

**Rationale**: The health query in SettingsPanel uses `staleTime: Infinity` (no polling). The badge in the header needs periodic refresh. A separate hook with its own query key avoids mutating the health query's caching behavior.

## Badge Placement

**Decision**: Place the `UpdateBadge` component inside the existing `<div className="relative" ref={settingsRef}>` wrapper in `DashboardPage.tsx` header (line 289), as an absolute-positioned dot indicator overlaying the settings gear icon.

**Rationale**: Follows the existing relative-positioned wrapper pattern already used for the settings panel popup. Keeps the badge visually tied to the settings entry point where the user will act on it, while remaining visible from any page.

## Color Assignment for UpdateService Logger

**Decision**: Yellow `\x1b[33m` for `[UpdateService]`.

**Rationale**: Next unassigned color in the CLAUDE.md color table. Magenta=PtyRegistry, Cyan=Teams, Green=Slack. Yellow is visually distinct and appropriate for an informational/update-related component.
