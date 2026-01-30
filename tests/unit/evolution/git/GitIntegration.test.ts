/**
 * GitIntegration Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GitIntegration } from '../../../../src/evolution/git/GitIntegration.js';
import { GitClient } from '../../../../src/evolution/git/GitClient.js';
import { CommitAnalyzer } from '../../../../src/evolution/git/CommitAnalyzer.js';
import { ChangeExtractor } from '../../../../src/evolution/git/ChangeExtractor.js';
import type {
  GitIntegrationConfig,
  GitCommit,
  GitAnalysis
} from '../../../../src/evolution/git/GitIntegrationTypes.js';

// Mock logger
vi.mock('../../../../src/core/logger/index.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

// Mock child_process exec
vi.mock('node:child_process', () => ({
  exec: vi.fn()
}));

describe('GitIntegration', () => {
  let gitIntegration: GitIntegration;
  let config: GitIntegrationConfig;

  const mockCommits: GitCommit[] = [
    {
      hash: 'abc123',
      shortHash: 'abc123',
      author: 'Test Author',
      authorEmail: 'test@example.com',
      committer: 'Test Author',
      committerEmail: 'test@example.com',
      message: 'feat: add new feature',
      summary: 'feat: add new feature',
      body: '',
      timestamp: Date.now() / 1000,
      date: new Date(),
      files: ['src/test.ts'],
      stats: { total: 1, additions: 10, deletions: 0, changes: 10 }
    },
    {
      hash: 'def456',
      shortHash: 'def456',
      author: 'Test Author',
      authorEmail: 'test@example.com',
      committer: 'Test Author',
      committerEmail: 'test@example.com',
      message: 'fix: fix bug',
      summary: 'fix: fix bug',
      body: '',
      timestamp: Date.now() / 1000 - 3600,
      date: new Date(),
      files: ['src/test.ts'],
      stats: { total: 1, additions: 5, deletions: 5, changes: 10 }
    }
  ];

  beforeEach(() => {
    config = {
      repoPath: '/test/repo',
      cacheEnabled: true,
      maxHistory: 100
    };

    // Mock GitClient methods
    vi.spyOn(GitClient.prototype, 'init').mockResolvedValue(true);
    vi.spyOn(GitClient.prototype, 'isGitRepo').mockResolvedValue(true);
    vi.spyOn(GitClient.prototype, 'getGitVersion').mockResolvedValue('git version 2.0.0');
    vi.spyOn(GitClient.prototype, 'getLog').mockResolvedValue(mockCommits);
    vi.spyOn(GitClient.prototype, 'getCommit').mockResolvedValue(mockCommits[0]);
    vi.spyOn(GitClient.prototype, 'getFileDiff').mockResolvedValue('+ added line\n- removed line');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('初始化', () => {
    it('应该创建 GitIntegration 实例', () => {
      gitIntegration = new GitIntegration(config);
      expect(gitIntegration).toBeInstanceOf(GitIntegration);
    });

    it('应该正确初始化', async () => {
      gitIntegration = new GitIntegration(config);
      const success = await gitIntegration.init();
      expect(success).toBe(true);
    });

    it('应该获取子组件', () => {
      gitIntegration = new GitIntegration(config);
      expect(gitIntegration.getClient()).toBeInstanceOf(GitClient);
      expect(gitIntegration.getAnalyzer()).toBeInstanceOf(CommitAnalyzer);
      expect(gitIntegration.getExtractor()).toBeInstanceOf(ChangeExtractor);
    });
  });

  describe('分析功能', () => {
    beforeEach(async () => {
      gitIntegration = new GitIntegration(config);
      await gitIntegration.init();
    });

    it('应该分析仓库', async () => {
      const analysis = await gitIntegration.analyze();

      expect(analysis).toBeDefined();
      expect(analysis.totalCommits).toBe(2);
      expect(analysis.authors).toHaveLength(1);
      expect(analysis.fileChanges).toBeDefined();
      expect(analysis.commonPatterns).toBeDefined();
    });

    it('应该生成报告', async () => {
      const report = await gitIntegration.generateReport({
        title: 'Test Report',
        includeCommits: true
      });

      expect(report).toBeDefined();
      expect(report.title).toBe('Test Report');
      expect(report.summary).toBeDefined();
      expect(report.commits).toHaveLength(2);
      expect(report.authors).toBeDefined();
      expect(report.insights).toBeDefined();
    });
  });

  describe('提取功能', () => {
    beforeEach(async () => {
      gitIntegration = new GitIntegration(config);
      await gitIntegration.init();
    });

    it('应该从提交中提取变更', async () => {
      const extraction = await gitIntegration.extract('abc123');

      expect(extraction).toBeDefined();
      expect(extraction.commitHash).toBe('abc123');
      expect(extraction.changes).toBeDefined();
      expect(extraction.patterns).toBeDefined();
    });

    it('应该批量提取', async () => {
      const extractions = await gitIntegration.extractBatch(['abc123', 'def456']);

      expect(extractions).toHaveLength(2);
      expect(extractions[0].commitHash).toBe('abc123');
      expect(extractions[1].commitHash).toBe('def456');
    });
  });

  describe('关联功能', () => {
    beforeEach(async () => {
      gitIntegration = new GitIntegration(config);
      await gitIntegration.init();
    });

    it('应该关联提交与经验', () => {
      gitIntegration.linkExperience({
        commitHash: 'abc123',
        experienceId: 'exp-1',
        linkType: 'caused',
        confidence: 0.9
      });

      const links = gitIntegration.getExperienceLinks('abc123');
      expect(links).toHaveLength(1);
      expect(links[0].experienceId).toBe('exp-1');
    });

    it('应该关联提交与反思', () => {
      gitIntegration.linkReflection({
        commitHash: 'abc123',
        reflectionId: 'ref-1',
        insights: ['Test insight'],
        actionItems: ['Fix the issue']
      });

      const links = gitIntegration.getReflectionLinks('abc123');
      expect(links).toHaveLength(1);
      expect(links[0].reflectionId).toBe('ref-1');
    });

    it('应该查找相关提交', async () => {
      gitIntegration.linkExperience({
        commitHash: 'abc123',
        experienceId: 'exp-1',
        linkType: 'caused',
        confidence: 0.9
      });

      gitIntegration.linkExperience({
        commitHash: 'def456',
        experienceId: 'exp-1',
        linkType: 'resolved',
        confidence: 0.8
      });

      const related = await gitIntegration.findRelatedCommits('exp-1');
      expect(related).toContain('abc123');
      expect(related).toContain('def456');
    });
  });

  describe('代码健康度', () => {
    beforeEach(async () => {
      gitIntegration = new GitIntegration(config);
      await gitIntegration.init();
    });

    it('应该评估代码健康度', async () => {
      const health = await gitIntegration.assessCodeHealth();

      expect(health).toBeDefined();
      expect(health.score).toBeGreaterThanOrEqual(0);
      expect(health.score).toBeLessThanOrEqual(100);
      expect(health.issues).toBeDefined();
      expect(health.recommendations).toBeDefined();
    });
  });

  describe('缓存管理', () => {
    beforeEach(async () => {
      gitIntegration = new GitIntegration(config);
      await gitIntegration.init();
    });

    it('应该清除缓存', () => {
      expect(() => gitIntegration.clearCache()).not.toThrow();
    });
  });

  describe('销毁', () => {
    it('应该销毁实例', async () => {
      gitIntegration = new GitIntegration(config);
      await gitIntegration.init();

      // 添加一些关联
      gitIntegration.linkExperience({
        commitHash: 'abc123',
        experienceId: 'exp-1',
        linkType: 'caused',
        confidence: 0.9
      });

      expect(() => gitIntegration.destroy()).not.toThrow();
    });
  });
});

describe('GitClient', () => {
  let client: GitClient;

  beforeEach(() => {
    client = new GitClient('/test/repo');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('初始化', () => {
    it('应该创建 GitClient 实例', () => {
      expect(client).toBeInstanceOf(GitClient);
    });

    it('应该初始化成功', async () => {
      vi.spyOn(client as any, 'isGitRepo').mockResolvedValue(true);
      vi.spyOn(client, 'getGitVersion').mockResolvedValue('git version 2.0.0');

      const success = await client.init();
      expect(success).toBe(true);
    });
  });
});

describe('CommitAnalyzer', () => {
  let analyzer: CommitAnalyzer;
  let mockClient: GitClient;

  beforeEach(() => {
    mockClient = new GitClient('/test/repo');
    analyzer = new CommitAnalyzer(mockClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('分析功能', () => {
    it('应该评估提交质量', () => {
      const commits: GitCommit[] = [
        {
          hash: 'abc',
          shortHash: 'abc',
          author: 'Test',
          authorEmail: 'test@example.com',
          committer: 'Test',
          committerEmail: 'test@example.com',
          message: 'Add feature',
          summary: 'Add feature',
          body: 'Detailed description',
          timestamp: Date.now() / 1000,
          date: new Date(),
          files: ['file1.ts'],
          stats: { total: 1, additions: 50, deletions: 0, changes: 50 }
        }
      ];

      const quality = analyzer.assessCommitQuality(commits);
      expect(quality).toBeDefined();
      expect(quality.score).toBeGreaterThanOrEqual(0);
      expect(quality.issues).toBeDefined();
      expect(quality.suggestions).toBeDefined();
    });

    it('应该清除缓存', () => {
      expect(() => analyzer.clearCache()).not.toThrow();
    });
  });
});

describe('ChangeExtractor', () => {
  let extractor: ChangeExtractor;
  let mockClient: GitClient;

  beforeEach(() => {
    mockClient = new GitClient('/test/repo');
    extractor = new ChangeExtractor(mockClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('提取功能', () => {
    it('应该检测代码文件', () => {
      expect(extractor['isCodeFile']('test.ts')).toBe(true);
      expect(extractor['isCodeFile']('test.js')).toBe(true);
      expect(extractor['isCodeFile']('test.py')).toBe(true);
      expect(extractor['isCodeFile']('test.md')).toBe(false);
      expect(extractor['isCodeFile']('test.txt')).toBe(false);
    });

    it('应该检测文件语言', () => {
      expect(extractor['detectLanguage']('test.ts')).toBe('typescript');
      expect(extractor['detectLanguage']('test.js')).toBe('javascript');
      expect(extractor['detectLanguage']('test.py')).toBe('python');
      expect(extractor['detectLanguage']('test.md')).toBeNull();
    });

    it('应该分类变更', () => {
      const changes = [
        { file: 'test.test.ts', type: 'modify' as const, addedLines: [], removedLines: [], description: '' },
        { file: 'config.json', type: 'modify' as const, addedLines: [], removedLines: [], description: '' },
        { file: 'src/api.ts', type: 'modify' as const, addedLines: ['fix bug'], removedLines: [], description: '' }
      ];

      const categories = extractor.categorizeChanges(changes);
      expect(categories.test).toHaveLength(1);
      expect(categories.config).toHaveLength(1);
    });
  });
});
