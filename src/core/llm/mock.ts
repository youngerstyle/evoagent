import type {
  LLMService,
  LLMRequest,
  LLMResponse,
  StreamChunk,
  TokenUsage
} from './types.js';

/**
 * Mock LLM服务，用于开发和测试
 */
export class MockLLMService implements LLMService {
  readonly provider = 'mock';
  readonly model = 'mock-model';

  private latency: number;
  private errorRate: number;
  private streamChunks: number;

  constructor(options: {
    latency?: number;
    errorRate?: number;
    streamChunks?: number;
  } = {}) {
    this.latency = options.latency || 100;
    this.errorRate = options.errorRate || 0;
    this.streamChunks = options.streamChunks || 5;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    await this.simulateLatency();
    this.maybeThrowError();

    const lastMessage = request.messages[request.messages.length - 1];
    const inputContent = lastMessage?.content || '';

    return {
      content: this.generateMockResponse(inputContent, request),
      usage: this.calculateUsage(request.messages),
      model: this.model,
      finishReason: 'stop'
    };
  }

  async *stream(request: LLMRequest): AsyncIterable<StreamChunk> {
    await this.simulateLatency();
    this.maybeThrowError();

    const lastMessage = request.messages[request.messages.length - 1];
    const inputContent = lastMessage?.content || '';
    const fullResponse = this.generateMockResponse(inputContent, request);

    // 分块发送
    const words = fullResponse.split(' ');
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      yield {
        type: 'content',
        delta: word + (i < words.length - 1 ? ' ' : '')
      };

      if (i % this.streamChunks === 0) {
        await this.sleep(20);
      }
    }

    yield {
      type: 'usage',
      usage: this.calculateUsage(request.messages)
    };
  }

  countTokens(text: string): number {
    // 粗略估算
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  private generateMockResponse(input: string, request: LLMRequest): string {
    const inputPreview = input.substring(0, 50);

    // 检查是否有工具调用
    const hasTools = request.tools && request.tools.length > 0;

    if (input.toLowerCase().includes('error') || input.toLowerCase().includes('fail')) {
      return `[Mock] I understand you want to handle an error scenario. Let me help you with that.

Based on your input: "${inputPreview}..."

Here's what I would do:
1. Analyze the error message
2. Check the stack trace
3. Look for similar issues in knowledge base
4. Propose a solution`;
    }

    if (hasTools && (input.toLowerCase().includes('read') || input.toLowerCase().includes('file'))) {
      return `[Mock] I'll help you read the file. I need to use the file_read tool for this.

Based on your input: "${inputPreview}..."

Let me call the appropriate tool to read the file content.`;
    }

    return `[Mock] I received your request: "${inputPreview}..."

This is a simulated response from the MockLLMService. In production, this would be replaced by actual LLM responses.

The mock service provides:
- Deterministic responses for testing
- Configurable latency simulation
- Error injection capability
- Token counting estimation

Current configuration:
- Latency: ${this.latency}ms
- Error rate: ${(this.errorRate * 100).toFixed(1)}%
- Stream chunks: ${this.streamChunks}`;
  }

  private calculateUsage(messages: any[]): TokenUsage {
    const inputText = JSON.stringify(messages);
    const inputTokens = this.countTokens(inputText);
    const outputTokens = 150; // 固定输出token数估算

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens
    };
  }

  private simulateLatency(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.latency));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private maybeThrowError(): void {
    if (Math.random() < this.errorRate) {
      throw new Error('Mock LLM simulated error');
    }
  }
}
