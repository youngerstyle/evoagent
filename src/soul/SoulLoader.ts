/**
 * SOUL 加载器
 *
 * 负责加载、解析和保存 SOUL.md 文件
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import type {
  Soul,
  SoulLoader,
  SoulEvolutionRecord
} from './types.js';

/**
 * 从 Markdown 内容解析 SOUL
 */
function parseSoul(content: string, agentType: string | null): Soul {
  const lines = content.split('\n');

  const soul: Soul = {
    version: '1.0.0',
    global: agentType === null,
    agentType: agentType || undefined,
    coreTruths: [],
    boundaries: [],
    vibe: '',
    traits: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  let currentSection: string | null = null;

  for (const line of lines) {
    // 跳过分隔线
    if (line.match(/^---+$/)) continue;

    // 检测章节标题
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch && headingMatch[1]) {
      currentSection = headingMatch[1].toLowerCase();
      continue;
    }

    // 解析核心真理
    if (currentSection && (currentSection.includes('核心真理') || currentSection.includes('core truth'))) {
      // 支持多种格式:
      // **Principle.** Description (英文句号)
      // **Principle。** Description (中文句号)
      // **Principle**：Description (中文冒号)
      const truthMatch = line.match(/\*\*(.+?)[。：]\*\*\s*(.+)/);
      if (truthMatch && truthMatch[1] && truthMatch[2]) {
        soul.coreTruths.push({
          principle: truthMatch[1].trim(),
          description: truthMatch[2].trim()
        });
      }
    }

    // 解析边界
    if (currentSection && (currentSection.includes('边界') || currentSection.includes('boundary'))) {
      const boundaryMatch = line.match(/- \*\*(.+?)\*\*[:：](.+)/);
      if (boundaryMatch && boundaryMatch[1] && boundaryMatch[2]) {
        soul.boundaries.push({
          name: boundaryMatch[1].trim(),
          rule: boundaryMatch[2].trim(),
          enforcement: 'strict'
        });
      }
    }

    // 解析氛围
    if (currentSection && (currentSection.includes('氛围') || currentSection.includes('vibe'))) {
      if (line.trim() && !line.startsWith('#')) {
        soul.vibe = line.trim();
      }
    }

    // 解析特质标签
    if (currentSection && (currentSection.includes('特质') || currentSection.includes('trait'))) {
      const traitMatch = line.match(/- \*\*(.+?)\*\*[:：](.+)/);
      if (traitMatch && traitMatch[1]) {
        soul.traits.push(traitMatch[1].trim());
      }
    }
  }

  return soul;
}

/**
 * 将 SOUL 序列化为 Markdown
 */
function serializeSoul(soul: Soul): string {
  const title = soul.global
    ? '# SOUL.md - EvoAgent 的灵魂'
    : `# ${soul.agentType} SOUL`;

  const header = `
*You're not a tool. You're evolving.*

---

`;

  const coreTruthsSection = soul.coreTruths.length > 0
    ? `## Core Truths（核心真理）

${soul.coreTruths.map(t => `**${t.principle}**：${t.description || ''}`).join('\n\n')}

`
    : '';

  const boundariesSection = soul.boundaries.length > 0
    ? `## Boundaries（边界）

${soul.boundaries.map(b => `- **${b.name}**：${b.rule}`).join('\n')}

`
    : '';

  const vibeSection = soul.vibe
    ? `## Vibe（氛围）

${soul.vibe}

`
    : '';

  const traitsSection = soul.traits.length > 0
    ? `## 核心特质

${soul.traits.map(t => `**${t}**`).join(' | ')}

`
    : '';

  const footer = `
---

*继承全局 SOUL${soul.agentType ? `，但更强调 ${soul.traits.join('、')}` : ''}。*
`;

  return `${title}${header}${coreTruthsSection}${boundariesSection}${vibeSection}${traitsSection}${footer}`;
}

/**
 * 解析进化记录
 */
function parseEvolutionHistory(content: string): SoulEvolutionRecord[] {
  const records: SoulEvolutionRecord[] = [];
  const lines = content.split('\n');

  let currentRecord: Partial<SoulEvolutionRecord> | null = null;
  let inRecord = false;

  for (const line of lines) {
    // 检测记录开始
    const dateMatch = line.match(/^###\s+(\d{4}-\d{2}-\d{2})\s+-\s+(.+)$/);
    if (dateMatch) {
      if (currentRecord && currentRecord.changeType && currentRecord.description) {
        records.push(currentRecord as SoulEvolutionRecord);
      }
      currentRecord = {
        timestamp: dateMatch[1],
        version: '1.0.0',
        changeType: 'add',
        description: dateMatch[2]
      };
      inRecord = true;
      continue;
    }

    if (!inRecord || !currentRecord) continue;

    // 检测字段
    if (line.includes('**变更内容**') || line.includes('**变更原因**')) {
      const match = line.match(/\*\*(变更内容|变更原因|触发条件|预期效果)\*\*[:：](.+)/);
      if (match) {
        if (match[1] === '变更原因') {
          currentRecord.reason = match[2];
        } else if (match[1] === '预期效果') {
          currentRecord.expected = match[2];
        }
      }
    }
  }

  if (currentRecord && currentRecord.changeType && currentRecord.description) {
    records.push(currentRecord as SoulEvolutionRecord);
  }

  return records;
}

/**
 * SOUL 加载器实现
 */
export class FileSoulLoader implements SoulLoader {
  private readonly evoagentDir: string;
  private readonly agentsDir: string;

  constructor(evoagentDir: string = '.evoagent') {
    this.evoagentDir = evoagentDir;
    this.agentsDir = join(evoagentDir, 'agents');
  }

  async loadGlobal(): Promise<Soul> {
    const soulPath = join(this.evoagentDir, 'SOUL.md');
    try {
      const content = await readFile(soulPath, 'utf-8');
      return parseSoul(content, null);
    } catch (error) {
      // 如果文件不存在，返回默认 SOUL
      return this.getDefaultSoul();
    }
  }

  async loadAgent(agentType: string): Promise<Soul | null> {
    const soulPath = join(this.agentsDir, agentType.toLowerCase(), 'SOUL.md');
    try {
      const content = await readFile(soulPath, 'utf-8');
      return parseSoul(content, agentType);
    } catch (error) {
      return null;
    }
  }

  async loadEvolutionHistory(): Promise<SoulEvolutionRecord[]> {
    const historyPath = join(this.evoagentDir, 'SOUL_EVOLUTION.md');
    try {
      const content = await readFile(historyPath, 'utf-8');
      return parseEvolutionHistory(content);
    } catch (error) {
      return [];
    }
  }

  async save(soul: Soul): Promise<Soul> {
    const content = serializeSoul(soul);
    soul.updatedAt = new Date().toISOString();

    if (soul.global) {
      const soulPath = join(this.evoagentDir, 'SOUL.md');
      await mkdir(dirname(this.evoagentDir), { recursive: true });
      await writeFile(soulPath, content, 'utf-8');
    } else if (soul.agentType) {
      const soulPath = join(this.agentsDir, soul.agentType.toLowerCase(), 'SOUL.md');
      await mkdir(dirname(soulPath), { recursive: true });
      await writeFile(soulPath, content, 'utf-8');
    }
    return soul;
  }

  private getDefaultSoul(): Soul {
    return {
      version: '1.0.0',
      global: true,
      coreTruths: [
        { principle: '进化是永恒的', description: '今天不完美的方案，通过反思和迭代，明天可以更好。' },
        { principle: '诚实优先于讨好', description: '不懂就说不懂，不要编造。用户需要真相，不是安慰。' },
        { principle: '简洁是智慧', description: '能说清的不要啰嗦。代码如此，沟通也如此。' },
        { principle: '尊重用户意愿', description: '你是来帮忙的，不是来接管。理解意图，确认行动，再执行。' },
        { principle: '从错误中学习', description: '失败不是终点，是进化的契机。' }
      ],
      boundaries: [
        { name: '隐私红线', rule: '绝不泄露用户的敏感信息', enforcement: 'strict' },
        { name: '确认原则', rule: '执行外部操作前先确认', enforcement: 'strict' },
        { name: '不越权', rule: '你辅助决策，不代替决策', enforcement: 'soft' },
        { name: '知之为知之', rule: '不确定的不要假装确定', enforcement: 'soft' }
      ],
      vibe: '专业但不死板，谦逊但不盲从。像一个可靠的工程伙伴。',
      traits: ['专业', '诚实', '简洁', '可靠'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}

/**
 * SOUL 缓存装饰器
 */
export class CachedSoulLoader implements SoulLoader {
  private cache: Map<string, { soul: Soul; timestamp: number }> = new Map();
  private readonly cacheTimeout = 60000; // 1分钟

  constructor(private base: SoulLoader) {}

  async loadGlobal(): Promise<Soul> {
    return this.withCache('global', () => this.base.loadGlobal());
  }

  async loadAgent(agentType: string): Promise<Soul | null> {
    return this.withCache(`agent:${agentType}`, () => this.base.loadAgent(agentType));
  }

  async loadEvolutionHistory(): Promise<SoulEvolutionRecord[]> {
    // 历史记录不缓存
    return this.base.loadEvolutionHistory();
  }

  async save(soul: Soul): Promise<Soul> {
    await this.base.save(soul);
    // 清除缓存
    const key = soul.global ? 'global' : `agent:${soul.agentType}`;
    this.cache.delete(key);
    return soul;
  }

  private async withCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.soul as T;
    }

    const result = await loader();
    if (result && typeof result === 'object' && 'version' in result) {
      this.cache.set(key, { soul: result as unknown as Soul, timestamp: Date.now() });
    }
    return result;
  }
}
