import { ShellTool } from './tools/shell.js';
import { FileOpsTool } from './tools/file-ops.js';
import { WebSearchTool } from './tools/web-search.js';
import { GitOpsTool } from './tools/git-ops.js';
import { ClaudeRunner } from './claude-runner/runner.js';
import { Scheduler } from './scheduler/scheduler.js';

const HEARTBEAT_INTERVAL_MS = 30_000;

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

  // Register tools in a map for dispatch
  const tools = { shell, fileOps, webSearch, gitOps, claudeRunner };
  console.log(`Tools loaded: ${Object.keys(tools).join(', ')}`);

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
