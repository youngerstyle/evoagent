/**
 * 技能依赖解析器
 *
 * 负责验证技能依赖关系，检测循环依赖
 */

import { getLogger } from '../../core/logger/index.js';
import type { Skill } from './SkillTypes.js';
import { SkillStore } from './SkillStore.js';

const logger = getLogger('evolution:skills:dependency-resolver');

/**
 * 依赖解析结果
 */
export interface DependencyResolutionResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  dependencyGraph: Map<string, string[]>;
  executionOrder?: string[];
}

/**
 * 技能依赖解析器
 */
export class SkillDependencyResolver {
  constructor(private readonly store: SkillStore) {}

  /**
   * 验证技能的依赖关系
   */
  async validateDependencies(skillId: string): Promise<DependencyResolutionResult> {
    const result: DependencyResolutionResult = {
      valid: true,
      errors: [],
      warnings: [],
      dependencyGraph: new Map()
    };

    const skill = await this.store.loadSkill(skillId);
    if (!skill) {
      result.valid = false;
      result.errors.push(`Skill not found: ${skillId}`);
      return result;
    }

    // 1. 检查依赖是否存在
    await this.checkDependenciesExist(skill, result);

    // 2. 构建依赖图
    await this.buildDependencyGraph(skill, result);

    // 3. 检测循环依赖
    this.detectCircularDependencies(skillId, result);

    // 4. 计算执行顺序
    if (result.valid) {
      result.executionOrder = this.calculateExecutionOrder(skillId, result.dependencyGraph);
    }

    return result;
  }

  /**
   * 批量验证技能依赖
   */
  async validateAllDependencies(): Promise<Map<string, DependencyResolutionResult>> {
    const allSkills = await this.store.getAllSkills();
    const results = new Map<string, DependencyResolutionResult>();

    for (const skill of allSkills) {
      const result = await this.validateDependencies(skill.metadata.name);
      results.set(skill.metadata.name, result);
    }

    return results;
  }

  /**
   * 检查依赖是否存在
   */
  private async checkDependenciesExist(
    skill: Skill,
    result: DependencyResolutionResult
  ): Promise<void> {
    const deps = skill.metadata.dependencies || [];

    for (const depId of deps) {
      const depSkill = await this.store.loadSkill(depId);
      if (!depSkill) {
        result.valid = false;
        result.errors.push(`Dependency not found: ${depId}`);
      } else if (depSkill.metadata.validation.status === 'deprecated') {
        result.warnings.push(`Dependency is deprecated: ${depId}`);
      }
    }
  }

  /**
   * 构建依赖图
   */
  private async buildDependencyGraph(
    skill: Skill,
    result: DependencyResolutionResult
  ): Promise<void> {
    const visited = new Set<string>();
    await this.buildGraphRecursive(skill.metadata.name, result.dependencyGraph, visited);
  }

  /**
   * 递归构建依赖图
   */
  private async buildGraphRecursive(
    skillId: string,
    graph: Map<string, string[]>,
    visited: Set<string>
  ): Promise<void> {
    if (visited.has(skillId)) {
      return;
    }

    visited.add(skillId);

    const skill = await this.store.loadSkill(skillId);
    if (!skill) {
      return;
    }

    const deps = skill.metadata.dependencies || [];
    graph.set(skillId, deps);

    for (const depId of deps) {
      await this.buildGraphRecursive(depId, graph, visited);
    }
  }

  /**
   * 检测循环依赖
   */
  private detectCircularDependencies(
    startSkillId: string,
    result: DependencyResolutionResult
  ): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = this.detectCycleRecursive(
      startSkillId,
      result.dependencyGraph,
      visited,
      recursionStack,
      []
    );

    if (hasCycle) {
      result.valid = false;
    }
  }

  /**
   * 递归检测循环
   */
  private detectCycleRecursive(
    skillId: string,
    graph: Map<string, string[]>,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): boolean {
    visited.add(skillId);
    recursionStack.add(skillId);
    path.push(skillId);

    const deps = graph.get(skillId) || [];

    for (const depId of deps) {
      if (!visited.has(depId)) {
        if (this.detectCycleRecursive(depId, graph, visited, recursionStack, path)) {
          return true;
        }
      } else if (recursionStack.has(depId)) {
        // 找到循环
        const cycleStart = path.indexOf(depId);
        const cycle = path.slice(cycleStart).concat(depId);
        logger.error(`Circular dependency detected: ${cycle.join(' -> ')}`);
        return true;
      }
    }

    recursionStack.delete(skillId);
    path.pop();
    return false;
  }

  /**
   * 计算执行顺序（拓扑排序）
   */
  private calculateExecutionOrder(
    startSkillId: string,
    graph: Map<string, string[]>
  ): string[] {
    const order: string[] = [];
    const visited = new Set<string>();

    const visit = (skillId: string) => {
      if (visited.has(skillId)) {
        return;
      }

      visited.add(skillId);

      const deps = graph.get(skillId) || [];
      for (const depId of deps) {
        visit(depId);
      }

      order.push(skillId);
    };

    visit(startSkillId);

    return order;
  }

  /**
   * 获取技能的所有依赖（递归）
   */
  async getAllDependencies(skillId: string): Promise<string[]> {
    const allDeps = new Set<string>();
    const visited = new Set<string>();

    await this.collectDependenciesRecursive(skillId, allDeps, visited);

    return Array.from(allDeps);
  }

  /**
   * 递归收集依赖
   */
  private async collectDependenciesRecursive(
    skillId: string,
    allDeps: Set<string>,
    visited: Set<string>
  ): Promise<void> {
    if (visited.has(skillId)) {
      return;
    }

    visited.add(skillId);

    const skill = await this.store.loadSkill(skillId);
    if (!skill) {
      return;
    }

    const deps = skill.metadata.dependencies || [];
    for (const depId of deps) {
      allDeps.add(depId);
      await this.collectDependenciesRecursive(depId, allDeps, visited);
    }
  }

  /**
   * 获取依赖于指定技能的所有技能
   */
  async getDependents(skillId: string): Promise<string[]> {
    const allSkills = await this.store.getAllSkills();
    const dependents: string[] = [];

    for (const skill of allSkills) {
      const deps = skill.metadata.dependencies || [];
      if (deps.includes(skillId)) {
        dependents.push(skill.metadata.name);
      }
    }

    return dependents;
  }

  /**
   * 检查是否可以安全删除技能
   */
  async canSafelyDelete(skillId: string): Promise<{
    canDelete: boolean;
    blockedBy: string[];
  }> {
    const dependents = await this.getDependents(skillId);

    return {
      canDelete: dependents.length === 0,
      blockedBy: dependents
    };
  }

  /**
   * 生成依赖图的可视化表示
   */
  async visualizeDependencyGraph(skillId: string): Promise<string> {
    const result = await this.validateDependencies(skillId);
    const lines: string[] = [];

    lines.push(`Dependency Graph for: ${skillId}`);
    lines.push('');

    if (result.executionOrder) {
      lines.push('Execution Order:');
      result.executionOrder.forEach((id, index) => {
        lines.push(`  ${index + 1}. ${id}`);
      });
      lines.push('');
    }

    lines.push('Dependencies:');
    for (const [skill, deps] of result.dependencyGraph.entries()) {
      if (deps.length > 0) {
        lines.push(`  ${skill} depends on:`);
        deps.forEach(dep => {
          lines.push(`    - ${dep}`);
        });
      }
    }

    if (result.errors.length > 0) {
      lines.push('');
      lines.push('Errors:');
      result.errors.forEach(err => {
        lines.push(`  ❌ ${err}`);
      });
    }

    if (result.warnings.length > 0) {
      lines.push('');
      lines.push('Warnings:');
      result.warnings.forEach(warn => {
        lines.push(`  ⚠️  ${warn}`);
      });
    }

    return lines.join('\n');
  }
}
