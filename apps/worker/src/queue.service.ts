/**
 * FooladERP - Central Asynchronous Queue & Dead Letter Queue Service
 * Handles background jobs: Moadian submissions, SMS dispatch, large imports/exports, with priority & scheduled delays.
 */

import { QueueJob, QueueJobPriority } from '@foolad/domain';

export class QueueService {
  private jobs: Map<string, QueueJob> = new Map();

  /**
   * Enqueues a new background job.
   */
  public enqueue(params: {
    companyId: string;
    queueName: string;
    jobType: string;
    payload: Record<string, unknown>;
    priority?: QueueJobPriority;
    delaySeconds?: number;
    maxAttempts?: number;
    userId?: string;
  }): QueueJob {
    const now = new Date();
    const scheduledAt = params.delaySeconds
      ? new Date(now.getTime() + params.delaySeconds * 1000).toISOString()
      : now.toISOString();

    const job: QueueJob = {
      id: crypto.randomUUID(),
      company_id: params.companyId,
      queue_name: params.queueName,
      job_type: params.jobType,
      payload: params.payload,
      priority: params.priority || 'NORMAL',
      status: params.delaySeconds ? 'SCHEDULED' : 'PENDING',
      scheduled_at: scheduledAt,
      attempt_count: 0,
      max_attempts: params.maxAttempts || 5,
      is_dead_letter: false,
      created_by: params.userId,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    this.jobs.set(job.id, job);
    return job;
  }

  /**
   * Polls the next executable job based on priority and schedule.
   */
  public pollNextJob(queueName?: string): QueueJob | undefined {
    const now = new Date().toISOString();
    const priorityWeights: Record<QueueJobPriority, number> = {
      CRITICAL: 4,
      HIGH: 3,
      NORMAL: 2,
      LOW: 1,
    };

    const candidates = Array.from(this.jobs.values()).filter(j => {
      const matchQueue = queueName ? j.queue_name === queueName : true;
      const isReady = (j.status === 'PENDING' || (j.status === 'SCHEDULED' && j.scheduled_at <= now)) && !j.is_dead_letter;
      return matchQueue && isReady;
    });

    if (candidates.length === 0) return undefined;

    // Sort by priority desc, then created_at asc
    candidates.sort((a, b) => {
      const pDiff = priorityWeights[b.priority] - priorityWeights[a.priority];
      if (pDiff !== 0) return pDiff;
      return a.created_at.localeCompare(b.created_at);
    });

    const chosen = candidates[0];
    chosen.status = 'PROCESSING';
    chosen.started_at = new Date().toISOString();
    chosen.attempt_count += 1;
    chosen.updated_at = new Date().toISOString();
    return chosen;
  }

  /**
   * Completes a job successfully.
   */
  public completeJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'SUCCEEDED';
    job.finished_at = new Date().toISOString();
    job.updated_at = new Date().toISOString();
  }

  /**
   * Handles job failure with automatic retry policy or routing to Dead Letter Queue.
   */
  public failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.last_error = error;
    job.updated_at = new Date().toISOString();

    if (job.attempt_count < job.max_attempts) {
      job.status = 'RETRYING';
      // Exponential backoff retry e.g. 5s, 15s, 45s
      const delay = Math.pow(3, job.attempt_count) * 2;
      job.scheduled_at = new Date(Date.now() + delay * 1000).toISOString();
      job.status = 'SCHEDULED';
    } else {
      job.status = 'FAILED';
      job.is_dead_letter = true;
      job.finished_at = new Date().toISOString();
    }
  }

  /**
   * Retrieves summary counts for monitoring.
   */
  public getMetrics(): { pending: number; scheduled: number; processing: number; succeeded: number; deadLetter: number } {
    const jobs = Array.from(this.jobs.values());
    return {
      pending: jobs.filter(j => j.status === 'PENDING').length,
      scheduled: jobs.filter(j => j.status === 'SCHEDULED').length,
      processing: jobs.filter(j => j.status === 'PROCESSING').length,
      succeeded: jobs.filter(j => j.status === 'SUCCEEDED').length,
      deadLetter: jobs.filter(j => j.is_dead_letter).length,
    };
  }

  public getAllJobs(): QueueJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

export const queueService = new QueueService();
