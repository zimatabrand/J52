import { ShellTool } from './shell.js';

export class GitOpsTool {
  constructor(private shell: ShellTool) {}

  async status(repoPath: string): Promise<string> {
    const result = await this.shell.exec({ command: 'git status --short', cwd: repoPath });
    return result.stdout;
  }

  async log(repoPath: string, count = 10): Promise<string> {
    const result = await this.shell.exec({
      command: `git log --oneline -${count}`,
      cwd: repoPath
    });
    return result.stdout;
  }

  async pull(repoPath: string): Promise<string> {
    const result = await this.shell.exec({ command: 'git pull', cwd: repoPath });
    return result.stdout + result.stderr;
  }

  async clone(url: string, targetDir: string): Promise<string> {
    const result = await this.shell.exec({
      command: `git clone ${url} ${targetDir}`,
      timeoutSeconds: 120
    });
    return result.stdout + result.stderr;
  }

  async commit(repoPath: string, message: string, files?: string[]): Promise<string> {
    if (files && files.length > 0) {
      await this.shell.exec({ command: `git add ${files.join(' ')}`, cwd: repoPath });
    } else {
      await this.shell.exec({ command: 'git add -A', cwd: repoPath });
    }
    const result = await this.shell.exec({
      command: `git commit -m "${message.replace(/"/g, '\\"')}"`,
      cwd: repoPath
    });
    return result.stdout + result.stderr;
  }

  async push(repoPath: string): Promise<string> {
    const result = await this.shell.exec({ command: 'git push', cwd: repoPath, timeoutSeconds: 60 });
    return result.stdout + result.stderr;
  }
}
