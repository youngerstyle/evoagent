/**
 * Session 压缩器
 *
 * 压缩策略：
 * 1. 移除冗余的系统消息
 * 2. 合并连续的用户消息
 * 3. 压缩 tool_call 和 tool_result 对
 * 4. 只保留关键的事件类型
 */

import { getLogger } from '../../core/logger/index.js';

const logger = getLogger('memory:session:compressor');

export interface CompressionOptions {
  keepDays?: number;
  keepAgentRuns?: number;
  compressToolCalls?: boolean;
  removeSystemMessages?: boolean;
}

export interface CompressedSession {
  sessionId: string;
  originalEvents: number;
  compressedEvents: number;
  compressionRatio: number;
}

/**
 * Session 压缩器
 */
export class SessionCompressor {
  /**
   * 压缩 Session 事件列表
   */
  compress(events: any[], options: CompressionOptions = {}): any[] {
    const compressed: any[] = [];
    const {
      keepDays = 30,
      keepAgentRuns = 10,
      compressToolCalls = true,
      removeSystemMessages = true
    } = options;

    const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000);

    // 跟踪最近的 agent run
    let lastAgentRunIndex = -1;
    let agentRunCount = 0;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // 过滤过期的消息
      if (event.timestamp && event.timestamp < cutoffTime) {
        continue;
      }

      // 移除系统消息
      if (removeSystemMessages && event.type === 'message' && event.role === 'system') {
        continue;
      }

      // 压缩工具调用
      if (compressToolCalls && event.type === 'tool_call') {
        // 查找对应的 tool_result
        const toolResult = this.findToolResult(events, i);
        if (toolResult) {
          // 合并 tool_call 和 tool_result
          compressed.push({
            type: 'tool_execution',
            tool: event.name,
            input: event.input,
            output: toolResult.output,
            success: toolResult.success,
            timestamp: event.timestamp
          });
          // 跳过 tool_result，已经处理了
          continue;
        }
      }

      // 跳过已处理的 tool_result
      if (compressToolCalls && event.type === 'tool_result') {
        // 检查是否已经被前面的 tool_call 处理了
        if (this.isProcessedToolResult(events, i)) {
          continue;
        }
      }

      // 保留重要事件
      const importantTypes = [
        'session.created',
        'session.completed',
        'agent.run.start',
        'agent.run.completed',
        'agent.run.failed',
        'error',
        'user.input',
        'assistant.response',
        'artifact.created'
      ];

      if (event.type === 'agent.run.completed') {
        lastAgentRunIndex = compressed.length;
        agentRunCount++;
      }

      // 限制保留的 agent run 数量
      if (event.type === 'agent.run.start' && agentRunCount >= keepAgentRuns) {
        // 清除之后的旧数据
        compressed.length = lastAgentRunIndex + 1;
        continue;
      }

      // 保留重要事件
      if (importantTypes.includes(event.type) || event.type === 'message') {
        compressed.push(event);
      }
    }

    logger.debug(`Compressed session: ${events.length} -> ${compressed.length} events`);

    return compressed;
  }

  /**
   * 估算压缩比率
   */
  estimateCompressionRatio(events: any[], options: CompressionOptions = {}): number {
    const compressed = this.compress(events, options);
    return events.length / compressed.length;
  }

  /**
   * 查找 tool_result
   */
  private findToolResult(events: any[], startIndex: number): any | null {
    for (let i = startIndex + 1; i < events.length; i++) {
      const event = events[i];
      if (event.type === 'tool_result' && event.toolCallId) {
        return event;
      }
    }
    return null;
  }

  /**
   * 检查 tool_result 是否已被前面的 tool_call 处理
   */
  private isProcessedToolResult(events: any[], index: number): boolean {
    for (let i = index - 1; i >= 0; i--) {
      const event = events[i];
      if (event.type === 'tool_call' && events[index].toolCallId) {
        return true;
      }
    }
    return false;
  }
}
