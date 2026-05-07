# Research: Todo List Filter (068)

## Decision 1: Controlled vs. Uncontrolled Add-Todo Input

**Decision**: Switch the add-todo input from uncontrolled (`defaultValue` + `key` remount trick) to controlled (`value={filterText}` + `onChange`).

**Rationale**: Live filtering requires reading the input's current value on every keystroke. A controlled input makes this natural — `filterText` state is the single source of truth for both the displayed value and the filter predicate. The uncontrolled approach with `key` changes would require `ref.current.value` reads on every keystroke, coupling the filter to a DOM read rather than React state.

**Alternative rejected**: Keep uncontrolled + poll via `ref` on each keypress. Rejected because it bypasses React's data flow, makes the component harder to test, and gives no benefit over the controlled approach.

---

## Decision 2: Blur No Longer Creates a Todo

**Decision**: Remove the blur-creates-todo behavior for the draft (add) row.

**Rationale**: The user's explicit requirement is "if i tab out it should leave the text in the input box." Blur-creates-todo is the current behavior, but it directly conflicts with the desired UX where tab/blur is a non-destructive action that leaves the filter active.

**Alternative rejected**: Keep blur-creates-todo and only change blur behavior when typing "looks like a filter" (heuristic). Rejected because there is no reliable heuristic to distinguish intent; the user's words are unambiguous.

**Impact**: This is a behavior change visible to existing users. The old behavior (blur = auto-save) was implicit and not documented. Enter remains the explicit save action, which is the standard pattern.

---

## Decision 3: Filter in Memo vs. Derived State

**Decision**: Add the text filter as a second `.filter()` pass inside the existing `reversedTodos` `useMemo`.

**Rationale**: The `reversedTodos` memo already computes the display list from the canonical `todos` array. Adding the text filter there keeps a single computed list, avoids a second memo, and ensures filter + showDone always compose atomically.

**Alternative rejected**: Separate `filteredTodos` memo that reads from `reversedTodos`. Rejected as unnecessary indirection with no benefit.

---

## Decision 4: Empty-Match State Message

**Decision**: Render "No todos match your filter." inline in the list area when the filter is active and produces zero results.

**Rationale**: Without this, a non-matching filter produces a blank panel, which looks identical to the loading state and gives the user no signal about why the list is empty.

**Alternative rejected**: Show a toast/banner. Rejected because this is not an error — it is expected feedback tied to the filter state, and the CLAUDE.md UX rules reserve banners for errors.
