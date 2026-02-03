/**
 * 输入验证工具
 *
 * 提供统一的输入验证功能
 */

import { VALIDATION_RULES } from './SkillConfig.js';

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 输入验证器
 */
export class InputValidator {
  /**
   * 验证技能ID
   */
  static validateSkillId(skillId: unknown): ValidationResult {
    const errors: string[] = [];

    if (typeof skillId !== 'string') {
      errors.push('Skill ID must be a string');
      return { valid: false, errors };
    }

    if (skillId.length < VALIDATION_RULES.SKILL_ID.MIN_LENGTH) {
      errors.push(`Skill ID must be at least ${VALIDATION_RULES.SKILL_ID.MIN_LENGTH} character`);
    }

    if (skillId.length > VALIDATION_RULES.SKILL_ID.MAX_LENGTH) {
      errors.push(`Skill ID must not exceed ${VALIDATION_RULES.SKILL_ID.MAX_LENGTH} characters`);
    }

    if (!VALIDATION_RULES.SKILL_ID.PATTERN.test(skillId)) {
      errors.push('Skill ID can only contain letters, numbers, hyphens, and underscores');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证技能名称
   */
  static validateSkillName(skillName: unknown): ValidationResult {
    const errors: string[] = [];

    if (typeof skillName !== 'string') {
      errors.push('Skill name must be a string');
      return { valid: false, errors };
    }

    if (skillName.trim().length < VALIDATION_RULES.SKILL_NAME.MIN_LENGTH) {
      errors.push(`Skill name must be at least ${VALIDATION_RULES.SKILL_NAME.MIN_LENGTH} character`);
    }

    if (skillName.length > VALIDATION_RULES.SKILL_NAME.MAX_LENGTH) {
      errors.push(`Skill name must not exceed ${VALIDATION_RULES.SKILL_NAME.MAX_LENGTH} characters`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证参数键
   */
  static validateParameterKey(key: unknown): ValidationResult {
    const errors: string[] = [];

    if (typeof key !== 'string') {
      errors.push('Parameter key must be a string');
      return { valid: false, errors };
    }

    if (key.length < VALIDATION_RULES.PARAMETER_KEY.MIN_LENGTH) {
      errors.push(`Parameter key must be at least ${VALIDATION_RULES.PARAMETER_KEY.MIN_LENGTH} character`);
    }

    if (key.length > VALIDATION_RULES.PARAMETER_KEY.MAX_LENGTH) {
      errors.push(`Parameter key must not exceed ${VALIDATION_RULES.PARAMETER_KEY.MAX_LENGTH} characters`);
    }

    if (!VALIDATION_RULES.PARAMETER_KEY.PATTERN.test(key)) {
      errors.push('Parameter key must be a valid identifier (letters, numbers, underscores)');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证分数（0-1之间）
   */
  static validateScore(score: unknown): ValidationResult {
    const errors: string[] = [];

    if (typeof score !== 'number') {
      errors.push('Score must be a number');
      return { valid: false, errors };
    }

    if (isNaN(score) || !isFinite(score)) {
      errors.push('Score must be a valid number');
    }

    if (score < 0 || score > 1) {
      errors.push('Score must be between 0 and 1');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证非空字符串
   */
  static validateNonEmptyString(value: unknown, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (typeof value !== 'string') {
      errors.push(`${fieldName} must be a string`);
      return { valid: false, errors };
    }

    if (value.trim().length === 0) {
      errors.push(`${fieldName} cannot be empty`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证正整数
   */
  static validatePositiveInteger(value: unknown, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (typeof value !== 'number') {
      errors.push(`${fieldName} must be a number`);
      return { valid: false, errors };
    }

    if (!Number.isInteger(value)) {
      errors.push(`${fieldName} must be an integer`);
    }

    if (value < 0) {
      errors.push(`${fieldName} must be positive`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证数组
   */
  static validateArray(value: unknown, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (!Array.isArray(value)) {
      errors.push(`${fieldName} must be an array`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 组合多个验证结果
   */
  static combine(...results: ValidationResult[]): ValidationResult {
    const allErrors = results.flatMap(r => r.errors);
    return {
      valid: allErrors.length === 0,
      errors: allErrors
    };
  }
}
