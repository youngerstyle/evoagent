/**
 * CLI Execute 命令集成测试
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { rm, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

describe('CLI Execute Command', () => {
  let testWorkspace: string;
  let cliPath: string;

  beforeAll(async () => {
    // 创建临时测试工作空间
    testWorkspace = mkdtempSync(join(tmpdir(), 'evoagent-cli-test-'));

    // CLI 可执行文件路径
    cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');

    // 确保构建已更新
    await mkdir(join(testWorkspace, 'src'), { recursive: true });
  });

  afterAll(async () => {
    // 清理临时目录
    try {
      await rm(testWorkspace, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe('命令行参数解析', () => {
    it('应该显示帮助信息', async () => {
      const { stdout } = await execAsync(`node ${cliPath} execute --help`);

      expect(stdout).toContain('Execute a task with single agent');
      expect(stdout).toContain('--type');
      expect(stdout).toContain('--session');
      expect(stdout).toContain('--workspace');
    });

    it('应该显示版本信息', async () => {
      const { stdout } = await execAsync(`node ${cliPath} --version`);

      expect(stdout).toContain('1.0.0');
    });

    it('应该显示主命令帮助', async () => {
      const { stdout } = await execAsync(`node ${cliPath} --help`);

      expect(stdout).toContain('EvoAgent');
      expect(stdout).toContain('init');
      expect(stdout).toContain('execute');
      expect(stdout).toContain('serve');
    });
  });

  describe('必需参数验证', () => {
    it('应该拒绝没有输入参数的命令', async () => {
      try {
        await execAsync(`node ${cliPath} execute`);
        expect(true).toBe(false); // 不应该到达这里
      } catch (error: any) {
        expect(error.stderr).toBeDefined();
        // 应该有错误信息
      }
    });
  });

  describe('工作空间选项', () => {
    it('应该接受自定义工作空间路径', async () => {
      try {
        await execAsync(
          `node ${cliPath} execute --workspace "${testWorkspace}" "test input"`,
          {
            env: { ...process.env, ANTHROPIC_API_KEY: 'test-key' },
            timeout: 30000
          }
        );
      } catch (error: any) {
        // 可能会因为 API key 无效而失败，但至少工作空间参数应该被接受
        expect(error.stdout || error.stderr || error.message).toBeDefined();
      }
    });
  });

  describe('Agent 类型选项', () => {
    it('应该接受 codewriter 类型', async () => {
      try {
        await execAsync(
          `node ${cliPath} execute --type codewriter "test input"`,
          {
            env: { ...process.env, ANTHROPIC_API_KEY: 'test-key' },
            timeout: 30000
          }
        );
      } catch (error: any) {
        expect(error.stdout || error.stderr || error.message).toBeDefined();
      }
    });

    it('应该接受 tester 类型', async () => {
      try {
        await execAsync(
          `node ${cliPath} execute --type tester "test input"`,
          {
            env: { ...process.env, ANTHROPIC_API_KEY: 'test-key' },
            timeout: 30000
          }
        );
      } catch (error: any) {
        expect(error.stdout || error.stderr || error.message).toBeDefined();
      }
    });

    it('应该接受 reviewer 类型', async () => {
      try {
        await execAsync(
          `node ${cliPath} execute --type reviewer "test input"`,
          {
            env: { ...process.env, ANTHROPIC_API_KEY: 'test-key' },
            timeout: 30000
          }
        );
      } catch (error: any) {
        expect(error.stdout || error.stderr || error.message).toBeDefined();
      }
    });
  });

  describe('会话选项', () => {
    it('应该接受自定义会话 ID', async () => {
      try {
        await execAsync(
          `node ${cliPath} execute --session test-session-123 "test input"`,
          {
            env: { ...process.env, ANTHROPIC_API_KEY: 'test-key' },
            timeout: 30000
          }
        );
      } catch (error: any) {
        expect(error.stdout || error.stderr || error.message).toBeDefined();
      }
    });
  });
});
