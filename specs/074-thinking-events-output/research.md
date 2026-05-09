# Research: Thinking Events in Output Stream and Preview

## Decision 1: No DB schema change needed

**Decision**: Store thinking events using the existing `session_output` table with `type = 'thinking'`.

**Rationale**: The `type` column is a TEXT field with no CHECK constraint. The existing schema already accommodates any string value. The `content` column stores the thinking text; redacted blocks store an empty string. There is no need for an `is_redacted` column because empty content combined with `type = 'thinking'` is sufficient — but a content prefix sentinel `[REDACTED]` is cleaner and avoids ambiguity with legitimately empty thinking (which we render as "(empty)" anyway). We use a special marker in content rather than a new column to avoid a migration.

**Alternative rejected**: Adding an `is_redacted BOOLEAN` column. Rejected because it requires a DB migration and the information is fully recoverable from context (we know at parse time whether the block was redacted, and we can encode that in the content string).

## Decision 2: Redacted thinking content encoding

**Decision**: For `redacted_thinking` blocks, store `content` as the empty string `""` and set a flag in the stored content using the sentinel value `"\x00REDACTED"` — actually, simpler: store `content` as empty string and derive the "redacted" display from whether the original JSONL block type was `redacted_thinking`. Since we only know this at parse time, we store the content as `""` and add no other marker. The renderer treats `type === 'thinking'` with `content === ""` as potentially empty OR redacted — but since we also have real empty thinking (which is just a quirk of the model), we need to distinguish them.

**Revised decision**: Store redacted content as the literal string `"[redacted]"` in the `content` field. This is human-readable if inspected directly in the DB, requires no schema change, and lets the renderer check `content === '[redacted]'` to show the "(redacted)" placeholder.

**Alternative rejected**: A separate DB column. Rejected per Decision 1.

## Decision 3: Thinking in buildDisplayItems — pass-through as singles

**Decision**: Thinking items flow through `buildDisplayItems` as `{ kind: 'single', item }` unconditionally. They never enter the tool-pairing logic.

**Rationale**: Thinking blocks have no paired counterpart (no `thinking_result`). The focused-mode filtering that hides orphaned tool_results should NOT apply to thinking — thinking has its own visibility rule (collapsed, not hidden). The focused-mode filter is applied at render time in `SessionDetail.tsx` based on `item.type === 'thinking'`, not in `buildDisplayItems`.

**Alternative rejected**: Filtering thinking in `buildDisplayItems`. Rejected because the filter there produces `null` (fully hidden), but focused mode requires showing thinking collapsed. Keeping the visibility logic in the renderer gives more control.

## Decision 4: Session card preview — thinking replaces message

**Decision**: When a session has any `thinking` output events, `SessionCard` shows the content of the first thinking event as the preview text (truncated). When no thinking events exist, it falls back to the last assistant message as before.

**Rationale**: The user explicitly requested "in the output preview it only shows thinking." Showing thinking as the primary preview signals that the model was reasoning, which is the most interesting diagnostic signal. The fallback preserves existing behavior for sessions without thinking.

**Alternative rejected**: Showing thinking alongside the message. Rejected because the user explicitly chose "only shows thinking."

## Decision 5: Tool count — derive from stored events, not rescan JSONL

**Decision**: The tool call count shown on the session card is `items.filter(i => i.type === 'tool_use').length` computed from the already-loaded output items.

**Rationale**: Session cards already load recent output for the preview. The count is a free derivation from that existing data — no extra network call or JSONL rescan needed.
