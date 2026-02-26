import { Router, Request, Response } from 'express';
import { requireSession } from '../middleware/auth.js';
import { query } from '../db/pool.js';

export const sessionsRouter = Router();
sessionsRouter.use(requireSession);

// GET /sessions - List sessions (optional ?schemaCode= filter)
sessionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const schemaCode = req.query.schemaCode as string | undefined;
    let sql = `SELECT * FROM public.ai_sessions`;
    const params: unknown[] = [];

    if (schemaCode) {
      sql += ` WHERE schema_code = $1`;
      params.push(schemaCode.toUpperCase());
    }
    sql += ` ORDER BY started_at DESC LIMIT 100`;

    const result = await query(sql, params);
    res.json({ sessions: result.rows });
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// GET /sessions/:id
sessionsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(`SELECT * FROM public.ai_sessions WHERE session_id = $1`, [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ session: result.rows[0] });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// POST /sessions - Create new AI session
sessionsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { schemaCode, aiProvider, role, sessionName, model, parentSessionId } = req.body;
    const result = await query(
      `INSERT INTO public.ai_sessions (schema_code, ai_provider, role, session_name, model, parent_session_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [schemaCode || null, aiProvider || 'claude', role || 'assistant',
       sessionName || null, model || null, parentSessionId || null]
    );
    res.status(201).json({ session: result.rows[0] });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// PATCH /sessions/:id - Update session (status, tokens, etc.)
sessionsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { status, tokenCountIn, tokenCountOut } = req.body;
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (status) { fields.push(`status = $${idx}`); values.push(status); idx++; }
    if (tokenCountIn !== undefined) { fields.push(`token_count_in = $${idx}`); values.push(tokenCountIn); idx++; }
    if (tokenCountOut !== undefined) { fields.push(`token_count_out = $${idx}`); values.push(tokenCountOut); idx++; }

    if (status === 'completed' || status === 'terminated' || status === 'error') {
      fields.push(`ended_at = NOW()`);
    }
    fields.push(`last_activity_at = NOW()`);

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE public.ai_sessions SET ${fields.join(', ')} WHERE session_id = $${idx} RETURNING *`,
      values
    );
    res.json({ session: result.rows[0] });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// GET /sessions/:id/messages - Get chat messages for a session
sessionsRouter.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await query(
      `SELECT * FROM public.chat_io_log
       WHERE session_id = $1
       ORDER BY sequence_number ASC
       LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );
    res.json({ messages: result.rows });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// POST /sessions/:id/messages - Add a message
sessionsRouter.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { ioType, content, contentFormat, tokenCount, modelUsed, processingTimeMs, metadata } = req.body;
    if (!ioType || !content) {
      res.status(400).json({ error: 'ioType and content are required' });
      return;
    }

    // Get next sequence number
    const seqResult = await query(
      `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_seq FROM public.chat_io_log WHERE session_id = $1`,
      [req.params.id]
    );
    const nextSeq = seqResult.rows[0].next_seq;

    const result = await query(
      `INSERT INTO public.chat_io_log
       (session_id, io_type, content, content_format, token_count, model_used, processing_time_ms, metadata, sequence_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.params.id, ioType, content, contentFormat || 'text',
       tokenCount || null, modelUsed || null, processingTimeMs || null,
       metadata ? JSON.stringify(metadata) : null, nextSeq]
    );
    res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});
