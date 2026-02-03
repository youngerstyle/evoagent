/**
 * 健康检查端点
 */

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: Record<string, { status: 'pass' | 'fail' | 'warn'; message?: string; duration?: number }>;
}

export class HealthChecker {
  private startTime: number;
  private checks: Map<string, () => Promise<boolean>>;

  constructor() {
    this.startTime = Date.now();
    this.checks = new Map();
  }

  registerCheck(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check);
  }

  async check(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = {};
    let hasFailure = false;
    let hasWarning = false;

    for (const [name, checkFn] of this.checks.entries()) {
      const startTime = Date.now();
      try {
        const result = await Promise.race([
          checkFn(),
          new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Check timeout')), 5000))
        ]);
        checks[name] = { status: result ? 'pass' : 'warn', duration: Date.now() - startTime };
        if (!result) hasWarning = true;
      } catch (error) {
        checks[name] = {
          status: 'fail',
          message: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime
        };
        hasFailure = true;
      }
    }

    return {
      status: hasFailure ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks
    };
  }

  async ready(): Promise<boolean> {
    const status = await this.check();
    return status.status !== 'unhealthy';
  }

  async alive(): Promise<boolean> {
    return true;
  }
}

export const globalHealthChecker = new HealthChecker();
