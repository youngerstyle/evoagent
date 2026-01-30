import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMService,
  LLMRequest,
  LLMResponse,
  StreamChunk,
  Message,
  ToolDefinition
} from './types.js';
import {
  LLMError,
  LLMTimeoutError,
  LLMRateLimitError,
  LLMInvalidRequestError
} from './types.js';

/**
 * Anthropic Claude LLM服务实现
 */
export class AnthropicLLMService implements LLMService {
  readonly provider = 'anthropic';
  readonly model: string;

  private client: Anthropic;
  private timeout: number;
  private maxRetries: number;

  constructor(options: {
    apiKey: string;
    model?: string;
    baseUrl?: string;
    timeout?: number;
    maxRetries?: number;
  }) {
    this.model = options.model || 'claude-3-5-sonnet-20241022';
    this.timeout = options.timeout || 60000;
    this.maxRetries = options.maxRetries || 3;

    this.client = new Anthropic({
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
      timeout: this.timeout,
      maxRetries: this.maxRetries
    });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      const messages = this.convertMessages(request.messages);
      const tools = request.tools ? this.convertTools(request.tools) : undefined;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens || 8192,
        temperature: request.temperature,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        stop_sequences: request.stopSequences
      });

      return {
        content: this.extractTextContent(response),
        toolCalls: this.extractToolCalls(response),
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        },
        model: response.model,
        finishReason: this.mapStopReason(response.stop_reason)
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(request: LLMRequest): AsyncIterable<StreamChunk> {
    try {
      const messages = this.convertMessages(request.messages);
      const tools = request.tools ? this.convertTools(request.tools) : undefined;

      const stream = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens || 8192,
        temperature: request.temperature,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        stop_sequences: request.stopSequences,
        stream: true
      });

      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'content_block_start':
            if (chunk.content_block.type === 'tool_use') {
              yield {
                type: 'tool_call',
                toolCall: {
                  id: chunk.content_block.id,
                  name: chunk.content_block.name,
                  input: chunk.content_block.input as Record<string, unknown>
                }
              };
            }
            break;

          case 'content_block_delta':
            if (chunk.delta.type === 'text_delta') {
              yield {
                type: 'content',
                delta: chunk.delta.text
              };
            } else if (chunk.delta.type === 'input_json_delta') {
              // 工具输入的增量更新
            }
            break;

          case 'message_stop':
            // 消息完成
            break;

          case 'message_start':
            // 消息开始，可能包含usage信息
            if (chunk.message.usage) {
              yield {
                type: 'usage',
                usage: {
                  inputTokens: chunk.message.usage.input_tokens,
                  outputTokens: chunk.message.usage.output_tokens,
                  totalTokens: 0
                }
              };
            }
            break;
        }
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  countTokens(text: string): number {
    // Anthropic使用claude_tokenize，这里简化处理
    // 粗略估算：英文约4字符/token，中文约1.5字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }]
      });
      return true;
    } catch {
      return false;
    }
  }

  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));
  }

  /**
   * 验证工具 Schema 格式
   */
  private validateToolSchema(schema: Record<string, unknown>): Anthropic.Tool['input_schema'] {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Tool schema must be an object');
    }

    // 基本格式验证
    if (schema.type !== 'object') {
      throw new Error('Tool schema must have type "object"');
    }

    return schema as Anthropic.Tool['input_schema'];
  }

  private convertTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: this.validateToolSchema(t.inputSchema)
    }));
  }

  private extractTextContent(response: Anthropic.Message): string {
    return response.content
      .filter(block => block.type === 'text')
      .map(block => (block as Anthropic.TextBlock).text)
      .join('\n');
  }

  private extractToolCalls(response: Anthropic.Message) {
    return response.content
      .filter(block => block.type === 'tool_use')
      .map(block => {
        const toolBlock = block as Anthropic.ToolUseBlock;
        return {
          id: toolBlock.id,
          name: toolBlock.name,
          input: toolBlock.input as Record<string, unknown>
        };
      });
  }

  private mapStopReason(reason: Anthropic.Message['stop_reason']): LLMResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_use';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'stop';
    }
  }

  private handleError(error: unknown): LLMError {
    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return new LLMRateLimitError(
          error.message,
          parseInt(error.headers?.['retry-after'] || '60')
        );
      }
      if (error.status === 400) {
        return new LLMInvalidRequestError(error.message);
      }
      if (error.cause && typeof error.cause === 'object' && 'name' in error.cause && error.cause.name === 'AbortError') {
        return new LLMTimeoutError('Request timeout');
      }
    }

    if (error instanceof Error) {
      return new LLMError(error.message, 'UNKNOWN', true);
    }

    return new LLMError('Unknown error', 'UNKNOWN', false);
  }
}
