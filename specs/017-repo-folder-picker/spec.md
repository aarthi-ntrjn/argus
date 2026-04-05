# Feature Specification: Frontend-Driven Repository Folder Picker

**Feature Branch**: `017-repo-folder-picker`  
**Created**: 2025-07-21  
**Status**: Draft  
**Input**: User description: "I do not like how the folder picking is done. The frontend uses the browser API to pick a folder, then the frontend scans for git folders in that folder. It creates a list of git folders and the backend has an API to monitor folder paths with the git urls. Remove all the pick folder and scan folder APIs from the backend."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Type a Path and Discover Repos (Priority: P1)

A user wants to add one or more git repositories to Argus for monitoring. They click "Add Repository", type or paste an absolute folder path (e.g. `C:\source` or `/home/user/projects`), and the UI immediately shows a list of all git repositories discovered within that folder. The user selects which ones to add and confirms.

**Why this priority**: This is the core flow. Typing a path is the only way to provide an absolute OS path in a browser-based local tool — the browser's native folder picker deliberately withholds absolute paths for security reasons. Developers know their source folder paths.

**Independent Test**: Can be fully tested by typing a parent folder path, verifying the discovered git repo list appears, selecting repos, and confirming they appear in the monitored list.

**Acceptance Scenarios**:

1. **Given** no repositories are monitored, **When** the user types a valid parent folder path containing 3 git subdirectories and clicks "Scan", **Then** all 3 repos are shown in a selectable list with their names and full paths.
2. **Given** a discovered list is shown, **When** the user selects 2 of 3 repos and confirms, **Then** only the 2 selected repos are added to the monitored list and the others are not.
3. **Given** a discovered list is shown, **When** a repo in the list is already registered, **Then** it appears pre-checked and disabled (already added) so the user cannot add a duplicate.
4. **Given** the user types a folder path that contains no git repositories, **When** the scan completes, **Then** a friendly message "No git repositories found in this folder" is shown.

---

### User Story 2 - Add a Single Repository Directly (Priority: P2)

A user already knows the exact folder path of a git repository they want to monitor. They can type or paste the path directly into a text input and add it without going through the folder picker.

**Why this priority**: The browser folder picker does not expose absolute OS paths to the frontend, so typing a path directly is the reliable fallback that allows the backend (which needs an absolute path) to monitor the repo.

**Independent Test**: Can be tested by entering a known git repo path in the text input and verifying the repo appears in the monitored list.

**Acceptance Scenarios**:

1. **Given** the "Add Repository" dialog is open, **When** the user types a valid absolute path to a git repo and clicks "Add", **Then** the repo is registered and appears in the monitored list.
2. **Given** the user enters a path that is not a git repository, **When** they click "Add", **Then** an error message "Not a git repository" is shown and nothing is added.
3. **Given** the user enters a path already registered, **When** they click "Add", **Then** an error "Repository already added" is shown.

---

### User Story 3 - Remove Backend Folder-Scanning APIs (Priority: P1)

All backend APIs for picking folders (`POST /api/v1/fs/pick-folder`) and scanning for git repos (`POST /api/v1/fs/scan-folder`, `GET /api/v1/fs/browse`, `GET /api/v1/fs/scan`) are removed. The backend retains only the repository registration API (`POST /api/v1/repositories`) which accepts an absolute path.

**Why this priority**: Removing these APIs is part of the core redesign — they represent the old architecture that couples the backend to the host OS UI. Keeping them would be confusing and unnecessary.

**Independent Test**: Can be verified by confirming the removed endpoints return 404, and that all folder-scanning/picking behaviour works correctly via the frontend-only flow.

**Acceptance Scenarios**:

1. **Given** the backend is running, **When** a client calls `POST /api/v1/fs/pick-folder`, **Then** a 404 response is returned.
2. **Given** the backend is running, **When** a client calls `POST /api/v1/fs/scan-folder`, **Then** a 404 response is returned.
3. **Given** the backend is running, **When** a client calls `GET /api/v1/fs/browse`, **Then** a 404 response is returned.
4. **Given** the backend is running, **When** a client calls `GET /api/v1/fs/scan`, **Then** a 404 response is returned.
5. **Given** the backend is running, **When** a client calls `POST /api/v1/repositories` with a valid absolute path, **Then** the repository is registered successfully (existing behaviour preserved).

---

### Edge Cases

- What happens when the user cancels the dialog without entering anything? → Dialog closes, no repos are added, no error is shown.
- What happens when the typed path has deeply nested git repos? → Only immediate subdirectories containing `.git` are detected (one level deep); repos nested inside repos are not shown.
- What happens if the folder scan finds dozens of repos? → The list is scrollable; all repos are shown with select-all and deselect-all controls.
- What happens when the absolute path typed by the user does not exist on disk? → The backend returns an error and the UI shows "Path not found".
- What happens when the user types a path to a single git repo (not a parent folder)? → The repo itself is offered as the only item in the list for selection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to type or paste an absolute folder path into the "Add Repository" dialog to initiate a repository scan.
- **FR-002**: When a path is submitted, the backend MUST scan that folder for git repositories (directories containing a `.git` subfolder) and return the list.
- **FR-003**: The frontend MUST display all discovered git repositories in a selectable list before registering them.
- **FR-004**: Users MUST be able to select a subset of discovered repositories to add (not all-or-nothing).
- **FR-005**: Already-registered repositories MUST be visually indicated as already added and not selectable again.
- **FR-006**: Users MUST be able to add a single known repository by typing its exact absolute path directly (without scanning a parent folder).
- **FR-007**: The backend MUST accept a `POST /api/v1/repositories` request with an absolute path and register that repository for monitoring.
- **FR-008**: The backend MUST remove all legacy folder-picking and folder-scanning API endpoints: `POST /api/v1/fs/pick-folder`, `POST /api/v1/fs/scan-folder`, `GET /api/v1/fs/browse`, `GET /api/v1/fs/scan`.
- **FR-009**: The backend MUST provide a `POST /api/v1/fs/scan` endpoint (or equivalent) that accepts an absolute folder path and returns a list of immediate git repository subdirectories — used by the frontend after the user types a path.
- **FR-010**: The frontend MUST show a clear message when a typed path contains no git repositories.
- **FR-011**: The frontend MUST show a clear error when a typed path does not exist on disk.

### Key Entities

- **Repository**: A registered git project being monitored. Identified by its absolute file system path. Has a display name (basename of path), registration timestamp, current git branch, and monitoring status.
- **Discovered Repository**: A transient entry found during a frontend folder scan. Has a relative folder name, relative path within the scanned parent, and a flag indicating whether it is already registered.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can discover and add all git repositories in a parent folder in under 30 seconds.
- **SC-002**: 100% of legacy backend folder-scanning and folder-picking endpoints are removed; calling them returns 404.
- **SC-003**: The folder scan step (after entering a path) completes in under 2 seconds for folders containing up to 50 subdirectories.
- **SC-004**: Users can successfully add a repository via the direct path input without needing to scan a parent folder.
- **SC-005**: The "Add Repository" dialog clearly shows all discovered repos and prevents adding duplicates without any extra confirmation steps.

## Assumptions

- Argus runs as a local-first tool where the backend and browser are on the same machine; users are developers familiar with their local file paths.
- The browser's native folder picker API (`showDirectoryPicker()`) does **not** expose absolute OS paths — this is a deliberate browser security restriction. The path text input is therefore the primary mechanism for path entry.
- Only immediate subdirectories of the typed parent folder are scanned for `.git` (one level deep); recursive deep scanning is out of scope for v1.
- The backend repository registration API (`POST /api/v1/repositories`) remains unchanged in its contract — it accepts `{ path: string }` and validates that a `.git` directory exists at that path.
- The `fs.ts` route file (containing the removed endpoints) may be deleted entirely or reduced to a minimal module.
- Mobile browser support is out of scope.
