/**
 * LLM服务核心类型定义
 */

export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  output: unknown;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LLMRequest {
  messages: Message[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
  finishReason: 'stop' | 'length' | 'tool_use' | 'error';
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'usage';
  delta?: string;
  toolCall?: Partial<ToolCall>;
  usage?: TokenUsage;
}

export interface LLMStreamOptions extends LLMRequest {
  onChunk?: (chunk: StreamChunk) => void;
}

/**
 * LLM服务接口
 * 所有LLM提供商都必须实现此接口
 */
export interface LLMService {
  /**
   * 获取提供商名称
   */
  readonly provider: string;

  /**
   * 获取当前模型名称
   */
  readonly model: string;

  /**
   * 完成模式：一次性获取完整响应
   */
  complete(request: LLMRequest): Promise<LLMResponse>;

  /**
   * 流式模式：逐步获取响应
   */
  stream(request: LLMRequest): AsyncIterable<StreamChunk>;

  /**
   * 估算token数量（粗略计算）
   */
  countTokens(text: string): number;

  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>;
}

/**
 * LLM配置
 */
export interface LLMServiceConfig {
  provider: 'anthropic' | 'openai' | 'custom';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * LLM错误类型
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(message: string) {
    super(message, 'TIMEOUT', true);
    this.name = 'LLMTimeoutError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(message: string, public readonly retryAfter?: number) {
    super(message, 'RATE_LIMIT', true);
    this.name = 'LLMRateLimitError';
  }
}

export class LLMInvalidRequestError extends LLMError {
  constructor(message: string) {
    super(message, 'INVALID_REQUEST', false);
    this.name = 'LLMInvalidRequestError';
  }
}
