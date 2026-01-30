/**
 * OpenAI兼容的LLM服务
 * 支持 OpenAI、DeepSeek 等兼容 OpenAI API 的服务
 */

import type { LLMService, LLMRequest, LLMResponse, StreamChunk, ToolDefinition } from './types.js';
import { getLogger } from '../logger/index.js';

const logger = getLogger('llm:openai');

interface OpenAILLMServiceConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeout?: number;
  maxRetries?: number;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
  [key: string]: unknown;
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content?: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

/**
 * OpenAI兼容的LLM服务
 * 支持 OpenAI、DeepSeek、Moonshot 等
 */
export class OpenAILLMService implements LLMService {
  readonly provider = 'openai';
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(config: OpenAILLMServiceConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-3.5-turbo';
    this.timeout = config.timeout || 60000;
    this.maxRetries = config.maxRetries || 3;

    logger.info(`OpenAI service initialized: ${this.model} @ ${this.baseUrl}`);
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const openaiRequest = this.convertRequest(request);

    logger.debug(`Sending request to ${this.baseUrl}/chat/completions`);

    const response = await this.makeRequest<OpenAIResponse>(
      '/chat/completions',
      openaiRequest
    );

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No choice in response');
    }

    const content = choice.message.content || '';

    // 转换 tool_calls
    const toolCalls = choice.message.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments)
    }));

    return {
      content,
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      },
      model: response.model,
      finishReason: this.mapFinishReason(choice.finish_reason),
      metadata: {
        responseId: response.id,
        created: response.created
      }
    };
  }

  async *stream(request: LLMRequest): AsyncIterable<StreamChunk> {
    const openaiRequest = this.convertRequest(request);
    openaiRequest.stream = true;

    const response = await this.fetchStream('/chat/completions', openaiRequest);
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6)) as OpenAIStreamChunk;
              const choice = data.choices[0];
              if (!choice) continue;

              if (choice.delta.content) {
                yield {
                  type: 'content',
                  delta: choice.delta.content
                };
              }

              if (choice.finish_reason) {
                yield {
                  type: 'usage',
                  usage: {
                    inputTokens: 0,
                    outputTokens: 0,
                    totalTokens: 0
                  }
                };
              }
            } catch (e) {
              logger.warn(`Failed to parse SSE data: ${e}`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  countTokens(text: string): number {
    // 粗略估算：英文约4字符/token，中文约1.5字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest<{ object: string }>(
        '/models',
        {},
        'GET'
      );
      return response.object === 'list';
    } catch {
      return false;
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    data: Record<string, unknown>,
    method: 'POST' | 'GET' = 'POST'
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout)
    };

    if (method === 'POST') {
      options.body = JSON.stringify(data);
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP ${response.status}: ${errorText}`
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          logger.debug(`Retry ${attempt + 1}/${this.maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  private async fetchStream(endpoint: string, data: Record<string, unknown>): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response;
  }

  private convertRequest(request: LLMRequest): OpenAIRequest {
    const messages: OpenAIMessage[] = request.messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content
    }));

    const openaiRequest: OpenAIRequest = {
      model: this.model,
      messages,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature
    };

    if (request.tools && request.tools.length > 0) {
      openaiRequest.tools = this.convertTools(request.tools);
    }

    if (request.topP) {
      openaiRequest.top_p = request.topP;
    }

    if (request.stopSequences) {
      openaiRequest.stop = request.stopSequences;
    }

    return openaiRequest;
  }

  private convertTools(tools: ToolDefinition[]): OpenAITool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
  }

  private mapFinishReason(reason: string): LLMResponse['finishReason'] {
    const mapping: Record<string, LLMResponse['finishReason']> = {
      'stop': 'stop',
      'length': 'length',
      'tool_calls': 'tool_use',
      'content_filter': 'error'
    };
    return mapping[reason] || 'stop';
  }
}
