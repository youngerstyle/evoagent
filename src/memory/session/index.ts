/**
 * Session Memory Module
 *
 * 提供会话的持久化、检索和压缩功能
 *
 * 数据格式：
 * - .index.json - 会话索引文件
 * - {sessionId}.jsonl - 会话事件文件（JSONL格式）
 */

export { SessionStorage, type SessionMetadata, type SessionEvent, type Session } from './SessionStorage.js';
export { SessionCompressor, type CompressionOptions } from './SessionCompressor.js';
export type { SessionStats } from './types.js';
