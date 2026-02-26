export interface ScheduledJob {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
  lastRun?: Date;
}

export class Scheduler {
  private jobs: ScheduledJob[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  register(name: string, intervalMs: number, handler: () => Promise<void>) {
    this.jobs.push({ name, intervalMs, handler });
  }

  start() {
    if (this.running) return;
    this.running = true;

    // Check every 10 seconds for jobs to run
    this.timer = setInterval(() => this.tick(), 10_000);
    console.log(`Scheduler started with ${this.jobs.length} jobs`);
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('Scheduler stopped');
  }

  private async tick() {
    const now = new Date();
    for (const job of this.jobs) {
      const elapsed = job.lastRun ? now.getTime() - job.lastRun.getTime() : Infinity;
      if (elapsed >= job.intervalMs) {
        job.lastRun = now;
        try {
          await job.handler();
        } catch (err) {
          console.error(`Scheduler job "${job.name}" failed:`, err);
        }
      }
    }
  }
}
