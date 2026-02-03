/**
 * 技能执行引擎
 *
 * 负责技能的实际执行，包括：
 * - 模板参数绑定
 * - 沙箱执行环境
 * - 资源限制和超时
 * - 错误处理
 */

import type { Skill, SkillTemplate } from './SkillTypes.js';
import type { AgentContext, ToolResult } from '../../agent/base/types.js';
import { getLogger } from '../../core/logger/index.js';
import { WorkerSandbox } from './sandbox/WorkerSandbox.js';

const logger = getLogger('skill-executor');

/**
 * 技能执行选项
 */
export interface SkillExecutionOptions {
  timeout?: number;
  maxMemory?: number;
  allowedModules?: string[];
  context?: Record<string, unknown>;
}

/**
 * 模板参数
 */
export interface TemplateParameters {
  [key: string]: string | number | boolean | object;
}

/**
 * 技能执行器
 */
export class SkillExecutor {
  private readonly defaultTimeout = 30000; // 30秒
  private readonly defaultMaxMemory = 128 * 1024 * 1024; // 128MB
  private readonly sandbox: WorkerSandbox;

  constructor() {
    this.sandbox = new WorkerSandbox();
  }

  /**
   * 执行技能
   */
  async execute(
    skill: Skill,
    parameters: TemplateParameters,
    context: AgentContext,
    options: SkillExecutionOptions = {}
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      logger.info(`Executing skill: ${skill.metadata.name}`, {
        skillName: skill.metadata.name,
        parameters
      });

      // 1. 验证技能状态
      if (skill.metadata.validation.status === 'deprecated') {
        return {
          success: false,
          output: null,
          error: 'Skill is deprecated and cannot be executed'
        };
      }

      // 2. 选择合适的模板
      const template = this.selectTemplate(skill, parameters);
      if (!template) {
        return {
          success: false,
          output: null,
          error: 'No suitable template found for given parameters'
        };
      }

      // 3. 绑定模板参数
      const boundContent = this.bindParameters(template.content, parameters);

      // 4. 在沙箱中执行
      const result = await this.executeInSandbox(
        boundContent,
        context,
        {
          timeout: options.timeout || this.defaultTimeout,
          maxMemory: options.maxMemory || this.defaultMaxMemory,
          allowedModules: options.allowedModules || []
        }
      );

      const duration = Date.now() - startTime;

      logger.info(`Skill execution completed: ${skill.metadata.name}`, {
        skillName: skill.metadata.name,
        success: result.success,
        duration
      });

      return {
        success: result.success,
        output: result.output,
        error: result.error
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(`Skill execution failed: ${skill.metadata.name}`, error, {
        skillName: skill.metadata.name,
        duration
      });

      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 选择合适的模板
   */
  private selectTemplate(
    skill: Skill,
    parameters: TemplateParameters
  ): SkillTemplate | undefined {
    if (skill.templates.size === 0) {
      return undefined;
    }

    // 如果只有一个模板，直接返回
    if (skill.templates.size === 1) {
      return Array.from(skill.templates.values())[0];
    }

    // 根据参数匹配最合适的模板
    const templates = Array.from(skill.templates.values());
    const paramKeys = Object.keys(parameters);

    for (const template of templates) {
      const templateParams = this.extractTemplateParameters(template.content);

      // 检查所有必需参数是否都提供了
      const allParamsProvided = templateParams.every(p => paramKeys.includes(p));

      if (allParamsProvided) {
        return template;
      }
    }

    // 如果没有完全匹配的，返回第一个
    return templates[0];
  }

  /**
   * 提取模板中的参数
   */
  private extractTemplateParameters(content: string): string[] {
    const paramRegex = /\{\{(\w+)\}\}/g;
    const params: string[] = [];
    let match;

    while ((match = paramRegex.exec(content)) !== null) {
      const paramName = match[1];
      if (paramName && !params.includes(paramName)) {
        params.push(paramName);
      }
    }

    return params;
  }

  /**
   * 绑定模板参数
   */
  private bindParameters(
    template: string,
    parameters: TemplateParameters
  ): string {
    let result = template;

    // 替换所有 {{ParameterName}} 占位符
    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      // 使用安全的参数转义
      const stringValue = this.sandbox.escapeParameter(value);
      result = result.replace(placeholder, stringValue);
    }

    // 检查是否还有未绑定的参数
    const unboundParams = this.extractTemplateParameters(result);
    if (unboundParams.length > 0) {
      logger.warn('Template has unbound parameters', {
        unboundParams
      });
    }

    return result;
  }

  /**
   * 在沙箱中执行代码
   */
  private async executeInSandbox(
    code: string,
    context: AgentContext,
    options: Required<Pick<SkillExecutionOptions, 'timeout' | 'maxMemory' | 'allowedModules'>>
  ): Promise<ToolResult> {
    // 执行安全检查
    const security = this.sandbox.validateSecurity(code);
    if (!security.safe) {
      return {
        success: false,
        output: null,
        error: `Security check failed: ${security.issues.join(', ')}`
      };
    }

    // 准备安全的上下文
    const safeContext = {
      workspace: context.workspace,
      sessionId: context.sessionId,
      agentId: context.agentId
    };

    // 在沙箱中执行
    const result = await this.sandbox.execute(code, safeContext, {
      timeout: options.timeout,
      maxMemory: options.maxMemory,
      allowedModules: options.allowedModules
    });

    return {
      success: result.success,
      output: result.output,
      error: result.error
    };
  }

  /**
   * 验证技能代码安全性
   */
  validateSecurity(content: string): { safe: boolean; issues: string[] } {
    return this.sandbox.validateSecurity(content);
  }

  /**
   * 预热技能（编译检查）
   */
  async warmup(skill: Skill): Promise<{ success: boolean; error?: string }> {
    try {
      // 检查所有模板的安全性
      for (const template of skill.templates.values()) {
        const security = this.validateSecurity(template.content);
        if (!security.safe) {
          return {
            success: false,
            error: `Security issues found: ${security.issues.join(', ')}`
          };
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * 全局技能执行器实例
 */
export const globalSkillExecutor = new SkillExecutor();
