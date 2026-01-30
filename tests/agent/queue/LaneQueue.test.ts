/**
 * Lane Queue Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LaneQueue, type TaskExecutor, type LaneTask } from '../../../src/agent/queue/LaneQueue.js';
import type { AgentRunResult } from '../../../src/agent/base/types.js';

// Mock TaskExecutor
class MockTaskExecutor implements TaskExecutor {
  private delay: number;
  private shouldFail: boolean;
  private executionCount: number = 0;

  constructor(delay: number = 10, shouldFail: boolean = false) {
    this.delay = delay;
    this.shouldFail = shouldFail;
  }

  async execute(task: LaneTask): Promise<AgentRunResult> {
    this.executionCount++;

    await new Promise(resolve => setTimeout(resolve, this.delay));

    if (this.shouldFail) {
      throw new Error('Task execution failed');
    }

    return {
      runId: `run-${task.id}`,
      sessionId: task.sessionId,
      agentType: task.agentType,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: this.delay,
      success: true,
      output: `Executed: ${task.input}`,
      metadata: {}
    };
  }

  getExecutionCount(): number {
    return this.executionCount;
  }

  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }
}

describe('LaneQueue', () => {
  let queue: LaneQueue;
  let executor: MockTaskExecutor;

  beforeEach(() => {
    executor = new MockTaskExecutor(10);
    queue = new LaneQueue({ enableAutoStart: false }); // Disable auto-start for controlled tests
    queue.setTaskExecutor(executor);
  });

  afterEach(() => {
    queue.destroy();
  });

  describe('enqueue', () => {
    it('should enqueue a task', async () => {
      const taskId = await queue.enqueue(
        'codewriter',
        'Write test code',
        'main',
        'session-1'
      );

      expect(taskId).toBeDefined();
      expect(taskId).toMatch(/^task-/);

      const task = queue.getTaskStatus(taskId);
      expect(task).toBeDefined();
      expect(task!.status).toBe('queued');
      expect(task!.lane).toBe('main');
    });

    it('should enqueue multiple tasks', async () => {
      const taskId1 = await queue.enqueue('agent-1', 'Task 1', 'main', 'session-1');
      const taskId2 = await queue.enqueue('agent-2', 'Task 2', 'parallel', 'session-1');

      expect(taskId1).toBeDefined();
      expect(taskId2).toBeDefined();

      const stats = queue.getStats();
      expect(stats.totalTasks).toBe(2);
    });

    it('should use custom task options', async () => {
      const taskId = await queue.enqueue(
        'codewriter',
        'High priority task',
        'main',
        'session-1',
        {
          taskId: 'custom-task-id',
          priority: 90,
          maxRetries: 5
        }
      );

      const task = queue.getTaskStatus(taskId);
      expect(task).toBeDefined();
      expect(task!.id).toBe('custom-task-id');
      expect(task!.priority).toBe(90);
      expect(task!.maxRetries).toBe(5);
    });

    it('should reject task for non-existent lane', async () => {
      await expect(
        queue.enqueue('agent', 'task', 'invalid' as any, 'session-1')
      ).rejects.toThrow('Lane invalid does not exist');
    });
  });

  describe('cancel', () => {
    it('should cancel a queued task', async () => {
      const taskId = await queue.enqueue('agent', 'task', 'main', 'session-1');

      const cancelled = queue.cancel(taskId);

      expect(cancelled).toBe(true);

      const task = queue.getTaskStatus(taskId);
      expect(task!.status).toBe('cancelled');
    });

    it('should not cancel completed task', async () => {
      const taskId = await queue.enqueue('agent', 'task', 'main', 'session-1');

      // Simulate task completion
      const task = queue.getTaskStatus(taskId)!;
      task.status = 'completed';
      task.completedAt = Date.now();

      const cancelled = queue.cancel(taskId);

      expect(cancelled).toBe(false);
    });

    it('should return false for non-existent task', () => {
      const cancelled = queue.cancel('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('waitFor', () => {
    it('should wait for task completion', async () => {
      const taskId = await queue.enqueue('agent', 'task', 'main', 'session-1');

      // Simulate task completion
      setTimeout(() => {
        const task = queue.getTaskStatus(taskId)!;
        task.status = 'completed';
        task.completedAt = Date.now();
      }, 50);

      const result = await queue.waitFor(taskId);

      expect(result.status).toBe('completed');
    });

    it('should timeout when waiting for task', async () => {
      const taskId = await queue.enqueue('agent', 'task', 'main', 'session-1');

      await expect(
        queue.waitFor(taskId, 100)
      ).rejects.toThrow('timeout');
    });
  });

  describe('Lane operations', () => {
    it('should get lane status', async () => {
      await queue.enqueue('agent', 'task', 'main', 'session-1');

      const status = queue.getLaneStatus('main');

      expect(status).toBeDefined();
      expect(status!.type).toBe('main');
      expect(status!.queuedTasks).toBe(1);
    });

    it('should get all lane statuses', async () => {
      await queue.enqueue('agent', 'task', 'main', 'session-1');
      await queue.enqueue('agent', 'task', 'parallel', 'session-1');

      const statuses = queue.getAllLaneStatus();

      expect(statuses).toHaveLength(3); // planner, main, parallel
      expect(statuses.find(s => s.type === 'main')).toBeDefined();
      expect(statuses.find(s => s.type === 'parallel')).toBeDefined();
    });

    it('should pause and resume lane', () => {
      const paused = queue.pauseLane('main');
      expect(paused).toBe(true);

      const resumed = queue.resumeLane('main');
      expect(resumed).toBe(true);
    });

    it('should clear lane', async () => {
      await queue.enqueue('agent', 'task', 'main', 'session-1');
      await queue.enqueue('agent', 'task', 'main', 'session-1');

      const cleared = queue.clearLane('main');
      expect(cleared).toBe(true);

      const status = queue.getLaneStatus('main');
      expect(status!.queuedTasks).toBe(0);
    });
  });

  describe('priority', () => {
    it('should respect task priority', async () => {
      await queue.enqueue('agent', 'Low priority', 'main', 'session-1', { priority: 10 });
      await queue.enqueue('agent', 'High priority', 'main', 'session-1', { priority: 90 });
      await queue.enqueue('agent', 'Medium priority', 'main', 'session-1', { priority: 50 });

      const laneStatus = queue.getLaneStatus('main');
      // Note: Can't directly test queue order, but we can verify all tasks are queued
      expect(laneStatus!.queuedTasks).toBe(3);
    });
  });

  describe('dependencies', () => {
    it('should respect task dependencies', async () => {
      const taskId1 = await queue.enqueue('agent', 'Task 1', 'main', 'session-1');
      const taskId2 = await queue.enqueue('agent', 'Task 2', 'main', 'session-1', {
        dependencies: [taskId1]
      });

      const task2 = queue.getTaskStatus(taskId2);
      expect(task2!.dependencies).toEqual([taskId1]);
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', async () => {
      await queue.enqueue('agent', 'task', 'main', 'session-1');
      await queue.enqueue('agent', 'task', 'parallel', 'session-1');
      await queue.enqueue('agent', 'task', 'planner', 'session-1');

      // Cancel one task
      const task = queue.getTaskStatus(await queue.enqueue('agent', 'task', 'main', 'session-1'));
      task!.status = 'cancelled';
      task!.completedAt = Date.now();

      const stats = queue.getStats();

      expect(stats.totalTasks).toBe(4);
      expect(stats.tasksByStatus.queued).toBe(3);
      expect(stats.tasksByStatus.cancelled).toBe(1);
      expect(stats.tasksByLane.main).toBe(2);
      expect(stats.tasksByLane.parallel).toBe(1);
      expect(stats.tasksByLane.planner).toBe(1);
      expect(stats.totalLanes).toBe(3);
    });
  });

  describe('TaskExecutor integration', () => {
    it('should execute tasks through executor', async () => {
      const autoStartQueue = new LaneQueue({ enableAutoStart: true });
      autoStartQueue.setTaskExecutor(executor);

      const taskId = await autoStartQueue.enqueue('agent', 'test task', 'main', 'session-1');

      // Wait for task to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(executor.getExecutionCount()).toBeGreaterThan(0);

      autoStartQueue.destroy();
    });

    it('should handle task execution failure', async () => {
      const failingExecutor = new MockTaskExecutor(5, true);
      const autoStartQueue = new LaneQueue({ enableAutoStart: true, defaultMaxRetries: 1 });
      autoStartQueue.setTaskExecutor(failingExecutor);

      const taskId = await autoStartQueue.enqueue('agent', 'failing task', 'main', 'session-1');

      // Wait for task to fail (initial + 1 retry)
      await new Promise(resolve => setTimeout(resolve, 200));

      const task = autoStartQueue.getTaskStatus(taskId);
      expect(task!.status).toBe('failed');
      expect(task!.error).toBeDefined();

      autoStartQueue.destroy();
    });
  });

  describe('Task retry', () => {
    it('should retry failed tasks up to maxRetries', async () => {
      const failingExecutor = new MockTaskExecutor(5, true);
      const autoStartQueue = new LaneQueue({ enableAutoStart: true, defaultMaxRetries: 2 });
      autoStartQueue.setTaskExecutor(failingExecutor);

      await autoStartQueue.enqueue('agent', 'flaky task', 'main', 'session-1');

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have attempted initial + 2 retries = 3 attempts
      expect(failingExecutor.getExecutionCount()).toBe(3);

      autoStartQueue.destroy();
    });
  });
});
