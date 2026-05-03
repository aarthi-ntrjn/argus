# Testing and Code Coverage

This document describes the four test suites in the Argus monorepo, how coverage is collected for each, and how the coverage report is generated.

---

## Test suites

Argus has four independent test suites. Each targets a different layer of the stack.

| Suite | Command | Test location | Config | Technology | Coverage mechanism | What it covers |
|---|---|---|---|---|---|---|
| Backend unit | `npm test --workspace=backend` | `backend/tests/unit/`, `backend/tests/integration/`, `backend/tests/contract/` | `backend/vitest.config.ts` | Vitest + V8 | `@vitest/coverage-v8` | `backend/src` — services, detectors, API routes, WebSocket handlers |
| Frontend unit | `npm test --workspace=frontend` | `frontend/src/**/*.test.*` | `frontend/vitest.config.ts` | Vitest + jsdom | `@vitest/coverage-v8` | `frontend/src` — React components, hooks, query logic |
| E2E mock | `npm run test:e2e` | `frontend/tests/e2e/` | `playwright.config.ts` | Playwright + Vite preview | `vite-plugin-istanbul` (build-time instrumentation, `window.__coverage__`) | `frontend/src` — UI flows with all API calls mocked |
| E2E real | `npm run test:e2e:real` | `frontend/tests/e2e/real-server/` | `playwright.real.config.ts` | Playwright + live backend | `NODE_V8_COVERAGE` + `c8 report` | `backend/src` — full stack with real Fastify server and SQLite DB |

### Backend sub-categories

The backend suite (`npm test --workspace=backend`) contains three sub-categories that all run together under Vitest. None of them use a browser.

| Sub-category | Location | What makes it different |
|---|---|---|
| Unit | `backend/tests/unit/` | Everything mocked. No real DB, no real server, no file I/O. Fastest. |
| Integration | `backend/tests/integration/` | Real SQLite DB (temp file via `ARGUS_DB_PATH`) and real file fixtures. Tests the full parse-to-persist pipeline for detectors and stores. No HTTP server. |
| Contract | `backend/tests/contract/` | Real Fastify server started in-process. Makes actual HTTP and WebSocket calls. Tests that API endpoints return the correct status codes, response shapes, and error structures. |

These are unrelated to the E2E suites. The key difference: contract tests call the HTTP API directly from Node with no browser, while the E2E real suite drives a real browser through the full stack. They overlap in scope but serve different purposes — contract tests are faster and pinpoint API regressions; E2E real tests verify the complete user-facing flow.

---

## Coverage collection

Each suite uses a different coverage mechanism suited to its runtime environment.

### Backend unit: V8 via Vitest

Vitest runs with `@vitest/coverage-v8`. Coverage is collected across all `backend/src` files (including those not imported during the run, via `all: true`).

```
npm run test:coverage --workspace=backend
```

Output: `backend/coverage/coverage-summary.json`

### Frontend unit: V8 via Vitest

Same mechanism as backend. Coverage is collected across all `frontend/src` files.

```
npm run test:coverage --workspace=frontend
```

Output: `frontend/coverage/coverage-summary.json`

### E2E mock: Istanbul via `vite-plugin-istanbul`

The frontend is built with `VITE_COVERAGE=true`, which activates `vite-plugin-istanbul` in `vite.config.ts`. This instruments every `frontend/src` file at build time so `window.__coverage__` is populated in-browser as Playwright tests run.

After each test, the fixture (`frontend/tests/e2e/fixtures.ts`) reads `window.__coverage__` from the page and writes a per-test JSON file to `frontend/.nyc_output/`.

After all tests finish, `scripts/merge-e2e-coverage.mjs` merges those files using `istanbul-lib-coverage` and writes the combined summary.

```
npm run test:coverage:e2e
```

This script runs three steps in sequence:
1. `VITE_COVERAGE=true npm run build --workspace=frontend` (instruments and writes to `frontend/dist-coverage/`)
2. `VITE_COVERAGE=true npm run test:e2e --workspace=frontend` (Playwright serves from `dist-coverage/`)
3. `node scripts/merge-e2e-coverage.mjs` (merges per-test JSONs)

Output: `frontend/coverage-e2e/coverage-summary.json`

### E2E real: V8 via `NODE_V8_COVERAGE` and `c8`

The real-server Playwright config starts the backend (`backend/start-test-server.mjs`) with `NODE_V8_COVERAGE` set to an absolute path. Node's V8 engine writes raw coverage profiles to that directory while the server runs.

When the test suite finishes, `global-teardown.ts` calls `POST /api/v1/test/shutdown` to trigger a clean `process.exit(0)`, which flushes the V8 coverage buffers. A hard process kill would not flush them.

After the server exits, `c8 report` converts the raw V8 profiles into a JSON summary.

```
npm run test:coverage:e2e:real
```

This script:
1. Sets `NODE_V8_COVERAGE=./backend/coverage-e2e/raw` and runs the real-server E2E suite
2. Runs `c8 report --reporter=json-summary --reporter=text --src=backend/src --temp-directory=backend/coverage-e2e/raw --reports-dir=backend/coverage-e2e --all`

Output: `backend/coverage-e2e/coverage-summary.json`

---

## Running all suites at once

```
# Unit tests only (backend + frontend)
npm run test:coverage

# All four suites (run in sequence)
npm run test:coverage
npm run test:coverage:e2e
npm run test:coverage:e2e:real
```

Coverage is never run automatically during development. It runs during `/merge` (Step 4), which generates `reports/coverage.md` and commits it before merging to master.

---

## Output locations

| Suite | Summary JSON | HTML report |
|---|---|---|
| Backend unit | `backend/coverage/coverage-summary.json` | `backend/coverage/index.html` |
| Frontend unit | `frontend/coverage/coverage-summary.json` | `frontend/coverage/index.html` |
| E2E mock | `frontend/coverage-e2e/coverage-summary.json` | (none) |
| E2E real | `backend/coverage-e2e/coverage-summary.json` | (none) |

All `coverage/` directories are gitignored. Only `reports/coverage.md` is committed.

---

## `reports/coverage.md`

The committed coverage snapshot. Updated automatically on every `/merge`. Format:

```markdown
# Coverage Report

*Generated: YYYY-MM-DD | Branch: <branch>*

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
