/**
 * Skill 相关 CLI 命令
 */

import { Command } from 'commander';
import type { SkillStore } from '../../evolution/skills/SkillStore.js';

/**
 * 注册 Skill 命令
 */
export function registerSkillCommands(
  program: Command,
  skillStore: SkillStore
): void {
  const skillCmd = program.command('skill');

  // skill list
  skillCmd
    .command('list')
    .description('列出所有技能')
    .option('-l, --limit <n>', '限制数量', '20')
    .action(async (options) => {
      await skillStore.init();
      const allSkills = await skillStore.getAllSkills();

      const limit = parseInt(options.limit);
      const displayed = allSkills.slice(0, limit);

      if (displayed.length === 0) {
        console.log('没有找到技能');
        return;
      }

      console.log(`技能列表 (显示 ${displayed.length}/${allSkills.length}):\n`);

      for (const skill of displayed) {
        const status = skill.metadata.validation.status;
        const statusIcon = status === 'validated' ? '✅' :
                          status === 'probation' ? '🔄' :
                          status === 'draft' ? '📝' : '🗑️';

        const successRate = skill.metadata.timesUsed > 0
          ? skill.metadata.timesSucceeded / skill.metadata.timesUsed
          : 0;

        console.log(`${statusIcon} ${skill.metadata.name}`);
        console.log(`   状态: ${status}`);
        console.log(`   标签: ${skill.metadata.tags.join(', ')}`);
        console.log(`   描述: ${skill.metadata.description}`);
        console.log(`   使用: ${skill.metadata.timesUsed}次 | 成功率: ${(successRate * 100).toFixed(1)}%`);
        console.log();
      }

      if (allSkills.length > limit) {
        console.log(`... 还有 ${allSkills.length - limit} 个技能未显示`);
      }
    });

  // skill get <id>
  skillCmd
    .command('get <skillId>')
    .description('查看技能详情')
    .action(async (skillId) => {
      await skillStore.init();
      const skill = await skillStore.loadSkill(skillId);

      if (!skill) {
        console.error(`❌ 技能不存在: ${skillId}`);
        process.exit(1);
      }

      const successRate = skill.metadata.timesUsed > 0
        ? skill.metadata.timesSucceeded / skill.metadata.timesUsed
        : 0;

      console.log(`# 技能: ${skill.metadata.name}\n`);
      console.log(`状态: ${skill.metadata.validation.status}`);
      console.log(`标签: ${skill.metadata.tags.join(', ')}`);
      console.log(`描述: ${skill.metadata.description}`);
      console.log(`版本: ${skill.metadata.version}`);
      console.log();

      console.log('## 内容');
      console.log(skill.content);
      console.log();

      console.log('## 统计');
      console.log(`使用次数: ${skill.metadata.timesUsed}`);
      console.log(`成功次数: ${skill.metadata.timesSucceeded}`);
      console.log(`失败次数: ${skill.metadata.timesFailed}`);
      console.log(`成功率: ${(successRate * 100).toFixed(1)}%`);
      console.log();

      console.log('## 时间');
      console.log(`创建: ${skill.metadata.created}`);
      console.log(`最后验证: ${skill.metadata.validation.lastValidated}`);
    });

  // skill delete <id>
  skillCmd
    .command('delete <skillId>')
    .description('删除技能')
    .option('-f, --force', '强制删除，不询问')
    .action(async (skillId, options) => {
      await skillStore.init();
      const skill = await skillStore.loadSkill(skillId);

      if (!skill) {
        console.error(`❌ 技能不存在: ${skillId}`);
        process.exit(1);
      }

      if (!options.force) {
        console.warn(`⚠️  确定要删除技能 ${skill.metadata.name}?`);
        console.warn(`这个操作不可撤销。`);
        console.log('');
        console.log('使用 --force 选项确认操作。');
        return;
      }

      await skillStore.deleteSkill(skillId);
      console.log(`✓ 技能已删除: ${skill.metadata.name}`);
    });

  // skill deprecate <id>
  skillCmd
    .command('deprecate <skillId>')
    .description('废弃技能')
    .option('-r, --reason <reason>', '废弃原因', 'Manual deprecation')
    .action(async (skillId, options) => {
      await skillStore.init();
      const skill = await skillStore.loadSkill(skillId);

      if (!skill) {
        console.error(`❌ 技能不存在: ${skillId}`);
        process.exit(1);
      }

      await skillStore.deprecateSkill(skillId, options.reason);
      console.log(`✓ 技能已废弃: ${skill.metadata.name}`);
      console.log(`  原因: ${options.reason}`);
    });

  // skill search <query>
  skillCmd
    .command('search <query>')
    .description('搜索技能')
    .option('-l, --limit <n>', '限制数量', '10')
    .action(async (query, options) => {
      await skillStore.init();
      const skills = await skillStore.searchSkills({
        searchText: query
      });

      const limit = parseInt(options.limit);
      const displayed = skills.slice(0, limit);

      if (displayed.length === 0) {
        console.log('没有找到匹配的技能');
        return;
      }

      console.log(`搜索结果 (显示 ${displayed.length}/${skills.length}):\n`);

      for (const skill of displayed) {
        const status = skill.metadata.validation.status;
        const statusIcon = status === 'validated' ? '✅' :
                          status === 'probation' ? '🔄' :
                          status === 'draft' ? '📝' : '🗑️';

        console.log(`${statusIcon} ${skill.metadata.name}`);
        console.log(`   ${skill.metadata.description}`);
        console.log(`   状态: ${status} | 标签: ${skill.metadata.tags.join(', ')}`);
        console.log();
      }

      if (skills.length > limit) {
        console.log(`... 还有 ${skills.length - limit} 个结果未显示`);
      }
    });

  // skill stats
  skillCmd
    .command('stats')
    .description('显示技能统计信息')
    .action(async () => {
      await skillStore.init();
      const allSkills = await skillStore.getAllSkills();

      const stats = {
        total: allSkills.length,
        byStatus: {} as Record<string, number>,
        byCategory: {} as Record<string, number>,
        totalUsage: 0,
        totalSuccess: 0
      };

      for (const skill of allSkills) {
        const status = skill.metadata.validation.status;
        const tags = skill.metadata.tags;

        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
        for (const tag of tags) {
          stats.byCategory[tag] = (stats.byCategory[tag] || 0) + 1;
        }
        stats.totalUsage += skill.metadata.timesUsed;
        stats.totalSuccess += skill.metadata.timesSucceeded;
      }

      const avgSuccessRate = stats.totalUsage > 0 ? stats.totalSuccess / stats.totalUsage : 0;

      console.log('# 技能统计\n');
      console.log(`总技能数: ${stats.total}`);
      console.log(`草稿: ${stats.byStatus.draft || 0}`);
      console.log(`试用: ${stats.byStatus.probation || 0}`);
      console.log(`已验证: ${stats.byStatus.validated || 0}`);
      console.log(`已废弃: ${stats.byStatus.deprecated || 0}`);
      console.log();

      console.log('按类别:');
      for (const [category, count] of Object.entries(stats.byCategory)) {
        console.log(`  ${category}: ${count}`);
      }
      console.log();

      console.log(`总使用次数: ${stats.totalUsage}`);
      console.log(`平均成功率: ${(avgSuccessRate * 100).toFixed(1)}%`);
    });

  // skill rebuild-index
  skillCmd
    .command('rebuild-index')
    .description('重建技能索引')
    .action(async () => {
      await skillStore.init();
      console.log('重建技能索引...');
      await skillStore.rebuildIndex();
      console.log('✓ 索引重建完成');
    });
}
