# Feature Specification: Todo List Filter

**Feature Branch**: `068-todo-filter`
**Created**: 2026-05-06
**Status**: Draft
**Input**: User description: "when i type items in todo - it should filter the todo list."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter Todos by Typing (Priority: P1)

A user with a long todo list wants to quickly find items matching a keyword. They type into a filter input at the top of the Todo panel and the list immediately narrows to show only items whose text contains the typed characters.

**Why this priority**: This is the entire feature. Without it nothing else in this spec has value.

**Independent Test**: Open the Todo panel with at least 5 todos, type a word that appears in only some of them, and verify only matching items remain visible.

**Acceptance Scenarios**:

1. **Given** the Todo panel contains multiple items, **When** the user types text into the filter input, **Then** only items whose text contains that text (case-insensitive) are shown.
2. **Given** a filter is active, **When** the user clears the filter input, **Then** all items (subject to existing show-completed toggle) are shown again.
3. **Given** a filter is active, **When** the typed text matches no items, **Then** the list shows an empty state message indicating no matches.

---

### User Story 2 - Filter Interacts with Show-Completed Toggle (Priority: P2)

A user wants to filter only within incomplete (or only within all) todos. The filter input works in combination with the existing "show completed" toggle, so both constraints apply simultaneously.

**Why this priority**: The show-completed toggle is an existing filter layer; the new text filter must compose with it rather than override it, or users will see unexpected results.

**Independent Test**: Enable show-completed toggle, type a filter, verify only matching items from both complete and incomplete are shown. Disable show-completed, verify filter applies only to incomplete items.

**Acceptance Scenarios**:

1. **Given** "show completed" is off and a filter is typed, **When** the filter matches both done and undone items, **Then** only undone matching items are visible.
2. **Given** "show completed" is on and a filter is typed, **When** the filter matches both done and undone items, **Then** both are visible.

---

### Edge Cases

- What happens when the user has zero todos and types into the filter? The empty state already visible should remain, no crash.
- What happens when a todo's text contains special regex characters (e.g., `[`, `(`)?  The filter must treat the input as a plain substring, not a pattern.
- What happens when the filter input contains only whitespace? Treat as empty (no filter applied).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Todo panel MUST display a text input field dedicated to filtering the todo list.
- **FR-002**: As the user types in the filter input, the list MUST update in real time to show only items whose text contains the typed string (case-insensitive, plain substring match).
- **FR-003**: Leading and trailing whitespace in the filter input MUST be trimmed before matching; a whitespace-only entry MUST be treated as an empty filter (no filtering applied).
- **FR-004**: When the filter input is empty, the list MUST display all items subject to the existing show-completed toggle, as if no filter were active.
- **FR-005**: When the filter matches no items, the panel MUST display a short message indicating that no todos match the current filter.
- **FR-006**: The filter MUST compose with the existing "show completed" toggle: both constraints apply simultaneously.
- **FR-007**: The filter input MUST be clearable with a single action (e.g., a clear button or selecting all and deleting), restoring the full list immediately.
- **FR-008**: The filter state MUST NOT be persisted across page reloads; it resets to empty each session.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can locate a specific todo item by typing 3 or fewer characters in under 2 seconds from when they start typing.
- **SC-002**: The visible list updates on every keystroke with no perceptible delay (filter result appears within 100ms of the keystroke).
- **SC-003**: 100% of todos whose text contains the filter string (case-insensitive) are shown; 0% of non-matching todos are shown while a filter is active.
- **SC-004**: Applying a filter does not affect the underlying data: removing the filter restores the full list with no todos lost or reordered.

## Assumptions

- The filter operates entirely on the data already loaded in the client; no additional server requests are needed for filtering.
- The "add new todo" input row at the top of the panel remains visible and functional while a filter is active.
- The filter input is placed between the "add todo" row and the list of todo items, or in the panel's toolbar area alongside the existing toggles, so it is immediately discoverable.
- Mobile layout is in scope; the filter input must fit the existing responsive design of the Todo panel.
