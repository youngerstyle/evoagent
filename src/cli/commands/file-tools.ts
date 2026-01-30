/**
 * File tool commands for CLI
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { resolve, dirname } from 'path';

/**
 * Register file tools with a tool registry (Map)
 */
export function registerFileTools(
  registry: Map<string, (params: any) => Promise<any>>,
  workspace: string
): void {
  // Register file_read handler
  registry.set('file_read', async (params: any) => {
    const { path } = params;
    try {
      const fullPath = resolve(workspace, path);
      const content = await readFile(fullPath, 'utf-8');
      return { success: true, output: content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Register file_write handler
  registry.set('file_write', async (params: any) => {
    const { path, content } = params;
    try {
      const fullPath = resolve(workspace, path);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, 'utf-8');
      return { success: true, output: `Wrote ${path}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Register file_list handler
  registry.set('file_list', async (params: any) => {
    const { path: pathParam = '.' } = params;
    try {
      const fullPath = resolve(workspace, pathParam);
      const entries = await readdir(fullPath, { withFileTypes: true });
      const files = entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file'
        }));
      return { success: true, output: files };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Register terminal_execute handler
  registry.set('terminal_execute', async (params: any) => {
    try {
      const { exec } = await import('node:child_process');
      const util = await import('node:util');
      const execAsync = util.promisify(exec);
      const { command } = params;
      const { stdout, stderr } = await execAsync(command, { cwd: workspace });
      return { success: true, output: stdout, metadata: { stderr } };
    } catch (error: any) {
      // 命令执行错误也返回结果，包含错误信息
      return {
        success: error.code === 0,
        output: error.stdout || '',
        error: error.message,
        metadata: { stderr: error.stderr }
      };
    }
  });
}
