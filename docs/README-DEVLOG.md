# Argus: Development Log

A day-by-day account of what was built, fixed, and decided from the first commit to today. The secondary purpose of this document is a retrospective on how AI-assisted development evolved across the project — not just the code, but the practice of working with AI tools.

---

## Retrospective: How AI Tool Usage Evolved

### Week 1 in summary

Argus went from an empty repository to a working multi-feature product with security hardening, CI, a test suite, and onboarding in six days of active work. That pace is only possible because of how the AI tools were used — and that usage changed noticeably across the week.

### Day 1: AI as executor inside a rigid scaffold

The first day established the pattern that made everything else possible: Speckit. Before a single line of application code was written, the spec was written, clarified, planned, and tasked. The AI was operating inside a strict pipeline with defined outputs at each stage (spec.md, plan.md, tasks.md), and the implementation was driven by a numbered task list.

The outcome was impressive on the surface — a full-stack application in one day — but it also showed the limits of that approach. The session detection logic had bugs that only surfaced with real data, the UI needed significant rework after first use, and the architecture had gaps that needed subsequent features to fill. The AI was fast, but it was building to the spec, not to experience.

**Key dynamic:** AI as a fast implementer executing human-designed tasks. The value of Speckit was that it forced upfront thinking that a pure "just build it" prompt would have skipped.

### Day 2: Real usage reveals what AI missed

The second day was largely about fixing what real usage exposed. Bugs in Copilot CLI detection (js-yaml date coercion, Windows path handling), a null-PID check that silently broke session liveness, sessions that never ended when their process stopped. None of these were spec failures — they were things that only appear when you run the tool against real sessions on a real machine.

The more significant shift: the user started encoding workflows into reusable AI skills. The `/bug` and `/merge` skills were created on day 2. This was the first sign of a new pattern — using the AI not just to write code but to formalise how the AI itself should approach recurring tasks.

**Key dynamic:** Moving from "AI does what I ask" to "AI follows a process I've defined for this class of work." The skills are standing instructions that constrain and guide future AI behaviour.

### Day 3: Trusting the AI with judgment calls

Day 3 saw a wave of UI polish — page backgrounds, font sizes, metadata layout — that went through many iterations in quick succession. The commits show: `fix: change page background from gray-50 to slate-200`, then `to zinc-200`, then `to bg-sky-100`, then `to bg-sky-50`, then `to bg-slate-50`. This is a human using the AI as a fast feedback loop for visual decisions, not a human specifying outcomes and having the AI execute.

This was also the day the security spec was written. Committing to systematic security work on day 3 — before the product had any users — reflects a deliberate choice to treat AI-assisted development as capable of professional-grade output, not just a prototype.

**Key dynamic:** The AI as a collaborator in an iterative design loop, not just a code generator. And growing trust that a rigorous feature (security hardening) could be handled through the same speckit pipeline as a UI component.

### Day 4: Systematic over ad-hoc

Day 4 is the most striking day in the log. Supply chain hardening (exact version pinning, SHA-pinned CI actions, lifecycle script allowlist, dependency advisory blocking), security hardening (21 tasks), real E2E tests, and a full 6-phase user onboarding feature — all in one day, all through the speckit pipeline.

This only worked because of the trust established in the previous three days. The user had evidence that the AI could handle security-sensitive work (from day 3's security spec), systematic test writing (from the test suite patterns established on days 1–2), and multi-phase features (from the session dashboard). Day 4 used that trust to stack ambitious work.

The `/e2e` skill was also added on day 4. The pattern of "encode the process into a skill once, reuse it repeatedly" was now an established habit.

**Key dynamic:** Compounding returns. Earlier investment in process (speckit pipeline, committed skills, constitution) meant day 4 could move faster and more safely than day 1 despite being more ambitious.

### Day 5–6: Docs and GTM as first-class outputs

The final days show another shift: the AI being used not just to write application code but to produce artifacts that require judgment — architecture documentation, a CLI comparison spec, a go-to-market analysis. The GTM document required the AI to research an external product (OpenClaw), synthesise findings, and produce a reasoned recommendation across four decisions. That is a different kind of task than implementing T047.

This reflects a mature working relationship with AI tools: comfort delegating research and synthesis, not just implementation. It also reflects the user's growing confidence that AI-produced written artifacts are worth keeping and sharing, not just scaffolding to be replaced later.

**Key dynamic:** AI as a thinking partner on strategic questions, not just a coding tool. The retrospective you are reading now is the endpoint of that evolution.

---

### Patterns that emerged

| Practice | When it appeared | What it unlocked |
|----------|-----------------|------------------|
| Speckit pipeline (spec → clarify → plan → tasks → implement) | Day 1 | Structured implementation with defined checkpoints |
| Committed skills (/bug, /merge, /e2e, /pull) | Days 2–4 | Reusable AI workflows; consistent behaviour across sessions |
| Constitution | Day 1 | Non-negotiable principles that `speckit.analyze` enforces |
| Security-first feature scoping | Day 3 | Professional-grade output from day 4 onwards |
| AI-driven UI iteration | Day 3 | Fast visual feedback loop without manual builds |
| Research and synthesis delegation | Day 6 | Strategic documents produced alongside code |

---

## Day 1 — March 31, 2026

**Enlistment and full first feature shipped end-to-end.**

The repository was created and immediately bootstrapped with the full Speckit SDD infrastructure: CLAUDE.md, Copilot instructions, Specify/Speckit setup, and the constitution ratification workflow. The Argus constitution was ratified at v1.0.0, restructured to v1.0.1 for readability, then amended to v1.1.0 to add exception clauses.

From there, feature 001 (Session Dashboard) went through the full speckit pipeline in one day: specify, clarify, plan, tasks, analyze (resolving all 15 findings), and implement. By end of day every task from T001 to T052 was complete:

- Monorepo structure (npm workspaces, backend + frontend)
- Backend: SQLite schema, database helpers, ArgusConfig loader, TypeScript models, Fastify server with WebSocket event dispatcher, Copilot CLI detector, Claude Code detector with hook injection, session monitor orchestrator, output store, repository and session REST routes, hooks endpoint
- Frontend: Vite + React + Tailwind setup, TanStack Query, WebSocket client with exponential backoff, Dashboard page with repository cards and session counts, SessionCard component with type and status badges, SessionPage with live output stream, ControlPanel with stop and send-prompt

The core architecture — file-system detection, SQLite storage, WebSocket push, React SPA — was fully established on day one.

---

## Day 2 — April 1, 2026

**First merge, four features, substantial bug fixing, and tooling additions.**

Feature 001 merged into master. The rest of the day stacked four more features on top:

**Feature 005 — Dashboard Settings**
Added show/hide controls for ended sessions, and a separate setting to hide repos with no active sessions. Settings are persisted in localStorage.

**Feature 006 — Session Detail UX Redesign**
Rewrote the session detail view in response to real usage feedback: unified dark output stream, a unified prompt bar across session types, official Claude/Copilot brand icons, inactive session detection, and removal of the stop button from the detail page.

**Feature 007 — Claude Code Live Output and Model Display**
Claude Code sessions now stream output in real time via the JSONL file watcher. Model name appears as a badge on each session card. Role labels (YOU/AI/TOOL/RESULT) added to output lines. Several active-state bugs fixed.

**Repository management**
Replaced the original folder-browser modal with a native OS folder picker dialog. Added "scan folder" bulk import — pick a parent directory and Argus registers every git repo it finds inside. Added a "don't ask again" checkbox to the remove-repo confirmation dialog.

**Bug fixes (logged)**
- Null-PID falsy check was marking valid sessions as stale
- Windows psList does not include cwd, breaking session matching
- js-yaml was coercing ISO timestamps to Date objects, breaking Copilot CLI session detection
- Sessions were not being marked ended when their process stopped
- Stale active sessions from a previous run were not being reconciled on startup

**Skills added**
- `/bug` — adds a bug task to tasks.md, investigates, fixes, and commits
- `/merge` — runs a constitution-gate check then merges to master

---

## Day 3 — April 2, 2026

**Architecture documentation, output stream polish, a wave of bug fixes, and security planning.**

Added a formal architecture document (README-ARCH.md) with a Mermaid flowchart. Added `tsx --watch` for hot-reload during backend development.

**Output stream improvements**
Two-column layout for output lines (badge column + content column). Markdown rendering for AI response text. Consistent dark preview strip across all session cards. Resting/running status icons for sessions in different states.

**UI polish pass**
Metadata sizing (model name, PID, elapsed time, session ID) standardised to `text-[10px]` font-mono. All metadata coloured uniformly. Page background settled on `bg-slate-50` after several iterations. `Add Repository` button sizing and padding refined.

**Bug fixes (T084–T094)**
- Browser timezone used for timestamps instead of hardcoded PST
- Raw JSON was leaking into tool event content (Copilot CLI parser cleanup)
- Copilot CLI sessions never showed a model name (model now extracted from `data.model` on tool completion events)
- Copilot CLI nested `data` object format was not being parsed (flat and nested formats now both handled)
- Claude Code session ID was derived from hook payload instead of JSONL filename, causing phantom sessions
- `Stop` hook was setting status to `ended` instead of `idle`
- Claude Code sessions were not ending when the process exited (periodic PID liveness check added)
- Stale null-PID Claude Code sessions now cleaned up using JSONL file freshness (30-minute threshold)

**Feature 009 scoped**
Security hardening specification, plan, and task list created for the next day's work.

---

## Day 4 — April 3, 2026

**Security hardening, supply chain protection, real E2E tests, user onboarding, and CI expansion.**

Four features merged into master.

**Feature 004 — Real-Server E2E Tests**
A second Playwright tier that runs against a live backend with an isolated database. Tests cover the full request/response cycle including session detection and WebSocket events.

**Features 009 and 010 — Security Hardening and Supply Chain**
All 21 security tasks complete:
- Process control: stop/interrupt validate PID ownership in two stages (session record + OS process allowlist check)
- Shell injection: all `taskkill` calls use `spawnSync` with an explicit args array
- Hook endpoint: UUID v4 validation, 64 KB body limit, cwd allowlist, PID-overwrite rejection with 409
- Filesystem routes: all user-supplied paths validated against homedir and registered repos, symlink traversal blocked
- HTTP headers: `X-Content-Type-Options` and `X-Frame-Options` on all responses

Supply chain hardening (feature 010):
- `npm ci --ignore-scripts` in CI; lifecycle allowlist for packages that need to rebuild
- All GitHub Action `uses:` directives pinned to 40-character commit SHAs
- Exact dependency versions (no `^` or `~`) in all package.json files
- Lockfile integrity enforced in CI
- Dependency advisory check on PRs to master
- 7 known CVEs patched; pinned version validation script added to CI

**Feature 012 — User Onboarding**
Full 6-step interactive tour using React Joyride. Auto-launches on first dashboard load. Settings panel exposes restart and reset controls. Three dismissible hint badges on the session detail page. 30 tasks across 7 phases, all complete.

**Frontend unit tests**
68 unit tests added across 6 components and hooks, integrated into the CI pipeline.

**Tooling**
- `/e2e` skill added for writing Playwright tests following codebase conventions
- Branch auto-delete after successful merge
- Duplicate agent/prompt files removed (CLAUDE.md is the single source of truth)
- ARGUS_PORT environment variable honoured by config loader

---

## Day 5 — April 5, 2026

*(No commits on April 4.)*

**CI hardening, todo list feature, onboarding polish.**

**CI pipeline expansion**
- Backend build step added so TypeScript compilation errors block merge
- Playwright mock E2E suite added to CI
- Pinned-version validation runs on every build
- CI scope narrowed to master pushes and PRs targeting master

**Feature 014 — Engineer Todo List ("To Tackle")**
A persistent task panel on the right side of the dashboard. Items are stored in SQLite. Full backend (REST CRUD) and frontend (React panel with add, check off, delete). Complete test coverage: unit tests, mocked E2E, real-server E2E.

**Onboarding polish**
Tour tooltip restyled to match the app theme. Tour copy rewritten with friendlier messaging. All E2E onboarding tests passing against both mock and real-server tiers. Tour suppressed in E2E test runs to prevent overlay blocking click targets.

---

## Day 6 — April 6, 2026

**Todo panel UX overhaul, docs restructure, and GTM planning.**

**Todo panel UX (feature 014 extension)**
After the initial implementation, the panel received a full UX redesign:
- Inline editing (click any item to edit in place, no separate edit mode)
- Hover delete button overlaid on the timestamp
- Relative timestamps on each item, toggleable
- Toggle to show/hide completed items
- Newest items appear at the top
- Textarea replaces input for multiline content
- Output pane and todo panel share a right column, stacked

**Merged feature 014** into master after all tests passing.

**Feature 015 — Docs Cleanup (in progress)**
- Created `docs/` folder and moved all `README-*.md` files into it
- Renamed `BUG-LEARNINGS.md` to `README-LEARNINGS.md` and `MANUAL-TESTS.md` to `README-MANUAL-TESTS.md`
- Removed all em dashes from documentation (style rule: use comma, colon, or parentheses instead)
- Restructured `README.md` as a user-facing document; moved contributor content to `README-CONTRIBUTORS.md`
- Added `README-CLI-COMPARISON.md` comparing Claude Code and Copilot CLI stream formats, parsers, state models, and data availability — with example JSONL messages for each event type
- Added `README-GTM.md` exploring go-to-market decisions (public vs private, desktop vs web, login vs no login) using OpenClaw as the primary reference, with a side-by-side comparison table

**New skills**
- `/pull` — fetches latest from master and merges into the current branch
- `/speckit.run` — runs the full Speckit pipeline end-to-end from a single feature description
- Merge skill updated: waits for CI to pass before deleting the feature branch
