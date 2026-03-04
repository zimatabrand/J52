import express from 'express';
import { ShellTool } from './tools/shell.js';
import { FileOpsTool } from './tools/file-ops.js';
import { WebSearchTool } from './tools/web-search.js';
import { GitOpsTool } from './tools/git-ops.js';
import { ClaudeRunner } from './claude-runner/runner.js';
import { Scheduler } from './scheduler/scheduler.js';

const HEARTBEAT_INTERVAL_MS = 30_000;
const PORT = parseInt(process.env.WORKER_PORT || '9000', 10);
const WORKER_SECRET = process.env.WORKER_SECRET || '';

async function main() {
  console.log('J52 Worker starting...');
  console.log(`PID: ${process.pid}`);
  console.log(`Node: ${process.version}`);
  console.log(`Platform: ${process.platform}`);

  // Initialize tools
  const shell = new ShellTool();
  const fileOps = new FileOpsTool();
  const webSearch = new WebSearchTool();
  const gitOps = new GitOpsTool(shell);
  const claudeRunner = new ClaudeRunner(shell);
  const scheduler = new Scheduler();

  console.log(`Tools loaded: shell, fileOps, webSearch, gitOps, claudeRunner`);

  // --- HTTP Server for tool dispatch ---
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Auth middleware — shared secret
  app.use('/tools', (req, res, next) => {
    const token = req.headers['x-worker-secret'];
    if (!WORKER_SECRET) {
      console.warn('WORKER_SECRET not set — tool endpoints are unprotected');
      next();
      return;
    }
    if (token !== WORKER_SECRET) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'j52-worker',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  // POST /tools/shell
  app.post('/tools/shell', async (req, res) => {
    try {
      const { command, cwd, timeoutSeconds } = req.body;
      if (!command) { res.status(400).json({ error: 'command is required' }); return; }
      const result = await shell.exec({ command, cwd, timeoutSeconds });
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /tools/file-read
  app.post('/tools/file-read', async (req, res) => {
    try {
      const { path, maxBytes } = req.body;
      if (!path) { res.status(400).json({ error: 'path is required' }); return; }
      const content = await fileOps.readFile({ path, maxBytes });
      res.json({ success: true, result: { content } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /tools/list-dir
  app.post('/tools/list-dir', async (req, res) => {
    try {
      const { path } = req.body;
      if (!path) { res.status(400).json({ error: 'path is required' }); return; }
      const entries = await fileOps.listDirectory({ path });
      res.json({ success: true, result: { entries } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /tools/web-search
  app.post('/tools/web-search', async (req, res) => {
    try {
      const { query, searchDepth } = req.body;
      if (!query) { res.status(400).json({ error: 'query is required' }); return; }
      const results = await webSearch.search({ query, searchDepth });
      res.json({ success: true, result: { results } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /tools/web-extract
  app.post('/tools/web-extract', async (req, res) => {
    try {
      const { urls } = req.body;
      if (!urls || !Array.isArray(urls)) { res.status(400).json({ error: 'urls array is required' }); return; }
      const results = await webSearch.extract(urls);
      res.json({ success: true, result: { results } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /tools/claude-run
  app.post('/tools/claude-run', async (req, res) => {
    try {
      const { projectPath, prompt, timeoutSeconds } = req.body;
      if (!projectPath || !prompt) { res.status(400).json({ error: 'projectPath and prompt are required' }); return; }
      const result = await claudeRunner.run({ projectPath, prompt, timeoutSeconds });
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /tools/git — multiplexed git operations
  app.post('/tools/git', async (req, res) => {
    try {
      const { action, repoPath, url, targetDir, message, files, count } = req.body;
      if (!action) { res.status(400).json({ error: 'action is required' }); return; }

      let output: string;
      switch (action) {
        case 'status':
          output = await gitOps.status(repoPath); break;
        case 'log':
          output = await gitOps.log(repoPath, count); break;
        case 'pull':
          output = await gitOps.pull(repoPath); break;
        case 'clone':
          output = await gitOps.clone(url, targetDir); break;
        case 'commit':
          output = await gitOps.commit(repoPath, message, files); break;
        case 'push':
          output = await gitOps.push(repoPath); break;
        default:
          res.status(400).json({ error: `Unknown git action: ${action}` }); return;
      }
      res.json({ success: true, result: { output } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Worker HTTP server listening on port ${PORT}`);
  });

  // Start scheduler
  scheduler.start();
  console.log('Scheduler started');

  // Heartbeat
  setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[heartbeat] uptime=${Math.round(process.uptime())}s rss=${Math.round(mem.rss / 1024 / 1024)}MB`);
  }, HEARTBEAT_INTERVAL_MS);

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    scheduler.stop();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log('J52 Worker ready.');
}

main().catch(err => {
  console.error('Worker fatal error:', err);
  process.exit(1);
});
