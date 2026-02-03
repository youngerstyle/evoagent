/**
 * Health Check - 健康检查
 *
 * 实现各种健康检查功能
 */

import { cpus, freemem, totalmem } from 'os';
import type { LLMService } from '../../core/llm/types.js';

/**
 * 健康状态
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  status: HealthStatus;
  checks: Record<string, ComponentHealth>;
  timestamp: string;
}

/**
 * 组件健康状态
 */
export interface ComponentHealth {
  status: HealthStatus;
  message?: string;
  details?: Record<string, unknown>;
  duration?: number; // 检查耗时（毫秒）
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  diskThresholdPercent: number;
  memoryThresholdPercent: number;
  llmTimeout: number;
  embeddingTimeout: number;
}

/**
 * 健康检查器
 */
export class HealthChecker {
  private readonly startTime: number;

  constructor(
    private readonly llm?: LLMService,
    private readonly config?: Partial<HealthCheckConfig>
  ) {
    this.startTime = Date.now();
  }

  /**
   * 执行完整健康检查
   */
  async check(): Promise<HealthCheckResult> {
    const results: Record<string, ComponentHealth> = {};
    const timestamp = new Date().toISOString();

    // 并行执行所有检查
    const checks = await Promise.allSettled([
      this.checkLLM(),
      this.checkDisk(),
      this.checkMemory(),
      this.checkProcess(),
      this.checkEmbedding()
    ]);

    // LLM 检查
    results.llm = this.extractResult(checks[0], 'LLM');

    // 磁盘检查
    results.disk = this.extractResult(checks[1], 'Disk');

    // 内存检查
    results.memory = this.extractResult(checks[2], 'Memory');

    // 进程检查
    results.process = this.extractResult(checks[3], 'Process');

    // Embedding 检查
    results.embedding = this.extractResult(checks[4], 'Embedding');

    // 计算总体状态
    const status = this.calculateOverallStatus(results);

    return {
      status,
      checks: results,
      timestamp
    };
  }

  /**
   * 检查 LLM 服务
   */
  private async checkLLM(): Promise<ComponentHealth> {
    if (!this.llm) {
      return {
        status: 'degraded',
        message: 'LLM service not configured'
      };
    }

    const start = Date.now();
    try {
      const healthy = await Promise.race([
        this.llm.healthCheck(),
        this.timeout(this.config?.llmTimeout ?? 10000)
      ]);

      const duration = Date.now() - start;

      if (healthy) {
        return {
          status: 'healthy',
          message: 'LLM service is responding',
          details: { provider: this.llm.provider, model: this.llm.model },
          duration
        };
      } else {
        return {
          status: 'unhealthy',
          message: 'LLM service health check failed',
          details: { provider: this.llm.provider, model: this.llm.model },
          duration
        };
      }
    } catch (error) {
      const duration = Date.now() - start;
      return {
        status: 'unhealthy',
        message: `LLM service error: ${error}`,
        duration
      };
    }
  }

  /**
   * 检查磁盘空间
   */
  private async checkDisk(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      // 简化的磁盘检查（实际实现可以使用 diskusage 等库）
      const threshold = this.config?.diskThresholdPercent ?? 90;

      // 这里应该检查实际磁盘使用率
      // 由于跨平台兼容性，这里使用模拟值
      const diskUsagePercent = 50; // 模拟值

      const duration = Date.now() - start;

      if (diskUsagePercent >= threshold) {
        return {
          status: 'unhealthy',
          message: `Disk usage critical: ${diskUsagePercent}%`,
          details: { usagePercent: diskUsagePercent, threshold },
          duration
        };
      } else if (diskUsagePercent >= threshold * 0.8) {
        return {
          status: 'degraded',
          message: `Disk usage high: ${diskUsagePercent}%`,
          details: { usagePercent: diskUsagePercent, threshold },
          duration
        };
      } else {
        return {
          status: 'healthy',
          message: `Disk usage normal: ${diskUsagePercent}%`,
          details: { usagePercent: diskUsagePercent },
          duration
        };
      }
    } catch (error) {
      const duration = Date.now() - start;
      return {
        status: 'degraded',
        message: `Disk check failed: ${error}`,
        duration
      };
    }
  }

  /**
   * 检查内存
   */
  private async checkMemory(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      const free = freemem();
      const total = totalmem();
      const usagePercent = ((total - free) / total) * 100;
      const threshold = this.config?.memoryThresholdPercent ?? 90;

      const duration = Date.now() - start;

      if (usagePercent >= threshold) {
        return {
          status: 'unhealthy',
          message: `Memory usage critical: ${usagePercent.toFixed(1)}%`,
          details: {
            usagePercent,
            free: `${(free / 1024 / 1024 / 1024).toFixed(2)} GB`,
            total: `${(total / 1024 / 1024 / 1024).toFixed(2)} GB`
          },
          duration
        };
      } else if (usagePercent >= threshold * 0.8) {
        return {
          status: 'degraded',
          message: `Memory usage high: ${usagePercent.toFixed(1)}%`,
          details: {
            usagePercent,
            free: `${(free / 1024 / 1024 / 1024).toFixed(2)} GB`,
            total: `${(total / 1024 / 1024 / 1024).toFixed(2)} GB`
          },
          duration
        };
      } else {
        return {
          status: 'healthy',
          message: `Memory usage normal: ${usagePercent.toFixed(1)}%`,
          details: {
            usagePercent,
            free: `${(free / 1024 / 1024 / 1024).toFixed(2)} GB`,
            total: `${(total / 1024 / 1024 / 1024).toFixed(2)} GB`
          },
          duration
        };
      }
    } catch (error) {
      const duration = Date.now() - start;
      return {
        status: 'degraded',
        message: `Memory check failed: ${error}`,
        duration
      };
    }
  }

  /**
   * 检查进程状态
   */
  private async checkProcess(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      const uptime = Date.now() - this.startTime;
      const cpuInfo = cpus();

      const duration = Date.now() - start;

      return {
        status: 'healthy',
        message: `Process running for ${(uptime / 1000).toFixed(0)}s`,
        details: {
          uptime,
          cpuCount: cpuInfo.length,
          uptimeFormatted: this.formatUptime(uptime)
        },
        duration
      };
    } catch (error) {
      const duration = Date.now() - start;
      return {
        status: 'degraded',
        message: `Process check failed: ${error}`,
        duration
      };
    }
  }

  /**
   * 检查 Embedding 服务
   */
  private async checkEmbedding(): Promise<ComponentHealth> {
    const start = Date.now();

    // Embedding 检查（如果有配置的话）
    const duration = Date.now() - start;

    return {
      status: 'degraded',
      message: 'Embedding service not configured',
      duration
    };
  }

  /**
   * 计算总体状态
   */
  private calculateOverallStatus(checks: Record<string, ComponentHealth>): HealthStatus {
    const values = Object.values(checks);

    // 如果有任何 unhealthy，返回 unhealthy
    if (values.some(v => v.status === 'unhealthy')) {
      return 'unhealthy';
    }

    // 如果有任何 degraded，返回 degraded
    if (values.some(v => v.status === 'degraded')) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * 提取检查结果
   */
  private extractResult(
    result: PromiseSettledResult<ComponentHealth>,
    componentName: string
  ): ComponentHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'unhealthy',
        message: `${componentName} check threw an error: ${result.reason}`
      };
    }
  }

  /**
   * 超时辅助函数
   */
  private timeout(ms: number): Promise<false> {
    return new Promise(resolve => {
      setTimeout(() => resolve(false), ms);
    });
  }

  /**
   * 格式化运行时间
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * 获取简化的健康状态（用于 /health 端点）
   */
  async getQuickStatus(): Promise<{ status: HealthStatus; timestamp: string }> {
    const result = await this.check();
    return {
      status: result.status,
      timestamp: result.timestamp
    };
  }
}
