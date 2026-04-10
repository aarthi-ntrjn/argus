# Tasks: Test GitHub Copilot CLI (GHCP) Launch with Argus

**Branch**: `022-test-ghcp-launch`
**Status**: Complete

## Phase 1 — Core Detection & API Fixes

- [X] T101 [P1] [Story 1] Fix CopilotCliDetector to skip already-ended session dirs (perf: no rescan)
- [X] T102 [P1] [Story 1] Stop retrying claimForSession for read-only copilot sessions every scan
- [X] T103 [P1] [Story 1] Only attempt PTY claim for copilot sessions on first discovery
- [X] T104 [P1] [Story 3] Claim copilot sessions via workspace_id WS message (not repoPath matching)
- [X] T105 [P1] [Story 3] Separate hostPid (shell wrapper) from pid (tool process) in session tracking

## Phase 2 — PTY Launch Stability

- [X] T111 [P1] [Story 3] Guard claimForSession with isRunning to prevent ended sessions stealing pending PTY WS
- [X] T112 [P1] [Story 3] Preserve launchMode:pty on session end; re-link only when process still running
- [X] T113 [P1] [Story 3] Re-claim WS on restart, add reconnect to ArgusLaunchClient, guard readyState
- [X] T114 [P1] [Story 3] Fix CopilotCliDetector to claim PTY connection when argus launch is pending
- [X] T115 [P1] [Story 3] Guard re-claim with isRunning check

## Phase 3 — Observability

- [X] T121 [P2] [Story 1] Log hook_event_name on each incoming hook request
- [X] T122 [P2] [Story 1] Add prompt-flow debug logs to trace send_prompt path
- [X] T123 [P2] [Story 1] Derive lastActivityAt from JSONL watcher, drop redundant hook events

## Phase 4 — Test Fixes

- [X] T131 [P1] [Story 1] Fix sessions.test.ts to use in-memory DB (prevent parallel test conflicts)
- [X] T132 [P1] [Story 1] Update copilot-cli-detector test to match current ended-session skip behavior
