import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePendingLaunchers } from './usePendingLaunchers';

describe('usePendingLaunchers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts with an empty pending launcher map', () => {
    const { result } = renderHook(() => usePendingLaunchers());
    expect(result.current.pendingLaunchers.size).toBe(0);
  });

  it('adds a pending launcher on addPending', () => {
    const { result } = renderHook(() => usePendingLaunchers());
    act(() => {
      result.current.addPending('uuid-1', '/repo/myproject', 'claude');
    });
    expect(result.current.pendingLaunchers.size).toBe(1);
    const entry = result.current.pendingLaunchers.get('uuid-1');
    expect(entry?.ptyLaunchId).toBe('uuid-1');
    expect(entry?.repoPath).toBe('/repo/myproject');
    expect(entry?.tool).toBe('claude');
  });

  it('removes a pending launcher on removePending', () => {
    const { result } = renderHook(() => usePendingLaunchers());
    act(() => {
      result.current.addPending('uuid-2', '/repo/a', 'copilot');
    });
    expect(result.current.pendingLaunchers.size).toBe(1);
    act(() => {
      result.current.removePending('uuid-2');
    });
    expect(result.current.pendingLaunchers.size).toBe(0);
  });

  it('auto-removes a pending launcher after 30 seconds', () => {
    const { result } = renderHook(() => usePendingLaunchers());
    act(() => {
      result.current.addPending('uuid-3', '/repo/b', 'claude');
    });
    expect(result.current.pendingLaunchers.size).toBe(1);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.pendingLaunchers.size).toBe(0);
  });

  it('supports multiple concurrent pending launchers', () => {
    const { result } = renderHook(() => usePendingLaunchers());
    act(() => {
      result.current.addPending('uuid-4', '/repo/c', 'claude');
      result.current.addPending('uuid-5', '/repo/d', 'copilot');
    });
    expect(result.current.pendingLaunchers.size).toBe(2);
    act(() => {
      result.current.removePending('uuid-4');
    });
    expect(result.current.pendingLaunchers.size).toBe(1);
    expect(result.current.pendingLaunchers.has('uuid-5')).toBe(true);
  });

  it('clears timeout when removePending is called early', () => {
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    const { result } = renderHook(() => usePendingLaunchers());
    act(() => {
      result.current.addPending('uuid-6', '/repo/e', 'claude');
    });
    act(() => {
      result.current.removePending('uuid-6');
    });
    expect(clearSpy).toHaveBeenCalled();
  });
});
