# EvoAgent

自主进化编码Agent系统

## 核心理念

```
用户输入一句话 → EvoAgent 自动完成 → 交付可运行代码
```

**零交互原则**：不问用户技术问题，系统自动做最佳决策。

## 核心特性

1. **自主规划引擎**：根据任务特点自动选择最适合的执行模式
2. **三层记忆系统**：Session（短期对话）+ Knowledge（结构化知识）+ Memory（向量检索）
3. **双轨进化机制**：实时经验收集 + 定期反思提炼
4. **零交互交付**：用户输入需求 → Agent自主完成 → 交付可运行代码

## 目录结构

```
evoagent/
├── src/                    # 源代码
│   ├── core/               # 核心基础设施
│   │   ├── config/         # 配置管理
│   │   ├── logger/         # 日志系统
│   │   ├── llm/            # LLM服务
│   │   └── database/       # 数据库抽象
│   ├── agent/              # Agent实现
│   │   ├── base/           # Agent基类
│   │   ├── planner/        # Planner
│   │   ├── orchestrator/   # Orchestrator
│   │   └── specialists/    # 专项Agent
│   ├── memory/             # 记忆系统
│   ├── evolution/          # 进化系统
│   ├── communication/      # A2A通信
│   ├── queue/              # 队列系统
│   ├── tools/              # 工具实现
│   ├── observability/      # 可观测性
│   └── cli/                # 命令行入口
│
├── tests/                  # 测试
├── prompts/                # Prompt模板
├── docs/                   # 文档
│   ├── design.md           # 设计文档
│   └── implementation-plan.md  # 实施计划
│
├── package.json
├── tsconfig.json
├── evoagent.config.json
└── README.md
```

## 快速开始

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 启动开发模式
npm run dev

# 执行任务
npm run execute "实现一个快速排序算法"

# 启动服务器
npm run serve

# 系统诊断
npm run doctor
```

## 配置

创建 `evoagent.config.json` 文件：

```json
{
  "server": {
    "port": 18790,
    "host": "localhost"
  },
  "agent": {
    "maxConcurrent": 3,
    "timeout": 300000
  },
  "llm": {
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "apiKey": "sk-ant-...",
    "maxTokens": 8192,
    "temperature": 0.7
  },
  "log": {
    "level": "info",
    "format": "json"
  },
  "evolution": {
    "enabled": true,
    "reflectionSchedule": "0 2 * * *",
    "minSessionsForReflection": 10
  }
}
```

## 命令

| 命令 | 说明 |
|------|------|
| `evoagent init` | 初始化配置文件 |
| `evoagent execute <task>` | 执行任务 |
| `evoagent serve` | 启动HTTP服务器 |
| `evoagent reflect` | 运行反思分析 |
| `evoagent knowledge <action>` | 知识库管理 |
| `evoagent doctor` | 系统健康诊断 |

## 环境变量

| 变量 | 说明 |
|------|------|
| `EVOAGENT_PORT` | 服务器端口 |
| `EVOAGENT_LOG_LEVEL` | 日志级别 (debug/info/warn/error) |
| `ANTHROPIC_API_KEY` | Anthropic API密钥 |
| `EVOAGENT_LLM_MODEL` | LLM模型名称 |

## 开发

```bash
# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 自动修复代码
npm run lint:fix

# 格式化代码
npm run format

# 构建项目
npm run build

# 监听模式构建
npm run build:watch
```

## 执行模式

| 模式 | 描述 | 适用场景 |
|------|------|----------|
| **A** | 单一Agent | <300行代码，<3个文件 |
| **B** | 主从模式 | 300-1000行，需要专业审查 |
| **C** | 并行协作 | 多个独立模块，可并行开发 |
| **D** | 分层架构 | >1000行，需要架构设计 |

## 记忆系统

- **Session (.jsonl)**: 短期对话上下文，保留7天（可配置）
- **Knowledge (.md)**: 结构化知识库（坑点、模式、决策、解决方案）
- **Memory (Vector DB)**: 语义检索历史经验

## 进化机制

- **实时收集**：监听Agent lifecycle事件，自动提取经验
- **定期反思**：每7天或每10个session，触发Reflector Agent分析
- **自动优化**：根据发现的经验自动优化System Prompt

## License

MIT
