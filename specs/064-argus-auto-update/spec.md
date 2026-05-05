# Feature Specification: Argus Auto Update

**Feature Branch**: `064-argus-auto-update`
**Created**: 2026-05-04
**Status**: Draft
**Input**: User description: "i want to build the auto update functionality for argus/exit"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Update Notification in UI (Priority: P1)

A user is running Argus and notices a banner or indicator in the settings panel telling them a newer version is available. They can see what version is current and what version is available, then trigger an update at a time that suits them.

**Why this priority**: Users need to know updates exist before they can act on them. This is the foundation all other update behavior builds on, and it delivers value on its own by ending the "how do I know there's a new version?" problem.

**Independent Test**: Can be tested by running an older version of Argus, opening the Settings panel, and verifying that the UI shows the new version as available.

**Acceptance Scenarios**:

1. **Given** Argus is running and a newer version exists on npm, **When** the update check completes, **Then** a persistent badge appears in the navigation/header visible from any page, and the Settings panel also shows the current and available version numbers.
2. **Given** Argus is running and no newer version exists, **When** the user opens the Settings panel, **Then** no update indicator is shown and the version display is unchanged.
3. **Given** Argus cannot reach the update source (network unavailable), **When** the version check runs, **Then** no error is surfaced to the user and the app continues normally.

---

### User Story 2 - Update on Exit (Priority: P1)

When the user stops the Argus server process (e.g., Ctrl+C or system shutdown), Argus detects a pending update and applies it before fully exiting, so the next launch automatically starts the newer version without any manual `npm install` step.

**Why this priority**: This is the core "auto update" behavior described in the feature request. Combined with Story 1 (notification), it delivers the full update loop with no manual npm commands required.

**Independent Test**: Can be tested by running an outdated Argus, stopping the process, then relaunching and confirming the version number has advanced.

**Acceptance Scenarios**:

1. **Given** a newer version is available and the user stops Argus, **When** the exit sequence begins, **Then** Argus briefly notifies that active monitoring is paused until the update is applied and the server is restarted, performs the update, and exits.
2. **Given** a newer version is available but the update fails (network error, permissions), **When** the exit sequence runs, **Then** Argus exits cleanly anyway and logs a warning; the next launch still runs the old version.
3. **Given** no newer version is available and the user stops Argus, **When** the exit sequence runs, **Then** Argus exits immediately with no update step.
4. **Given** the user has opted out of auto update in settings, **When** the exit sequence runs, **Then** no update is applied even if one is available.

---

### User Story 3 - Manual Update Trigger (Priority: P2)

A user sees the update-available indicator in the Settings panel and clicks an "Update now" button to trigger the update immediately, without waiting until they exit. After the update completes, Argus prompts them to restart so the new version takes effect.

**Why this priority**: Some users will want to update on demand rather than waiting for their next restart. This removes friction for proactive users while keeping the exit-update path as the fallback for everyone else.

**Independent Test**: Can be tested by clicking the "Update now" button and verifying the update runs and a restart prompt appears.

**Acceptance Scenarios**:

1. **Given** an update is available, **When** the user clicks "Update now", **Then** a progress indicator is shown, the update is applied, and a restart prompt appears.
2. **Given** an update is in progress, **When** the user navigates away or closes the Settings panel, **Then** the update continues in the background and the restart prompt appears when complete.
3. **Given** the update fails mid-way, **When** the error occurs, **Then** a clear error message is shown and the running version is unchanged.

---

### User Story 4 - Update Preference Control (Priority: P3)

A user who manages Argus in a controlled environment (e.g., a team server) wants to disable automatic updates so they can control when upgrades happen. They can turn off auto update in Settings.

**Why this priority**: Enterprise and team users need predictability. This is a guard rail, not a core flow; lower priority because most users will leave auto update on.

**Independent Test**: Can be tested by disabling auto update in Settings, stopping Argus with a newer version available, and confirming the version does not change.

**Acceptance Scenarios**:

1. **Given** auto update is disabled, **When** Argus exits, **Then** no update is applied.
2. **Given** auto update is disabled, **When** an update is available, **Then** the notification still appears in the Settings panel so the user knows an update exists.

---

### Edge Cases

- What happens when the update check takes too long (slow network)? The check should time out gracefully and not block the UI or the exit sequence.
- What happens if the user interrupts the update mid-download (Ctrl+C during exit)? The partial update must not corrupt the installed package; the old version must remain functional.
- What happens if the update source returns an unexpected format? The app must continue normally and log a warning.
- What happens when two instances of Argus are running and one triggers an update on exit? The update applies to the package globally; the still-running instance continues on the old version until it restarts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST check for a newer published version at startup and at a regular interval while running. The default interval is every 4 hours and is configurable via `updateCheckIntervalHours` in the config file.
- **FR-002**: System MUST display an update-available indicator as a persistent badge or indicator in the navigation or header, visible from any page in the UI, when a newer version is detected. The indicator MUST show both the current and available version numbers and persist until the update is applied or dismissed. The Settings panel MUST also surface this information.
- **FR-003**: System MUST apply a pending update during the exit sequence when auto update is enabled and a newer version is available. Before applying the update, the system MUST display a brief message: "Active monitoring paused until update is applied and server is restarted."
- **FR-004**: System MUST complete the exit sequence and terminate normally even if the update step fails.
- **FR-005**: Users MUST be able to trigger an update immediately from the Settings panel without stopping Argus.
- **FR-006**: System MUST display a restart prompt after a manually triggered update completes.
- **FR-007**: Auto update MUST be enabled by default. Users MUST be able to disable it in the Settings panel; the preference must persist across restarts.
- **FR-008**: System MUST continue to show the update-available notification even when auto update is disabled.
- **FR-009**: Version checks MUST fail silently (no error surfaced to the user) when the update source is unreachable.
- **FR-010**: System MUST NOT apply an update if the current user account does not have the necessary permissions; it must log a clear error and exit normally instead.

### Key Entities

- **UpdateStatus**: Represents the result of a version check: current version, latest available version, whether an update is pending, and last-checked timestamp.
- **UpdatePreference**: User setting controlling whether auto update on exit is enabled or disabled, stored persistently.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users running an outdated version see the update-available badge in the navigation/header within 60 seconds of launch, regardless of which page they are on.
- **SC-002**: A user stopping Argus with auto update enabled starts the new version on the very next launch, with no manual steps required.
- **SC-003**: The exit sequence completes (Argus fully terminates) within 30 seconds even when an update is being applied.
- **SC-004**: Update failures (network, permissions) do not prevent Argus from exiting; the process always terminates.
- **SC-005**: 100% of users who interact with the update flow can complete it (notification seen, update applied or dismissed) without consulting external documentation.

## Assumptions

- Argus is installed as a global npm package; the update mechanism uses the same npm registry and installation path.
- The update check queries the public npm registry for the latest published version of the package.
- Users launching Argus have a network connection available most of the time; offline use is supported but version checks silently skip when offline.
- Applying an update requires the same permissions used to install Argus initially; no elevated/sudo prompt is in scope for this feature.
- The restart required after a manual in-session update is a manual action by the user (i.e., Argus does not restart itself automatically mid-session).
- The Settings panel is the single surface for update controls; no separate update dialog or system tray integration is in scope.

## Clarifications

### Session 2026-05-04

- Q: What should Argus do with active sessions when it exits to apply an update? → A: Warn then proceed, using the message "Active monitoring paused until update is applied and server is restarted."
- Q: Should auto update be on or off by default? → A: On by default; users can disable it in Settings.
- Q: Where should the update-available notification appear in the UI? → A: Persistent badge in the navigation/header, visible from any page; Settings panel also surfaces it.
