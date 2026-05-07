import { useState, useCallback } from 'react';
import type { ToolCommand } from '../types';

export interface PendingLauncher {
  ptyLaunchId: string;
  repoPath: string;
  tool: ToolCommand;
  createdAt: string;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

const PENDING_TIMEOUT_MS = 30_000;

export function usePendingLaunchers() {
  const [pendingLaunchers, setPendingLaunchers] = useState<Map<string, PendingLauncher>>(
    () => new Map(),
  );

  const removePending = useCallback((ptyLaunchId: string) => {
    setPendingLaunchers((prev) => {
      const entry = prev.get(ptyLaunchId);
      if (!entry) {
        return prev;
      }
      clearTimeout(entry.timeoutHandle);
      const next = new Map(prev);
      next.delete(ptyLaunchId);
      return next;
    });
  }, []);

  const addPending = useCallback(
    (ptyLaunchId: string, repoPath: string, tool: ToolCommand) => {
      const timeoutHandle = setTimeout(() => {
        removePending(ptyLaunchId);
      }, PENDING_TIMEOUT_MS);

      setPendingLaunchers((prev) => {
        const next = new Map(prev);
        next.set(ptyLaunchId, {
          ptyLaunchId,
          repoPath,
          tool,
          createdAt: new Date().toISOString(),
          timeoutHandle,
        });
        return next;
      });
    },
    [removePending],
  );

  return { pendingLaunchers, addPending, removePending };
}
