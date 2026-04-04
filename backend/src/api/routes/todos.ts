import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { getTodos, insertTodo, updateTodo, deleteTodo } from '../../db/database.js';

const DEFAULT_USER = 'default';

const todosRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/todos', async (_req, reply) => {
    const todos = getTodos(DEFAULT_USER);
    return reply.send(todos);
  });

  app.post<{ Body: { text?: unknown } }>('/api/v1/todos', async (req, reply) => {
    const { text } = req.body ?? {};
    if (typeof text !== 'string' || text.trim().length === 0) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Todo text is required and must not be empty.',
        requestId: req.id,
      });
    }
    if (text.trim().length > 500) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Todo text must not exceed 500 characters.',
        requestId: req.id,
      });
    }
    const now = new Date().toISOString();
    const todo = { id: randomUUID(), userId: DEFAULT_USER, text: text.trim(), done: false, createdAt: now, updatedAt: now };
    insertTodo(todo);
    req.log.info({ action: 'todo_created', todoId: todo.id, userId: DEFAULT_USER }, 'Todo item created');
    return reply.status(201).send(todo);
  });

  app.patch<{ Params: { id: string }; Body: { done?: unknown } }>('/api/v1/todos/:id', async (req, reply) => {
    const { id } = req.params;
    const { done } = req.body ?? {};
    if (typeof done !== 'boolean') {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: "Field 'done' is required and must be a boolean.",
        requestId: req.id,
      });
    }
    const updated = updateTodo(id, done, new Date().toISOString());
    if (!updated) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Todo item not found.',
        requestId: req.id,
      });
    }
    req.log.info({ action: 'todo_toggled', todoId: id, done, userId: DEFAULT_USER }, 'Todo item toggled');
    return reply.send(updated);
  });

  app.delete<{ Params: { id: string } }>('/api/v1/todos/:id', async (req, reply) => {
    const { id } = req.params;
    const deleted = deleteTodo(id);
    if (!deleted) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Todo item not found.',
        requestId: req.id,
      });
    }
    req.log.info({ action: 'todo_deleted', todoId: id, userId: DEFAULT_USER }, 'Todo item deleted');
    return reply.status(204).send();
  });
};

export default todosRoutes;
