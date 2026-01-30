/**
 * File Tools 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerFileTools } from '../../../src/cli/commands/file-tools.js';
import { rm, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';

describe('File Tools', () => {
  let testWorkspace: string;
  let toolRegistry: Map<string, (params: any) => Promise<any>>;

  beforeEach(async () => {
    // 创建临时测试目录
    testWorkspace = mkdtempSync(join(tmpdir(), 'evoagent-test-'));

    // 创建工具注册表
    toolRegistry = new Map();
    registerFileTools(toolRegistry, testWorkspace);
  });

  afterEach(async () => {
    // 清理临时目录
    try {
      await rm(testWorkspace, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe('file_read', () => {
    it('should read file content successfully', async () => {
      const fileRead = toolRegistry.get('file_read');
      expect(fileRead).toBeDefined();

      // 创建测试文件
      const testFile = join(testWorkspace, 'test.txt');
      await writeFile(testFile, 'Hello, World!', 'utf-8');

      // 读取文件
      const result = await fileRead!({ path: 'test.txt' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello, World!');
    });

    it('should handle non-existent file', async () => {
      const fileRead = toolRegistry.get('file_read');

      const result = await fileRead!({ path: 'non-existent.txt' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should read file from subdirectory', async () => {
      const fileRead = toolRegistry.get('file_read');

      // 创建子目录和文件
      const { mkdir } = await import('fs/promises');
      const subdir = join(testWorkspace, 'subdir');
      await mkdir(subdir, { recursive: true });

      const testFile = join(subdir, 'nested.txt');
      await writeFile(testFile, 'Nested content', 'utf-8');

      // 读取文件
      const result = await fileRead!({ path: 'subdir/nested.txt' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Nested content');
    });
  });

  describe('file_write', () => {
    it('should write file content successfully', async () => {
      const fileWrite = toolRegistry.get('file_write');
      expect(fileWrite).toBeDefined();

      // 写入文件
      const result = await fileWrite!({
        path: 'new-file.txt',
        content: 'New content'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('new-file.txt');

      // 验证文件内容
      const testFile = join(testWorkspace, 'new-file.txt');
      const content = await readFile(testFile, 'utf-8');
      expect(content).toBe('New content');
    });

    it('should create parent directories if they do not exist', async () => {
      const fileWrite = toolRegistry.get('file_write');

      // 写入到不存在的子目录
      const result = await fileWrite!({
        path: 'deep/nested/path/file.txt',
        content: 'Deep content'
      });

      expect(result.success).toBe(true);

      // 验证文件存在
      const testFile = join(testWorkspace, 'deep/nested/path/file.txt');
      const content = await readFile(testFile, 'utf-8');
      expect(content).toBe('Deep content');
    });

    it('should overwrite existing file', async () => {
      const fileWrite = toolRegistry.get('file_write');

      // 创建初始文件
      const testFile = join(testWorkspace, 'overwrite.txt');
      await writeFile(testFile, 'Initial content', 'utf-8');

      // 覆盖文件
      const result = await fileWrite!({
        path: 'overwrite.txt',
        content: 'Updated content'
      });

      expect(result.success).toBe(true);

      // 验证文件内容已更新
      const content = await readFile(testFile, 'utf-8');
      expect(content).toBe('Updated content');
    });
  });

  describe('file_list', () => {
    it('should list files in directory', async () => {
      const fileList = toolRegistry.get('file_list');
      expect(fileList).toBeDefined();

      // 创建测试文件
      await writeFile(join(testWorkspace, 'file1.txt'), '', 'utf-8');
      await writeFile(join(testWorkspace, 'file2.ts'), '', 'utf-8');

      // 列出文件
      const result = await fileList!({ path: '.' });

      expect(result.success).toBe(true);
      expect(result.output).toHaveLength(2);
      expect(result.output.some((f: any) => f.name === 'file1.txt')).toBe(true);
      expect(result.output.some((f: any) => f.name === 'file2.ts')).toBe(true);
    });

    it('should filter out hidden files and node_modules', async () => {
      const fileList = toolRegistry.get('file_list');

      // 创建各种文件
      await writeFile(join(testWorkspace, 'visible.txt'), '', 'utf-8');
      await writeFile(join(testWorkspace, '.hidden'), '', 'utf-8');
      const { mkdir } = await import('fs/promises');
      await mkdir(join(testWorkspace, 'node_modules'), { recursive: true });
      await writeFile(join(testWorkspace, 'node_modules', 'package.json'), '{}', 'utf-8');

      // 列出文件
      const result = await fileList!({ path: '.' });

      expect(result.success).toBe(true);
      expect(result.output).toHaveLength(1);
      expect(result.output[0].name).toBe('visible.txt');
    });

    it('should identify directories correctly', async () => {
      const fileList = toolRegistry.get('file_list');

      // 创建文件和目录
      await writeFile(join(testWorkspace, 'file.txt'), '', 'utf-8');
      const { mkdir } = await import('fs/promises');
      await mkdir(join(testWorkspace, 'directory'), { recursive: true });

      // 列出文件
      const result = await fileList!({ path: '.' });

      expect(result.success).toBe(true);
      expect(result.output).toHaveLength(2);
      expect(result.output.some((f: any) => f.name === 'file.txt' && f.type === 'file')).toBe(true);
      expect(result.output.some((f: any) => f.name === 'directory' && f.type === 'directory')).toBe(true);
    });

    it('should default to current directory when no path provided', async () => {
      const fileList = toolRegistry.get('file_list');

      await writeFile(join(testWorkspace, 'default.txt'), '', 'utf-8');

      // 不提供路径参数
      const result = await fileList!({});

      expect(result.success).toBe(true);
      expect(result.output.length).toBeGreaterThan(0);
    });
  });

  describe('terminal_execute', () => {
    // 在 Windows 上跳过终端测试
    const isWindows = process.platform === 'win32';

    it('should execute shell command successfully', async () => {
      if (isWindows) {
        // 跳过 Windows
        return;
      }

      const terminalExecute = toolRegistry.get('terminal_execute');

      const result = await terminalExecute!({ command: 'echo "Hello, Terminal!"' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello, Terminal!');
    });

    it('should execute commands in workspace directory', async () => {
      if (isWindows) {
        // 跳过 Windows
        return;
      }

      const terminalExecute = toolRegistry.get('terminal_execute');

      // 创建测试文件
      await writeFile(join(testWorkspace, 'test.txt'), 'content', 'utf-8');

      // 在工作空间目录中执行命令
      const result = await terminalExecute!({ command: 'ls test.txt' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('test.txt');
    });

    it('should handle command errors', async () => {
      if (isWindows) {
        // 跳过 Windows
        return;
      }

      const terminalExecute = toolRegistry.get('terminal_execute');

      // 执行会失败的命令
      const result = await terminalExecute!({ command: 'exit 1' });

      // 命令执行了但返回错误
      expect(result).toBeDefined();
    });

    it('should execute multiple commands with piping', async () => {
      if (isWindows) {
        // 跳过 Windows
        return;
      }

      const terminalExecute = toolRegistry.get('terminal_execute');

      const result = await terminalExecute!({ command: 'echo "test" | wc -l' });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });
  });

  describe('Tool Registry', () => {
    it('should register all expected tools', () => {
      const expectedTools = ['file_read', 'file_write', 'file_list', 'terminal_execute'];

      for (const toolName of expectedTools) {
        expect(toolRegistry.has(toolName)).toBe(true);
        expect(typeof toolRegistry.get(toolName)).toBe('function');
      }
    });

    it('should have 4 tools registered', () => {
      expect(toolRegistry.size).toBe(4);
    });
  });
});
