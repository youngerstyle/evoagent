import { MockLLMService } from '../../src/core/llm/index.js';

describe('MockLLMService', () => {
  let llm: MockLLMService;

  beforeEach(() => {
    llm = new MockLLMService({ latency: 10 });
  });

  it('should create mock response', async () => {
    const response = await llm.complete({
      messages: [{ role: 'user', content: 'Hello' }]
    });

    expect(response.content).toContain('Hello');
    expect(response.usage).toHaveProperty('inputTokens');
    expect(response.usage).toHaveProperty('outputTokens');
  });

  it('should stream responses', async () => {
    const chunks: string[] = [];

    for await (const chunk of llm.stream({
      messages: [{ role: 'user', content: 'Test' }]
    })) {
      if (chunk.type === 'content' && chunk.delta) {
        chunks.push(chunk.delta);
      }
    }

    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should count tokens', () => {
    const count = llm.countTokens('This is a test message');
    expect(count).toBeGreaterThan(0);
  });

  it('should pass health check', async () => {
    const healthy = await llm.healthCheck();
    expect(healthy).toBe(true);
  });

  it('should simulate errors when configured', async () => {
    const errorLlm = new MockLLMService({ errorRate: 1 });

    await expect(
      errorLlm.complete({
        messages: [{ role: 'user', content: 'Test' }]
      })
    ).rejects.toThrow();
  });
});
