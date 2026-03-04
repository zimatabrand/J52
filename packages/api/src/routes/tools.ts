import { Router, Request, Response } from 'express';
import { requireSession } from '../middleware/auth.js';
import { query } from '../db/pool.js';

export const toolsRouter = Router();

const WORKER_URL = process.env.WORKER_URL || 'http://35.211.50.24:9000';
const WORKER_SECRET = process.env.WORKER_SECRET || '';
const WORKER_TIMEOUT_MS = 120_000; // 2 minutes default
const CLAUDE_TIMEOUT_MS = 660_000; // 11 minutes for Claude Code calls

// Map OpenAI tool names → worker endpoints + request transforms
async function dispatchToWorker(endpoint: string, body: Record<string, unknown>, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (WORKER_SECRET) headers['x-worker-secret'] = WORKER_SECRET;

    const response = await fetch(`${WORKER_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Worker returned ${response.status}: ${text}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// POST /tools/execute — main dispatch endpoint for OpenAI tool calls
toolsRouter.post('/execute', requireSession, async (req: Request, res: Response) => {
  const { tool_name, arguments: args } = req.body;

  if (!tool_name) {
    res.status(400).json({ error: 'tool_name is required' });
    return;
  }

  const startTime = Date.now();

  try {
    let result: any;

    switch (tool_name) {
      case 'run_shell': {
        result = await dispatchToWorker('/tools/shell', {
          command: args.command,
          cwd: args.cwd,
          timeoutSeconds: args.timeoutSeconds
        }, WORKER_TIMEOUT_MS);
        break;
      }

      case 'read_text_file': {
        result = await dispatchToWorker('/tools/file-read', {
          path: args.path,
          maxBytes: args.maxBytes
        }, WORKER_TIMEOUT_MS);
        break;
      }

      case 'list_directory': {
        result = await dispatchToWorker('/tools/list-dir', {
          path: args.path
        }, WORKER_TIMEOUT_MS);
        break;
      }

      case 'web_search': {
        result = await dispatchToWorker('/tools/web-search', {
          query: args.query,
          searchDepth: args.search_depth
        }, WORKER_TIMEOUT_MS);
        break;
      }

      case 'web_extract': {
        result = await dispatchToWorker('/tools/web-extract', {
          urls: args.urls
        }, WORKER_TIMEOUT_MS);
        break;
      }

      case 'run_claude_code': {
        result = await dispatchToWorker('/tools/claude-run', {
          projectPath: args.project_path,
          prompt: args.prompt,
          timeoutSeconds: args.timeout_seconds
        }, CLAUDE_TIMEOUT_MS);
        break;
      }

      // --- DB-backed tools (handled directly by API, no worker needed) ---

      case 'list_projects': {
        const { rows } = await query(
          'SELECT id, name, code, repo_url, status FROM projects ORDER BY name'
        );
        result = { success: true, result: { projects: rows } };
        break;
      }

      case 'get_project_context': {
        const { rows } = await query(
          'SELECT id, name, code, repo_url, description, status FROM projects WHERE code = $1',
          [args.project_code]
        );
        if (rows.length === 0) {
          result = { success: false, error: `Project '${args.project_code}' not found` };
        } else {
          result = { success: true, result: { project: rows[0] } };
        }
        break;
      }

      case 'remember_fact': {
        await query(
          'INSERT INTO memory_facts (content, category) VALUES ($1, $2)',
          [args.content, args.category || 'general']
        );
        result = { success: true, result: { message: 'Fact remembered' } };
        break;
      }

      case 'recall_memory': {
        const { rows } = await query(
          'SELECT id, content, category, created_at FROM memory_facts ORDER BY created_at DESC'
        );
        result = { success: true, result: { facts: rows } };
        break;
      }

      case 'forget_fact': {
        const { rowCount } = await query(
          'DELETE FROM memory_facts WHERE content ILIKE $1',
          [`%${args.search_term}%`]
        );
        result = { success: true, result: { deleted: rowCount } };
        break;
      }

      default:
        res.status(400).json({ error: `Unknown tool: ${tool_name}` });
        return;
    }

    const executionTimeMs = Date.now() - startTime;
    res.json({ ...result, executionTimeMs });

  } catch (err: any) {
    const executionTimeMs = Date.now() - startTime;
    if (err.name === 'AbortError') {
      res.status(504).json({ success: false, error: 'Worker request timed out', executionTimeMs });
    } else {
      console.error(`Tool ${tool_name} error:`, err.message);
      res.status(502).json({ success: false, error: err.message, executionTimeMs });
    }
  }
});

// GET /tools/health — check if worker is reachable
toolsRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const response = await fetch(`${WORKER_URL}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    const data = await response.json();
    res.json({ api: 'healthy', worker: data });
  } catch (err: any) {
    res.json({ api: 'healthy', worker: { status: 'unreachable', error: err.message } });
  }
});
