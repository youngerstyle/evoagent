/**
 * Worker Threads 沙箱
 *
 * 使用 Node.js Worker Threads 提供安全的代码执行环境
 * 替代已废弃的 VM2 库
 */

import { Worker } from 'worker_threads';
import { join } from 'path';
import { getLogger } from '../../../core/logger/index.js';

const logger = getLogger('skill-executor:sandbox');

/**
 * 沙箱执行选项
 */
export interface SandboxOptions {
  timeout: number;
  maxMemory: number;
  allowedModules?: string[];
}

/**
 * 沙箱执行结果
 */
export interface SandboxResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

/**
 * Worker Threads 沙箱
 */
export class WorkerSandbox {
  /**
   * 在沙箱中执行代码
   */
  async execute(
    code: string,
    context: Record<string, unknown>,
    options: SandboxOptions
  ): Promise<SandboxResult> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        worker.terminate();
        resolve({
          success: false,
          error: `Execution timeout after ${options.timeout}ms`
        });
      }, options.timeout);

      // 创建 Worker
      const worker = new Worker(
        join(import.meta.dirname || __dirname, 'sandbox-worker.js'),
        {
          workerData: {
            code,
            context,
            allowedModules: options.allowedModules || []
          },
          resourceLimits: {
            maxOldGenerationSizeMb: Math.floor(options.maxMemory / (1024 * 1024)),
            maxYoungGenerationSizeMb: Math.floor(options.maxMemory / (1024 * 1024) / 2)
          }
        }
      );

      worker.on('message', (result: SandboxResult) => {
        clearTimeout(timeoutId);
        worker.terminate();
        resolve(result);
      });

      worker.on('error', (error) => {
        clearTimeout(timeoutId);
        worker.terminate();
        logger.error('Worker error:', error);
        resolve({
          success: false,
          error: error.message
        });
      });

      worker.on('exit', (code) => {
        clearTimeout(timeoutId);
        if (code !== 0) {
          resolve({
            success: false,
            error: `Worker stopped with exit code ${code}`
          });
        }
      });
    });
  }

  /**
   * 验证代码安全性
   */
  validateSecurity(code: string): { safe: boolean; issues: string[] } {
    const issues: string[] = [];

    // 危险模式检测
    const dangerousPatterns = [
      { pattern: /require\s*\(/g, message: 'Direct require() calls are not allowed' },
      { pattern: /import\s+.*\s+from/g, message: 'Import statements are not allowed' },
      { pattern: /eval\s*\(/g, message: 'eval() is not allowed' },
      { pattern: /Function\s*\(/g, message: 'Function constructor is not allowed' },
      { pattern: /process\./g, message: 'Process access is not allowed' },
      { pattern: /child_process/g, message: 'Child process spawning is not allowed' },
      { pattern: /fs\./g, message: 'Direct filesystem access is not allowed' },
      { pattern: /__dirname/g, message: '__dirname access is not allowed' },
      { pattern: /__filename/g, message: '__filename access is not allowed' },
      { pattern: /global\./g, message: 'Global object access is not allowed' },
      { pattern: /globalThis\./g, message: 'GlobalThis access is not allowed' },
      { pattern: /\.constructor\s*\(/g, message: 'Constructor access is not allowed' },
      { pattern: /\.prototype\./g, message: 'Prototype manipulation is not allowed' },
      { pattern: /Object\.defineProperty/g, message: 'Object.defineProperty is not allowed' },
      { pattern: /Object\.setPrototypeOf/g, message: 'Object.setPrototypeOf is not allowed' },
      { pattern: /Proxy\s*\(/g, message: 'Proxy is not allowed' },
      { pattern: /Reflect\./g, message: 'Reflect API is not allowed' },
      { pattern: /WebAssembly/g, message: 'WebAssembly is not allowed' },
      { pattern: /fetch\s*\(/g, message: 'Network requests are not allowed' },
      { pattern: /XMLHttpRequest/g, message: 'XMLHttpRequest is not allowed' },
      { pattern: /Worker\s*\(/g, message: 'Worker creation is not allowed' },
      { pattern: /SharedArrayBuffer/g, message: 'SharedArrayBuffer is not allowed' }
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        issues.push(message);
      }
    }

    // 检查代码长度
    if (code.length > 100000) {
      issues.push('Code is too long (max 100KB)');
    }

    // 检查嵌套深度
    const maxNestingDepth = 10;
    const nestingDepth = this.calculateNestingDepth(code);
    if (nestingDepth > maxNestingDepth) {
      issues.push(`Code nesting depth exceeds limit (${nestingDepth} > ${maxNestingDepth})`);
    }

    return {
      safe: issues.length === 0,
      issues
    };
  }

  /**
   * 计算代码嵌套深度
   */
  private calculateNestingDepth(code: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of code) {
      if (char === '{' || char === '(' || char === '[') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}' || char === ')' || char === ']') {
        currentDepth--;
      }
    }

    return maxDepth;
  }

  /**
   * 转义参数值
   */
  escapeParameter(value: unknown): string {
    if (typeof value === 'string') {
      // 转义特殊字符
      return value
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\x00/g, '\\0');
    } else if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    } else {
      return String(value);
    }
  }
}

/**
 * 全局沙箱实例
 */
export const globalSandbox = new WorkerSandbox();
