# Testing and Code Coverage

This document describes the four test suites in the Argus monorepo, how coverage is collected for each, and how the coverage report is generated.

---

## Test suites

Argus has four independent test suites. Each targets a different layer of the stack.

| | Backend unit | Frontend unit | E2E mock | E2E real |
|---|---|---|---|---|
| **Command** | `npm test --workspace=backend` | `npm test --workspace=frontend` | `npm run test:e2e` | `npm run test:e2e:real` |
| **Coverage command** | `npm run test:coverage --workspace=backend` | `npm run test:coverage --workspace=frontend` | `npm run test:coverage:e2e` | `npm run test:coverage:e2e:real` |
| **Test location** | `backend/tests/unit/` `backend/tests/integration/` `backend/tests/contract/` | `frontend/src/**/*.test.*` | `frontend/tests/e2e/` | `frontend/tests/e2e/real-server/` |
| **Config** | `backend/vitest.config.ts` | `frontend/vitest.config.ts` | `playwright.config.ts` | `playwright.real.config.ts` |
| **Technology** | Vitest + V8 | Vitest + jsdom | Playwright + Vite preview | Playwright + live backend |
| **Coverage mechanism** | `@vitest/coverage-v8` | `@vitest/coverage-v8` | `vite-plugin-istanbul` (build-time instrumentation, `window.__coverage__`) | `NODE_V8_COVERAGE` + `c8 report` |
| **Coverage output** | `backend/coverage/coverage-summary.json` | `frontend/coverage/coverage-summary.json` | `frontend/coverage-e2e/coverage-summary.json` | `backend/coverage-e2e/coverage-summary.json` |
| **Coverage notes** | Covers all `backend/src` files including those not imported, via `all: true`. | Covers all `frontend/src` files including those not imported, via `all: true`. | Build step (`VITE_COVERAGE=true`) instruments `frontend/src` at compile time and writes to `frontend/dist-coverage/` (separate from the clean `dist/`). Each Playwright test writes `window.__coverage__` to `frontend/.nyc_output/`. `scripts/merge-e2e-coverage.mjs` merges them into the final summary. | Backend is started with `NODE_V8_COVERAGE` pointing to `backend/coverage-e2e/raw/`. Teardown calls `POST /api/v1/test/shutdown` to trigger a clean `process.exit(0)`, which flushes V8 buffers. A hard kill would lose coverage. `c8 report` converts the raw profiles into the summary. |
| **Test scope** | Services, detectors, API route handlers, WebSocket logic, PTY registry, session lifecycle, DB persistence | React components, hooks, query state, routing, error display, UI interactions | Browser-level UI flows: session list, session detail, prompts, settings, repositories — all API responses faked in-browser | Full user flows against a live backend: real API calls, real DB reads/writes, real WebSocket events |
| **Coverage source scope** | `backend/src` — services, detectors, API routes, WebSocket handlers | `frontend/src` — React components, hooks, query logic | `frontend/src` — UI flows with all API calls mocked | `backend/src` — full stack with real Fastify server and SQLite DB |

### Backend sub-categories

The backend suite (`npm test --workspace=backend`) contains three sub-categories that all run together under Vitest. None of them use a browser.

| Sub-category | Location | What makes it different |
|---|---|---|
| Unit | `backend/tests/unit/` | Everything mocked. No real DB, no real server, no file I/O. Fastest. |
| Integration | `backend/tests/integration/` | Real SQLite DB (temp file via `ARGUS_DB_PATH`) and real file fixtures. Tests the full parse-to-persist pipeline for detectors and stores. No HTTP server. |
| Contract | `backend/tests/contract/` | Real Fastify server started in-process. Makes actual HTTP and WebSocket calls. Tests that API endpoints return the correct status codes, response shapes, and error structures. |

These are unrelated to the E2E suites. The key difference: contract tests call the HTTP API directly from Node with no browser, while the E2E real suite drives a real browser through the full stack. They overlap in scope but serve different purposes — contract tests are faster and pinpoint API regressions; E2E real tests verify the complete user-facing flow.

---

## Running all suites at once

### Tests

```
# Backend + frontend unit tests
npm test

# All four suites
npm run test:all

# Individual E2E suites
npm run test:e2e
npm run test:e2e:real
```

Tests run automatically during `/merge` (Step 3) as a gate — the merge is blocked if any suite fails. `playwright-report/` and `test-results/` are gitignored. There is no committed test results snapshot.

### Coverage

```
# Unit tests only (backend + frontend)
npm run test:coverage

# All four suites + regenerate reports/coverage.md
npm run test:coverage:all

# Individual suites
npm run test:coverage:e2e
npm run test:coverage:e2e:real
```

Coverage is never run automatically during development. It runs during `/merge` (Step 4), which generates `reports/coverage.md` and commits it before merging to master.

All `coverage/` directories are gitignored. Only `reports/coverage.md` is committed.

---

## `reports/coverage.md`

The committed coverage snapshot. Updated automatically on every `/merge`. Format:

```markdown
# Coverage Report

*Generated: YYYY-MM-DD*

| Suite | Statements | Branches | Functions | Lines | Covers |
|-------|------------|----------|-----------|-------|--------|
| backend unit  | XX.XX% | XX.XX% | XX.XX% | XX.XX% | backend/src |
| frontend unit | XX.XX% | XX.XX% | XX.XX% | XX.XX% | frontend/src |
| e2e mock      | XX.XX% | XX.XX% | XX.XX% | XX.XX% | frontend/src |
| e2e real      | XX.XX% | XX.XX% | XX.XX% | XX.XX% | backend/src |
```

---

## Build isolation for E2E mock coverage

The E2E mock coverage run builds the frontend with instrumentation to `frontend/dist-coverage/` instead of `frontend/dist/`. This keeps the production-ready clean build intact. `vite preview` reads `outDir` from `vite.config.ts` at startup, so it automatically serves the correct directory based on the `VITE_COVERAGE` environment variable.

| `VITE_COVERAGE` | Build output | Served by `vite preview` |
|---|---|---|
| unset | `frontend/dist/` | `frontend/dist/` |
| `true` | `frontend/dist-coverage/` | `frontend/dist-coverage/` |

---

## Key implementation notes

- **`NODE_V8_COVERAGE` must be an absolute path at process start.** `backend/start-test-server.mjs` calls `path.resolve()` on the value before the server imports anything. V8 reads the env var at startup and a relative path resolves against whichever directory Node was invoked from, not the repo root.

- **`vite-plugin-istanbul` requires `forceBuildInstrument: true`.** Without it, instrumentation is silently skipped in production builds (non-dev mode).

- **`POST /api/v1/test/shutdown` is only registered when `NODE_V8_COVERAGE` is set.** The endpoint is not present in normal server builds and has zero overhead at runtime.

- **`istanbul-lib-coverage` and `istanbul-lib-report` are CommonJS modules.** In `.mjs` files, import them via the default export: `import pkg from 'istanbul-lib-coverage'; const { createCoverageMap } = pkg;`
