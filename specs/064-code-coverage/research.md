# Research: Code Coverage Reporting

**Branch**: `064-code-coverage` | **Date**: 2026-05-02

## Decision 1: Coverage Provider

**Decision**: Use the existing `@vitest/coverage-v8` provider in both workspaces.

**Rationale**: Both workspaces already have `@vitest/coverage-v8` in `devDependencies`. The V8 provider uses Node.js's built-in V8 coverage engine, which is fast, requires no Babel transforms, and produces accurate results for TypeScript via source maps. No new packages need to be installed.

**Alternatives Considered**:
- `@vitest/coverage-istanbul`: More portable but slower; requires instrumentation transforms. Not worth switching when V8 is already installed.

---

## Decision 2: Backend `vitest.config.ts` Fix

**Decision**: Add `all: true` to the existing `coverage` block in `backend/vitest.config.ts`.

**Rationale**: The current config includes `include: ['src/**/*.ts']` but lacks `all: true`. Without it, Vitest only reports coverage for files that were actually imported during the test run. Setting `all: true` forces all matching files (including untested ones) to appear at 0%, satisfying FR-004 and SC-004.

**Current state** (lines 17-22 of `backend/vitest.config.ts`):
```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['src/**/*.ts'],
  exclude: ['node_modules', 'dist', 'src/**/*.d.ts'],
},
```

**Required change**: Add `all: true` inside the coverage block.

---

## Decision 3: Frontend `vitest.config.ts` Coverage Block

**Decision**: Add a `coverage` block to `frontend/vitest.config.ts` mirroring the backend config, with `include` covering `.ts` and `.tsx` source files and excluding test files and setup files.

**Rationale**: The frontend has no coverage config at all. The coverage block needs `include` paths that match the actual source (not test) files, and `exclude` that drops test files, setup, config files, and type declarations.

**New coverage block**:
```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['src/**/*.ts', 'src/**/*.tsx'],
  exclude: [
    'node_modules',
    'dist',
    'src/**/*.d.ts',
    'src/test/**',
    'src/**/*.test.ts',
    'src/**/*.test.tsx',
  ],
  all: true,
},
```

---

## Decision 4: `test:coverage` Script Placement

**Decision**: Add `test:coverage` to `backend/package.json`, `frontend/package.json`, and the root `package.json`.

**Rationale**:
- Backend already has `"test:coverage": "vitest run --coverage"` — verify it works; no change needed unless missing.
- Frontend has no `test:coverage` script — add `"test:coverage": "vitest run --coverage"`.
- Root uses npm workspaces; add `"test:coverage": "npm run test:coverage --workspace=backend && npm run test:coverage --workspace=frontend"` to run both in sequence and propagate the exit code correctly.

**Alternative for root**: `npm run test:coverage --workspaces` would run both but in potentially undefined order and might not propagate failures well. Sequential `&&` is clearer and fails fast.

---

## Decision 5: HTML Report Output Location

**Decision**: Accept Vitest's default output directory (`coverage/`) in each workspace root.

**Rationale**: `backend/coverage/` and `frontend/coverage/` are already excluded by `.gitignore` (standard Vitest convention). No additional gitignore changes needed.
