import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TodoPanel from './TodoPanel';

// Mock all hooks used by TodoPanel
vi.mock('../../hooks/useTodos', () => ({
  useTodos: vi.fn(),
  useCreateTodo: vi.fn(),
  useUpdateTodoText: vi.fn(),
  useToggleTodo: vi.fn(),
  useDeleteTodo: vi.fn(),
}));

import { useTodos, useCreateTodo, useUpdateTodoText, useToggleTodo, useDeleteTodo } from '../../hooks/useTodos';

const mockUseTodos = vi.mocked(useTodos);
const mockUseCreateTodo = vi.mocked(useCreateTodo);
const mockUseUpdateTodoText = vi.mocked(useUpdateTodoText);
const mockUseToggleTodo = vi.mocked(useToggleTodo);
const mockUseDeleteTodo = vi.mocked(useDeleteTodo);

function makeMutation(overrides = {}) {
  return { mutate: vi.fn(), isPending: false, isError: false, error: null, ...overrides } as unknown as ReturnType<typeof useCreateTodo>;
}

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TodoPanel />
    </QueryClientProvider>
  );
}

const baseTodos = [
  { id: '1', userId: 'default', text: 'First task', done: false, createdAt: '', updatedAt: '' },
  { id: '2', userId: 'default', text: 'Done task', done: true, createdAt: '', updatedAt: '' },
];

beforeEach(() => {
  mockUseCreateTodo.mockReturnValue(makeMutation());
  mockUseUpdateTodoText.mockReturnValue(makeMutation() as unknown as ReturnType<typeof useUpdateTodoText>);
  mockUseToggleTodo.mockReturnValue(makeMutation() as unknown as ReturnType<typeof useToggleTodo>);
  mockUseDeleteTodo.mockReturnValue(makeMutation() as unknown as ReturnType<typeof useDeleteTodo>);
});

describe('TodoPanel', () => {
  describe('header', () => {
    it('shows "My To-Do" as the panel title', () => {
      mockUseTodos.mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      expect(screen.getByText(/my to-do/i)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows a draft input row when no todos exist', async () => {
      mockUseTodos.mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      // Should show a blank editable input so user can start typing
      await expect(screen.findByRole('textbox', { name: /new task/i })).resolves.toBeInTheDocument();
    });

    it('shows loading state', () => {
      mockUseTodos.mockReturnValue({ data: undefined, isLoading: true, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('shows error state', () => {
      mockUseTodos.mockReturnValue({ data: undefined, isLoading: false, isError: true } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  describe('todo list', () => {
    beforeEach(() => {
      mockUseTodos.mockReturnValue({ data: baseTodos, isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
    });

    it('renders all todo items as text inputs', () => {
      renderPanel();
      expect(screen.getByRole('textbox', { name: /edit task: First task/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /edit task: Done task/i })).toBeInTheDocument();
    });

    it('applies strikethrough style to done item input', () => {
      renderPanel();
      const doneInput = screen.getByRole('textbox', { name: /edit task: Done task/i });
      expect(doneInput.className).toContain('line-through');
    });

    it('does not render an add button or form', () => {
      renderPanel();
      expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument();
    });

    it('does not render X delete buttons', () => {
      renderPanel();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('checkbox toggle', () => {
    it('calls toggleTodo when checkbox is clicked on a real todo', async () => {
      mockUseTodos.mockReturnValue({ data: baseTodos, isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      const mutate = vi.fn();
      mockUseToggleTodo.mockReturnValue(makeMutation({ mutate }) as unknown as ReturnType<typeof useToggleTodo>);
      renderPanel();
      const checkbox = screen.getByRole('checkbox', { name: /mark "First task"/i });
      await userEvent.click(checkbox);
      expect(mutate).toHaveBeenCalledWith({ id: '1', done: true });
    });
  });

  describe('Enter key', () => {
    it('calls createTodo when Enter is pressed on a non-empty draft row', async () => {
      mockUseTodos.mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      const mutate = vi.fn();
      mockUseCreateTodo.mockReturnValue(makeMutation({ mutate }));
      renderPanel();
      const draft = await screen.findByRole('textbox', { name: /new task/i });
      await userEvent.type(draft, 'New item{Enter}');
      expect(mutate).toHaveBeenCalledWith('New item', expect.any(Object));
    });

    it('inserts a new draft row when Enter is pressed on a real todo row', async () => {
      mockUseTodos.mockReturnValue({ data: [baseTodos[0]], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      const input = screen.getByRole('textbox', { name: /edit task: First task/i });
      await userEvent.click(input);
      await userEvent.keyboard('{Enter}');
      // A new blank draft input should appear
      await expect(screen.findByRole('textbox', { name: /new task/i })).resolves.toBeInTheDocument();
    });
  });

  describe('Backspace on empty input', () => {
    it('calls deleteTodo when Backspace is pressed on an empty real todo input', async () => {
      mockUseTodos.mockReturnValue({ data: baseTodos, isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      const mutate = vi.fn();
      mockUseDeleteTodo.mockReturnValue(makeMutation({ mutate }) as unknown as ReturnType<typeof useDeleteTodo>);
      renderPanel();
      const input = screen.getByRole('textbox', { name: /edit task: First task/i });
      // Clear value then press Backspace
      await userEvent.clear(input);
      await userEvent.keyboard('{Backspace}');
      expect(mutate).toHaveBeenCalledWith('1');
    });
  });

  describe('blur saves text', () => {
    it('calls updateTodoText on blur when text has changed', async () => {
      mockUseTodos.mockReturnValue({ data: [baseTodos[0]], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      const mutate = vi.fn();
      mockUseUpdateTodoText.mockReturnValue(makeMutation({ mutate }) as unknown as ReturnType<typeof useUpdateTodoText>);
      renderPanel();
      const input = screen.getByRole('textbox', { name: /edit task: First task/i });
      await userEvent.clear(input);
      await userEvent.type(input, 'Updated text');
      act(() => { input.blur(); });
      expect(mutate).toHaveBeenCalledWith({ id: '1', text: 'Updated text' });
    });

    it('calls deleteTodo on blur when real todo text is emptied', async () => {
      mockUseTodos.mockReturnValue({ data: [baseTodos[0]], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      const mutate = vi.fn();
      mockUseDeleteTodo.mockReturnValue(makeMutation({ mutate }) as unknown as ReturnType<typeof useDeleteTodo>);
      renderPanel();
      const input = screen.getByRole('textbox', { name: /edit task: First task/i });
      await userEvent.clear(input);
      act(() => { input.blur(); });
      expect(mutate).toHaveBeenCalledWith('1');
    });
  });
});
