# Argus: Output Stream Manual Tests

Manual tests for the inline output pane and real-time updates. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)
2. At least one session with output exists

---

## P0: Inline output pane (desktop)

**Prerequisites:** Desktop viewport (>768px).

| # | Steps | Expected |
|---|-------|----------|
| P-01 | Click on a session card | An output pane slides in on the right side showing the session's output stream |
| P-02 | Click the same session card again | The output pane closes |
| P-03 | Click a different session card while the pane is open | The pane updates to show the newly selected session's output |
| P-04 | Press **Escape** while the output pane is open | The pane closes |

---

## P1: Real-time updates (WebSocket)

**Prerequisites:** The dashboard is open and at least one session is active.

| # | Steps | Expected |
|---|-------|----------|
| P-05 | Open the dashboard with an active session | The session card's elapsed time updates in real time without refreshing |
| P-06 | From another terminal, trigger activity on an active session | The session card's last output preview and status update automatically |
| P-07 | End a session externally (e.g. type `/exit` in a Claude terminal) | The session card transitions to "ended" status within a few seconds without refreshing |
| P-08 | Open browser DevTools > Network > WS tab | A WebSocket connection to `/ws` is active; events like `session.updated` appear in the message log |
