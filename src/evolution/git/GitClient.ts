/**
 * Git Client
 *
 * 封装 Git 操作，提供类型安全的 API
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { getLogger } from '../../core/logger/index.js';
import type {
  GitCommit,
  GitBranch,
  GitStatus,
  GitDiff,
  GitFileChange,
  GitFileStatus,
  GitLogOptions,
  GitFileStats
} from './GitIntegrationTypes.js';

const execAsync = promisify(exec);
const logger = getLogger('evolution:git:client');

/**
 * GitClient - Git 操作封装类
 */
export class GitClient {
  private repoPath: string;
  private gitPath: string;
  private initialized: boolean = false;

  constructor(repoPath: string, gitPath: string = 'git') {
    this.repoPath = repoPath;
    this.gitPath = gitPath;
  }

  /**
   * 初始化客户端，验证仓库是否有效
   */
  async init(): Promise<boolean> {
    try {
      const isValid = await this.isGitRepo();
      if (!isValid) {
        logger.error(`Not a valid Git repository: ${this.repoPath}`);
        return false;
      }

      // 验证 Git 可用
      const version = await this.getGitVersion();
      logger.debug(`Git version: ${version}`);

      this.initialized = true;
      logger.info('GitClient initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize GitClient:', error);
      return false;
    }
  }

  /**
   * 获取 Git 版本
   */
  async getGitVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync(`${this.gitPath} --version`);
      return stdout.trim();
    } catch {
      throw new Error('Git is not available');
    }
  }

  /**
   * 检查是否是 Git 仓库
   */
  async isGitRepo(): Promise<boolean> {
    try {
      const gitDir = join(this.repoPath, '.git');
      await access(gitDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取当前分支
   */
  async getCurrentBranch(): Promise<string> {
    this.ensureInitialized();
    try {
      const { stdout } = await this.exec(['rev-parse', '--abbrev-ref', 'HEAD']);
      return stdout.trim();
    } catch (error) {
      logger.error('Failed to get current branch:', error);
      throw new Error('Failed to get current branch');
    }
  }

  /**
   * 获取所有分支
   */
  async getBranches(): Promise<GitBranch[]> {
    this.ensureInitialized();
    try {
      const current = await this.getCurrentBranch();
      const { stdout } = await this.exec(['branch', '-vv', '--list']);

      const branches: GitBranch[] = [];
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        const match = line.match(/^[\* ]\s+(\S+)\s+([a-f0-9]+)\s*(.*)$/);
        if (match) {
          const [, name, commit, tracking] = match;
          branches.push({
            name: name || '',
            current: name === current,
            commit: commit || '',
            tracked: tracking ? tracking.replace(/[\[\]]/g, '') : undefined
          });
        }
      }

      return branches;
    } catch (error) {
      logger.error('Failed to get branches:', error);
      return [];
    }
  }

  /**
   * 获取仓库状态
   */
  async getStatus(): Promise<GitStatus> {
    this.ensureInitialized();
    try {
      const branch = await this.getCurrentBranch();

      // 获取 upstream 信息
      let upstream: string | undefined;
      let ahead = 0;
      let behind = 0;

      try {
        const { stdout: revParse } = await this.exec(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
        upstream = revParse.trim();

        const { stdout: count } = await this.exec(['rev-list', '--left-right', '--count', `HEAD...${upstream!}`]);
        const parts = count.trim().split('\t');
        behind = parseInt(parts[0] || '0') || 0;
        ahead = parseInt(parts[1] || '0') || 0;
      } catch {
        // 没有 upstream 或其他问题，忽略
      }

      // 获取文件状态
      const { stdout: statusOut } = await this.exec(['status', '--porcelain=v1']);

      const staged: GitFileChange[] = [];
      const unstaged: GitFileChange[] = [];
      const untracked: string[] = [];
      const conflicted: string[] = [];

      const lines = statusOut.trim().split('\n');
      for (const line of lines) {
        if (!line) continue;

        const status = line.substring(0, 2);
        const path = line.substring(3);

        if (status === '??') {
          untracked.push(path);
        } else if (status === 'UU' || status === 'AA' || status === 'DD') {
          conflicted.push(path);
        } else {
          const indexStatus = status[0];
          const workTreeStatus = status[1];

          if (indexStatus && indexStatus !== ' ' && indexStatus !== '?') {
            staged.push({
              path,
              status: this.parseStatus(indexStatus),
              additions: 0,
              deletions: 0
            });
          }

          if (workTreeStatus && workTreeStatus !== ' ' && workTreeStatus !== '?') {
            unstaged.push({
              path,
              status: this.parseStatus(workTreeStatus),
              additions: 0,
              deletions: 0
            });
          }
        }
      }

      return {
        branch,
        upstream,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
        conflicted
      };
    } catch (error) {
      logger.error('Failed to get status:', error);
      throw new Error('Failed to get repository status');
    }
  }

  /**
   * 获取提交历史
   */
  async getLog(options: GitLogOptions = {}): Promise<GitCommit[]> {
    this.ensureInitialized();

    const args = [
      'log',
      '--pretty=format:%H|%h|%an|%ae|%cn|%ce|%ct|%s|%b',
      '--numstat',
      '--name-only'
    ];

    if (options.limit) {
      args.push(`-${options.limit}`);
    }

    if (options.since) {
      const since = typeof options.since === 'string' ? options.since : options.since.toISOString();
      args.push(`--since="${since}"`);
    }

    if (options.until) {
      const until = typeof options.until === 'string' ? options.until : options.until.toISOString();
      args.push(`--until="${until}"`);
    }

    if (options.author) {
      args.push(`--author="${options.author}"`);
    }

    if (options.branch) {
      args.push(options.branch);
    }

    if (options.path) {
      args.push('--', options.path);
    }

    try {
      const { stdout } = await this.exec(args);
      return this.parseLogOutput(stdout);
    } catch (error) {
      logger.error('Failed to get log:', error);
      return [];
    }
  }

  /**
   * 获取单个提交详情
   */
  async getCommit(hash: string): Promise<GitCommit | null> {
    this.ensureInitialized();

    try {
      const { stdout } = await this.exec([
        'show',
        '--pretty=format:%H|%h|%an|%ae|%cn|%ce|%ct|%s|%b',
        '--numstat',
        '--name-only',
        hash
      ]);

      const commits = this.parseLogOutput(stdout);
      return commits[0] || null;
    } catch (error) {
      logger.error(`Failed to get commit ${hash}:`, error);
      return null;
    }
  }

  /**
   * 获取两个提交之间的差异
   */
  async getDiff(from: string, to?: string): Promise<GitDiff> {
    this.ensureInitialized();

    const revision = to ? `${from}..${to}` : from;

    try {
      const { stdout } = await this.exec(['diff', '--numstat', revision]);

      const files: GitFileChange[] = [];
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        const match = line.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);
        if (match) {
          const [, add, del, path] = match;
          files.push({
            path: path || '',
            status: 'modified',
            additions: add === '-' ? 0 : parseInt(add || '0'),
            deletions: del === '-' ? 0 : parseInt(del || '0')
          });
        }
      }

      return {
        from,
        to: to || 'HEAD',
        files,
        summary: `${files.length} files changed`
      };
    } catch (error) {
      logger.error('Failed to get diff:', error);
      return {
        from,
        to: to || 'HEAD',
        files: [],
        summary: 'Failed to get diff'
      };
    }
  }

  /**
   * 获取文件差异
   */
  async getFileDiff(path: string, from?: string, to?: string): Promise<string> {
    this.ensureInitialized();

    const revision = from && to ? `${from}..${to}` : from || 'HEAD';

    try {
      const { stdout } = await this.exec(['diff', revision, '--', path]);
      return stdout;
    } catch (error) {
      logger.error(`Failed to get diff for ${path}:`, error);
      return '';
    }
  }

  /**
   * 获取文件内容
   */
  async getFileContent(path: string, revision: string = 'HEAD'): Promise<string> {
    this.ensureInitialized();

    try {
      const { stdout } = await this.exec(['show', `${revision}:${path}`]);
      return stdout;
    } catch (error) {
      logger.error(`Failed to get content for ${path} at ${revision}:`, error);
      return '';
    }
  }

  /**
   * 克隆仓库
   */
  static async clone(url: string, targetPath: string, options: {
    depth?: number;
    branch?: string;
    singleBranch?: boolean;
  } = {}): Promise<boolean> {
    const args = ['clone'];

    if (options.depth) {
      args.push(`--depth=${options.depth}`);
    }

    if (options.singleBranch) {
      args.push('--single-branch');
    }

    if (options.branch) {
      args.push('--branch', options.branch);
    }

    args.push(url, targetPath);

    try {
      await execAsync(`git ${args.join(' ')}`);
      logger.info(`Cloned repository to ${targetPath}`);
      return true;
    } catch (error) {
      logger.error('Failed to clone repository:', error);
      return false;
    }
  }

  /**
   * 拉取更新
   */
  async pull(remote: string = 'origin', branch?: string): Promise<boolean> {
    this.ensureInitialized();

    const args = ['pull', remote];
    if (branch) {
      args.push(branch);
    }

    try {
      await this.exec(args);
      logger.info('Pulled updates from remote');
      return true;
    } catch (error) {
      logger.error('Failed to pull:', error);
      return false;
    }
  }

  /**
   * 推送变更
   */
  async push(remote: string = 'origin', branch?: string): Promise<boolean> {
    this.ensureInitialized();

    const args = ['push', remote];
    if (branch) {
      args.push(branch);
    }

    try {
      await this.exec(args);
      logger.info('Pushed changes to remote');
      return true;
    } catch (error) {
      logger.error('Failed to push:', error);
      return false;
    }
  }

  /**
   * 解析日志输出
   */
  private parseLogOutput(output: string): GitCommit[] {
    const commits: GitCommit[] = [];
    const lines = output.split('\n');

    let currentCommit: Partial<GitCommit> | null = null;
    let files: string[] = [];
    let stats: GitFileStats | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // 提交信息行
      if (line.includes('|') && /^[a-f0-9]{40}/.test(line)) {
        // 保存上一个提交
        if (currentCommit && currentCommit.hash) {
          commits.push({
            ...currentCommit,
            files,
            stats: stats || undefined
          } as GitCommit);
        }

        const parts = line.split('|');
        currentCommit = {
          hash: parts[0] || '',
          shortHash: parts[1] || '',
          author: parts[2] || '',
          authorEmail: parts[3] || '',
          committer: parts[4] || '',
          committerEmail: parts[5] || '',
          timestamp: parseInt(parts[6] || '0'),
          date: new Date(parseInt(parts[6] || '0') * 1000),
          summary: parts[7] || '',
          message: (parts[7] || '') + (parts[8] ? '\n' + parts[8].trim() : ''),
          body: parts[8] || ''
        };
        files = [];
        stats = { total: 0, additions: 0, deletions: 0, changes: 0 };
      }
      // 统计信息行
      else if (/^\d+\s+\d+/.test(line)) {
        const [add, del] = line.split('\t');
        const additions = add === '-' ? 0 : parseInt(add || '0');
        const deletions = del === '-' ? 0 : parseInt(del || '0');

        if (stats) {
          stats.total++;
          stats.additions += additions;
          stats.deletions += deletions;
          stats.changes += additions + deletions;
        }
      }
      // 文件名行
      else if (line && !line.includes('|') && !/^\d+\s+\d+/.test(line)) {
        files.push(line);
      }
    }

    // 保存最后一个提交
    if (currentCommit && currentCommit.hash) {
      commits.push({
        ...currentCommit,
        files,
        stats: stats || undefined
      } as GitCommit);
    }

    return commits;
  }

  /**
   * 解析文件状态字符
   */
  private parseStatus(char: string): GitFileStatus {
    const statusMap: Record<string, GitFileStatus> = {
      'M': 'modified',
      'A': 'added',
      'D': 'deleted',
      'R': 'renamed',
      'C': 'copied',
      'U': 'unmerged'
    };
    return statusMap[char] || 'unknown';
  }

  /**
   * 执行 Git 命令
   */
  private async exec(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const cmd = `${this.gitPath} ${args.join(' ')}`;
    const options = {
      cwd: this.repoPath,
      env: { ...process.env }
    };

    return execAsync(cmd, options);
  }

  /**
   * 确保客户端已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('GitClient not initialized. Call init() first.');
    }
  }
}
