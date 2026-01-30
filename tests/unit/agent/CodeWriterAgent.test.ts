/**
 * CodeWriter Agent 单元测试
 */

import { CodeWriterAgent } from '../../../src/agent/specialists/CodeWriterAgent.js';
import { TesterAgent } from '../../../src/agent/specialists/TesterAgent.js';
import { ReviewerAgent } from '../../../src/agent/specialists/ReviewerAgent.js';
import type { LLMService, LLMResponse } from '../../../src/core/llm/types.js';
import type { AgentConfig } from '../../../src/types/agent.js';

// Mock LLM Service
class MockLLMService implements LLMService {
  readonly provider = 'mock';
  readonly model = 'mock-model';
  private mockContent: string;
  private mockToolCalls: any[] = [];

  constructor(options: { content?: string; toolCalls?: any[] } = {}) {
    this.mockContent = options.content || 'Mock response content';
    this.mockToolCalls = options.toolCalls || [];
  }

  async complete(): Promise<LLMResponse> {
    return {
      content: this.mockContent,
      toolCalls: this.mockToolCalls.length > 0 ? this.mockToolCalls : undefined,
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150
      },
      model: 'mock-model',
      finishReason: 'stop',
      metadata: {}
    };
  }

  async *stream() {
    yield { type: 'content', delta: this.mockContent };
    yield {
      type: 'usage',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 }
    };
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  healthCheck(): Promise<boolean> {
    return Promise.resolve(true);
  }

  setMockContent(content: string): void {
    this.mockContent = content;
  }

  setMockToolCalls(toolCalls: any[]): void {
    this.mockToolCalls = toolCalls;
  }
}

describe('CodeWriterAgent', () => {
  let mockLLM: MockLLMService;
  let agentConfig: AgentConfig;

  beforeEach(() => {
    mockLLM = new MockLLMService();
    agentConfig = {
      agentId: 'test-agent',
      description: 'Test CodeWriter agent',
      model: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
      workspace: '/tmp/test-workspace',
      systemPrompt: 'You are a test agent.',
      tools: [],
      maxTokens: 8192,
      temperature: 0.7
    };
  });

  describe('run()', () => {
    it('should execute successfully and return result', async () => {
      const agent = new CodeWriterAgent(agentConfig, mockLLM);
      mockLLM.setMockContent('Here is the code you requested.');

      const result = await agent.run({
        agentType: 'codewriter',
        input: 'Write a hello world function',
        sessionId: 'test-session-123'
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Here is the code you requested.');
      expect(result.agentType).toBe('codewriter');
      expect(result.sessionId).toBe('test-session-123');
      expect(result.runId).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should extract artifacts from code blocks', async () => {
      const agent = new CodeWriterAgent(agentConfig, mockLLM);
      const mockResponse = `Here's your code:

\`\`\`typescript:src/utils/hello.ts
export function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

The function is ready to use.`;

      mockLLM.setMockContent(mockResponse);

      const result = await agent.run({
        agentType: 'codewriter',
        input: 'Write a hello function',
        sessionId: 'test-session-456'
      });

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts![0].type).toBe('file');
      expect(result.artifacts![0].path).toBe('src/utils/hello.ts');
      expect(result.artifacts![0].content).toContain('hello');
    });

    it('should extract multiple artifacts', async () => {
      const agent = new CodeWriterAgent(agentConfig, mockLLM);
      const mockResponse = `Here are the files:

\`\`\`typescript:src/math/add.ts
export function add(a: number, b: number): number {
  return a + b;
}
\`\`\`

\`\`\`typescript:src/math/subtract.ts
export function subtract(a: number, b: number): number {
  return a - b;
}
\`\`\`

Done!`;

      mockLLM.setMockContent(mockResponse);

      const result = await agent.run({
        agentType: 'codewriter',
        input: 'Write math functions',
        sessionId: 'test-session-789'
      });

      expect(result.artifacts).toHaveLength(2);
      expect(result.artifacts![0].path).toBe('src/math/add.ts');
      expect(result.artifacts![1].path).toBe('src/math/subtract.ts');
    });

    it('should handle tool calls in multi-turn execution', async () => {
      const toolRegistry = new Map<string, (params: any) => Promise<any>>();
      toolRegistry.set('file_read', async () => ({
        success: true,
        output: 'existing content'
      }));

      const agent = new CodeWriterAgent(agentConfig, mockLLM, toolRegistry);

      // First call has tool calls
      mockLLM.setMockToolCalls([
        {
          id: 'tool-1',
          name: 'file_read',
          input: { path: 'existing-file.ts' }
        }
      ]);
      mockLLM.setMockContent('Let me check the file first.');

      const result = await agent.run({
        agentType: 'codewriter',
        input: 'Update the existing file',
        sessionId: 'test-session-tool'
      });

      // Should complete despite tool calls
      expect(result.success).toBe(true);
    });

    it('should handle LLM errors gracefully', async () => {
      const errorLLM = new MockLLMService();
      // Override complete to throw error
      errorLLM.complete = async () => {
        throw new Error('LLM API error');
      };

      const agent = new CodeWriterAgent(agentConfig, errorLLM);

      await expect(agent.run({
        agentType: 'codewriter',
        input: 'Test error handling',
        sessionId: 'test-session-error'
      })).rejects.toThrow('LLM API error');
    });

    it('should track progress during execution', async () => {
      const agent = new CodeWriterAgent(agentConfig, mockLLM);
      mockLLM.setMockContent('Progress tracked successfully.');

      const progressUpdates: number[] = [];
      agent.addEventListener((event: any) => {
        if (event.type === 'progress') {
          progressUpdates.push(event.progress);
        }
      });

      await agent.run({
        agentType: 'codewriter',
        input: 'Track progress',
        sessionId: 'test-session-progress'
      });

      // Should have progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      // Final progress should be 100
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });
  });

  describe('getStatus()', () => {
    it('should return status after execution', async () => {
      const agent = new CodeWriterAgent(agentConfig, mockLLM);

      const result = await agent.run({
        agentType: 'codewriter',
        input: 'Get status task',
        sessionId: 'test-session-status'
      });

      // Check status after completion
      const status = agent.getStatus(result.runId);
      expect(status).toBeDefined();
      expect(status?.status).toBe('completed');
      expect(status?.progress).toBe(100);
    });
  });

  describe('buildSystemPrompt()', () => {
    it('should use custom system prompt from config', async () => {
      const customConfig = {
        ...agentConfig,
        systemPrompt: 'Custom instructions for testing.'
      };
      const agent = new CodeWriterAgent(customConfig, mockLLM);

      const result = await agent.run({
        agentType: 'codewriter',
        input: 'Test',
        sessionId: 'test-session-custom'
      });

      expect(result.success).toBe(true);
    });

    it('should use default system prompt when not provided', async () => {
      const noPromptConfig = { ...agentConfig, systemPrompt: '' };
      const agent = new CodeWriterAgent(noPromptConfig, mockLLM);

      const result = await agent.run({
        agentType: 'codewriter',
        input: 'Test',
        sessionId: 'test-session-default'
      });

      expect(result.success).toBe(true);
    });
  });
});

describe('TesterAgent', () => {
  let mockLLM: MockLLMService;
  let agentConfig: AgentConfig;

  beforeEach(() => {
    mockLLM = new MockLLMService();
    agentConfig = {
      agentId: 'test-tester',
      description: 'Test Tester agent',
      model: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
      workspace: '/tmp/test-workspace',
      systemPrompt: '',
      tools: [],
      maxTokens: 8192,
      temperature: 0.3
    };
  });

  it('should execute test generation', async () => {
    const agent = new TesterAgent(agentConfig, mockLLM);
    mockLLM.setMockContent('```typescript\n// Test code here\n```');

    const result = await agent.run({
      agentType: 'tester',
      input: 'Write tests for hello function',
      sessionId: 'test-session-tester'
    });

    expect(result.success).toBe(true);
    expect(result.agentType).toBe('tester');
  });
});

describe('ReviewerAgent', () => {
  let mockLLM: MockLLMService;
  let agentConfig: AgentConfig;

  beforeEach(() => {
    mockLLM = new MockLLMService();
    agentConfig = {
      agentId: 'test-reviewer',
      description: 'Test Reviewer agent',
      model: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
      workspace: '/tmp/test-workspace',
      systemPrompt: '',
      tools: [],
      maxTokens: 8192,
      temperature: 0.3
    };
  });

  it('should execute code review', async () => {
    const agent = new ReviewerAgent(agentConfig, mockLLM);
    mockLLM.setMockContent('Code looks good. Consider adding more error handling.');

    const result = await agent.run({
      agentType: 'reviewer',
      input: 'Review this code',
      sessionId: 'test-session-reviewer'
    });

    expect(result.success).toBe(true);
    expect(result.agentType).toBe('reviewer');
  });
});
