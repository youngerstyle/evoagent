/**
 * Session 相关 CLI 命令
 */

import { Command } from 'commander';
import type { SessionStorage } from '../../memory/session/SessionStorage.js';

/**
 * 注册 Session 命令
 */
export function registerSessionCommands(
  program: Command,
  sessionStorage: SessionStorage
): void {
  const sessionCmd = program.command('session');

  // session list
  sessionCmd
    .command('list')
    .description('列出所有会话')
    .option('-s, --status <status>', '按状态筛选: active | archived | pruned')
    .option('-l, --limit <n>', '限制数量', '20')
    .action(async (options) => {
      await sessionStorage.init();
      const sessions = sessionStorage.listSessions(options.status);
      const limit = parseInt(options.limit);
      const displayed = sessions.slice(0, limit);

      if (displayed.length === 0) {
        console.log('没有找到会话');
        return;
      }

      console.log(`会话列表 (显示 ${displayed.length}/${sessions.length}):\n`);

      for (const session of displayed) {
        const statusIcon = session.status === 'active' ? '🟢' :
                          session.status === 'archived' ? '📦' : '🗑️';
        const createdDate = new Date(session.createdAt).toLocaleString('zh-CN');
        const updatedDate = new Date(session.updatedAt).toLocaleString('zh-CN');

        console.log(`${statusIcon} ${session.sessionId}`);
        console.log(`   状态: ${session.status}`);
        console.log(`   创建: ${createdDate}`);
        console.log(`   更新: ${updatedDate}`);
        console.log(`   消息: ${session.messageCount} | Agent运行: ${session.agentRunCount}`);
        console.log(`   大小: ${(session.fileSize / 1024).toFixed(2)} KB`);
        if (session.keepForever) {
          console.log(`   🔒 永久保留`);
        }
        console.log();
      }

      if (sessions.length > limit) {
        console.log(`... 还有 ${sessions.length - limit} 个会话未显示`);
        console.log(`使用 --limit 选项查看更多`);
      }
    });

  // session get <id>
  sessionCmd
    .command('get <sessionId>')
    .description('查看会话详情')
    .option('--events', '显示所有事件')
    .action(async (sessionId, options) => {
      await sessionStorage.init();
      const session = await sessionStorage.loadSession(sessionId);

      if (!session) {
        console.error(`❌ 会话不存在: ${sessionId}`);
        process.exit(1);
      }

      const { metadata, events } = session;
      const createdDate = new Date(metadata.createdAt).toLocaleString('zh-CN');
      const updatedDate = new Date(metadata.updatedAt).toLocaleString('zh-CN');

      console.log(`# 会话: ${sessionId}\n`);
      console.log(`状态: ${metadata.status}`);
      console.log(`创建: ${createdDate}`);
      console.log(`更新: ${updatedDate}`);
      console.log(`消息数: ${metadata.messageCount}`);
      console.log(`Agent运行: ${metadata.agentRunCount}`);
      console.log(`文件大小: ${(metadata.fileSize / 1024).toFixed(2)} KB`);
      if (metadata.keepForever) {
        console.log(`🔒 永久保留`);
      }
      console.log();

      if (options.events) {
        console.log(`## 事件 (${events.length}):\n`);
        for (const event of events) {
          const timestamp = new Date(event.timestamp).toLocaleString('zh-CN');
          console.log(`[${timestamp}] ${event.type}`);
          if (event.data) {
            const dataStr = JSON.stringify(event.data, null, 2);
            console.log(`  ${dataStr.split('\n').join('\n  ')}`);
          }
          console.log();
        }
      } else {
        console.log(`事件数: ${events.length} (使用 --events 查看详情)`);
      }
    });

  // session delete <id>
  sessionCmd
    .command('delete <sessionId>')
    .description('删除会话')
    .option('-f, --force', '强制删除，不询问')
    .action(async (sessionId, options) => {
      await sessionStorage.init();
      const session = await sessionStorage.loadSession(sessionId);

      if (!session) {
        console.error(`❌ 会话不存在: ${sessionId}`);
        process.exit(1);
      }

      if (session.metadata.keepForever && !options.force) {
        console.error(`❌ 此会话被标记为永久保留`);
        console.error(`使用 --force 选项强制删除`);
        process.exit(1);
      }

      if (!options.force) {
        console.warn(`⚠️  确定要删除会话 ${sessionId}?`);
        console.warn(`这个操作不可撤销。`);
        console.log('');
        console.log('使用 --force 选项确认操作。');
        return;
      }

      await sessionStorage.deleteSession(sessionId);
      console.log(`✓ 会话已删除: ${sessionId}`);
    });

  // session archive <id>
  sessionCmd
    .command('archive <sessionId>')
    .description('归档会话')
    .action(async (sessionId) => {
      await sessionStorage.init();
      const metadata = sessionStorage.getMetadata(sessionId);

      if (!metadata) {
        console.error(`❌ 会话不存在: ${sessionId}`);
        process.exit(1);
      }

      await sessionStorage.archiveSession(sessionId);
      console.log(`✓ 会话已归档: ${sessionId}`);
    });

  // session keep <id>
  sessionCmd
    .command('keep <sessionId>')
    .description('标记会话为永久保留')
    .option('--unkeep', '取消永久保留标记')
    .action(async (sessionId, options) => {
      await sessionStorage.init();
      const metadata = sessionStorage.getMetadata(sessionId);

      if (!metadata) {
        console.error(`❌ 会话不存在: ${sessionId}`);
        process.exit(1);
      }

      const keep = !options.unkeep;
      await sessionStorage.keepForever(sessionId, keep);

      if (keep) {
        console.log(`✓ 会话已标记为永久保留: ${sessionId}`);
      } else {
        console.log(`✓ 已取消永久保留标记: ${sessionId}`);
      }
    });

  // session cleanup
  sessionCmd
    .command('cleanup')
    .description('清理旧会话')
    .option('--max-age <days>', '最大年龄（天）', '30')
    .option('--max-sessions <n>', '最大会话数', '100')
    .option('--keep-active', '保留活跃会话')
    .option('-f, --force', '强制执行，不询问')
    .action(async (options) => {
      await sessionStorage.init();

      if (!options.force) {
        console.warn(`⚠️  此操作将清理旧会话`);
        console.warn(`  最大年龄: ${options.maxAge} 天`);
        console.warn(`  最大会话数: ${options.maxSessions}`);
        console.warn(`  保留活跃会话: ${options.keepActive ? '是' : '否'}`);
        console.log('');
        console.log('使用 --force 选项确认操作。');
        return;
      }

      const maxAge = parseInt(options.maxAge) * 24 * 60 * 60 * 1000;
      const maxSessions = parseInt(options.maxSessions);

      const deletedCount = await sessionStorage.cleanup({
        maxAge,
        maxSessions,
        keepActive: options.keepActive
      });

      console.log(`✓ 已清理 ${deletedCount} 个会话`);
    });

  // session stats
  sessionCmd
    .command('stats')
    .description('显示会话统计信息')
    .action(async () => {
      await sessionStorage.init();
      const stats = sessionStorage.getStats();

      console.log('# 会话统计\n');
      console.log(`总会话数: ${stats.totalSessions}`);
      console.log(`活跃会话: ${stats.activeSessions}`);
      console.log(`已归档: ${stats.archivedSessions}`);
      console.log(`总大小: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    });
}
