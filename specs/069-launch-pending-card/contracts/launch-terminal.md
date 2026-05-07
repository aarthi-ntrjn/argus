# Contract: POST /api/v1/sessions/launch-terminal

## Overview

Initiates a terminal launch for the given tool and optional repository path. On success, opens a new terminal window running the Argus launcher. The response now includes the `ptyLaunchId` that will be associated with the resulting session.

## Request

```
POST /api/v1/sessions/launch-terminal
Content-Type: application/json
```

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `tool` | `'claude' \| 'copilot'` | Yes | The AI tool to launch |
| `repoPath` | `string` | No | Absolute path to the repository. If omitted, the terminal opens in the current directory. |

### Example

```json
{
  "tool": "claude",
  "repoPath": "/Users/dev/my-project"
}
```

## Responses

### 202 Accepted — Terminal launched successfully

```json
{
  "status": "launched",
  "ptyLaunchId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

| Field | Type | Description |
|---|---|---|
| `status` | `'launched'` | Fixed string confirming the launch. |
| `ptyLaunchId` | `string` | UUID. Uniquely identifies this launch attempt. Will appear in the `session.created` event payload when the AI tool registers, enabling the frontend to match the placeholder to the real session. |

### 422 Unprocessable Entity — No GUI terminal available (headless)

```json
{
  "status": "no-terminal",
  "message": "No GUI terminal emulator found. Run this command manually in your terminal:\n...",
  "cmd": "node /path/to/launch.js claude --cwd /path"
}
```

No placeholder card should be shown in this case.

### 400 Bad Request — Invalid body

```json
{
  "error": "VALIDATION_ERROR",
  "message": "body/tool must be equal to one of the allowed values",
  "requestId": "..."
}
```

## Test Cases

| # | Scenario | Input | Expected Status | Expected Body |
|---|---|---|---|---|
| 1 | Happy path with repoPath | `{ tool: 'claude', repoPath: '/valid/path' }` | 202 | `{ status: 'launched', ptyLaunchId: <uuid> }` |
| 2 | Happy path without repoPath | `{ tool: 'copilot' }` | 202 | `{ status: 'launched', ptyLaunchId: <uuid> }` |
| 3 | Headless environment | `{ tool: 'claude' }` | 422 | `{ status: 'no-terminal', cmd: ... }` |
| 4 | Invalid tool | `{ tool: 'unknown' }` | 400 | validation error |
| 5 | Each request returns a different ptyLaunchId | Two requests with same tool+repo | Both 202 | Different `ptyLaunchId` values |
