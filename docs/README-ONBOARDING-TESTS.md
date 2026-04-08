# Argus: Onboarding Manual Tests

Manual tests for the onboarding tour and first-visit experience. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)

---

## S2: Onboarding tour (first visit)

**Prerequisites:** Clear localStorage or click "Reset Onboarding" in settings to simulate a first visit.

| # | Steps | Expected |
|---|-------|----------|
| S2-01 | Open the dashboard for the first time (or after resetting onboarding) | The onboarding tour starts automatically; the first step highlights the header with a "Welcome Commander!" message |
| S2-02 | Click **Next** | The tour advances to step 2, highlighting the "Add Repository" button with an explanation of folder scanning |
| S2-03 | Click **Next** through all remaining steps | Each step highlights its target element (repo cards, session cards, settings, final message); progress counter updates (e.g. "3 of 6") |
| S2-04 | On the final step, click **Done** | The tour closes; the dashboard is fully interactive |
| S2-05 | Refresh the page | The tour does not restart (completion is persisted in localStorage) |
| S2-06 | Restart the tour: open Settings, click "Restart Tour" | The tour begins again from step 1 |
| S2-07 | Press **Escape** during any tour step | The tour closes immediately |
| S2-08 | Click **Skip** on any step | The tour closes; it does not restart on refresh |
