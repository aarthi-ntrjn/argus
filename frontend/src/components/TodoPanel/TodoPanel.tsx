import { useState } from 'react';
import { useTodos, useCreateTodo, useToggleTodo, useDeleteTodo } from '../../hooks/useTodos';

export default function TodoPanel() {
  const [inputText, setInputText] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const { data: todos = [], isLoading, isError } = useTodos();
  const createTodo = useCreateTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) {
      setInputError('Please enter a reminder.');
      return;
    }
    if (trimmed.length > 500) {
      setInputError('Reminder must be 500 characters or fewer.');
      return;
    }
    setInputError(null);
    createTodo.mutate(trimmed, { onSuccess: () => setInputText('') });
  };

  return (
    <aside className="w-72 shrink-0 flex flex-col bg-white rounded-lg shadow h-fit sticky top-8">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">My Reminders</h2>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-3 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={e => { setInputText(e.target.value); setInputError(null); }}
            placeholder="Add a reminder…"
            aria-label="New reminder"
            className="flex-1 min-w-0 text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={createTodo.isPending}
            className="text-xs bg-blue-600 text-white px-2.5 py-1.5 rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>
        {inputError && (
          <p role="alert" className="mt-1 text-xs text-red-600">{inputError}</p>
        )}
        {createTodo.isError && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {createTodo.error instanceof Error ? createTodo.error.message : 'Failed to add reminder.'}
          </p>
        )}
      </form>

      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-16rem)]">
        {isLoading && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
        )}
        {isError && (
          <div className="px-4 py-6 text-center text-sm text-red-500">Failed to load reminders.</div>
        )}
        {!isLoading && !isError && todos.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">No reminders yet.</div>
        )}
        {!isLoading && !isError && todos.length > 0 && (
          <ul className="divide-y divide-gray-50">
            {todos.map(todo => (
              <li key={todo.id} className="flex items-start gap-2 px-4 py-2.5 group hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={todo.done}
                  aria-label={`Mark "${todo.text}" as ${todo.done ? 'incomplete' : 'complete'}`}
                  onChange={() => toggleTodo.mutate({ id: todo.id, done: !todo.done })}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                />
                <span className={`flex-1 text-sm break-words ${todo.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {todo.text}
                </span>
                <button
                  onClick={() => deleteTodo.mutate(todo.id)}
                  aria-label={`Delete "${todo.text}"`}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-0.5 rounded"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
