# Feature Specification: Todo List Filter

**Feature Branch**: `068-todo-filter`
**Created**: 2026-05-06
**Status**: Clarified
**Input**: User description: "when i type items in todo - it should filter the todo list."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter Todos by Typing in the Add-Todo Input (Priority: P1)

A user with a long todo list wants to quickly find items matching a keyword. They type into the existing add-todo input at the top of the Todo panel; the list below immediately narrows to show only items whose text contains the typed characters. The input is dual-purpose: it filters while the user is typing, and adds a new item when the user presses Enter.

**Why this priority**: This is the entire feature. Typing in the add-todo input is already the first thing a user sees, making the filter instantly discoverable without adding any new controls.

**Independent Test**: Open the Todo panel with at least 5 todos, type a word that appears in only some of them, and verify only matching items appear below. Then press Enter and verify a new todo with that text is created and the filter clears.

**Acceptance Scenarios**:

1. **Given** the Todo panel contains multiple items, **When** the user types text into the add-todo input, **Then** only items whose text contains that text (case-insensitive) are shown below.
2. **Given** a filter is active (text in the input), **When** the user presses Enter, **Then** a new todo is created with the typed text and the list returns to the unfiltered state.
3. **Given** a filter is active, **When** the typed text matches no items, **Then** the list shows an empty state message indicating no matches.
4. **Given** a filter is active, **When** the user tabs out or moves focus away from the input, **Then** the text remains in the input and the filter stays active.
5. **Given** a filter is active, **When** the user manually clears the input (selects all + delete, backspace, etc.), **Then** the full list (subject to existing show-completed toggle) is restored immediately.

---

### User Story 2 - Filter Interacts with Show-Completed Toggle (Priority: P2)

The live filter applies on top of the existing "show completed" toggle. Both constraints are active simultaneously so the user sees only items that satisfy both conditions.

**Why this priority**: The show-completed toggle is an existing filter layer; the new text filter must compose with it rather than override it, or users will see unexpected results.

**Independent Test**: Enable the show-completed toggle, type a filter that matches both done and undone items, verify both appear. Disable the toggle, verify only undone matching items appear.

**Acceptance Scenarios**:

1. **Given** "show completed" is off and the user types a filter that matches both done and undone items, **Then** only undone matching items are visible.
2. **Given** "show completed" is on and the user types a filter that matches both done and undone items, **Then** both are visible.

---

### Edge Cases

- What happens when the user has zero todos and types into the add-todo input? The empty list state remains; no crash.
- What happens when a todo's text contains special regex characters (e.g., `[`, `(`)? The filter treats the input as a plain substring, not a pattern.
- What happens when the input contains only whitespace? Treat as empty (no filter applied; full list shown).
- What happens after Enter creates a new todo? The input is cleared and filtering returns to the unfiltered state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The existing add-todo input MUST serve as the live filter input; no additional filter control is added to the panel.
- **FR-002**: As the user types in the add-todo input, the todo list MUST update in real time to show only items whose text contains the typed string (case-insensitive, plain substring match).
- **FR-003**: Leading and trailing whitespace in the input MUST be trimmed before matching; a whitespace-only entry MUST be treated as an empty filter (no filtering applied).
- **FR-004**: When the input is empty, the list MUST display all items subject to the existing show-completed toggle, as if no filter were active.
- **FR-005**: When the filter matches no items, the panel MUST display a short message indicating that no todos match the current filter.
- **FR-006**: The filter MUST compose with the existing "show completed" toggle: both constraints apply simultaneously.
- **FR-007**: Pressing Enter while the input contains text MUST create a new todo with that text and clear the input, returning the list to its unfiltered state.
- **FR-008**: Tabbing out or blurring the input MUST leave the typed text in place; the filter remains active until the user manually clears the input.
- **FR-009**: The filter state MUST NOT be persisted across page reloads; the input resets to empty on each page load.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can locate a specific todo item by typing 3 or fewer characters in under 2 seconds from when they start typing.
- **SC-002**: The visible list updates on every keystroke with no perceptible delay (filter result appears within 100ms of the keystroke).
- **SC-003**: 100% of todos whose text contains the filter string (case-insensitive) are shown; 0% of non-matching todos are shown while a filter is active.
- **SC-004**: Applying a filter does not affect the underlying data: clearing the input restores the full list with no todos lost or reordered.
- **SC-005**: Pressing Enter while a filter is active successfully creates a new todo and returns the list to the unfiltered view in a single action.

## Assumptions

- The filter operates entirely on data already loaded in the client; no additional server requests are needed for filtering.
- The add-todo input's existing Enter-to-add behavior is preserved; filtering is purely additive behavior on top of it.
- Mobile layout is in scope; the dual-purpose input must fit the existing responsive design of the Todo panel.

## Clarifications

### Session 2026-05-06

- **Filter placement**: There is no dedicated filter control. The existing add-todo input at the top of the panel is the filter. Typing filters the list in real time; Enter adds the item; tab/blur leaves the text and keeps the filter active. User must manually clear the input to remove the filter.
