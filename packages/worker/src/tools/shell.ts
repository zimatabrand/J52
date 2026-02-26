import { spawn } from 'child_process';
import type { ShellExecRequest, ShellExecResult } from '@j52/shared';

const DEFAULT_TIMEOUT_S = 60;
const MAX_TIMEOUT_S = 300;
const MAX_OUTPUT_BYTES = 512_000; // 500KB

export class ShellTool {
  async exec(request: ShellExecRequest): Promise<ShellExecResult> {
    const timeout = Math.min(request.timeoutSeconds || DEFAULT_TIMEOUT_S, MAX_TIMEOUT_S) * 1000;

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const proc = spawn('bash', ['-c', request.command], {
        cwd: request.cwd || process.env.HOME,
        env: { ...process.env },
        timeout
      });

      proc.stdout.on('data', (data: Buffer) => {
        if (stdout.length < MAX_OUTPUT_BYTES) {
          stdout += data.toString();
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        if (stderr.length < MAX_OUTPUT_BYTES) {
          stderr += data.toString();
        }
      });

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
      }, timeout);

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout: stdout.slice(0, MAX_OUTPUT_BYTES),
          stderr: stderr.slice(0, MAX_OUTPUT_BYTES),
          exitCode: code ?? 1,
          timedOut
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          stdout: '',
          stderr: err.message,
          exitCode: 1,
          timedOut: false
        });
      });
    });
  }
}
