# API Contract: Session Output (thinking events)

No new endpoints. The existing `GET /api/v1/sessions/:id/output` endpoint already returns all output events for a session. Adding `thinking` to `OutputType` means this endpoint will naturally return thinking events once the parser stores them.

## GET /api/v1/sessions/:id/output

**No changes to request shape.**

**Response — SessionOutput item (thinking event example)**:
```json
{
  "id": "out-abc123",
  "sessionId": "session-xyz",
  "timestamp": "2026-05-08T12:00:00.000Z",
  "type": "thinking",
  "content": "The user wants to refactor the auth module. I should start by reading the existing code...",
  "toolName": null,
  "toolCallId": null,
  "role": null,
  "sequenceNumber": 3,
  "isMeta": false
}
```

**Response — redacted thinking event**:
```json
{
  "id": "out-def456",
  "sessionId": "session-xyz",
  "timestamp": "2026-05-08T12:00:01.000Z",
  "type": "thinking",
  "content": "[redacted]",
  "toolName": null,
  "toolCallId": null,
  "role": null,
  "sequenceNumber": 4,
  "isMeta": false
}
```

## Test Cases

| Scenario | Expected result |
|----------|----------------|
| Session with thinking blocks | Output list includes items with `type: 'thinking'` |
| Session with redacted_thinking blocks | Output list includes `type: 'thinking'` items with `content: '[redacted]'` |
| Session without thinking | Output list has no `type: 'thinking'` items |
| Mixed session (messages + thinking + tools) | All types present, ordered by `sequenceNumber` |
