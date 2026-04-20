import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const root = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');

// T125: @homebridge/node-pty-prebuilt-multiarch was a dead dependency with an
// engine constraint of >=18.0.0 <25.0.0 that produced EBADENGINE warnings on
// Node 25.x. The package was never imported anywhere; all PTY usage goes through
// node-pty directly. These tests prevent it from being re-added.

describe('package.json dependency hygiene (T125)', () => {
  it('root package.json does not depend on @homebridge/node-pty-prebuilt-multiarch', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies };
    expect(deps).not.toHaveProperty('@homebridge/node-pty-prebuilt-multiarch');
  });

  it('backend/package.json does not depend on @homebridge/node-pty-prebuilt-multiarch', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'backend', 'package.json'), 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies };
    expect(deps).not.toHaveProperty('@homebridge/node-pty-prebuilt-multiarch');
  });
});
