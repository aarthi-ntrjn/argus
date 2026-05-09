import { useQuery } from '@tanstack/react-query';
import { getUpdateStatus, type UpdateStatus } from '../services/api';

export function useUpdateStatus(): UpdateStatus | undefined {
  const { data } = useQuery({
    queryKey: ['update-status'],
    queryFn: getUpdateStatus,
    refetchOnWindowFocus: false,
  });
  return data;
}
