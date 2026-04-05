import { test, expect } from '@playwright/test';

type TodoItem = {
  id: string;
  userId: string;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: crypto.randomUUID(),
    userId: 'default',
    text: 'Task',
    done: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Registers route mocks for all API endpoints used by the dashboard.
 * - GET  /api/v1/todos          returns current todoList
 * - POST /api/v1/todos          appends to todoList, returns created item
 * - PATCH /api/v1/todos/:id     updates item in todoList, returns updated item
 * - DELETE /api/v1/todos/:id    removes item from todoList
 */
async function mockApis(
  page: import('@playwright/test').Page,
  initialTodos: TodoItem[] = [],
) {
  const todoList: TodoItem[] = [...initialTodos];

  await Promise.all([
    page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
    ),
    page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
    ),
    // Specific routes (with :id) must be registered before the base route
    page.route('**/api/v1/todos/**', async route => {
      const method = route.request().method();
      const url = route.request().url();
      const id = url.split('/').pop()!;

      if (method === 'PATCH') {
        const body = await route.request().postDataJSON();
        const idx = todoList.findIndex(t => t.id === id);
        if (idx === -1) {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND', message: 'Not found', requestId: 'test' }) });
          return;
        }
        if ('text' in body && (body.text ?? '').trim() === '') {
          await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'VALIDATION_ERROR', message: 'text cannot be empty', requestId: 'test' }) });
          return;
        }
        todoList[idx] = { ...todoList[idx], ...body, updatedAt: new Date().toISOString() };
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(todoList[idx]) });
      } else if (method === 'DELETE') {
        const idx = todoList.findIndex(t => t.id === id);
        if (idx !== -1) todoList.splice(idx, 1);
        await route.fulfill({ status: 204, body: '' });
      } else {
        await route.continue();
      }
    }),
    page.route('**/api/v1/todos', async route => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([...todoList]) });
      } else if (method === 'POST') {
        const body = await route.request().postDataJSON();
        const created = makeTodo({ id: crypto.randomUUID(), text: body.text });
        todoList.push(created);
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
      } else {
        await route.continue();
      }
    }),
  ]);

  return todoList;
}

test.describe('Todo Panel', () => {
  test('shows draft input row when todo list is empty', async ({ page }) => {
    await mockApis(page, []);
    await page.goto('/');
    // A blank editable row should be present (the draft placeholder)
    await expect(page.getByRole('textbox', { name: /new task/i })).toBeVisible();
  });

  test('shows todo items as editable inputs when they exist', async ({ page }) => {
    const todos = [
      makeTodo({ id: '1', text: 'Fix the bug' }),
      makeTodo({ id: '2', text: 'Write tests', done: true }),
    ];
    await mockApis(page, todos);
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: /edit task: Fix the bug/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /edit task: Write tests/i })).toBeVisible();
  });

  test('done item input has strikethrough styling', async ({ page }) => {
    const todos = [makeTodo({ id: '1', text: 'Done item', done: true })];
    await mockApis(page, todos);
    await page.goto('/');
    const input = page.getByRole('textbox', { name: /edit task: Done item/i });
    await expect(input).toBeVisible();
    await expect(input).toHaveClass(/line-through/);
  });

  test('typing into draft row and blurring saves the item', async ({ page }) => {
    await mockApis(page, []);
    await page.goto('/');

    const draft = page.getByRole('textbox', { name: /new task/i });
    await draft.fill('My new task');
    // Blur by pressing Tab
    await draft.press('Tab');

    // After save + re-fetch, the item should appear as an editable input
    await expect(page.getByRole('textbox', { name: /edit task: My new task/i })).toBeVisible();
  });

  test('pressing Enter on a row saves it and creates a new row below', async ({ page }) => {
    await mockApis(page, []);
    await page.goto('/');

    const draft = page.getByRole('textbox', { name: /new task/i });
    await draft.fill('First task');
    await draft.press('Enter');

    // First task should be saved, a new draft should appear
    await expect(page.getByRole('textbox', { name: /edit task: First task/i })).toBeVisible();
    // A new empty row should be focused (the newly inserted draft)
    const inputs = page.getByRole('textbox');
    // At least 2 inputs: the saved item and the new draft
    await expect(inputs).toHaveCount(2);
  });

  test('editing an existing item and blurring updates its text', async ({ page }) => {
    const todos = [makeTodo({ id: 'edit-1', text: 'Original text' })];
    await mockApis(page, todos);
    await page.goto('/');

    const input = page.getByRole('textbox', { name: /edit task: Original text/i });
    await input.fill('Updated text');
    await input.press('Tab');

    await expect(page.getByRole('textbox', { name: /edit task: Updated text/i })).toBeVisible();
  });

  test('pressing Backspace on empty row deletes it and focuses the previous row', async ({ page }) => {
    const todos = [
      makeTodo({ id: 'a', text: 'Keep me' }),
      makeTodo({ id: 'b', text: 'Delete me' }),
    ];
    await mockApis(page, todos);
    await page.goto('/');

    const deleteTarget = page.getByRole('textbox', { name: /edit task: Delete me/i });
    await deleteTarget.fill('');
    await deleteTarget.press('Backspace');

    await expect(page.getByRole('textbox', { name: /edit task: Delete me/i })).not.toBeVisible();
    await expect(page.getByRole('textbox', { name: /edit task: Keep me/i })).toBeVisible();
  });

  test('toggling a checkbox marks the item done', async ({ page }) => {
    const todos = [makeTodo({ id: '1', text: 'Toggle me', done: false })];
    await mockApis(page, todos);
    await page.goto('/');

    const checkbox = page.getByRole('checkbox', { name: /mark "Toggle me"/i });
    await checkbox.click();

    // After toggle, the input should gain the line-through class
    const input = page.getByRole('textbox', { name: /edit task: Toggle me/i });
    await expect(input).toHaveClass(/line-through/);
  });
});
