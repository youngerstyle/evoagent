/**
 * Specialist agents (CodeWriter, Tester, Reviewer)
 */

import { BaseAgent } from '../base/Agent.js';
import type {
  AgentRunOptions,
  AgentRunResult,
  AgentContext
} from '../base/types.js';
import type { AgentConfig, Artifact } from '../../types/agent.js';
import type { LLMService, LLMRequest, Message } from '../../core/llm/types.js';
import type { ToolHandler } from './types.js';

/**
 * CodeWriter Agent - Specialized in writing and modifying code
 */
export class CodeWriterAgent extends BaseAgent {
  constructor(
    config: AgentConfig,
    llm: LLMService,
    tools?: Map<string, ToolHandler>
  ) {
    super(config, 'codewriter', llm);

    // 注册文件工具的 JSON Schema
    const fileToolSchemas: Record<string, { description: string; inputSchema: Record<string, unknown> }> = {
      file_read: {
        description: 'Read the contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read'
            }
          },
          required: ['path']
        }
      },
      file_write: {
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to write'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['path', 'content']
        }
      },
      file_list: {
        description: 'List files in a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the directory (default: current directory)'
            }
          }
        }
      },
      terminal_execute: {
        description: 'Execute a shell command',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Shell command to execute'
            }
          },
          required: ['command']
        }
      }
    };

    // 注册提供的工具
    if (tools) {
      for (const [name, handler] of tools) {
        const schema = fileToolSchemas[name];
        this.registerTool({
          name,
          description: schema?.description || `Tool: ${name}`,
          inputSchema: schema?.inputSchema || {
            type: 'object',
            properties: {},
            required: []
          },
          execute: async (params: unknown) => {
            // 验证参数是对象类型
            const validatedParams = typeof params === 'object' && params !== null
              ? params as Record<string, unknown>
              : {};
            return handler(validatedParams);
          }
        });
      }
    }
  }

  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const startTime = new Date().toISOString();
    const runId = this.initRun(options.input, options.sessionId, options.parentRunId);

    try {
      const systemPrompt = await this.buildSystemPrompt();
      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: options.input }
      ];

      const toolDefinitions = this.getToolDefinitions();
      this.updateProgress(runId, 20);

      let finalContent = '';
      const artifacts: Artifact[] = [];

      // Multi-turn loop for tool use
      const maxTurns = 10;
      for (let turn = 0; turn < maxTurns; turn++) {
        const request: LLMRequest = {
          messages,
          tools: toolDefinitions,
          maxTokens: this.config.maxTokens || 8192,
          temperature: this.config.temperature || 0.7
        };

        const response = await this.llm.complete(request);
        finalContent = response.content;

        this.updateProgress(runId, 20 + (60 * (turn + 1) / maxTurns));

        // Handle tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          for (const toolCall of response.toolCalls) {
            const context: AgentContext = {
              agentId: this.config.agentId,
              agentType: 'codewriter',
              sessionId: options.sessionId,
              runId,
              input: options.input,
              workspace: this.config.workspace,
              tools: {},
              metadata: {}
            };

            const toolResult = await this.executeToolCall(toolCall.name, toolCall.input, context);

            messages.push({
              role: 'assistant',
              content: finalContent
            });

            messages.push({
              role: 'user',
              content: JSON.stringify({
                tool_result_id: toolCall.id,
                ...toolResult
              })
            });
          }
        } else {
          // No more tool calls, we're done
          break;
        }
      }

      // Extract artifacts from final response
      const extractedArtifacts = this.extractArtifacts(finalContent);
      artifacts.push(...extractedArtifacts);

      this.updateProgress(runId, 100);

      const endTime = new Date().toISOString();
      const result: AgentRunResult = {
        runId,
        sessionId: options.sessionId,
        agentType: 'codewriter',
        startTime,
        endTime,
        duration: new Date(endTime).getTime() - new Date(startTime).getTime(),
        success: true,
        output: finalContent,
        artifacts,
        metadata: {
          turns: messages.length
        }
      };

      this.completeRun(runId, result);
      return result;
    } catch (error) {
      this.failRun(runId, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  protected async buildSystemPrompt(): Promise<string> {
    const basePrompt = this.config.systemPrompt || `You are a CodeWriter agent specializing in writing clean, maintainable code.

Your role:
- Write code based on user requirements
- Follow best practices and design patterns
- Add appropriate error handling
- Write self-documenting code with clear variable/function names
- Handle edge cases appropriately

Guidelines:
- Prioritize readability and maintainability
- Follow the project's existing code style
- Add comments for complex logic
- Consider performance implications
- Always validate inputs
- Handle errors gracefully

When writing code:
1. Understand the requirements fully
2. Plan the structure before coding
3. Write clean, modular code
4. Add necessary error handling
5. Consider testability`;
    // 让基类注入 SOUL
    return basePrompt;
  }

  private extractArtifacts(content: string): Artifact[] {
    const artifacts: Artifact[] = [];

    // Extract file write patterns like: ```typescript:path/to/file.ts ...```
    const fileWriteRegex = /```(?:\w+)?:(.+?)\n([\s\S]+?)```/g;
    const matches = content.matchAll(fileWriteRegex);

    for (const match of matches) {
      const path = match[1];
      const content = match[2];
      if (path && content) {
        artifacts.push({
          type: 'file',
          path,
          content
        });
      }
    }

    return artifacts;
  }
}
