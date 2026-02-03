/**
 * InputValidator 单元测试
 */

import { describe, it, expect } from '@jest/globals';
import { InputValidator } from '../../../src/evolution/skills/InputValidator.js';

describe('InputValidator', () => {
  describe('validateSkillId', () => {
    it('应该接受有效的技能ID', () => {
      const result = InputValidator.validateSkillId('valid-skill-123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝非字符串', () => {
      const result = InputValidator.validateSkillId(123);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be a string');
    });

    it('应该拒绝空字符串', () => {
      const result = InputValidator.validateSkillId('');
      expect(result.valid).toBe(false);
    });

    it('应该拒绝过长的ID', () => {
      const result = InputValidator.validateSkillId('a'.repeat(200));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceed'))).toBe(true);
    });

    it('应该拒绝包含特殊字符的ID', () => {
      const result = InputValidator.validateSkillId('skill@#$');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('letters, numbers'))).toBe(true);
    });
  });

  describe('validateSkillName', () => {
    it('应该接受有效的技能名称', () => {
      const result = InputValidator.validateSkillName('Valid Skill Name');
      expect(result.valid).toBe(true);
    });

    it('应该拒绝空白名称', () => {
      const result = InputValidator.validateSkillName('   ');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateScore', () => {
    it('应该接受0到1之间的分数', () => {
      expect(InputValidator.validateScore(0).valid).toBe(true);
      expect(InputValidator.validateScore(0.5).valid).toBe(true);
      expect(InputValidator.validateScore(1).valid).toBe(true);
    });

    it('应该拒绝超出范围的分数', () => {
      expect(InputValidator.validateScore(-0.1).valid).toBe(false);
      expect(InputValidator.validateScore(1.1).valid).toBe(false);
    });

    it('应该拒绝NaN和Infinity', () => {
      expect(InputValidator.validateScore(NaN).valid).toBe(false);
      expect(InputValidator.validateScore(Infinity).valid).toBe(false);
    });
  });

  describe('validatePositiveInteger', () => {
    it('应该接受正整数', () => {
      const result = InputValidator.validatePositiveInteger(5, 'count');
      expect(result.valid).toBe(true);
    });

    it('应该拒绝负数', () => {
      const result = InputValidator.validatePositiveInteger(-1, 'count');
      expect(result.valid).toBe(false);
    });

    it('应该拒绝小数', () => {
      const result = InputValidator.validatePositiveInteger(1.5, 'count');
      expect(result.valid).toBe(false);
    });
  });

  describe('combine', () => {
    it('应该组合多个验证结果=> {
      const result1 = { valid: true, errors: [] };
      const result2 = { valid: false, errors: ['Error 1'] };
      const result3 = { valid: false, errors: ['Error 2'] };

      const combined = InputValidator.combine(result1, result2, result3);
      expect(combined.valid).toBe(false);
      expect(combined.errors).toHaveLength(2);
      expect(combined.errors).toContain('Error 1');
      expect(combined.errors).toContain('Error 2');
    });

    it('应该在所有验证通过时返回valid', () => {
      const result1 = { valid: true, errors: [] };
      const result2 = { valid: true, errors: [] };

      const combined = InputValidator.combine(result1, result2);
      expect(combined.valid).toBe(true);
      expect(combined.errors).toHaveLength(0);
    });
  });
});
