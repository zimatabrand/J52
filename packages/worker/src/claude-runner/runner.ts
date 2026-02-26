import { ShellTool } from '../tools/shell.js';
import type { ClaudeCodeRequest, ClaudeCodeResult } from '@j52/shared';

const DEFAULT_TIMEOUT_S = 600;
const MAX_TIMEOUT_S = 900;

export class ClaudeRunner {
  constructor(private shell: ShellTool) {}

  async run(request: ClaudeCodeRequest): Promise<ClaudeCodeResult> {
    const timeout = Math.min(request.timeoutSeconds || DEFAULT_TIMEOUT_S, MAX_TIMEOUT_S);

    // Escape the prompt for shell
    const escapedPrompt = request.prompt
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
