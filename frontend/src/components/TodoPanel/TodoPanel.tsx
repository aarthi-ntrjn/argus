import { useState, useRef, useEffect, useCallback } from 'react';
import { useTodos, useCreateTodo, useUpdateTodoText, useToggleTodo, useDeleteTodo } from '../../hooks/useTodos';

// A row in the list is either a real DB item or a local draft (not yet saved).
type RowId = string; // real todo id or a draft uuid

function newDraftId() {
  return 'draft-' + crypto.randomUUID();
}

function isDraft(id: RowId) {
  return id.startsWith('draft-');
}

export default function TodoPanel() {
  const { data: todos = [], isLoading, isError } = useTodos();
  const createTodo = useCreateTodo();
  const updateTodoText = useUpdateTodoText();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  // Local text for every row (real or draft), keyed by rowId.
  const [localTexts, setLocalTexts] = useState<Record<RowId, string>>({});
  // Draft-only row IDs (not in DB). Interleaved with real todos by index position.
  const [draftIds, setDraftIds] = useState<RowId[]>([]);

  // Build the ordered list of row IDs to render:
  // real todos (in DB order) with drafts inserted after them.
  // Drafts are appended at the end for simplicity; Enter inserts after the focused row.
  // We track insertion positions via draftPositions.
  const [draftPositions, setDraftPositions] = useState<Record<RowId, number>>({});

  // Seed a single draft when the list would otherwise be completely empty.
  useEffect(() => {
    if (!isLoading && !isError && todos.length === 0 && draftIds.length === 0) {
      const id = newDraftId();
      setDraftIds([id]);
      setLocalTexts(prev => ({ ...prev, [id]: '' }));
      setDraftPositions({});
    }
  }, [isLoading, isError, todos.length, draftIds.length]);

  // Sync localTexts when server data arrives (only for rows not currently being edited).
  useEffect(() => {
    setLocalTexts(prev => {
      const next = { ...prev };
      for (const todo of todos) {
        if (!(todo.id in next)) next[todo.id] = todo.text;
      }
      return next;
    });
  }, [todos]);

  // Build ordered row list: merge real todos with draft insertions.
  const orderedRows: Array<{ id: RowId; isDraftRow: boolean }> = [];
  const realTodos = todos;
  let draftsLeft = [...draftIds];
  for (let i = 0; i <= realTodos.length; i++) {
    // Insert any drafts whose position === i (inserted after index i-1).
    draftsLeft = draftsLeft.filter(draftId => {
      const pos = draftPositions[draftId] ?? realTodos.length;
      if (pos === i) {
        orderedRows.push({ id: draftId, isDraftRow: true });
        return false;
      }
      return true;
    });
    if (i < realTodos.length) {
      orderedRows.push({ id: realTodos[i].id, isDraftRow: false });
    }
  }
  // Any remaining drafts without a specific position go at the end.
  for (const draftId of draftsLeft) {
    orderedRows.push({ id: draftId, isDraftRow: true });
  }

  // Refs for focus management, indexed by orderedRows position.
  const inputRefs = useRef<Array<React.RefObject<HTMLInputElement | null>>>([]);
  if (inputRefs.current.length !== orderedRows.length) {
    inputRefs.current = orderedRows.map((_, i) => inputRefs.current[i] ?? { current: null });
  }

  const focusRow = useCallback((index: number) => {
    setTimeout(() => {
      inputRefs.current[index]?.current?.focus();
    }, 0);
  }, []);

  const handleChange = (id: RowId, value: string) => {
    setLocalTexts(prev => ({ ...prev, [id]: value }));
  };

  const handleBlur = useCallback((id: RowId) => {
    const text = (localTexts[id] ?? '').trim();

    if (isDraft(id)) {
      if (text.length === 0) {
        // Empty draft on blur — discard only if there's at least one other row.
        if (orderedRows.length > 1) {
          setDraftIds(prev => prev.filter(d => d !== id));
          setLocalTexts(prev => { const n = { ...prev }; delete n[id]; return n; });
          setDraftPositions(prev => { const n = { ...prev }; delete n[id]; return n; });
        }
      } else {
        // Persist draft to DB.
        createTodo.mutate(text, {
          onSuccess: () => {
            setDraftIds(prev => prev.filter(d => d !== id));
            setLocalTexts(prev => { const n = { ...prev }; delete n[id]; return n; });
            setDraftPositions(prev => { const n = { ...prev }; delete n[id]; return n; });
          },
        });
      }
      return;
    }

    // Real todo row.
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    if (text.length === 0) {
      // Empty → delete.
      deleteTodo.mutate(id);
      setLocalTexts(prev => { const n = { ...prev }; delete n[id]; return n; });
    } else if (text !== todo.text) {
      updateTodoText.mutate({ id, text });
    }
  }, [localTexts, todos, orderedRows.length, createTodo, updateTodoText, deleteTodo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, id: RowId, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Save current row (same logic as blur, but don't remove focus).
      const text = (localTexts[id] ?? '').trim();
      if (isDraft(id)) {
        if (text.length > 0) {
          // Insert new draft AFTER current position, then save current.
          const insertPos = index + 1;
          const newId = newDraftId();
          // The new draft's position in the real-todos array = number of real rows at or before index.
          const realCountBefore = orderedRows.slice(0, insertPos).filter(r => !r.isDraftRow).length;
          setDraftPositions(prev => ({ ...prev, [newId]: realCountBefore }));
          setDraftIds(prev => [...prev, newId]);
          setLocalTexts(prev => ({ ...prev, [newId]: '' }));
          createTodo.mutate(text, {
            onSuccess: () => {
              setDraftIds(prev => prev.filter(d => d !== id));
              setLocalTexts(prev => { const n = { ...prev }; delete n[id]; return n; });
              setDraftPositions(prev => { const n = { ...prev }; delete n[id]; return n; });
            },
          });
          focusRow(insertPos);
        }
        // Empty draft + Enter → just add a new draft below.
        else {
          const insertPos = index + 1;
          const newId = newDraftId();
          const realCountBefore = orderedRows.slice(0, insertPos).filter(r => !r.isDraftRow).length;
          setDraftPositions(prev => ({ ...prev, [newId]: realCountBefore }));
          setDraftIds(prev => [...prev, newId]);
          setLocalTexts(prev => ({ ...prev, [newId]: '' }));
          focusRow(insertPos);
        }
      } else {
        // Real row: insert a new draft after this row.
        const insertPos = index + 1;
        const newId = newDraftId();
        const realCountBefore = orderedRows.slice(0, insertPos).filter(r => !r.isDraftRow).length;
        setDraftPositions(prev => ({ ...prev, [newId]: realCountBefore }));
        setDraftIds(prev => [...prev, newId]);
        setLocalTexts(prev => ({ ...prev, [newId]: '' }));
        // Save any pending text change on the current real row.
        const todo = todos.find(t => t.id === id);
        if (todo && text !== todo.text && text.length > 0) {
          updateTodoText.mutate({ id, text });
        }
        focusRow(insertPos);
      }
    } else if (e.key === 'Backspace' && (localTexts[id] ?? '') === '') {
      e.preventDefault();
      const prevIndex = index - 1;
      if (isDraft(id)) {
        setDraftIds(prev => prev.filter(d => d !== id));
        setLocalTexts(prev => { const n = { ...prev }; delete n[id]; return n; });
        setDraftPositions(prev => { const n = { ...prev }; delete n[id]; return n; });
      } else {
        deleteTodo.mutate(id);
        setLocalTexts(prev => { const n = { ...prev }; delete n[id]; return n; });
      }
      if (prevIndex >= 0) focusRow(prevIndex);
    }
  }, [localTexts, todos, orderedRows, createTodo, updateTodoText, deleteTodo, focusRow]);

  return (
    <aside className="w-72 shrink-0 flex flex-col bg-white rounded-lg shadow h-fit sticky top-8">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">My To-Do</h2>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-12rem)]">
        {isLoading && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
        )}
        {isError && (
          <div className="px-4 py-6 text-center text-sm text-red-500">Failed to load todos.</div>
        )}
        {!isLoading && !isError && (
          <ul className="divide-y divide-gray-50 py-1">
            {orderedRows.map(({ id, isDraftRow }, index) => {
              const todo = isDraftRow ? null : todos.find(t => t.id === id);
              const text = localTexts[id] ?? (todo?.text ?? '');
              const done = todo?.done ?? false;

              if (!inputRefs.current[index]) {
                inputRefs.current[index] = { current: null };
              }

              return (
                <li key={id} className="flex items-center gap-2 px-4 py-2">
                  <input
                    type="checkbox"
                    checked={done}
                    disabled={isDraftRow}
                    aria-label={isDraftRow ? undefined : `Mark "${todo?.text ?? ''}" as ${done ? 'incomplete' : 'complete'}`}
                    onChange={() => todo && toggleTodo.mutate({ id, done: !done })}
                    className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 cursor-pointer disabled:opacity-30"
                  />
                  <input
                    ref={inputRefs.current[index] as React.RefObject<HTMLInputElement>}
                    type="text"
                    value={text}
                    onChange={e => handleChange(id, e.target.value)}
                    onBlur={() => handleBlur(id)}
                    onKeyDown={e => handleKeyDown(e, id, index)}
                    placeholder="Add a task…"
                    aria-label={isDraftRow ? 'New task' : `Edit task: ${todo?.text ?? ''}`}
                    className={`flex-1 min-w-0 text-sm bg-transparent border-none outline-none focus:ring-0 placeholder-gray-300 ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
