/**
 * Specialist agents 共享类型
 */

/**
 * 工具执行结果类型
 */
export interface ToolResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

/**
 * 工具处理器类型
 */
export type ToolHandler = (params: Record<string, unknown>) => Promise<ToolResult>;
