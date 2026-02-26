import { Router, Request, Response } from 'express';
import { requireSession } from '../middleware/auth.js';
import { query } from '../db/pool.js';

export const tasksRouter = Router();
tasksRouter.use(requireSession);

// GET /tasks - List tasks with filters
tasksRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { schemaCode, status, assignedTo } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (schemaCode) { conditions.push(`schema_code = $${idx}`); params.push((schemaCode as string).toUpperCase()); idx++; }
    if (status) { conditions.push(`status = $${idx}`); params.push(status); idx++; }
    if (assignedTo) { conditions.push(`assigned_to = $${idx}`); params.push(assignedTo); idx++; }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM public.tasks ${where} ORDER BY priority DESC, created_at DESC LIMIT 200`,
      params
    );
    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

// GET /tasks/:id
tasksRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(`SELECT * FROM public.tasks WHERE task_id = $1`, [req.params.id]);
    if (result.rows.length === 0) { res.status(404).json({ error: 'Task not found' }); return; }
    res.json({ task: result.rows[0] });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// POST /tasks - Create task
tasksRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { taskTitle, taskDescription, taskType, priority, schemaCode,
            sessionId, parentTaskId, assignedTo, dueDate, estimatedHours, tags } = req.body;

    if (!taskTitle) { res.status(400).json({ error: 'taskTitle is required' }); return; }

    const result = await query(
      `INSERT INTO public.tasks
       (task_title, task_description, task_type, priority, schema_code,
        session_id, parent_task_id, assigned_to, due_date, estimated_hours, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [taskTitle, taskDescription || null, taskType || 'general', priority || 5,
       schemaCode?.toUpperCase() || null, sessionId || null, parentTaskId || null,
       assignedTo || null, dueDate || null, estimatedHours || null, tags || []]
    );
    res.status(201).json({ task: result.rows[0] });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PATCH /tasks/:id - Update task
tasksRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const mapping: Record<string, string> = {
      taskTitle: 'task_title', taskDescription: 'task_description',
      taskType: 'task_type', status: 'status', priority: 'priority',
      assignedTo: 'assigned_to', dueDate: 'due_date',
      completedDate: 'completed_date', estimatedHours: 'estimated_hours',
      actualHours: 'actual_hours', tags: 'tags'
    };

    for (const [camel, snake] of Object.entries(mapping)) {
      if (req.body[camel] !== undefined) {
        fields.push(`${snake} = $${idx}`);
        values.push(req.body[camel]);
        idx++;
      }
    }

    // Auto-set completed_date when status changes to completed
    if (req.body.status === 'completed' && req.body.completedDate === undefined) {
      fields.push(`completed_date = NOW()`);
    }

    if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    values.push(req.params.id);
    const result = await query(
      `UPDATE public.tasks SET ${fields.join(', ')} WHERE task_id = $${idx} RETURNING *`,
      values
    );
    res.json({ task: result.rows[0] });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /tasks/:id
tasksRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await query(`DELETE FROM public.tasks WHERE task_id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});
