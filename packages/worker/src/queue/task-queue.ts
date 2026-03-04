import { query, getPool } from '../db/pool.js';
import { ClaudeRunner } from '../claude-runner/runner.js';
import os from 'os';

const MAX_CONCURRENT = 3;
const STALE_TASK_MINUTES = 20;

interface QueuedTask {
  task_id: number;
  project_path: string;
  claude_prompt: string;
  task_title: string;
}

export class TaskQueue {
  private activeTasks = new Map<number, Promise<void>>();
  private workerId: string;

  constructor(private claudeRunner: ClaudeRunner) {
    this.workerId = `worker-${os.hostname()}-${process.pid}`;
  }

  get activeCount(): number {
    return this.activeTasks.size;
  }

  get availableSlots(): number {
    return MAX_CONCURRENT - this.activeTasks.size;
  }

  async pollAndExecute(): Promise<void> {
    // Clean up finished tasks from tracking map
    for (const [taskId, promise] of this.activeTasks) {
      // Check if settled by racing with an already-resolved promise
      const result = await Promise.race([
        promise.then(() => 'done').catch(() => 'done'),
        Promise.resolve('pending')
      ]);
      if (result === 'done') {
        this.activeTasks.delete(taskId);
      }
    }

    // Recover stale tasks
    await this.recoverStaleTasks();

    // Claim and start new tasks up to available slots
    const slots = this.availableSlots;
    if (slots <= 0) return;

    const tasks = await this.claimTasks(slots);
    for (const task of tasks) {
      const promise = this.executeTask(task);
      this.activeTasks.set(task.task_id, promise);
    }
  }

  private async claimTasks(limit: number): Promise<QueuedTask[]> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get active project paths to prevent duplicate project runs
      const activeProjects = Array.from(this.activeTasks.keys());
      let activeProjectPaths: string[] = [];
      if (activeProjects.length > 0) {
        const { rows } = await client.query(
          `SELECT DISTINCT project_path FROM tasks
           WHERE task_id = ANY($1) AND project_path IS NOT NULL`,
          [activeProjects]
        );
        activeProjectPaths = rows.map(r => r.project_path);
      }

      // Build exclusion clause for projects already running
      let excludeClause = '';
      const params: unknown[] = [this.workerId, limit];
      if (activeProjectPaths.length > 0) {
        excludeClause = `AND (project_path IS NULL OR project_path != ALL($3))`;
        params.push(activeProjectPaths);
      }

      // Also exclude projects that other workers are running
      const { rows: tasks } = await client.query<QueuedTask>(
        `UPDATE tasks SET
           status = 'in_progress',
           worker_id = $1,
           started_at_worker = NOW(),
           updated_at = NOW()
         WHERE task_id IN (
           SELECT t.task_id FROM tasks t
           WHERE t.status = 'queued'
             AND t.claude_prompt IS NOT NULL
             ${excludeClause}
             AND NOT EXISTS (
               SELECT 1 FROM tasks t2
               WHERE t2.project_path = t.project_path
                 AND t2.project_path IS NOT NULL
                 AND t2.status = 'in_progress'
                 AND t2.task_id != t.task_id
             )
           ORDER BY t.priority DESC, t.queued_at ASC
           LIMIT $2
           FOR UPDATE OF t SKIP LOCKED
         )
         RETURNING task_id, project_path, claude_prompt, task_title`,
        params
      );

      await client.query('COMMIT');
      if (tasks.length > 0) {
        console.log(`Claimed ${tasks.length} task(s): ${tasks.map(t => `#${t.task_id}`).join(', ')}`);
      }
      return tasks;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Failed to claim tasks:', err);
      return [];
    } finally {
      client.release();
    }
  }

  private async executeTask(task: QueuedTask): Promise<void> {
    console.log(`Executing task #${task.task_id}: "${task.task_title}" in ${task.project_path}`);
    const startTime = Date.now();

    try {
      const result = await this.claudeRunner.run({
        projectPath: task.project_path,
        prompt: task.claude_prompt
      });

      const durationMs = Date.now() - startTime;
      const output = result.output || '';
      const summary = output.slice(0, 2000);

      await query(
        `UPDATE tasks SET
           status = $1,
           completed_date = NOW(),
           result_summary = $2,
           result_output = $3,
           execution_metadata = $4,
           updated_at = NOW()
         WHERE task_id = $5`,
        [
          result.exitCode === 0 ? 'completed' : 'failed',
          summary,
          output,
          JSON.stringify({
            exitCode: result.exitCode,
            timedOut: result.timedOut,
            durationMs,
            workerId: this.workerId
          }),
          task.task_id
        ]
      );

      console.log(`Task #${task.task_id} ${result.exitCode === 0 ? 'completed' : 'failed'} in ${Math.round(durationMs / 1000)}s`);
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      console.error(`Task #${task.task_id} error:`, err.message);

      await query(
        `UPDATE tasks SET
           status = 'failed',
           error_message = $1,
           execution_metadata = $2,
           updated_at = NOW()
         WHERE task_id = $3`,
        [
          err.message,
          JSON.stringify({ durationMs, workerId: this.workerId, error: true }),
          task.task_id
        ]
      );
    }
  }

  private async recoverStaleTasks(): Promise<void> {
    try {
      const { rowCount } = await query(
        `UPDATE tasks SET
           status = 'queued',
           worker_id = NULL,
           started_at_worker = NULL,
           updated_at = NOW()
         WHERE status = 'in_progress'
           AND claude_prompt IS NOT NULL
           AND started_at_worker < NOW() - INTERVAL '${STALE_TASK_MINUTES} minutes'`
      );
      if (rowCount && rowCount > 0) {
        console.log(`Recovered ${rowCount} stale task(s)`);
      }
    } catch (err) {
      console.error('Failed to recover stale tasks:', err);
    }
  }
}
