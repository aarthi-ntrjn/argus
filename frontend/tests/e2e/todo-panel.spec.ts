import { test, expect } from '@playwright/test';

function mockApis(page: import('@playwright/test').Page, todos: unknown[] = []) {
  return Promise.all([
    page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
    ),
    page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
    ),
    page.route('**/api/v1/todos', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(todos) });
      } else {
        await route.continue();
      }
    }),
  ]);
}

test.describe('Todo Panel', () => {
  test('shows empty state when no todos exist', async ({ page }) => {
    await mockApis(page, []);
    await page.goto('/');
    await expect(page.getByText(/no reminders yet/i)).toBeVisible();
  });

  test('shows todo items when they exist', async ({ page }) => {
    const todos = [
      { id: '1', userId: 'default', text: 'Fix the bug', done: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', userId: 'default', text: 'Write tests', done: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    await mockApis(page, todos);
    await page.goto('/');
    await expect(page.getByText('Fix the bug')).toBeVisible();
    await expect(page.getByText('Write tests')).toBeVisible();
  });

  test('done item has strikethrough styling', async ({ page }) => {
    const todos = [
      { id: '1', userId: 'default', text: 'Done item', done: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    await mockApis(page, todos);
    await page.goto('/');
    const doneText = page.getByText('Done item');
    await expect(doneText).toBeVisible();
    await expect(doneText).toHaveClass(/line-through/);
  });

  test('add form is present with input and button', async ({ page }) => {
    await mockApis(page, []);
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: /new reminder/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add/i })).toBeVisible();
  });

  test('shows validation error on empty submission', async ({ page }) => {
    await mockApis(page, []);
    await page.goto('/');
    await page.getByRole('button', { name: /add/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('creates a todo item and it appears in the list', async ({ page }) => {
    const created = { id: 'new-1', userId: 'default', text: 'New reminder', done: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    let todoList: unknown[] = [];

    await Promise.all([
      page.route('**/api/v1/repositories', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
      ),
      page.route('**/api/v1/sessions**', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
      ),
      page.route('**/api/v1/todos', async route => {
        if (route.request().method() === 'GET') {
          await route.fulfill({ contentType: 'application/json', body: JSON.stringify(todoList) });
        } else if (route.request().method() === 'POST') {
          todoList = [created];
          await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
        } else {
          await route.continue();
        }
      }),
    ]);

    await page.goto('/');
    await expect(page.getByText(/no reminders yet/i)).toBeVisible();
    await page.getByRole('textbox', { name: /new reminder/i }).fill('New reminder');
    await page.getByRole('button', { name: /add/i }).click();
    await expect(page.getByText('New reminder')).toBeVisible();
  });

  test('deletes a todo item when delete button clicked', async ({ page }) => {
    const todo = { id: 'del-1', userId: 'default', text: 'To delete', done: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    let todoList: unknown[] = [todo];

    await Promise.all([
      page.route('**/api/v1/repositories', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
      ),
      page.route('**/api/v1/sessions**', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
      ),
      page.route('**/api/v1/todos', async route => {
        if (route.request().method() === 'GET') {
          await route.fulfill({ contentType: 'application/json', body: JSON.stringify(todoList) });
        } else if (route.request().method() === 'DELETE') {
          todoList = [];
          await route.fulfill({ status: 204, body: '' });
        } else {
          await route.continue();
        }
      }),
    ]);

    await page.goto('/');
    await expect(page.getByText('To delete')).toBeVisible();
    await page.getByRole('button', { name: /delete "To delete"/i }).click();
    await expect(page.getByText('To delete')).not.toBeVisible();
    await expect(page.getByText(/no reminders yet/i)).toBeVisible();
  });
});
