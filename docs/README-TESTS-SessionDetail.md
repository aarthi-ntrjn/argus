# Argus: Session Detail Page Manual Tests

Manual tests for the session detail page. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)

---

## D0: Read-only session detail page

**Prerequisites:** At least one detected (non-PTY) session exists.

| # | Steps | Expected |
|---|-------|----------|
| D-01 | Click the external link icon on a read-only session card | The session detail page opens at `/sessions/:id` |
| D-02 | Check the session detail header | A back button, type badge with icon, model name, status badge, PID, short session ID, and elapsed time are visible |
| D-03 | Check the output stream area | Session output is displayed in chronological order with timestamps, role badges, and content |
| D-04 | Check the prompt bar area | The prompt bar shows "read-only" text instead of an input |
| D-05 | Click the **Back** button | Returns to the dashboard |

---

## D1: Live session detail page

**Prerequisites:** At least one live (PTY) session exists, launched via "Launch with Argus".

| # | Steps | Expected |
|---|-------|----------|
| D-06 | Click the external link icon on a live session card | The session detail page opens at `/sessions/:id` |
| D-07 | Check the session detail header | A back button, type badge with icon, model name, status badge, PID, short session ID, and elapsed time are visible |
| D-08 | Check the output stream area | Session output is displayed in chronological order with timestamps, role badges, and content |
| D-09 | Check the prompt bar area | A prompt input bar is visible below the output stream |
| D-10 | Type a prompt and press **Enter** | The prompt is sent to the CLI session; the response appears in the output stream; the input clears |
| D-11 | Press **Escape** while focused on the prompt input | An interrupt signal is sent to the CLI session |
| D-12 | Click the **Back** button | Returns to the dashboard |

---

## D2: Layout and visual regression

| # | Steps | Expected |
|---|-------|----------|
| D-13 | Open a session detail page for a session with very little or no output content | The dark background fills the full height of the page; it is not cut short leaving a white gap below |
| D-14 | Scroll to the bottom of a sparse session detail page | No white or unstyled area is visible below the output stream |
