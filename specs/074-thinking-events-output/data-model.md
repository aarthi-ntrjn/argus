# Data Model: Thinking Events in Output Stream and Preview

## OutputType (extended)

Current:
```typescript
type OutputType = 'message' | 'tool_use' | 'tool_result' | 'error' | 'status_change';
```

After this feature:
```typescript
type OutputType = 'message' | 'tool_use' | 'tool_result' | 'error' | 'status_change' | 'thinking';
```

**Change location**: `backend/src/models/index.ts` and `frontend/src/types/` (wherever the frontend type is defined).

## SessionOutput (unchanged structure)

No new fields. The existing `SessionOutput` interface handles thinking events with:

| Field | Value for thinking events |
|-------|--------------------------|
| `type` | `'thinking'` |
| `content` | Thinking text (readable blocks) or `'[redacted]'` (redacted blocks) |
| `role` | `null` (thinking is not user/assistant turn content in the role sense) |
| `toolName` | `null` |
| `toolCallId` | `null` |
| `sequenceNumber` | Preserves insertion order from JSONL |

## DB Storage

No migration required. The `session_output` table's `type TEXT NOT NULL` column already accepts any string. Existing queries return all types; the frontend filters by type where needed.

**Redacted blocks**: stored with `content = '[redacted]'`. The renderer checks `content === '[redacted]'` to display the "(redacted)" placeholder.

**Empty legitimate thinking**: stored with `content = ''`. The renderer shows "(empty)" for empty non-redacted content.

## JSONL Block Mapping

| JSONL block type | Stored `type` | Stored `content` | Notes |
|------------------|---------------|------------------|-------|
| `thinking` | `thinking` | `block.thinking` | Full reasoning text |
| `redacted_thinking` | `thinking` | `'[redacted]'` | Encrypted data discarded |

## Frontend Display Types

The `DisplayItem` and `ToolGroupItem` types in `sessionDetailUtils.ts` are unchanged — thinking events flow as `{ kind: 'single', item: SessionOutput }` with `item.type === 'thinking'`.

Focused mode visibility rule (in `SessionDetail.tsx`):
- Verbose: render fully expanded
- Focused: render collapsed (THINK badge visible, content hidden behind toggle)
