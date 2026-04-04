import { useQuery, useMutation } from '@tanstack/react-query';
import { getTodos, createTodo, toggleTodo, deleteTodo, queryClient } from '../services/api';

const QUERY_KEY = ['todos'];

export function useTodos() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: getTodos });
}

export function useCreateTodo() {
  return useMutation({
    mutationFn: (text: string) => createTodo(text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useToggleTodo() {
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => toggleTodo(id, done),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteTodo() {
  return useMutation({
    mutationFn: (id: string) => deleteTodo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
