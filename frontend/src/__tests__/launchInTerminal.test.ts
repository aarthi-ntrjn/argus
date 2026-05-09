import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { launchInTerminal } from '../services/api';

describe('launchInTerminal — ptyLaunchId in 202 response', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns ptyLaunchId from 202 response', async () => {
    const expectedId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: 'launched', ptyLaunchId: expectedId }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await launchInTerminal('claude', '/my/repo');

    expect(result.ptyLaunchId).toBe(expectedId);
  });

  it('returns ptyLaunchId as undefined when absent from 202 body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: 'launched' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await launchInTerminal('claude', '/my/repo');

    expect(result.ptyLaunchId).toBeUndefined();
  });

  it('does not return ptyLaunchId on 422 headless response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'no-terminal', cmd: 'node launch.js claude --cwd /my/repo' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await launchInTerminal('claude', '/my/repo');

    expect(result.ptyLaunchId).toBeUndefined();
    expect(result.cmd).toBe('node launch.js claude --cwd /my/repo');
  });

  it('throws on non-202/422 status', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: 'internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(launchInTerminal('claude', '/my/repo')).rejects.toThrow('internal error');
  });
});
