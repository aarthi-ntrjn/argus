# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.8] - 2026-05-15

### Fixed

- **Linux terminal launch on ptyxis and other modern emulators**: The Launch action wraps the command in `bash -c` so terminals that pass `-e` directly to `execve()` (such as ptyxis, now the default `x-terminal-emulator` on Debian/Ubuntu) parse the command correctly instead of failing with "Failed to find executable".
- **Claude detection in `~/.local/bin`**: The dashboard now finds and launches `claude` even when the backend process (e.g. started via `npx`) does not inherit `~/.local/bin` in `PATH`. The absolute path is also baked into the launch command so the spawned terminal works regardless of its own `PATH`.

## [1.0.7] - 2026-05-14

### Fixed

- **Installed tool detection**: Refresh detection of installed AI tools so the dashboard accurately reflects which CLIs are available.

### Changed

- **Landing page**: Moved prerequisites into the step cards (Node.js 22+ in Install, cloned repo requirement in Add Repositories). Added a bold statement in the Monitor section clarifying that Argus is an add-on, not a CLI replacement.

## [1.0.6] - 2026-05-14

### Added

- **Integrations enabled by default**: Teams and Slack buttons now always show in the dashboard header, even when not configured, so users can discover and set them up.

### Fixed

- **Optimistic todo deletion**: Deleting a todo now removes it from the UI instantly instead of waiting for two server round trips.
- **Frontend unit tests on Node v25**: Added an in-memory localStorage polyfill to work around Node.js v25's broken native localStorage that broke all tests using localStorage.
- **E2E settings selector**: Fixed strict mode violations in e2e tests caused by integration buttons matching the settings button selector.

### Changed

- **Config flag renamed**: Replaced `integrationsEnabled` with `integrationsDisabled` (defaults to `false`, never written to config file). Existing configs with the old flag are cleaned up automatically.

## [1.0.5] - 2026-05-14

### Added

- **Auto-open browser**: Running `argus` now automatically opens the dashboard in your default browser. Use `--no-open` to skip.

## [1.0.4] - 2026-05-14

### Fixed

- **Missing runtime dependencies**: Backend dependencies (`@microsoft/teams.apps`, `@slack/web-api`, `@slack/socket-mode`, `@azure/msal-node`, `jose`, `koffi`) were only listed in the workspace `backend/package.json`, not in the root. Global installs would fail at startup with `ERR_MODULE_NOT_FOUND`.

## [1.0.3] - 2026-05-14

### Fixed

- **CLI permission denied**: The `bin/argus.js` entry point was missing the executable bit, causing `zsh: permission denied` when running `argus` after a global install.

## [1.0.2] - 2026-05-14

### Fixed

- **npm install failure**: The postinstall script (`fix-node-pty-helper.mjs`) was missing from the published npm package, causing `npm install -g argus-ai-hub` to fail with exit code 1. Added the script to the `files` array in `package.json`.

## [1.0.1] - 2026-05-13

### Fixed

- **E2E test suite**: All mock spec files now correctly seed `seenSessionSteps: true` in onboarding state, preventing the session catch-up tour from blocking pointer events during tests. The first-load tour step count and Settings button selector in the onboarding spec were also corrected.

## [1.0.0] - 2026-05-13

### Added

- **Landing page analytics**: The landing page now includes PostHog telemetry to track page visits and version. See the privacy policy for details.

### Fixed

- **Repository PR link encoding**: The "Open pull request" link on repository cards now uses the correct `/compare` URL with proper slash encoding, so it opens the right GitHub comparison page.

### Changed

- **Onboarding restructured into 3 progressive tours**: The single onboarding walkthrough has been replaced with three targeted tours. The first-load tour introduces the dashboard on a new install. A repo catch-up tour fires the first time a repository is added. A session catch-up tour fires the first time a session appears, highlighting session cards and integrations.
- **Auto-update on exit moved to About tab**: The "Auto-update on exit" toggle has been moved from the General tab to the About tab in the Settings dialog, keeping update-related controls together.
- **Documentation refresh**: The README has been comprehensively updated with new screenshots, a restructured navigation flow, consolidated Teams and Slack integration docs under "Roaming Integrations", and a new Supported Platforms section.

## [0.1.18] - 2026-05-10

### Added

- **Bash and tool approval cards**: When a Claude Code or Copilot CLI session runs without auto-approval (no `--yolo` / `--allow-all`), any tool that requires confirmation now surfaces an interactive approval card on the session card. The card shows the tool name and input, with tier-aware choices: bash-tier tools offer a permanent per-project "don't ask again" option; file-edit tools offer a session-scoped option; Copilot CLI tools offer once/session/reject.

### Fixed

- **Approval card instant dismiss**: Selecting a choice or typing an answer in the prompt bar now dismisses the approval card immediately (optimistic dismiss) rather than waiting for a server acknowledgement.
- **Copilot double approval card**: Commands such as `curl` that emit two `permission.requested` JSONL events no longer show the approval card twice. The first event shows the card; subsequent events silently update the tracked tool call ID so auto-dismiss still works.
- **AskUserQuestion and wildcard hooks**: Claude Code's `settings.json` now registers both an `AskUserQuestion`-matcher entry and a wildcard entry for `PreToolUse`/`PostToolUse`, ensuring all tool events reach Argus.
- **Prevent duplicate Copilot sessions on repo add**: Adding a repository that already has a running Copilot session no longer creates a duplicate session row.
- **node-pty spawn-helper chmod**: The `chmod` for the node-pty spawn helper binary is now scoped to macOS only, preventing errors on Windows and Linux.
- **ESC interrupt for Copilot CLI approval**: Pressing Esc in the approval panel now correctly sends the "No" choice rather than a raw escape byte, so the Copilot CLI agent receives a proper rejection.
- **npm vulnerability**: Resolved a fast-uri audit vulnerability.

## [0.1.17] - 2026-05-09

### Added

- **Tool call count badge**: Session cards now show a spinning overlay badge with a live tool call count while the AI is processing tool calls. The badge fades in when tool calls begin and disappears when the AI is idle.
- **Prompt clear on send**: The previous AI reply is cleared from the session card preview when the user sends a new prompt, so the card always reflects the current exchange.
- **Repo card GitHub links**: Repository cards now show a clickable branch chip that links to the branch on GitHub, and a PR indicator that opens a new pull request for that branch. Both links open in a new tab.
- **Pending session card**: A placeholder spinner card now appears in the session list the moment a user clicks "Launch with Argus", providing immediate visual feedback before the session connects.
- **Todo list filter**: The add-todo input field now doubles as a live filter for the todo list. Typing narrows the rows in real time; pressing Enter adds a new item. The Delete key removes a focused todo row.
- **Copilot CLI hooks integration**: Copilot CLI sessions now participate in the Attention Needed (pending choice) system via hooks, unified with the Claude Code hook pipeline. Session lifecycle events and ask_user prompts are handled consistently across both AI platforms.

### Fixed

- **Security**: Upgraded `@fastify/static`, `fastify`, and `postcss` to patch known vulnerabilities.
- **Integration update noise**: Eliminated duplicate session.updated broadcasts to Teams and Slack caused by `lastActivityAt` changes and resting-state transitions.
- **Integration status push**: Integration start/stop status is now broadcast via WebSocket immediately on change, rather than requiring a page refresh.
- **Focus-refetch eliminated**: Queries driven by WebSocket (sessions, todos, settings, available tools, update status) no longer silently re-fetch when the browser tab regains focus.
- **Update status push**: The software update status is now pushed via WebSocket rather than polled every 60 seconds.
- **Process identity verification**: `isExpectedProcess` now fails closed when process identity cannot be verified, preventing ghost PID false-positives from OS PID reuse.
- **Tool group stream jump**: In-flight `tool_use` entries are now folded into the active tool group to prevent the output stream from jumping mid-render.
- **Launch script path**: Fixed a broken launch path (dist/cli to dist/launch-pty) introduced by the backend source reorganization.
- **Notifier seeding**: Active sessions are now seeded into Teams and Slack notifiers on startup, so integrations receive updates for sessions that were already running when the notifier initialized.

---

## [0.1.16] - 2026-05-04

### Added

- **Auto-update**: Argus now checks for new versions automatically on a configurable schedule (default: every 4 hours). An update badge appears in the header when a new release is available, and an auto-update toggle in the Settings panel lets users enable or disable automatic updates.

### Fixed

- **Update button placement**: The update button has been moved to the header with a corrected badge layout for consistent positioning.

---

## [0.1.15] - 2026-05-03

### Added

- **Choice panel, type your own answer**: Both Claude Code and Copilot sessions now show a "Type your own answer" button in the Attention Needed panel. Clicking it forwards the implicit choice number to the prompt bar and focuses it; submitting sends the choice number and custom text together as a single action. Typing directly in the prompt bar while a choice is pending also routes through the same path automatically.
- **Choice panel, Esc to interrupt**: The Reject button has been replaced with a gray "Press Esc to interrupt" button, and the Escape key in the prompt bar now sends a raw ESC signal directly to the PTY for application-level interruption.
- **Attention Needed auto-dismiss**: The Attention Needed banner now dismisses automatically when the session is interrupted or when a clarify rejection is detected.
- **Session detail page, repo context bar**: Repository and branch context is now shown in a dedicated RepoContextBar on the session detail page only, instead of being embedded in the output pane header.
- **Teams and Slack integration**: Full Teams and Slack notification integrations with start/stop controls in the header, an editable Settings dialog with General/Teams/Slack tabs, standalone setup guide pages, and a 4-state connection UX (unconfigured, stopped, connecting, connected). Supports prompt injection from Teams and Slack threads.
- **Settings panel links**: The Settings panel version row now links to the website, GitHub repository, and npm package. A feedback row provides quick links to file bug reports and feature requests.
- **Telemetry enrichment**: Telemetry events now include OS platform and architecture. Location enrichment is provided via PostHog native GeoIP. Integration status is reported as a rich enum instead of a boolean.

### Fixed

- **ESC interrupt**: ESC prompt now correctly triggers the interrupt path regardless of the `skipEnter` flag.
- **Session page, ended banner**: Ended sessions now display a dead-session banner in place of the prompt bar.
- **Dashboard, session selection**: The selected session is now preserved on page refresh by deferring auto-switch until sessions have loaded.
- **Copilot ask_user, no choices**: The Attention Needed panel now correctly displays the question text when the ask_user tool provides no numbered choices (T126).
- **Process detection**: Ghost PID guard added to ClaudeCodeDetector; process name is verified against the lock file PID to prevent false-positives from PID reuse; copilot.exe.old is handled correctly during auto-update.
- **Telemetry**: Duplicate session_ended events are suppressed across all end paths for PTY Claude sessions.
- **Logging**: Log level labels are now colorized and timestamps use local time in createTaggedLogger output.
- **Output pane header**: Branch badge, diff link, and session GUID are now positioned consistently to match the repository card layout.

### Changed

- **Process utilities (Windows)**: Replaced PowerShell and WMI process spawns with koffi FFI and NtQueryInformationProcess for significantly lower-overhead process name and command-line lookup on Windows.
- **Backend logging**: All backend components standardized to createTaggedLogger with colored component tags and structured output.

---

## [0.1.14] - 2026-04-21

### Added

- **Supported CLIs in Settings**: A new "Supported CLIs" row appears in the Settings panel above the About section, with icon buttons linking to the Claude Code and GitHub Copilot CLI documentation pages.
- **CLI login and trust reminder**: The Launch dropdown now shows a persistent footer reminding users to log in to the CLI and trust the folder before Argus can fully control the session.

### Fixed

- **Mac PTY launcher**: Fixed the PTY-based launcher on macOS so sessions start correctly.
- **Mac JSONL event watcher**: Fixed the JSONL file watcher not firing on macOS by enabling persistent watching, ensuring session events are detected reliably.
- **CLI icons on install links**: The no-tools panel in the Launch dropdown now shows the Claude Code and GitHub Copilot icons next to each install link for quick visual identification.
- **Diff link icon**: The "View diff on GitHub" link in repository cards now uses a distinct GitCompare icon, distinguishing it from the session details link.

---

## [0.1.13] - 2026-04-21

### Added

- **Tilde path expansion**: Repository paths and folder scans now accept `~/` and `~\` notation (e.g. `~/projects`) on all platforms, expanding to the home directory automatically.

### Fixed

- **No-tools install guidance**: When no supported AI tools are detected, the Launch dropdown now shows an actionable panel with direct install links for Claude Code and GitHub Copilot CLI, replacing the previous generic error message.

---

## [0.1.12] - 2026-04-21

### Fixed

- **Send prompt on non-Windows**: Sending a prompt from the Argus UI now correctly submits it in Claude Code sessions running on Linux and macOS. The fix replaces a Windows-only keyboard input path with a cross-platform `pty.write('\r')` call so the enter key is always delivered.

---

## [0.1.11] - 2026-04-21

### Added

- **Prompt history navigation**: Up/down arrow keys in the session prompt bar now cycle through the last 50 sent prompts, with draft text preserved when navigating back past the newest entry. Terminal messages typed directly in Claude/Copilot sessions are included in history and kept in sync live, with deduplication so bar-sent prompts do not appear twice.
- **History position indicator**: A compact overlay inside the prompt input shows the current navigation position (e.g. `1 / 3`) while browsing history, with no layout shift on appear or dismiss.
- **Version display in Settings**: The About section of the Settings panel now shows the running server version (e.g. `v0.1.9`), fetched from the health endpoint.

### Fixed

- **Launch error messages**: When "Launch with Argus" fails, errors now appear in the page-level dismissible banner with a clear, actionable message (e.g., "Failed to launch session. The Argus server is unreachable.") instead of a raw network error above the button.
- **Dashboard layout jank**: Fixed layout reflow on page load by matching the loading skeleton pane proportions to the actual layout. Also fixed a flex overflow on the right pane that caused the session list to shrink unexpectedly when output pane content was wide.
- **Server version endpoint**: Fixed `/api/health` returning `1.0.0` instead of the correct version by reading from the root `package.json`.
- **Telemetry banner**: Fixed the banner appearing on the dashboard after repositories had already been added.

---

## [0.1.9] - 2026-04-20

### Added

- **Markdown preview**: session card output stream now renders markdown formatting
- **Copilot ask_user UX**: pending choice prompts from the Copilot `ask_user` tool are now broadcast via WebSocket and displayed in the UI

### Fixed

- Removed dead `@homebridge/node-pty-prebuilt-multiarch` dependency that broke installation on Node 25
- Skip submit panel when an `ask_user` question has only one option
- Advance `PendingChoicePanel` index correctly when user types via the session prompt bar

### Changed

- CI pipeline now enforces `--engine-strict` on `npm ci`

---

## [0.1.8] - 2026-04-19

### Added

- **Feedback menu**: GitHub feedback dropdown in Settings panel with bug report and feature request links
- **About section**: Settings panel now includes links to the website, GitHub repo, and npm package
- **Why Argus section**: landing page section explaining the attention and context-switching problem
- **Privacy callout pills**: landing page How It Works section highlights privacy and telemetry posture
- **Colored tagged logger**: `createTaggedLogger` utility for component-level colored log prefixes
- **PID-based session pre-linking**: sessions launched via Argus are now linked by PID immediately, replacing the slower repo path scan

### Fixed

- Sticky header with border-bottom in the dashboard, matching the landing page nav style
- Sidebar height and To Tackle panel now fill available viewport height correctly
- Send button in session prompt bar replaced with a paper-plane SVG icon, properly centered
- Error banner padding tightened and user-facing error messages made more descriptive on repo remove failure
- PTY registry now supports multiple pending launchers per repo path
- Active directory paths seeded from DB on server startup instead of requiring a full scan
- Landing page hero headline centered and full-width; telemetry and privacy pill text updated

---

## [0.1.7] - 2026-04-19

### Added

- **Unified output ID scheme**: byte-offset plus block-index for both Claude and Copilot parsers, ensuring stable IDs across server restarts
- **JsonlWatcherBase**: shared watcher logic extracted into a base class, fixing tail-read behavior and clear-on-attach

### Fixed

- Spaces in repo paths are now escaped when resolving the Claude project directory name
- Trailing slashes stripped from repo paths on insert and lookup
- Warning logged when a session working directory does not match any registered repository

---

## [0.1.6] - 2026-04-18

### Fixed

- Publish scripts (`/publish`, `/publish-npm`) guarded against accidental invocation
- Null return from `execSync` (when `stdio` is `inherit`) handled in both publish scripts

---

## [0.1.5] - 2026-04-18

### Added

- **Headless environment detection**: Argus detects SSH and Codespaces environments on startup and skips terminal launch automatically
- **Headless launch UX**: LaunchDropdown redesigned with inline copy icon per row; clicking a row in headless mode copies the command to clipboard
- **Headless hint**: hint shown at the bottom of the launch menu in headless environments
- **Cross-platform scripts**: `.mjs` equivalents added for all PowerShell automation scripts
- Ubuntu added to tested-on badges in the landing page

### Fixed

- PTY input: focus-in/out xterm sequences sent before prompt delivery on POSIX
- PTY write used for prompt delivery on POSIX instead of Win32 input sequences
- Copilot process identified by command line (not `comm`) on Linux and Mac

---

## [0.1.4] - 2026-04-18

### Added

- `--version` / `-v` flag for the `argus` CLI binary
- Uninstall and Cleanup section added to README

### Fixed

- Manual command shown when no terminal is available (headless environments and Codespaces)
- Linux terminal handling stabilized; server no longer crashes on launch in Linux environments

---

## [0.1.3] - 2026-04-18

### Fixed

- `npx argus-ai-hub` now calls the compiled `launch.js` directly instead of using `npm --workspace`, fixing launch failures in published packages

---

## [0.1.2] - 2026-04-18

### Fixed

- Added `argus-ai-hub` bin entry to `package.json` so `npx argus-ai-hub` resolves correctly
- Restored npm token auth while keeping `--provenance` for attestation

---

## [0.1.1] - 2026-04-18

### Added

- npm publish pipeline via OIDC Trusted Publishing
- GitHub Pages deploy workflow for the landing page

### Fixed

- Added missing `dotenv` dependency to the published package

---

## [0.1.0] - 2026-04-12

First public release.

### Added

- **Session monitoring**: real-time detection and monitoring of Claude Code and GitHub Copilot CLI sessions
- **Session output streaming**: live output pane with Focused and Verbose display modes
- **Kill session**: terminate any active session with a known PID via the dashboard or detail page
- **Launch with Argus**: start Claude Code or Copilot CLI sessions with PTY control for prompt injection
- **Prompt bar**: send prompts to live sessions directly from the browser
- **Repository management**: scan and register git repositories with one-click bulk import
- **To Tackle panel**: built-in task list for notes and reminders
- **Dashboard settings**: configurable filters (hide ended, hide inactive, hide empty repos) and resting threshold
- **Yolo mode**: launch sessions with all permission checks disabled
- **Mobile browser support**: responsive layout for viewports 390px and up
- **Onboarding tour**: interactive walkthrough for first-time users
- **npm package**: install and run via `npx argus-ai-hub`
- **CONTRIBUTING.md**: contribution guidelines
- **SECURITY.md**: security policy with GitHub Private Vulnerability Reporting
