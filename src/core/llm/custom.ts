/**
 * Custom LLM Service
 *
 * 支持自定义 LLM 端点，兼容 OpenAI API 格式
 * 可用于 Ollama、LM Studio、local-ai 等
 */

import type {
  LLMService,
  LLMRequest,
  LLMResponse,
  StreamChunk,
  TokenUsage
} from './types.js';

interface CustomLLMConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface StreamChunkData {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

/**
 * 自定义 LLM 服务
 */
export class CustomLLMService implements LLMService {
  readonly provider = 'custom' as const;
  readonly model: string;
  private readonly config: CustomLLMConfig;
  private readonly chatEndpoint: string;

  constructor(config: CustomLLMConfig) {
    this.config = config;
    this.model = config.model;
    this.chatEndpoint = `${config.baseUrl}/chat/completions`;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.makeRequest({
      model: this.config.model,
      messages: request.messages as ChatMessage[],
      temperature: request.temperature,
      max_tokens: request.maxTokens
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No choices returned from LLM');
    }

    const usage: TokenUsage | undefined = response.usage ? {
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens
    } : undefined;

    return {
      content: choice.message.content,
      usage: usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: response.model || this.model,
      finishReason: this.mapFinishReason(choice.finish_reason)
    };
  }

  async *stream(request: LLMRequest): AsyncIterable<StreamChunk> {
    const response = await fetch(this.chatEndpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.config.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM request failed: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;

        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const chunk: StreamChunkData = JSON.parse(data);
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            yield {
              type: 'content',
              delta: delta.content
            };
          }
        } catch {
          // Skip invalid JSON
        }
      }
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
      const response = await fetch(this.chatEndpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private async makeRequest(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(this.chatEndpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM request failed: ${response.status} ${error}`);
    }

    return response.json() as Promise<ChatResponse>;
  }

  private mapFinishReason(reason: string): LLMResponse['finishReason'] {
    const reasonMap: Record<string, LLMResponse['finishReason']> = {
      'stop': 'stop',
      'length': 'length',
      'tool_calls': 'tool_use',
      'error': 'error'
    };
    return reasonMap[reason] || 'stop';
  }
}
