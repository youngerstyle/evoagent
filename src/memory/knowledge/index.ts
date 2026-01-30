/**
 * Knowledge Memory Module
 *
 * 提供结构化知识的存储和检索功能
 *
 * 目录结构：
 * - auto/       # Reflector 自动生成（可覆盖）
 * - manual/     # 人工创建（Reflector 不修改）
 */

export { KnowledgeStorage, type KnowledgeItem, type KnowledgeFrontmatter, type KnowledgeStats } from './KnowledgeStorage.js';
