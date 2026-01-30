/**
 * Lane Queue - 并行执行队列管理
 *
 * 管理多个并行执行通道 (Lane)，每个 Lane 可以独立运行 Agent 任务
 */

import { getLogger } from '../../core/logger/index.js';
import type { AgentRunResult } from '../base/types.js';
import type { LaneType } from '../../types/memory.js';

const logger = getLogger('agent:lane-queue');

/**
 * 任务状态
 */
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Lane 任务
 */
export interface LaneTask {
  id: string;
  lane: LaneType;
  priority: number; // 0-100，越高越优先
  agentType: string;
  input: string;
  sessionId: string;
  parentTaskId?: string;

  // 执行相关
  status: TaskStatus;
  createdAt: number;
  queuedAt?: number;
  startedAt?: number;
  completedAt?: number;

  // 结果
  result?: AgentRunResult;
  error?: string;

  // 重试
  retryCount: number;
  maxRetries: number;

  // 依赖
  dependencies: string[]; // 依赖的任务 ID

  // 元数据
  metadata?: Record<string, unknown>;
}

/**
 * Lane 配置
 */
export interface LaneConfig {
  type: LaneType;
  maxConcurrent?: number; // 最大并发任务数
  priority?: number; // Lane 优先级
  description?: string;
}

/**
 * Lane 状态
 */
export interface LaneStatus {
  type: LaneType;
  active: boolean;
  runningTasks: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalTasks: number;
}

/**
 * 队列统计
 */
export interface QueueStats {
  totalLanes: number;
  activeLanes: number;
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByLane: Record<LaneType, number>;
  averageWaitTime: number;
  averageExecutionTime: number;
}

/**
 * 队列配置
 */
export interface LaneQueueConfig {
  lanes?: LaneConfig[];
  defaultMaxRetries?: number;
  enableAutoStart?: boolean;
  metricsEnabled?: boolean;
}

/**
 * 默认 Lane 配置
 */
const DEFAULT_LANES: LaneConfig[] = [
  { type: 'planner', maxConcurrent: 1, priority: 100, description: 'Planner Agent 专用通道' },
  { type: 'main', maxConcurrent: 2, priority: 80, description: '主执行流程' },
  { type: 'parallel', maxConcurrent: 4, priority: 60, description: '并行任务' }
];

/**
 * Lane 队列
 *
 * 功能：
 * 1. 管理多个执行 Lane
 * 2. 任务排队和调度
 * 3. 优先级管理
 * 4. 并发控制
 * 5. 任务依赖管理
 */
export class LaneQueue {
  private lanes: Map<LaneType, Lane> = new Map();
  private tasks: Map<string, LaneTask> = new Map();
  private taskExecutor?: TaskExecutor;
  private processing = false;

  private config: Required<LaneQueueConfig>;
  private metrics: QueueMetrics;

  constructor(config: LaneQueueConfig = {}) {
    this.config = {
      lanes: config.lanes ?? DEFAULT_LANES,
      defaultMaxRetries: config.defaultMaxRetries ?? 3,
      enableAutoStart: config.enableAutoStart ?? true,
      metricsEnabled: config.metricsEnabled ?? true
    };

    this.metrics = new QueueMetrics();

    // 初始化 Lanes
    for (const laneConfig of this.config.lanes) {
      this.lanes.set(laneConfig.type, new Lane(laneConfig));
    }

    // 启动自动处理
    if (this.config.enableAutoStart) {
      this.startProcessing();
    }

    logger.info('LaneQueue initialized', {
      lanes: this.config.lanes.map(l => l.type)
    });
  }

  /**
   * 设置任务执行器
   */
  setTaskExecutor(executor: TaskExecutor): void {
    this.taskExecutor = executor;
  }

  /**
   * 添加任务
   */
  async enqueue(
    agentType: string,
    input: string,
    lane: LaneType,
    sessionId: string,
    options: TaskOptions = {}
  ): Promise<string> {
    const taskId = options.taskId ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const task: LaneTask = {
      id: taskId,
      lane,
      priority: options.priority ?? 50,
      agentType,
      input,
      sessionId,
      parentTaskId: options.parentTaskId,
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.config.defaultMaxRetries,
      dependencies: options.dependencies ?? [],
      metadata: options.metadata
    };

    // 验证 Lane 存在
    const laneObj = this.lanes.get(lane);
    if (!laneObj) {
      throw new Error(`Lane ${lane} does not exist`);
    }

    // 存储任务
    this.tasks.set(taskId, task);

    // 添加到 Lane 队列
    laneObj.enqueue(task);

    this.metrics.recordTaskQueued(task);

    logger.debug(`Task enqueued: ${taskId} in lane ${lane}`);

    return taskId;
  }

  /**
   * 取消任务
   */
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === 'completed' || task.status === 'failed') {
      return false;
    }

    task.status = 'cancelled';
    task.completedAt = Date.now();

    const lane = this.lanes.get(task.lane);
    if (lane) {
      lane.remove(taskId);
    }

    this.metrics.recordTaskCompleted(task);

    logger.debug(`Task cancelled: ${taskId}`);

    return true;
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): LaneTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 等待任务完成
   */
  async waitFor(taskId: string, timeout?: number): Promise<LaneTask> {
    return new Promise((resolve, reject) => {
      const task = this.tasks.get(taskId);
      if (!task) {
        reject(new Error(`Task ${taskId} not found`));
        return;
      }

      // 如果已经完成，直接返回
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        resolve(task);
        return;
      }

      // 设置超时
      let timeoutId: NodeJS.Timeout | undefined;
      if (timeout) {
        timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error(`Task ${taskId} timeout after ${timeout}ms`));
        }, timeout);
      }

      // 检查完成的函数
      const checkComplete = () => {
        const currentTask = this.tasks.get(taskId);
        if (currentTask &&
            (currentTask.status === 'completed' ||
             currentTask.status === 'failed' ||
             currentTask.status === 'cancelled')) {
          cleanup();
          resolve(currentTask);
        } else if (currentTask) {
          // 继续等待
          setTimeout(checkComplete, 100);
        } else {
          cleanup();
          reject(new Error(`Task ${taskId} not found`));
        }
      };

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      // 开始检查
      setTimeout(checkComplete, 100);
    });
  }

  /**
   * 获取 Lane 状态
   */
  getLaneStatus(laneType: LaneType): LaneStatus | undefined {
    const lane = this.lanes.get(laneType);
    if (!lane) {
      return undefined;
    }

    return lane.getStatus();
  }

  /**
   * 获取所有 Lane 状态
   */
  getAllLaneStatus(): LaneStatus[] {
    const statuses: LaneStatus[] = [];
    for (const lane of this.lanes.values()) {
      statuses.push(lane.getStatus());
    }
    return statuses;
  }

  /**
   * 获取队列统计
   */
  getStats(): QueueStats {
    const stats: QueueStats = {
      totalLanes: this.lanes.size,
      activeLanes: 0,
      totalTasks: this.tasks.size,
      tasksByStatus: {
        pending: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      },
      tasksByLane: {
        planner: 0,
        main: 0,
        parallel: 0
      },
      averageWaitTime: this.metrics.getAverageWaitTime(),
      averageExecutionTime: this.metrics.getAverageExecutionTime()
    };

    for (const task of this.tasks.values()) {
      stats.tasksByStatus[task.status]++;
      stats.tasksByLane[task.lane]++;
    }

    for (const lane of this.lanes.values()) {
      if (lane.getStatus().runningTasks > 0) {
        stats.activeLanes++;
      }
    }

    return stats;
  }

  /**
   * 暂停 Lane
   */
  pauseLane(laneType: LaneType): boolean {
    const lane = this.lanes.get(laneType);
    if (!lane) {
      return false;
    }

    lane.pause();
    logger.debug(`Lane paused: ${laneType}`);

    return true;
  }

  /**
   * 恢复 Lane
   */
  resumeLane(laneType: LaneType): boolean {
    const lane = this.lanes.get(laneType);
    if (!lane) {
      return false;
    }

    lane.resume();
    logger.debug(`Lane resumed: ${laneType}`);

    return true;
  }

  /**
   * 清空 Lane
   */
  clearLane(laneType: LaneType): boolean {
    const lane = this.lanes.get(laneType);
    if (!lane) {
      return false;
    }

    const cleared = lane.clear();

    // 更新任务状态
    for (const taskId of cleared) {
      const task = this.tasks.get(taskId);
      if (task && task.status === 'queued') {
        task.status = 'cancelled';
        task.completedAt = Date.now();
      }
    }

    logger.debug(`Lane cleared: ${laneType}, ${cleared.length} tasks cancelled`);

    return true;
  }

  /**
   * 启动处理循环
   */
  private startProcessing(): void {
    if (this.processing) return;
    this.processing = true;

    const process = async () => {
      while (this.processing) {
        const processed = await this.processNextTask();

        if (!processed) {
          // 没有任务可处理，等待一段时间
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    };

    process();
  }

  /**
   * 处理下一个任务
   */
  private async processNextTask(): Promise<boolean> {
    if (!this.taskExecutor) {
      return false;
    }

    // 找到可以执行任务的 Lane
    for (const lane of this.lanes.values()) {
      if (!lane.canProcess()) {
        continue;
      }

      // 检查依赖是否满足
      const task = lane.peek();
      if (!task) {
        continue;
      }

      if (!this.areDependenciesMet(task)) {
        continue;
      }

      // 从队列中取出
      lane.dequeue();

      // 开始执行
      await this.executeTask(task);

      return true;
    }

    return false;
  }

  /**
   * 检查任务依赖是否满足
   */
  private areDependenciesMet(task: LaneTask): boolean {
    for (const depId of task.dependencies) {
      const depTask = this.tasks.get(depId);
      if (!depTask) {
        continue; // 依赖不存在，假设已满足
      }

      if (depTask.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  /**
   * 执行任务
   */
  private async executeTask(task: LaneTask): Promise<void> {
    const lane = this.lanes.get(task.lane);
    if (!lane) {
      return;
    }

    task.status = 'running';
    task.startedAt = Date.now();

    lane.startTask(task);

    this.metrics.recordTaskStarted(task);

    logger.debug(`Task started: ${task.id} in lane ${task.lane}`);

    try {
      const result = await this.taskExecutor!.execute(task);

      task.result = result;
      task.status = 'completed';
      task.completedAt = Date.now();

      this.metrics.recordTaskCompleted(task);

      logger.debug(`Task completed: ${task.id}`);

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      task.error = errMsg;

      // 决定是否重试
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.status = 'queued';
        task.queuedAt = Date.now();

        lane.enqueue(task);

        logger.debug(`Task retrying: ${task.id} (attempt ${task.retryCount})`);

      } else {
        task.status = 'failed';
        task.completedAt = Date.now();

        this.metrics.recordTaskCompleted(task);

        logger.error(`Task failed: ${task.id} - ${errMsg}`);
      }
    } finally {
      lane.completeTask(task);
    }
  }

  /**
   * 销毁队列
   */
  destroy(): void {
    this.processing = false;

    // 取消所有运行中的任务
    for (const task of this.tasks.values()) {
      if (task.status === 'running' || task.status === 'queued') {
        task.status = 'cancelled';
        task.completedAt = Date.now();
      }
    }

    this.lanes.clear();
    this.tasks.clear();

    logger.info('LaneQueue destroyed');
  }
}

/**
 * Lane - 单个执行通道
 */
class Lane {
  private queue: LaneTask[] = [];
  private running: Set<string> = new Set();
  private completed: number = 0;
  private failed: number = 0;

  constructor(private config: LaneConfig) {}

  /**
   * 添加任务到队列
   */
  enqueue(task: LaneTask): void {
    task.status = 'queued';
    task.queuedAt = Date.now();

    // 按优先级插入
    let insertIndex = 0;
    for (let i = 0; i < this.queue.length; i++) {
      const queuedTask = this.queue[i];
      if (queuedTask && queuedTask.priority < task.priority) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }

    this.queue.splice(insertIndex, 0, task);
  }

  /**
   * 从队列中取出任务
   */
  dequeue(): LaneTask | undefined {
    const task = this.queue.shift();
    return task;
  }

  /**
   * 查看队列头部的任务
   */
  peek(): LaneTask | undefined {
    return this.queue[0];
  }

  /**
   * 移除任务
   */
  remove(taskId: string): boolean {
    const index = this.queue.findIndex(t => t.id === taskId);
    if (index >= 0) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 开始任务
   */
  startTask(task: LaneTask): void {
    this.running.add(task.id);
  }

  /**
   * 完成任务
   */
  completeTask(task: LaneTask): void {
    this.running.delete(task.id);

    if (task.status === 'completed') {
      this.completed++;
    } else if (task.status === 'failed') {
      this.failed++;
    }
  }

  /**
   * 检查是否可以处理任务
   */
  canProcess(): boolean {
    const maxConcurrent = this.config.maxConcurrent ?? 1;
    return this.running.size < maxConcurrent && this.queue.length > 0;
  }

  /**
   * 暂停
   */
  pause(): void {
    // 可以添加暂停逻辑
  }

  /**
   * 恢复
   */
  resume(): void {
    // 可以添加恢复逻辑
  }

  /**
   * 清空队列
   */
  clear(): string[] {
    const cleared = this.queue.map(t => t.id);
    this.queue = [];
    return cleared;
  }

  /**
   * 获取状态
   */
  getStatus(): LaneStatus {
    return {
      type: this.config.type,
      active: this.running.size > 0 || this.queue.length > 0,
      runningTasks: this.running.size,
      queuedTasks: this.queue.length,
      completedTasks: this.completed,
      failedTasks: this.failed,
      totalTasks: this.running.size + this.queue.length + this.completed + this.failed
    };
  }
}

/**
 * 队列指标
 */
class QueueMetrics {
  private taskWaitTimes: number[] = [];
  private taskExecutionTimes: number[] = [];

  recordTaskQueued(_task: LaneTask): void {
    // 记录排队时间
  }

  recordTaskStarted(task: LaneTask): void {
    const waitTime = (task.startedAt ?? Date.now()) - task.createdAt;
    this.taskWaitTimes.push(waitTime);
  }

  recordTaskCompleted(task: LaneTask): void {
    const executionTime = (task.completedAt ?? Date.now()) - (task.startedAt ?? task.createdAt);
    this.taskExecutionTimes.push(executionTime);
  }

  getAverageWaitTime(): number {
    if (this.taskWaitTimes.length === 0) return 0;
    const sum = this.taskWaitTimes.reduce((a, b) => a + b, 0);
    return sum / this.taskWaitTimes.length;
  }

  getAverageExecutionTime(): number {
    if (this.taskExecutionTimes.length === 0) return 0;
    const sum = this.taskExecutionTimes.reduce((a, b) => a + b, 0);
    return sum / this.taskExecutionTimes.length;
  }
}

/**
 * 任务选项
 */
export interface TaskOptions {
  taskId?: string;
  priority?: number;
  maxRetries?: number;
  parentTaskId?: string;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * 任务执行器接口
 */
export interface TaskExecutor {
  execute(task: LaneTask): Promise<AgentRunResult>;
}
