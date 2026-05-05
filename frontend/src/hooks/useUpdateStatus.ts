import { useQuery } from '@tanstack/react-query';
import { getUpdateStatus, type UpdateStatus } from '../services/api';

export function useUpdateStatus(): UpdateStatus | undefined {
  const { data } = useQuery({
    queryKey: ['update-status'],
    queryFn: getUpdateStatus,
    refetchInterval: 60_000,
    staleTime: 55_000,
  });
  return data;
}
