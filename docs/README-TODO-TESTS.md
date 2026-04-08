# Argus: Todo Panel Manual Tests

Manual tests for the "To Tackle" todo panel. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)

---

## S7: Todo panel

| # | Steps | Expected |
|---|-------|----------|
| S7-01 | In the "To Tackle" panel, type a task and press Enter | The task appears in the list with an unchecked checkbox |
| S7-02 | Click the checkbox on a task | The task is marked as done (checkbox is checked; text styling changes) |
| S7-03 | Toggle **Hide completed** ON | Completed tasks disappear from the list |
| S7-04 | Toggle **Hide completed** OFF | Completed tasks reappear |
| S7-05 | Click the delete (trash) icon on a task | The task is removed from the list |
| S7-06 | Refresh the page | All tasks persist (stored in the database) |
