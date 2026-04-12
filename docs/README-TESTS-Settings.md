# Argus: Settings Panel Manual Tests

Manual tests for the settings panel. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)
2. At least one repository registered with both active and ended sessions

---

## G0: Settings panel

| # | Steps | Expected |
|---|-------|----------|
| G-01 | Click the gear icon in the header | A settings dropdown panel opens |
| G-02 | Check the available toggles | "Hide ended sessions", "Hide repos with no active sessions", and "Hide inactive sessions (>20 min)" checkboxes are visible |
| G-03 | Toggle **Hide ended sessions** ON | Ended session cards disappear from the dashboard |
| G-04 | Toggle **Hide ended sessions** OFF | Ended session cards reappear |
| G-05 | Toggle **Hide repos with no active sessions** ON | Repos that have only ended/completed sessions disappear |
| G-06 | Toggle **Hide repos with no active sessions** OFF | Hidden repos reappear |
| G-07 | Toggle **Hide inactive sessions** ON | Sessions with no output in the last 20 minutes disappear |
| G-08 | Toggle **Hide inactive sessions** OFF | Hidden inactive sessions reappear |
| G-09 | Press **Escape** or click outside the panel | The settings panel closes |
| G-10 | Check the bottom of the settings panel | A "Restart Tour" link is visible |

---

## G1: Yolo mode

**Prerequisites:** At least one repository with Claude Code or Copilot installed.

| # | Steps | Expected |
|---|-------|----------|
| G-11 | Open Settings and check the "Launch Behaviour" section | A "Yolo mode" checkbox is visible under a "Launch Behaviour" heading, below the session filter toggles |
| G-12 | Toggle **Yolo mode** ON | A warning dialog appears explaining that all permission checks will be bypassed |
| G-13 | Click **Cancel** in the warning dialog | The dialog closes, the Yolo mode checkbox remains unchecked |
| G-14 | Toggle **Yolo mode** ON and click **Enable Yolo Mode** | The dialog closes, the checkbox is checked, and a yellow "All permission checks disabled" label appears beneath it |
| G-15 | With Yolo mode ON, copy a Claude launch command | The copied command includes `--dangerously-skip-permissions` |
| G-16 | With Yolo mode ON, copy a Copilot launch command | The copied command includes `--allow-all` |
| G-17 | With Yolo mode ON, click **Launch Claude** from the Launch dropdown for any repo | A new terminal window opens; open Task Manager, find the `claude.exe` process, and verify its command line includes `--dangerously-skip-permissions` |
| G-18 | With Yolo mode ON, click **Launch Copilot** from the Launch dropdown for any repo | A new terminal window opens; open Task Manager, find the `copilot.exe` process, and verify its command line includes `--allow-all` |
| G-19 | Toggle **Yolo mode** OFF | No dialog appears; the checkbox unchecks immediately and the warning label disappears |
| G-20 | With Yolo mode OFF, click **Launch Claude** | A new terminal window opens; open Task Manager, find the `claude.exe` process, and verify its command line does NOT include `--dangerously-skip-permissions` |
| G-21 | With Yolo mode OFF, click **Launch Copilot** | A new terminal window opens; open Task Manager, find the `copilot.exe` process, and verify its command line does NOT include `--allow-all` |
| G-22 | With Yolo mode OFF, copy a Claude launch command | The copied command does NOT include `--dangerously-skip-permissions` |
| G-23 | With Yolo mode OFF, copy a Copilot launch command | The copied command does NOT include `--allow-all` |
