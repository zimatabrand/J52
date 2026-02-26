import { Router, Request, Response } from 'express';
import { requireSession } from '../middleware/auth.js';
import { query } from '../db/pool.js';

export const memoryRouter = Router();
memoryRouter.use(requireSession);

// GET /memory - Get all facts
memoryRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM public.memory_facts ORDER BY created_at DESC`
    );
    res.json({ facts: result.rows });
  } catch (error) {
    console.error('List facts error:', error);
    res.status(500).json({ error: 'Failed to list facts' });
  }
});

// POST /memory - Create a fact
memoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { content, category, source } = req.body;
    if (!content) { res.status(400).json({ error: 'content is required' }); return; }
    if (content.length > 500) { res.status(400).json({ error: 'content max 500 chars' }); return; }

    // Check max 50 facts
    const countResult = await query(`SELECT COUNT(*) as cnt FROM public.memory_facts`);
    if (parseInt(countResult.rows[0].cnt) >= 50) {
      // Delete oldest
      await query(
        `DELETE FROM public.memory_facts WHERE fact_id = (
          SELECT fact_id FROM public.memory_facts ORDER BY created_at ASC LIMIT 1
        )`
      );
    }

    const result = await query(
      `INSERT INTO public.memory_facts (content, category, source) VALUES ($1, $2, $3) RETURNING *`,
      [content, category || 'general', source || 'user']
    );
    res.status(201).json({ fact: result.rows[0] });
  } catch (error) {
    console.error('Create fact error:', error);
    res.status(500).json({ error: 'Failed to create fact' });
  }
});

// DELETE /memory/:id - Delete a fact
memoryRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await query(`DELETE FROM public.memory_facts WHERE fact_id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete fact error:', error);
    res.status(500).json({ error: 'Failed to delete fact' });
  }
});

// DELETE /memory/search/:term - Delete fact by search term
memoryRouter.delete('/search/:term', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `DELETE FROM public.memory_facts WHERE content ILIKE $1 RETURNING *`,
      [`%${req.params.term}%`]
    );
    res.json({ deleted: result.rowCount, facts: result.rows });
  } catch (error) {
    console.error('Delete fact by term error:', error);
    res.status(500).json({ error: 'Failed to delete fact' });
  }
});
