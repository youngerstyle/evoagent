/**
 * Orchestrator Agent Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OrchestratorAgent, type AgentExecutor } from '../../../src/agent/orchestrator/OrchestratorAgent.js';
import type { ExecutionPlan } from '../../../src/agent/planner/PlanGenerator.js';
import type { AgentRunResult } from '../../../src/agent/base/types.js';
import { MockLLMService } from '../../../src/core/llm/mock.js';

describe('OrchestratorAgent', () => {
  let orchestrator: OrchestratorAgent;
  let mockLLM: MockLLMService;

  beforeEach(() => {
    mockLLM = new MockLLMService();
    orchestrator = new OrchestratorAgent({}, mockLLM);
  });

  describe('constructor', () => {
    it('should create orchestrator with default config', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator.type).toBe('orchestrator');
    });

    it('should use custom config values', () => {
      const customOrchestrator = new OrchestratorAgent(
        { maxRetries: 5, retryDelay: 2000, timeout: 600000 },
        mockLLM
      );
      expect(customOrchestrator).toBeDefined();
    });
  });

  describe('executePlan', () => {
    it('should execute simple plan successfully', async () => {
      const plan: ExecutionPlan = {
        planId: 'test-plan-1',
        taskId: 'task-1',
        analysis: {
          userRequirement: 'Test requirement',
          complexity: 'simple',
          estimatedDuration: '30分钟',
          requiredCapabilities: ['general'],
          suggestedMode: {
            type: 'A',
            description: '单一 Agent',
            reasoning: 'Test'
          }
        },
        steps: [
          {
            id: 'step-1',
            agent: 'codewriter',
            description: 'Write test code',
            dependencies: []
          }
        ],
        totalEstimatedDuration: '30分钟',
        risks: []
      };

      const result = await orchestrator.executePlan(plan, 'test-session');

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(1);
      expect(result.totalSteps).toBe(1);
      expect(result.stepResults).toHaveLength(1);
      expect(result.stepResults[0].status).toBe('completed');
    });

    it('should handle plan with multiple steps', async () => {
      const plan: ExecutionPlan = {
        planId: 'test-plan-2',
        taskId: 'task-2',
        analysis: {
          userRequirement: 'Multi-step test',
          complexity: 'medium',
          estimatedDuration: '1小时',
          requiredCapabilities: ['frontend', 'backend'],
          suggestedMode: {
            type: 'B',
            description: '主从模式',
            reasoning: 'Test'
          }
        },
        steps: [
          {
            id: 'step-1',
            agent: 'codewriter',
            description: 'Write feature code',
            dependencies: []
          },
          {
            id: 'step-2',
            agent: 'tester',
            description: 'Write tests',
            dependencies: ['step-1']
          },
          {
            id: 'step-3',
            agent: 'reviewer',
            description: 'Review code',
            dependencies: ['step-2']
          }
        ],
        totalEstimatedDuration: '1小时',
        risks: []
      };

      const result = await orchestrator.executePlan(plan, 'test-session');

      expect(result.completedSteps).toBe(3);
      expect(result.totalSteps).toBe(3);
      expect(result.stepResults).toHaveLength(3);
    });

    it('should skip steps with unmet dependencies', async () => {
      const plan: ExecutionPlan = {
        planId: 'test-plan-3',
        taskId: 'task-3',
        analysis: {
          userRequirement: 'Test with missing dependency',
          complexity: 'complex',
          estimatedDuration: '2小时',
          requiredCapabilities: ['frontend'],
          suggestedMode: {
            type: 'C',
            description: '并行模式',
            reasoning: 'Test'
          }
        },
        steps: [
          {
            id: 'step-1',
            agent: 'codewriter',
            description: 'First step',
            dependencies: []
          },
          {
            id: 'step-2',
            agent: 'tester',
            description: 'Step with missing dependency',
            dependencies: ['non-existent-step']
          }
        ],
        totalEstimatedDuration: '2小时',
        risks: []
      };

      const result = await orchestrator.executePlan(plan, 'test-session');

      expect(result.stepResults[0].status).toBe('completed');
      expect(result.stepResults[1].status).toBe('skipped');
    });
  });

  describe('with AgentExecutor', () => {
    it('should use AgentExecutor when configured', async () => {
      const mockExecutor: AgentExecutor = {
        execute: async (_agentType: string, input: string, _sessionId: string) => {
          return {
            runId: 'test-run-1',
            sessionId: 'test-session',
            agentType: 'codewriter',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            duration: 100,
            success: true,
            output: `Executed: ${input}`,
            metadata: {}
          };
        }
      };

      orchestrator.setAgentExecutor(mockExecutor);

      const plan: ExecutionPlan = {
        planId: 'test-plan-4',
        taskId: 'task-4',
        analysis: {
          userRequirement: 'Test with executor',
          complexity: 'simple',
          estimatedDuration: '30分钟',
          requiredCapabilities: ['general'],
          suggestedMode: {
            type: 'A',
            description: '单一 Agent',
            reasoning: 'Test'
          }
        },
        steps: [
          {
            id: 'step-1',
            agent: 'codewriter',
            description: 'Write code',
            dependencies: []
          }
        ],
        totalEstimatedDuration: '30分钟',
        risks: []
      };

      const result = await orchestrator.executePlan(plan, 'test-session');

      expect(result.success).toBe(true);
      expect(result.stepResults[0].result?.output).toContain('Executed: Write code');
    });

    it('should handle executor failures', async () => {
      const mockExecutor: AgentExecutor = {
        execute: async () => {
          throw new Error('Agent execution failed');
        }
      };

      orchestrator.setAgentExecutor(mockExecutor);

      const plan: ExecutionPlan = {
        planId: 'test-plan-5',
        taskId: 'task-5',
        analysis: {
          userRequirement: 'Test with failing executor',
          complexity: 'simple',
          estimatedDuration: '30分钟',
          requiredCapabilities: ['general'],
          suggestedMode: {
            type: 'A',
            description: '单一 Agent',
            reasoning: 'Test'
          }
        },
        steps: [
          {
            id: 'step-1',
            agent: 'codewriter',
            description: 'Write code',
            dependencies: []
          }
        ],
        totalEstimatedDuration: '30分钟',
        risks: []
      };

      const result = await orchestrator.executePlan(plan, 'test-session');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.stepResults[0].status).toBe('failed');
    });
  });

  describe('handleFailure', () => {
    it('should retry on timeout errors', async () => {
      const decision = await orchestrator.handleFailure(
        { id: 'step-1', agent: 'test', description: 'Test', dependencies: [] },
        new Error('Request timed out')
      );

      expect(decision.shouldRetry).toBe(true);
      expect(decision.delay).toBe(2000); // 2x default retry delay
    });

    it('should retry on network errors', async () => {
      const decision = await orchestrator.handleFailure(
        { id: 'step-1', agent: 'test', description: 'Test', dependencies: [] },
        new Error('Network connection failed')
      );

      expect(decision.shouldRetry).toBe(true);
      expect(decision.delay).toBe(1000);
    });

    it('should not retry on authentication errors', async () => {
      const decision = await orchestrator.handleFailure(
        { id: 'step-1', agent: 'test', description: 'Test', dependencies: [] },
        new Error('Unauthorized access')
      );

      expect(decision.shouldRetry).toBe(false);
    });

    it('should not retry on syntax errors', async () => {
      const decision = await orchestrator.handleFailure(
        { id: 'step-1', agent: 'test', description: 'Test', dependencies: [] },
        new Error('Syntax error in code')
      );

      expect(decision.shouldRetry).toBe(false);
    });
  });

  describe('isCriticalStep', () => {
    it('should identify first step as critical', () => {
      const step = { id: 'step-1', agent: 'test', description: 'Test', dependencies: [] };
      expect(orchestrator['isCriticalStep'](step)).toBe(true);
    });

    it('should identify init steps as critical', () => {
      const step = { id: 'init', agent: 'test', description: 'Initialize project', dependencies: [] };
      expect(orchestrator['isCriticalStep'](step)).toBe(true);
    });

    it('should identify setup steps as critical', () => {
      const step = { id: 'setup', agent: 'test', description: 'Setup environment', dependencies: [] };
      expect(orchestrator['isCriticalStep'](step)).toBe(true);
    });

    it('should not identify regular steps as critical', () => {
      const step = { id: 'step-2', agent: 'test', description: 'Write feature', dependencies: [] };
      expect(orchestrator['isCriticalStep'](step)).toBe(false);
    });
  });

  describe('aggregateResults', () => {
    it('should aggregate step results correctly', () => {
      const stepResults = [
        {
          step: { id: 'step-1', agent: 'codewriter', description: 'Write code', dependencies: [] },
          status: 'completed' as const,
          result: {
            runId: 'run-1',
            sessionId: 'session-1',
            agentType: 'codewriter',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            duration: 1000,
            success: true,
            output: 'Code written successfully',
            metadata: {}
          },
          startTime: Date.now() - 1000,
          endTime: Date.now()
        },
        {
          step: { id: 'step-2', agent: 'tester', description: 'Test code', dependencies: ['step-1'] },
          status: 'failed' as const,
          error: 'Test failed',
          startTime: Date.now() - 500,
          endTime: Date.now()
        }
      ];

      const aggregated = orchestrator.aggregateResults(stepResults);

      expect(aggregated).toContain('执行结果汇总');
      expect(aggregated).toContain('✅');
      expect(aggregated).toContain('❌');
      expect(aggregated).toContain('完成: 1');
      expect(aggregated).toContain('失败: 1');
    });
  });

  describe('summarizeExecution', () => {
    it('should generate execution summary', () => {
      const result = {
        planId: 'test-plan',
        taskId: 'task-1',
        success: true,
        completedSteps: 2,
        totalSteps: 2,
        stepResults: [],
        aggregatedOutput: 'Test output',
        artifacts: [
          { type: 'file' as const, path: '/src/test.ts', content: 'test code' }
        ],
        errors: [],
        duration: 5000
      };

      const summary = orchestrator.summarizeExecution(result);

      expect(summary).toContain('test-plan');
      expect(summary).toContain('✅ 成功');
      expect(summary).toContain('2/2');
      expect(summary).toContain('/src/test.ts');
    });
  });

  describe('parsePlanInput', () => {
    it('should parse JSON plan input', () => {
      const plan: ExecutionPlan = {
        planId: 'test-plan',
        taskId: 'task-1',
        analysis: {
          userRequirement: 'Test',
          complexity: 'simple',
          estimatedDuration: '30分钟',
          requiredCapabilities: ['general'],
          suggestedMode: {
            type: 'A',
            description: 'Test',
            reasoning: 'Test'
          }
        },
        steps: [],
        totalEstimatedDuration: '30分钟',
        risks: []
      };

      const input = JSON.stringify({ plan });
      const parsed = orchestrator['parsePlanInput'](input);

      expect(parsed.planId).toBe('test-plan');
    });

    it('should create simple plan from plain text input', () => {
      const input = 'Write a simple function';
      const parsed = orchestrator['parsePlanInput'](input);

      expect(parsed.analysis.userRequirement).toBe('Write a simple function');
      expect(parsed.steps).toHaveLength(1);
      expect(parsed.steps[0].agent).toBe('codewriter');
    });
  });
});
