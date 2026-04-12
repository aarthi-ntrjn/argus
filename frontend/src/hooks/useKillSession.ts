import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stopSession } from '../services/api';

export function useKillSession() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (sessionId: string) => stopSession(sessionId),
    onSuccess: (_data, sessionId) => {
      setDialogOpen(false);
      setTargetSessionId(null);
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  function requestKill(sessionId: string) {
    mutation.reset();
    setTargetSessionId(sessionId);
    setDialogOpen(true);
  }

  function confirmKill() {
    if (targetSessionId) {
      mutation.mutate(targetSessionId);
    }
  }

  function cancelKill() {
    setDialogOpen(false);
    setTargetSessionId(null);
    mutation.reset();
  }

  return {
    dialogOpen,
    targetSessionId,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    requestKill,
    confirmKill,
    cancelKill,
    reset: mutation.reset,
  };
}
