import { ShellTool } from '../tools/shell.js';
import { FileOpsTool } from '../tools/file-ops.js';
import type { ClaudeCodeRequest, ClaudeCodeResult } from '@j52/shared';

const DEFAULT_TIMEOUT_S = 1200;
const MAX_TIMEOUT_S = 1500;
const MAX_SESSION_LOG_ENTRIES = 3;

interface ProjectContext {
  startMd: string | null;
  contextMd: string | null;
  activeTasksMd: string | null;
  sessionLogMd: string | null;
}

export class ClaudeRunner {
  constructor(
    private shell: ShellTool,
    private fileOps: FileOpsTool
  ) {}

  async readContextFiles(projectPath: string): Promise<ProjectContext> {
    const tryRead = async (filename: string): Promise<string | null> => {
      try {
        return await this.fileOps.readFile({ path: `${projectPath}/${filename}` });
      } catch {
        return null;
      }
    };

    const startMd = (await tryRead('start.md')) || (await tryRead('START.md'));
    const [contextMd, activeTasksMd, sessionLogMd] = await Promise.all([
      tryRead('.ai/context.md'),
      tryRead('.ai/active_tasks.md'),
      tryRead('.ai/session_log.md'),
    ]);

    return { startMd, contextMd, activeTasksMd, sessionLogMd };
  }

  truncateSessionLog(log: string): string {
    // Keep only the last N session entries (separated by ## or ---)
    const entries = log.split(/(?=^## )/m);
    if (entries.length <= MAX_SESSION_LOG_ENTRIES) return log;
    return entries.slice(-MAX_SESSION_LOG_ENTRIES).join('');
  }

  buildPrompt(userPrompt: string, context: ProjectContext): string {
    const hasContext = context.startMd || context.contextMd || context.activeTasksMd || context.sessionLogMd;

    if (!hasContext) {
      // No context files — fall back to raw prompt with save instructions
      return `${userPrompt}

=== AFTER COMPLETING YOUR TASK ===
Save your work by updating the project's context files:
1. Create .ai/ directory if it doesn't exist
2. Create/update .ai/session_log.md — add a new session entry with: date, what you did, files modified, next priority
3. Create/update .ai/context.md — add any new architectural knowledge or decisions
4. Create/update .ai/active_tasks.md — update task statuses, add new tasks found
5. Create/update start.md — project entry point with current status/priorities
6. Git: stage all changes, commit with message "xx.save — {brief description}", and push`;
    }

    const sections: string[] = [];

    if (context.startMd) {
      sections.push(`=== PROJECT CONTEXT ===\n${context.startMd}`);
    }

    if (context.activeTasksMd) {
      sections.push(`=== CURRENT TASKS ===\n${context.activeTasksMd}`);
    }

    if (context.contextMd) {
      sections.push(`=== PROJECT KNOWLEDGE ===\n${context.contextMd}`);
    }

    if (context.sessionLogMd) {
      const truncated = this.truncateSessionLog(context.sessionLogMd);
      sections.push(`=== RECENT SESSION HISTORY ===\n${truncated}`);
    }

    sections.push(`=== YOUR TASK ===\n${userPrompt}`);

    sections.push(`=== AFTER COMPLETING YOUR TASK ===
Save your work by updating the project's context files:
1. Update .ai/session_log.md — add a new session entry with: date, what you did, files modified, next priority
2. Update .ai/context.md — add any new architectural knowledge or decisions
3. Update .ai/active_tasks.md — update task statuses, add new tasks found
4. Update start.md — update current status/priorities if they changed
5. Git: stage all changes, commit with message "xx.save — {brief description}", and push

If .ai/ directory doesn't exist, create it with these files before saving.`);

    return sections.join('\n\n');
  }

  async run(request: ClaudeCodeRequest): Promise<ClaudeCodeResult> {
    const timeout = Math.min(request.timeoutSeconds || DEFAULT_TIMEOUT_S, MAX_TIMEOUT_S);

    // Pre-read project context files
    let context: ProjectContext = { startMd: null, contextMd: null, activeTasksMd: null, sessionLogMd: null };
    if (request.projectPath) {
      try {
        context = await this.readContextFiles(request.projectPath);
        const found = [
          context.startMd && 'start.md',
          context.contextMd && '.ai/context.md',
          context.activeTasksMd && '.ai/active_tasks.md',
          context.sessionLogMd && '.ai/session_log.md',
        ].filter(Boolean);
        if (found.length) {
          console.log(`[claude-runner] Context files found: ${found.join(', ')}`);
        }
      } catch (err) {
        console.warn('[claude-runner] Failed to read context files:', (err as Error).message);
      }
    }

    // Build context-aware prompt
    const fullPrompt = this.buildPrompt(request.prompt, context);

    // Escape the prompt for shell
    const escapedPrompt = fullPrompt
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "'\\''");

    const command = `claude --dangerously-skip-permissions --print '${escapedPrompt}'`;

    const result = await this.shell.exec({
      command,
      cwd: request.projectPath,
      timeoutSeconds: timeout
    });

    return {
      output: result.stdout || result.stderr,
      exitCode: result.exitCode,
      timedOut: result.timedOut
    };
  }
}
