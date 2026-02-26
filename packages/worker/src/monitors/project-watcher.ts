import { watch, FSWatcher } from 'fs';
import { join } from 'path';

export interface FileChangeEvent {
  type: 'change' | 'rename';
  path: string;
  timestamp: Date;
}

export class ProjectWatcher {
  private watchers = new Map<string, FSWatcher>();
  private callback: ((event: FileChangeEvent) => void) | null = null;

  onchange(cb: (event: FileChangeEvent) => void) {
    this.callback = cb;
  }

  watch(projectPath: string) {
    if (this.watchers.has(projectPath)) return;

    try {
      const watcher = watch(projectPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        // Ignore common noise
        if (filename.includes('node_modules') || filename.includes('.git/')) return;

        this.callback?.({
          type: eventType as 'change' | 'rename',
          path: join(projectPath, filename),
          timestamp: new Date()
        });
      });

      this.watchers.set(projectPath, watcher);
      console.log(`Watching: ${projectPath}`);
    } catch (err) {
      console.error(`Failed to watch ${projectPath}:`, err);
    }
  }

  unwatch(projectPath: string) {
    const watcher = this.watchers.get(projectPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(projectPath);
    }
  }

  unwatchAll() {
    for (const [path, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }
}
