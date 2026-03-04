import { Router, Request, Response } from 'express';
import { requireSession } from '../middleware/auth.js';
import { query } from '../db/pool.js';

export const notificationsRouter = Router();

// GET /notifications/completed?since=<ISO timestamp>
// Returns tasks that completed or failed since the given timestamp
notificationsRouter.get('/completed', requireSession, async (req: Request, res: Response) => {
  try {
    const since = req.query.since as string;
    if (!since) {
      res.status(400).json({ error: 'since query parameter is required (ISO timestamp)' });
      return;
    }

    const { rows } = await query(
      `SELECT task_id, task_title, status, project_path, completed_date,
              result_summary, error_message, updated_at
       FROM tasks
       WHERE task_type = 'claude_code'
         AND status IN ('completed', 'failed')
         AND updated_at > $1
       ORDER BY updated_at DESC`,
      [since]
    );

    res.json({ tasks: rows, count: rows.length });
  } catch (err: any) {
    console.error('Notifications error:', err.message);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /notifications/queue-status
// Returns counts of queued and running tasks
notificationsRouter.get('/queue-status', requireSession, async (_req: Request, res: Response) => {
  try {
    const { rows } = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text as count
       FROM tasks
       WHERE task_type = 'claude_code'
         AND status IN ('queued', 'in_progress')
       GROUP BY status`
    );

    const counts: Record<string, number> = { queued: 0, in_progress: 0 };
    for (const row of rows) {
      counts[row.status] = parseInt(row.count, 10);
    }

    res.json({
      queued: counts.queued,
      running: counts.in_progress,
      total: counts.queued + counts.in_progress
    });
  } catch (err: any) {
    console.error('Queue status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch queue status' });
  }
});
