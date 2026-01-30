/**
 * Change Extractor
 *
 * 从 Git 代码变更中提取模式和经验
 */

import { getLogger } from '../../core/logger/index.js';
import { GitClient } from './GitClient.js';
import type {
  ChangeExtraction,
  ExtractedChange,
  CodePattern
} from './GitIntegrationTypes.js';

const logger = getLogger('evolution:git:extractor');

// 语言特定的模式
const LANGUAGE_PATTERNS = {
  typescript: {
    function: /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?[^)]*\)?\s*=>)/g,
    class: /class\s+(\w+)/g,
    import: /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
    export: /export\s+(?:default\s+)?(?:class|function|const|interface|type)\s+(\w+)/g,
    interface: /interface\s+(\w+)/g,
    type: /type\s+(\w+)\s*=/g
  },
  javascript: {
    function: /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?[^)]*\)?\s*=>)/g,
    class: /class\s+(\w+)/g,
    import: /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
    export: /export\s+(?:default\s+)?(?:class|function|const)\s+(\w+)/g
  },
  python: {
    function: /def\s+(\w+)\s*\(/g,
    class: /class\s+(\w+)/g,
    import: /(?:from\s+(\S+)\s+import|import\s+(\S+))/g
  }
};

/**
 * ChangeExtractor - 代码变更提取器
 */
export class ChangeExtractor {
  private client: GitClient;
  private maxContextLines: number = 5;

  constructor(client: GitClient, maxContextLines: number = 5) {
    this.client = client;
    this.maxContextLines = maxContextLines;
  }

  /**
   * 从提交中提取变更
   */
  async extractFromCommit(commitHash: string): Promise<ChangeExtraction> {
    const commit = await this.client.getCommit(commitHash);
    if (!commit) {
      return {
        commitHash,
        timestamp: 0,
        changes: [],
        patterns: []
      };
    }

    const changes: ExtractedChange[] = [];
    const allPatterns: CodePattern[] = [];

    for (const filePath of commit.files) {
      // 跳过非代码文件
      if (!this.isCodeFile(filePath)) {
        continue;
      }

      const diff = await this.client.getFileDiff(filePath, commitHash + '^', commitHash);
      if (!diff) continue;

      const fileChanges = this.parseFileDiff(filePath, diff);
      changes.push(...fileChanges);

      // 从变更中提取模式
      const patterns = this.extractPatternsFromDiff(filePath, diff);
      allPatterns.push(...patterns);
    }

    return {
      commitHash,
      timestamp: commit.timestamp,
      changes,
      patterns: this.aggregatePatterns(allPatterns)
    };
  }

  /**
   * 从多个提交中提取变更
   */
  async extractFromCommits(commitHashes: string[]): Promise<ChangeExtraction[]> {
    const extractions: ChangeExtraction[] = [];

    for (const hash of commitHashes) {
      try {
        const extraction = await this.extractFromCommit(hash);
        extractions.push(extraction);
      } catch (error) {
        logger.warn(`Failed to extract from commit ${hash}:`, error as unknown as Record<string, unknown>);
      }
    }

    return extractions;
  }

  /**
   * 解析文件差异
   */
  private parseFileDiff(filePath: string, diff: string): ExtractedChange[] {
    const changes: ExtractedChange[] = [];

    const lines = diff.split('\n');
    let currentChange: Partial<ExtractedChange> | null = null;
    const addedLines: string[] = [];
    const removedLines: string[] = [];

    for (const line of lines) {
      // 文件头
      if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('@@')) {
        if (currentChange && currentChange.file) {
          changes.push({
            file: currentChange.file!,
            type: currentChange.type!,
            addedLines: [...addedLines],
            removedLines: [...removedLines],
            description: this.generateChangeDescription(addedLines, removedLines)
          });
          addedLines.length = 0;
          removedLines.length = 0;
        }

        currentChange = {
          file: filePath,
          type: this.detectChangeType(line)
        };
      }
      // 添加的行
      else if (line.startsWith('+') && !line.startsWith('+++')) {
        addedLines.push(line.substring(1));
      }
      // 删除的行
      else if (line.startsWith('-') && !line.startsWith('---')) {
        removedLines.push(line.substring(1));
      }
    }

    // 处理最后一个变更
    if (currentChange && currentChange.file) {
      changes.push({
        file: currentChange.file!,
        type: currentChange.type!,
        addedLines: [...addedLines],
        removedLines: [...removedLines],
        description: this.generateChangeDescription(addedLines, removedLines)
      });
    }

    // 如果没有解析到变更，返回一个基本的
    if (changes.length === 0 && diff.trim()) {
      changes.push({
        file: filePath,
        type: 'modify',
        addedLines: [],
        removedLines: [],
        description: 'File modified'
      });
    }

    return changes;
  }

  /**
   * 检测变更类型
   */
  private detectChangeType(line: string): ExtractedChange['type'] {
    if (line.startsWith('new file')) return 'create';
    if (line.startsWith('deleted')) return 'delete';
    if (line.includes('rename')) return 'rename';
    return 'modify';
  }

  /**
   * 生成变更描述
   */
  private generateChangeDescription(added: string[], removed: string[]): string {
    const parts: string[] = [];

    if (added.length > 0) {
      parts.push(`${added.length} lines added`);
    }

    if (removed.length > 0) {
      parts.push(`${removed.length} lines removed`);
    }

    if (parts.length === 0) {
      return 'No significant changes';
    }

    return parts.join(', ');
  }

  /**
   * 从差异中提取模式
   */
  private extractPatternsFromDiff(filePath: string, diff: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const language = this.detectLanguage(filePath);

    if (!language) {
      return patterns;
    }

    const langPatterns = LANGUAGE_PATTERNS[language as keyof typeof LANGUAGE_PATTERNS];
    if (!langPatterns) {
      return patterns;
    }

    // 从添加的行中提取模式
    const addedLines = diff.split('\n')
      .filter(line => line.startsWith('+') && !line.startsWith('+++'))
      .map(line => line.substring(1));

    const addedCode = addedLines.join('\n');

    // 提取函数定义
    if (langPatterns.function) {
      const matches = [...addedCode.matchAll(langPatterns.function)];
      for (const match of matches) {
        const name = match[1] || match[2];
        if (name) {
          patterns.push({
            name: `function:${name}`,
            type: 'success',
            description: `Function ${name} was added`,
            snippet: this.extractSnippet(addedLines, name, 'function'),
            frequency: 1
          });
        }
      }
    }

    // 提取类定义
    if (langPatterns.class) {
      const matches = [...addedCode.matchAll(langPatterns.class)];
      for (const match of matches) {
        const name = match[1];
        if (name) {
          patterns.push({
            name: `class:${name}`,
            type: 'success',
            description: `Class ${name} was added`,
            snippet: this.extractSnippet(addedLines, name, 'class'),
            frequency: 1
          });
        }
      }
    }

    // 提取导入语句
    if (langPatterns.import) {
      const matches = [...addedCode.matchAll(langPatterns.import)];
      for (const match of matches) {
        const importPath = match[1] || match[2];
        if (importPath) {
          patterns.push({
            name: `import:${importPath}`,
            type: 'best_practice',
            description: `Import of ${importPath} was added`,
            snippet: match[0],
            frequency: 1
          });
        }
      }
    }

    return patterns;
  }

  /**
   * 提取代码片段
   */
  private extractSnippet(lines: string[], name: string, type: string): string {
    const startLine = lines.findIndex(line =>
      line.includes(`${type} ${name}`) ||
      line.includes(`${name}(`) ||
      line.includes(`${name}:`)
    );

    if (startLine === -1) return '';

    const contextStart = Math.max(0, startLine - 1);
    const contextEnd = Math.min(lines.length, startLine + this.maxContextLines + 1);

    return lines.slice(contextStart, contextEnd).join('\n');
  }

  /**
   * 聚合模式
   */
  private aggregatePatterns(patterns: CodePattern[]): CodePattern[] {
    const frequencyMap = new Map<string, CodePattern>();

    for (const pattern of patterns) {
      const existing = frequencyMap.get(pattern.name);

      if (existing) {
        existing.frequency++;
      } else {
        frequencyMap.set(pattern.name, { ...pattern });
      }
    }

    return Array.from(frequencyMap.values())
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * 检测文件语言
   */
  private detectLanguage(filePath: string): string | null {
    const ext = filePath.split('.').pop()?.toLowerCase();

    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby'
    };

    return languageMap[ext || ''] || null;
  }

  /**
   * 检查是否是代码文件
   */
  private isCodeFile(filePath: string): boolean {
    const codeExtensions = [
      'ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs',
      'cpp', 'c', 'h', 'cs', 'php', 'rb', 'swift', 'kt'
    ];

    const ext = filePath.split('.').pop()?.toLowerCase();
    return ext ? codeExtensions.includes(ext) : false;
  }

  /**
   * 分类变更
   */
  categorizeChanges(changes: ExtractedChange[]): Record<string, ExtractedChange[]> {
    const categories: Record<string, ExtractedChange[]> = {
      bug_fix: [],
      feature: [],
      refactor: [],
      test: [],
      config: [],
      other: []
    };

    for (const change of changes) {
      const category = this.inferCategory(change);
      if (category) {
        (categories[category] ||= []).push(change);
      } else {
        categories.other?.push(change);
      }
    }

    return categories;
  }

  /**
   * 推断变更类别
   */
  private inferCategory(change: ExtractedChange): string | null {
    const filePath = change.file.toLowerCase();

    // 测试文件
    if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('/test/') || filePath.includes('/tests/')) {
      return 'test';
    }

    // 配置文件
    if (filePath.endsWith('.config.js') || filePath.endsWith('.config.ts') ||
        filePath.includes('config/') || filePath.endsWith('.json') || filePath.endsWith('.yaml')) {
      return 'config';
    }

    // 根据添加的行推断
    const addedCode = change.addedLines.join(' ').toLowerCase();

    if (addedCode.includes('test') || addedCode.includes('spec') || addedCode.includes('mock')) {
      return 'test';
    }

    if (addedCode.includes('fix') || addedCode.includes('bug') || addedCode.includes('patch')) {
      return 'bug_fix';
    }

    if (addedCode.includes('new') || addedCode.includes('add') || addedCode.includes('create')) {
      return 'feature';
    }

    if (addedCode.includes('refactor') || addedCode.includes('rewrite') || addedCode.includes('clean')) {
      return 'refactor';
    }

    return null;
  }

  /**
   * 提取 API 变更
   */
  async extractApiChanges(commitHash: string): Promise<Array<{
    name: string;
    type: 'added' | 'removed' | 'modified';
    file: string;
  }>> {
    const extraction = await this.extractFromCommit(commitHash);
    const apiChanges: Array<{
      name: string;
      type: 'added' | 'removed' | 'modified';
      file: string;
    }> = [];

    for (const change of extraction.changes) {
      // 检查是否是 API 相关文件
      if (change.file.includes('api') || change.file.includes('controller') || change.file.includes('route')) {
        // 提取函数或类名
        for (const line of [...change.addedLines, ...change.removedLines]) {
          const functionMatch = line.match(/(?:function|const|let|var)\s+(\w+)\s*[=\(]/);
          if (functionMatch && functionMatch[1]) {
            const type = change.addedLines.includes(line) ? 'added' : 'removed';
            apiChanges.push({
              name: functionMatch[1],
              type,
              file: change.file
            });
          }
        }
      }
    }

    return apiChanges;
  }
}
