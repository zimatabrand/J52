import { Router, Request, Response } from 'express';
import { requireSession } from '../middleware/auth.js';
import { query } from '../db/pool.js';

export const projectsRouter = Router();

// All project routes require auth
projectsRouter.use(requireSession);

// GET /projects - List all projects
projectsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT p.project_id, p.schema_code, p.project_name, p.project_type,
              p.base_directory, p.description, p.git_repository_url,
              p.primary_language, p.framework, p.is_active,
              p.created_at, p.updated_at,
              sr.schema_name, sr.schema_level, sr.parent_schema_code
       FROM public.projects p
       JOIN public.schema_registry sr ON sr.schema_code = p.schema_code
       WHERE p.is_active = TRUE
       ORDER BY sr.schema_level, p.project_name`
    );
    res.json({ projects: result.rows });
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// GET /projects/:code - Get project by schema code
projectsRouter.get('/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const result = await query(
      `SELECT p.*, sr.schema_name, sr.schema_level, sr.parent_schema_code, sr.has_project_manager_ai
       FROM public.projects p
       JOIN public.schema_registry sr ON sr.schema_code = p.schema_code
       WHERE p.schema_code = $1`,
      [code.toUpperCase()]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ project: result.rows[0] });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// POST /projects - Create a new project (calls create_project_schema function)
projectsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      schemaCode, schemaName, projectName, projectType,
      baseDirectory, tempDirectory, description,
      parentSchemaCode, hasProjectManagerAi
    } = req.body;

    if (!schemaCode || !projectName || !projectType || !baseDirectory) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const result = await query(
      `SELECT public.create_project_schema($1, $2, $3, $4, $5, $6, $7, $8, $9) AS result`,
      [
        schemaCode, schemaName || projectName, projectName, projectType,
        baseDirectory, tempDirectory || null, description || null,
        parentSchemaCode || null, hasProjectManagerAi || false
      ]
    );

    const msg = result.rows[0]?.result as string;
    if (msg?.startsWith('ERROR')) {
      res.status(400).json({ error: msg });
      return;
    }

    res.status(201).json({ success: true, message: msg });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PATCH /projects/:code - Update project
projectsRouter.patch('/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const allowed = ['project_name', 'project_type', 'base_directory', 'description',
                     'git_repository_url', 'primary_language', 'framework', 'is_active'];

    for (const [key, val] of Object.entries(req.body)) {
      const snakeKey = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
      if (allowed.includes(snakeKey)) {
        fields.push(`${snakeKey} = $${idx}`);
        values.push(val);
        idx++;
      }
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    values.push(code.toUpperCase());
    await query(
      `UPDATE public.projects SET ${fields.join(', ')} WHERE schema_code = $${idx}`,
      values
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});
