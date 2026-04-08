# Argus: Session Detail Page Manual Tests

Manual tests for the session detail page. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)
2. At least one session exists

---

## D0: Session detail page

| # | Steps | Expected |
|---|-------|----------|
| D-01 | Click the external link icon on a session card | The session detail page opens at `/sessions/:id` |
| D-02 | Check the session detail header | A back button, type badge with icon, model name, status badge, PID, short session ID, and elapsed time are visible |
| D-03 | Check the output stream area | Previous session output is displayed in chronological order with timestamps, role badges, and content |
| D-04 | Check a live session detail page | A prompt input bar is visible below the output stream |
| D-05 | Check a read-only session detail page | The prompt bar shows "read-only" text instead of an input |
| D-06 | Click the **Back** button | Returns to the dashboard |
