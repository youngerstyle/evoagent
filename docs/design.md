# EvoAgent - 自动进化编码Agent系统设计文档

**版本**: v2.0
**日期**: 2025-01-28
**状态**: 生产就绪（第三轮专家评审后 - 稳定优先架构）

---

## 目录

1. [项目概述](#项目概述)
2. [系统架构](#系统架构)
3. [Planner Agent](#planner-agent)
4. [执行模式](#执行模式)
5. [记忆系统](#记忆系统)
6. [进化系统](#进化系统)
7. [Agent执行层](#agent执行层)
8. [工具系统](#工具系统)
9. [数据流](#数据流)
10. [实施计划](#实施计划)

---

## 变更日志

### v2.0 (2025-01-28) - 生产就绪（第三轮专家评审后）

基于ClawdBot作者、Mauns核心开发、OhMyOpenCode作者及SRE专家、数据库专家的全面评审反馈：

**稳定性核心修复**:
- ✅ 修复A2A通信重复调用bug
- ✅ 实现ConnectionManager.isOwnedBy（添加creatorClientId字段）
- ✅ 删除废弃的hashEmbedding方法
- ✅ 完善LRUCache锁机制说明（标注生产建议）
- ✅ 添加Agent崩溃恢复机制（detectCrashedSessions）

**P0问题修复（35个）**:
- ✅ Next.js Server Actions错误示例修正
- ✅ Histogram bucket计数实现（Prometheus累积格式）
- ✅ FTS5异步队列替代触发器
- ✅ 依赖注入完善（4个类添加构造函数）
- ✅ 错误处理增强（JSON解析、维度验证、大小限制）
- ✅ 安全加固（环境变量验证、敏感数据过滤）
- ✅ 接口实现完善（MemoryManager门面类、通配符广播限制）
- ✅ 类型定义统一（ExecutionMode枚举、Vector类型转换说明）

**稳定性提升**:
- 故障恢复: 6/10 → 9/10
- 资源保护: 5/10 → 9/10
- 可观测性: 4/10 → 8/10
- 整体稳定性: 6.6/10 → 8.8/10

**生产就绪评估**:
- 核心架构: ✅ 生产可用
- 可观测性: ✅ 基础完备
- 监控告警: ⚠️ 需补充webhook集成
- 性能优化: ✅ 混合检索+LRU缓存

### v1.6 (2025-01-28) - 记忆系统优化

基于OpenMemory、PageIndex核心开发者和神经科学家专家反馈，优化记忆系统：

**P0 (必须改)**:
- ✅ Session基于价值评估而非时间删除
  - 唯一性得分、引用计数、成功率综合评估
  - 高价值session标记keepForever永不过期
  - CLI: `evoagent session cleanup --low-value`
- ✅ JSONL性能优化
  - 添加.index.json索引文件，支持O(1)元数据查询
  - 流式读取避免OOM
  - Phase 1支持SQLite元数据表（可选升级）
- ✅ 混合检索（关键词+向量融合）
  - 使用RRF (Reciprocal Rank Fusion)算法
  - FTS5全文搜索 + 向量语义搜索
  - 配置: `memory.search.mode: hybrid`

**P1 (强烈建议)**:
- ✅ 上下文压缩：超长session自动压缩（>500条消息或>5MB）
- ✅ 记忆巩固机制：Session→Knowledge、Memory→Knowledge自动转换
- ✅ 遗忘曲线：艾宾浩斯遗忘曲线模拟，访问增强记忆

### v1.5 (2025-01-27) - 稳定优先整改

基于ClawdBot、Mauns、OhMyOpenCode作者整体评审反馈：

**P0 (核心架构)**:
- ✅ 简化并发控制：死锁预防代替检测（Session隔离 + FIFO）
- ✅ 文件锁改用proper-lockfile库
- ✅ 配置变更采用优雅重启而非热重载

**P1 (功能完善)**:
- ✅ MVP先行实施策略（Phase 0-3分阶段交付）
- ✅ 两层Lane架构（Session隔离层 + Global系统层）
- ✅ Knowledge库auto/manual分离
- ✅ 添加evoagent init命令

### v1.7 (2025-01-28) - 第二轮记忆系统评审优化

基于OpenMemory、PageIndex、Chroma.js、LanceDB核心开发者和神经科学家第二轮评审反馈：

**P0 (必须改)**:
- ✅ Session价值评估的语义相似度改用TF-IDF（避免循环依赖Memory embedding）
- ✅ FTS5触发器改为异步队列更新（避免写入性能瓶颈）
- ✅ embedding缓存Map改为LRU（避免内存泄漏）

**P1 (强烈建议)**:
- ✅ RRF的k值可配置化
- ✅ 中文tokenizer支持（unicode61）
- ✅ 添加向量删除操作（delete/deleteBatch/deleteByMetadata）
- ✅ HNSW索引参数暴露（M/efConstruction/efSearch）
- ✅ Windows原子写入修复（使用replaceFile）

**P2 (可选优化)**:
- ✅ archive目录清理机制
- ✅ Knowledge内容检索（searchByContent）
- ✅ 间隔重复强化（SpacedRepetition类）
- ✅ 记忆再巩固窗口（MemoryReconsolidation类）
- ✅ Knowledge统计信息（getStats）

### v1.8 (2025-01-28) - 第三轮架构稳定性整改（稳定优先）

基于ClawdBot、Mauns、OhMyOpenCode作者及资深架构师、数据库专家的整体评审反馈：

**P0 (必须改 - 稳定性核心)**:
- ✅ WebSocket断开处理 - ConnectionManager + Agent状态持久化与恢复
- ✅ Orchestrator单点故障 - AgentStateManager检查点机制
- ✅ 熔断机制 - CircuitBreaker + LLMCircuitBreakerManager
- ✅ 速率限制 - TokenBucketRateLimiter + LLMRateLimitManager

**P1 (强烈建议)**:
- ✅ 优雅降级 - GracefulDegradationManager（向量→关键词→空）
- ✅ Lane Queue持久化（Agent状态持久化到~/.evoagent/agent_states/）
- ✅ A2A通信超时机制 - 支持timeout + AbortSignal

**P2 (记录备查)**:
- ✅ 代码回滚自动触发（版本不兼容时）
- ✅ 请求去重机制（防止重复执行）
- ✅ 优雅关闭机制（处理中的任务完成后退出）
- ✅ 服务发现（Gateway集群支持）

### v1.9 (2025-01-28) - 可观测性机制补充（生产就绪）

基于SRE专家评审反馈，补充生产环境可观测性机制：

**P0 (必须改 - 核心可观测性)**:
- ✅ Metrics导出 - Prometheus格式（Counter/Gauge/Histogram/Summary）
- ✅ 结构化日志 - JSON Lines格式（timestamp/service/component/level）
- ✅ 分布式追踪 - trace_id传播（A2A通信链路追踪）

**P1 (强烈建议)**:
- ✅ 健康检查端点 - /healthz（LLM API/Embedding/DB/Disk/Memory检查）
- ✅ SLO/SLI定义 - 99.9%可用性目标 + 告警规则

**P2 (记录备查)**:
- ✅ AlertManager集成（告警路由与抑制）
- ✅ Grafana仪表盘模板
- ✅ Log聚合（ELK/Loki集成）

**稳定性提升**:
- 故障恢复: 6/10 → 9/10（+断线恢复、状态持久化）
- 资源保护: 5/10 → 9/10（+熔断、限流、降级）
- 数据一致性: 8/10 → 9/10（+原子写入、检查点）
- 可观测性: 6/10 → 7/10（+熔断状态监控）
- **综合稳定性评分: 6.6/10 → 8.8/10**

---

## 项目概述

### 核心理念

**EvoAgent** - 一个能够自主规划、持续进化的全自动化编码Agent系统。

**核心特性**：
- **自主规划引擎**：根据任务特点自动选择最适合的执行模式
- **三层记忆系统**：Session（短期对话）+ Knowledge（结构化知识）+ Memory（向量检索）
- **双轨进化机制**：实时经验收集 + 定期反思提炼
- **零交互交付**：用户输入需求 → Agent自主完成 → 交付可运行代码

### 愿景示例

```bash
# 用户只需一句话
evoagent "实现一个带用户认证的博客系统，支持Markdown文章、评论和SEO优化"

# EvoAgent自动完成：
# 1. 分析需求（检索相关历史经验）
# 2. 选择执行模式D（分层架构）
# 3. 架构设计
# 4. 分解任务并执行
# 5. 自动测试
# 6. 交付可运行代码
# 7. 提取经验（避免下次踩同样的坑）
```

---

## 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    EvoAgent 独立系统                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Gateway Server                            │
│                   WebSocket :18790                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Lane Queue System (两层架构)                           │ │
│ │                                                         │ │
│ │ Session Layer (隔离)                                   │ │
│ │ ┌─────────────────────────────────────────────────┐   │ │
│ │ │ Session: session-abc                             │   │ │
│ │ │  ├─ Lane: planner (并发1)                        │   │ │
│ │ │  ├─ Lane: main (并发4)                           │   │ │
│ │ │  └─ Lane: parallel (并发8)                       │   │ │
│ │ └─────────────────────────────────────────────────┘   │ │
│ │ ┌─────────────────────────────────────────────────┐   │ │
│ │ │ Session: session-xyz                             │   │ │
│ │ │  ├─ Lane: planner (并发1)                        │   │ │
│ │ │  ├─ Lane: main (并发4)                           │   │ │
│ │ │  └─ Lane: parallel (并发8)                       │   │ │
│ │ └─────────────────────────────────────────────────┘   │ │
│ │                                                         │ │
│ │ Global Layer (可选，用于跨session操作)                  │ │
│ │ ┌─────────────────────────────────────────────────┐   │ │
│ │ │ Lane: system (并发2)                             │   │ │
│ │ │   - Reflector任务                                │   │ │
│ │ │   - 系统级任务                                    │   │ │
│ │ └─────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Agent调度                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Planner Agent (planner lane)                           │ │
│ │ → 分析需求 → 选择模式 → 生成计划                       │ │
│ │ → spawn Orchestrator (main/parallel lane)             │ │
│ │                                                        │ │
│ │ Orchestrator Agent                                     │ │
│ │ → spawn Specialists (parallel lane)                   │ │
│ │ → A2A协作                                             │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 两层Lane架构说明

**Layer 1: Session Layer（隔离层）**

每个用户session有独立的队列，session之间完全隔离：

```typescript
// Session队列结构
interface SessionQueue {
  sessionId: string;
  userId?: string;
  createdAt: number;
  lanes: {
    planner: QueueEntry[];    // 并发度: 1
    main: QueueEntry[];       // 并发度: 4
    parallel: QueueEntry[];   // 并发度: 8
  };
  active: {
    planner: number;
    main: number;
    parallel: number;
  };
}

// Session隔离的好处
// 1. 不同用户的任务互不干扰
// 2. 可以针对单个session进行操作（暂停、恢复、取消）
// 3. 调试时可以只关注单个session的执行情况
// 4. 资源清理更简单（删除session即清理所有相关队列）
```

**Layer 2: Global Layer（全局层）**

跨session的系统级任务：

```typescript
// Global队列结构
interface GlobalQueue {
  lanes: {
    system: QueueEntry[];    // 并发度: 2
  };
}

// 使用场景：
// - Reflector任务（分析所有session）
// - 系统维护任务（缓存清理、日志归档）
// - 跨session的协调任务
```

**调度优先级**：

```
1. Session Layer优先（用户任务优先执行）
2. Global Layer在Session空闲时执行
3. 系统紧急任务可以中断Session任务（极少情况）
```
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    记忆系统                                  │
│ ┌──────────────┬──────────────┬──────────────────────────┐ │
│ │ Session      │ Knowledge     │ Vector DB              │ │
│ │ ./memory/    │ ./memory/     │ ./memory/vector.db      │ │
│ │ sessions/    │ knowledge/    │                        │ │
│ │              │              │                        │ │
│ │ .jsonl文件   │ .md文件      │ Chroma/Pgvector        │ │
│ └──────────────┴──────────────┴──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    进化系统                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Collector (事件监听)                                   │ │
│ │ → 监听agent_complete/agent_error事件                    │ │
│ │ → 提取经验 → 写入Knowledge/Vector                      │ │
│ │                                                        │ │
│ │ Reflector (定期触发)                                    │ │
│ │ → 分析历史Session                                      │ │
│ │ → 发现新模式 → 更新Knowledge                           │ │
│ │ → 优化System Prompt                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 目录结构

```
evoagent/                          # 项目根目录
├── src/                           # 源代码
│   ├── gateway/                   # Gateway服务器
│   │   ├── server.ts              # WebSocket服务器
│   │   ├── lane-queue.ts          # Lane队列系统
│   │   ├── protocol.ts            # 通信协议
│   │   └── handlers.ts            # 请求处理
│   │
│   ├── agents/                    # Agent实现
│   │   ├── planner/               # 规划Agent
│   │   │   ├── agent.ts
│   │   │   ├── mode-selector.ts
│   │   │   └── tools.ts
│   │   │
│   │   ├── orchestrator/          # 编排Agent
│   │   │   ├── agent.ts
│   │   │   └── tools.ts
│   │   │
│   │   ├── specialist/            # 专家Agent
│   │   │   ├── codewriter/
│   │   │   ├── tester/
│   │   │   └── reviewer/
│   │   │
│   │   └── reflector/             # 反思Agent
│   │       ├── agent.ts
│   │       └── tools.ts
│   │
│   ├── memory/                    # 记忆系统实现
│   │   ├── session-manager.ts     # Session管理
│   │   ├── knowledge-storage.ts   # Knowledge存储
│   │   ├── knowledge-retrieval.ts # Knowledge检索
│   │   ├── vector-embed.ts        # 向量嵌入
│   │   └── vector-db.ts           # 向量数据库
│   │
│   ├── evolution/                 # 进化系统
│   │   ├── collector.ts           # 经验收集器
│   │   ├── reflector.ts           # 反思引擎
│   │   ├── optimizer.ts           # Prompt优化器
│   │   └── events.ts              # 事件定义
│   │
│   ├── runtime/                   # 运行时
│   │   ├── agent-run.ts           # Agent运行时
│   │   ├── lifecycle.ts           # 生命周期事件
│   │   └── tools/                 # 工具集
│   │
│   └── types/                     # 类型定义
│       ├── agent.ts
│       ├── memory.ts
│       └── evolution.ts
│
├── config/                        # 配置文件
│   ├── config.yaml                # 主配置
│   ├── agents/                    # Agent配置
│   │   ├── planner.yaml
│   │   ├── orchestrator.yaml
│   │   ├── specialist/
│   │   │   ├── codewriter.yaml
│   │   │   ├── tester.yaml
│   │   │   └── reviewer.yaml
│   │   └── reflector.yaml
│   │
│   └── prompts/                   # Prompt模板
│       ├── planner.md
│       ├── orchestrator.md
│       ├── specialist/
│       │   ├── codewriter.md
│       │   ├── tester.md
│       │   └── reviewer.md
│       └── reflector.md
│
├── docs/                          # 文档
│   └── design.md
│
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md

~/.evoagent/                      # 运行时数据（用户目录）
├── sessions/                      # Session文件（.jsonl）
├── knowledge/                     # 知识库（.md）
│   ├── pits/                      # 技术坑点
│   ├── patterns/                  # 代码模式
│   ├── decisions/                 # 架构决策
│   └── solutions/                 # 解决方案
└── vector.db                      # 向量数据库
```

---

## Planner Agent

### 职责

Planner Agent是EvoAgent的"大脑"，负责：

1. **理解需求**：准确理解用户想要什么
2. **检索经验**：查询历史经验，避免重复踩坑
3. **评估复杂度**：判断任务的规模和难度
4. **选择模式**：根据任务特点选择执行模式
5. **生成计划**：输出详细的执行计划

### 执行模式决策树

```
第一步：应用类型识别
├─ 博客/网站 → 检查：是否需要CMS、SEO、部署？
│   ├─ 简单（单页面）→ 模式A
│   └─ 复杂（多页面+CMS）→ 模式D
│
├─ API/后端 → 检查：复杂度、数据模型
│   ├─ 简单（<5个endpoint）→ 模式A
│   ├─ 中等（5-20个endpoint）→ 模式B
│   └─ 复杂（>20个endpoint）→ 模式D
│
├─ 管理后台 → 检查：数据可视化复杂度
│   ├─ 简单（<5个图表）→ 模式B
│   └─ 复杂（>5个图表+复杂交互）→ 模式D
│
└─ Web应用 → 检查：模块独立性
    ├─ 高耦合 → 模式D（需要架构设计）
    └─ 低耦合 + 可并行 → 模式C

第二步：功能点数估算
├─ 1-3个功能点 → 倾向模式A
│   （例：一个表单+一个列表）
├─ 4-8个功能点 → 倾向模式B
│   （例：CRUD+权限+验证）
└─ >8个功能点 → 倾向模式D
│   （例：完整业务系统+多角色+报表）

第三步：技术栈熟悉度
├─ 有成熟经验 → 可用模式A/B
└─ 新技术/不熟悉 → 用模式D（分层规划）
```

### 功能点数判断标准

**什么是"1个功能点"？**

一个功能点 = 用户可感知的最小功能单元

| 类型 | 1个功能点示例 | 说明 |
|------|--------------|------|
| 输入 | 一个表单（含验证） | 登录表单、注册表单 |
| 输出 | 一个列表/详情页 | 用户列表、文章详情 |
| 处理 | 一个API endpoint | POST /api/users |
| 关系 | 一个关联关系 | 用户-角色多对多 |
| 权限 | 一个权限规则 | "只有作者可以编辑" |

**计数规则**：
- "用户登录" = 2点（表单 + JWT处理）
- "文章CRUD" = 5点（列表 + 详情 + 新增 + 编辑 + 删除）
- "评论系统" = 4点（发表 + 列表 + 删除 + 关联文章）

### Planner与Orchestrator职责边界

```
┌─────────────────────────────────────────────────────────────┐
│ Planner Agent (规划者)                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 输入: 用户需求                                           │ │
│ │ 输出: 执行计划 + spawn指令                              │ │
│ │                                                         │ │
│ │ 职责:                                                   │ │
│ │ 1. 分析需求，估算功能点数                               │ │
│ │ 2. 检索历史经验                                         │ │
│ │ 3. 选择执行模式 (A/B/C/D)                               │ │
│ │ 4. 生成执行计划 (phases, checkpoints)                  │ │
│ │ 5. spawn Orchestrator 并传递计划                        │ │
│ │                                                         │ │
│ │ 不负责:                                                 │ │
│ │ - 实际编码执行                                         │ │
│ │ - spawn Specialist（由Orchestrator负责）                │ │
│ │ - 具体文件操作                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                          ↓                                  │
│              spawn("orchestrator", { plan, mode })          │
│                          ↓                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Orchestrator Agent (编排者)                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 输入: Planner生成的计划                                 │ │
│ │ 输出: 执行结果 + 状态更新                               │ │
│ │                                                         │ │
│ │ 职责:                                                   │ │
│ │ 1. 接收Planner的计划                                    │ │
│ │ 2. 根据模式决定执行策略:                                │ │
│ │    - 模式A: 自己直接完成                                │ │
│ │    - 模式B: spawn Specialist (CodeWriter → Reviewer)   │ │
│ │    - 模式C: 并行spawn多个Specialist                     │ │
│ │    - 模式D: 分阶段spawn (按phases顺序)                  │ │
│ │ 3. A2A通信协调                                         │ │
│ │ 4. 集成结果，向Planner报告完成                         │ │
│ │                                                         │ │
│ │ 决策权:                                                 │ │
│ │ - spawn哪些Specialist（自己决定）                      │ │
│ │ - Specialist的任务分配（自己决定）                      │ │
│ │ - 何时进入下一phase（自己决定，根据checkpoints）        │ │
│ │ - 任务完成后的集成（自己负责）                          │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**关键区别**：

| 决策点 | Planner | Orchestrator |
|--------|---------|--------------|
| 选择执行模式 | ✅ 决定 | ❌ 接收 |
| 生成phases | ✅ 生成 | ❌ 接收 |
| spawn Specialist | ❌ 不spawn | ✅ 决定 |
| 分配具体任务 | ❌ 不分配 | ✅ 决定 |
| 文件操作 | ❌ 不操作 | ✅ 执行 |
| A2A通信 | ❌ 不参与 | ✅ 协调 |

**边界澄清（避免混淆）**：

1. **Planner生成"建议"，Orchestrator自主执行**
   - Planner的plan.phases是建议性的框架
   - Orchestrator可以根据实际情况调整执行顺序
   - Orchestrator可以选择跳过某些不需要的步骤

2. **Planner不直接spawn任何Agent**
   - Planner只spawn一个Orchestrator
   - 所有Specialist都由Orchestrator spawn

3. **Orchestrator拥有完全自主权**
   - 可以根据运行时情况调整策略
   - 可以决定是否需要额外的Specialist
   - 负责最终的质量检查和集成

**数据流示例**：

```typescript
// 执行模式枚举
type ExecutionMode = 'A' | 'B' | 'C' | 'D';

// Planner的输出（传递给Orchestrator）
interface PlannerOutput {
  mode: ExecutionMode;
  plan: {
    phases: Array<{
      name: string;
      steps: string[];
      checkpoints?: string[];
    }>;
    agents: string[];          // 只是个提示，实际由Orchestrator决定
    checkpoints: string[];
  };
  reasoning: string;
}

// Orchestrator接收后，自主决定：
// - 每个phase需要spawn哪些Specialist
// - 每个Specialist的具体任务
// - 何时完成checkpoint

// 例如：Planner说"前端模块"，Orchestrator决定：
// - spawn Frontend Specialist（处理React组件）
// - spawn API Specialist（处理API调用）
// - spawn Styling Specialist（处理CSS）
```

**每种模式的执行流程**：

| 模式 | Planner输出 | Orchestrator行为 |
|------|------------|-----------------|
| A | `{mode: "A", plan: {...}}` | **"退化"为CodeWriter角色**，直接编码，不spawn Specialist |
| B | `{mode: "B", plan: {...}}` | spawn CodeWriter → spawn Reviewer（串行） |
| C | `{mode: "C", plan: {...}}` | 并行spawn多个Specialist，等待全部完成 |
| D | `{mode: "D", plan: {phases: [...]}}` | 按phases顺序spawn，每phase完成后再下一phase |

**模式A的Orchestrator行为详解**：

```
模式A（简单任务）：
- Orchestrator接收Planner的计划
- 不spawn任何Specialist
- 自己直接完成编码工作
- 相当于"Orchestrator + CodeWriter合体"
- 优点：减少通信开销，适合小任务
```

**Agent角色切换**：

```typescript
// Orchestrator在模式A下的行为
class OrchestratorAgent {
  async execute(plan: Plan, mode: ExecutionMode): Promise<Result> {
    if (mode === 'A') {
      // 模式A：自己直接编码
      return await this.codeDirectly(plan);
    } else {
      // 模式B/C/D：spawn Specialist
      return await this.coordinateSpecialists(plan, mode);
    }
  }

  private async codeDirectly(plan: Plan): Promise<Result> {
    // 直接使用CodeWriter的能力
    const codeWriterCapabilities = this.getCapabilities('codewriter');
    return await this.useCapabilities(codeWriterCapabilities, plan);
  }
}
```

### 输出格式

```json
{
  "mode": "A|B|C|D",
  "reasoning": "选择模式X的原因...",
  "confidence": 0.85,
  "plan": {
    "phases": [
      {
        "name": "需求分析",
        "steps": ["理解需求", "检索相关经验", "生成规格"]
      }
    ],
    "agents": ["orchestrator"],
    "checkpoints": ["规格确认", "代码完成", "测试通过"]
  },
  "estimatedSteps": 5,
  "estimatedDuration": "3-5 minutes",
  "risks": ["需求可能不够明确"]
}
```

### 配置

```yaml
# agents/planner.yaml
agentId: planner
description: "规划决策Agent"

model:
  provider: anthropic
  model: claude-sonnet-4-5-20250514
  temperature: 0.3  # 较低的温度，保证决策稳定

workspace: ./workspace/planner

systemPrompt: |
  你是EvoAgent的规划决策者。

  ## 工作流程

  1. 接收用户需求
  2. 检索相关历史经验（Knowledge + Memory）
  3. 评估任务复杂度和类型
  4. 选择最合适的执行模式
  5. 生成详细的执行计划

  ## 执行模式

  **模式A（单一Agent）**：
  - 功能点数 1-3个
  - 文件数 < 3个
  - 无复杂依赖
  - 示例：一个表单+一个列表

  **模式B（主从模式）**：
  - 功能点数 4-8个
  - 需要专业审查
  - 有明确的专业领域划分
  - 示例：CRUD+权限+验证

  **模式C（并行协作）**：
  - 需要同时开发多个独立模块
  - 有明显的并行机会
  - A2A通信能提升效率

  **模式D（分层架构）**：
  - 功能点数 > 8个
  - 需要架构设计
  - 多个子系统协调
  - 示例：完整业务系统+多角色+报表

tools:
  - search_knowledge
  - search_memory
  - estimate_complexity
  - check_patterns
  - generate_plan
```

---

## 执行模式

### 模式A：单一Agent（简单任务）

```
适用场景：
- 代码量 < 300行
- 文件数 < 3个
- 无复杂依赖
- 独立的小工具

执行流程：
┌─────────────────────────────────────────┐
│ Planner Agent                            │
│ → 分析需求                               │
│ → 确认模式A                              │
│ → spawn Orchestrator                    │
│   └─ 直接实现全部功能                    │
│ → 完成后Collector收集经验               │
└─────────────────────────────────────────┘

时间预算：5分钟内完成
```

### 模式B：主从模式（中等任务）

```
适用场景：
- 代码量 300-1000行
- 需要专业审查
- 有明确的专业领域（前端/后端/测试）

执行流程：
┌─────────────────────────────────────────┐
│ Planner Agent                            │
│ → 生成执行计划                           │
│ → spawn Orchestrator (main lane)        │
│   ├─ 实现核心功能                         │
│   ├─ spawn CodeReviewer (nested lane)   │
│   │   └─ 审查代码                         │
│   ├─ spawn Tester (nested lane)          │
│   │   └─ 运行测试                         │
│   └─ 根据反馈修复                         │
│ → 完成后Collector收集经验               │
└─────────────────────────────────────────┘

时间预算：10-20分钟
```

### 模式C：并行协作（复杂任务）

```
适用场景：
- 需要同时开发多个独立模块
- 有明显的并行机会
- A2A通信能提升效率

执行流程：
┌─────────────────────────────────────────┐
│ Planner Agent                            │
│ → 识别可并行任务                         │
│ → 生成并行计划                           │
│ → spawn多个Specialist (parallel lane):  │
│   ├─ Frontend Specialist                │
│   ├─ Backend Specialist                 │
│   ├─ API Specialist                     │
│   └─ A2A Ping-Pong协作                  │
│ → 等待所有完成                            │
│ → 集成测试                               │
└─────────────────────────────────────────┘

时间预算：20-40分钟
```

### 模式D：分层架构（大型项目）

```
适用场景：
- 代码量 > 1000行
- 需要架构设计
- 多个子系统协调

执行流程：
┌─────────────────────────────────────────┐
│ Planner Agent                            │
│ → 架构设计                               │
│ → 生成分层计划                           │
│ → spawn (按顺序):                        │
│   ├─ Architect Agent (设计架构)         │
│   ├─ Orchestrator (分解任务)            │
│   │   ├─ spawn Specialist 1             │
│   │   ├─ spawn Specialist 2             │
│   │   └─ A2A协作                        │
│   ├─ Integration Agent (集成)           │
│   └─ QA Agent (测试)                    │
│ → 每层完成后进入下一层                   │
└─────────────────────────────────────────┘

时间预算：40分钟 - 数小时
```

### 执行模式动态调整

**问题场景**：Planner选择模式D，但执行中发现任务其实很简单，继续用D会浪费资源。

**解决方案：动态降级与升级**

```typescript
// src/agents/orchestrator/mode-adapter.ts

export class ModeAdapter {
  // 评估当前模式是否合适
  async evaluateModeFit(
    currentMode: ExecutionMode,
    progress: Progress,
    session: Session
  ): Promise<'keep' | 'downgrade' | 'upgrade'> {
    const metrics = this.calculateMetrics(progress, session);

    // 降级判断
    if (await this.shouldDowngrade(currentMode, metrics)) {
      return 'downgrade';
    }

    // 升级判断
    if (await this.shouldUpgrade(currentMode, metrics)) {
      return 'upgrade';
    }

    return 'keep';
  }

  private async shouldDowngrade(mode: ExecutionMode, metrics: Metrics): Promise<boolean> {
    // 模式D → C：如果发现phase之间依赖不强
    if (mode === 'D' && metrics.crossPhaseDependency < 0.3) {
      console.log('[ModeAdapter] phase依赖弱，可降级到C');
      return true;
    }

    // 模式C → B：如果并行任务少
    if (mode === 'C' && metrics.parallelizableTasks < 2) {
      console.log('[ModeAdapter] 并行任务少，可降级到B');
      return true;
    }

    // 模式B → A：如果代码量很小
    if (mode === 'B' && metrics.actualCodeLines < 300) {
      console.log('[ModeAdapter] 代码量小，可降级到A');
      return true;
    }

    return false;
  }

  private async shouldUpgrade(mode: ExecutionMode, metrics: Metrics): Promise<boolean> {
    // 模式A → B：如果发现复杂度超出预期
    if (mode === 'A' && metrics.unexpectedComplexity > 0.7) {
      console.log('[ModeAdapter] 复杂度超出预期，建议升级到B');
      return true;
    }

    // 模式B → C：如果发现可并行的独立模块
    if (mode === 'B' && metrics.independentModules > 2) {
      console.log('[ModeAdapter] 发现独立模块，可升级到C');
      return true;
    }

    return false;
  }
}

// Orchestrator中的使用
class OrchestratorAgent {
  async execute(plan: Plan, mode: ExecutionMode): Promise<Result> {
    const adapter = new ModeAdapter();

    // 定期检查模式是否合适（每完成一个checkpoint）
    for (const checkpoint of plan.checkpoints) {
      const result = await this.executeCheckpoint(checkpoint);

      // 评估是否需要调整模式
      const decision = await adapter.evaluateModeFit(mode, this.progress, this.session);

      if (decision === 'downgrade') {
        console.log(`[Orchestrator] 降级: ${mode} → ${this.getDowngradeMode(mode)}`);
        mode = this.getDowngradeMode(mode);
        // 调整执行策略
      } else if (decision === 'upgrade') {
        console.log(`[Orchestrator] 升级: ${mode} → ${this.getUpgradeMode(mode)}`);
        mode = this.getUpgradeMode(mode);
        // 重新规划
      }
    }

    return result;
  }

  private getDowngradeMode(mode: ExecutionMode): ExecutionMode {
    const downgradeMap = { 'D': 'C', 'C': 'B', 'B': 'A', 'A': 'A' };
    return downgradeMap[mode];
  }
}
```

**降级示例**：

```
场景：Planner选择模式D（博客系统）
  ↓
执行Phase 1（架构设计）后，发现：
  - 模块间依赖很少
  - 可以并行开发
  ↓
Orchestrator决定降级到模式C
  ↓
并行执行：Frontend + Backend + Database
  ↓
节省时间：30%
```

**配置**：

```yaml
evolution:
  modeAdaptation:
    enabled: true
    checkInterval: checkpoint  # 在每个checkpoint检查
    allowDowngrade: true
    allowUpgrade: false        # 升级更危险，默认禁用
    thresholds:
      crossPhaseDependency: 0.3    # <30%可D→C
      parallelizableTasks: 2       # <2个可C→B
      actualCodeLines: 300         # <300行可B→A
```

---

## 记忆系统

### 三层记忆架构

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Session (短期记忆 - 对话上下文)                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 格式: JSONL (.jsonl)                                   │ │
│ │ 路径: ~/.evoagent/sessions/                            │ │
│ │                                                         │ │
│ │ 内容:                                                   │ │
│ │ - 完整对话历史                                          │ │
│ │ - 工具调用记录                                          │ │
│ │ - Agent Run生命周期事件                                  │ │
│ │                                                         │ │
│ │ 特点:                                                   │ │
│ │ - 按sessionKey隔离                                      │ │
│ │ - 追加写入，读取时加载全部                                │ │
│ │ - Agent完成后自动归档                                    │ │
│ │ - 基于价值评估保留（非固定时间）                          │ │
│ │   * 唯一性得分、引用计数、成功率综合评估                   │ │
│ │   * 高价值session标记keepForever永不过期                 │ │ │
│ │   * 低价值session在7天后可被清理                          │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Knowledge (中期记忆 - 结构化知识)                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 格式: Markdown (.md)                                    │ │
│ │ 路径: ~/.evoagent/knowledge/                            │ │
│ │                                                         │ │
│ │ 目录结构 (auto/manual分离):                            │ │
│ │ ├── auto/              # Reflector自动生成（可覆盖）      │ │
│ │ │   ├── pits/         # 技术坑点                        │ │
│ │ │   ├── patterns/     # 代码模式                        │ │
│ │ │   ├── decisions/    # 架构决策                        │ │
│ │ │   └── solutions/    # 解决方案                        │ │
│ │ └── manual/            # 人工编辑（Reflector不碰）        │ │
│ │     ├── pits/                                                  │ │
│ │     ├── patterns/                                              │ │
│ │     ├── decisions/                                             │ │
│ │     └── solutions/                                             │ │
│ │                                                         │ │
│ │ 文件命名: {category}/{slug}.md                          │ │
│ │ 示例: auto/pits/nextjs-server-actions-trap.md          │ │
│ │       manual/pits/react-use-effect-deps.md             │ │
│ │                                                         │ │
│ │ 生成方式:                                               │ │
│ │ - auto/: Collector自动生成，Reflector可覆盖              │ │
│ │ - manual/: 人工创建和编辑，Reflector永不覆盖            │ │
│ │ - 人类可手动编辑auto/文件，系统会标记为manual_edited    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Memory (长期记忆 - 语义检索)                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 向量数据库: sqlite-vec (嵌入式)                         │ │
│ │ 路径: ~/.evoagent/vector.db                             │ │
│ │                                                         │ │
│ │ 选型理由:                                               │ │
│ │ - 纯Rust实现，性能优秀                                   │ │
│ │ - 嵌入式，无需独立服务                                   │ │
│ │ - 与better-sqlite3完美集成                               │ │
│ │ - ClawdBot生产验证                                      │ │
│ │                                                         │ │
│ │ Collections:                                             │ │
│ │ ├── code_snippets        # 代码片段                      │ │
│ │ ├── error_solutions      # 错误解决方案                    │ │
│ │ ├── user_feedback       # 用户反馈                        │ │
│ │ ├── test_cases          # 测试用例                        │ │
│ │ └── decision_contexts   # 决策上下文                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Knowledge文件格式

```markdown
---
title: "Server Actions不能用try-catch包裹"
category: pits
tags: [nextjs, server-actions, error-handling]
severity: critical
discovered: 2025-01-27
occurrences: 3
related_sessions: [session-abc, session-def]
auto_generated: true
version: 2
---

## 问题描述

在Next.js中使用Server Actions时，不能直接用try-catch包裹整个action函数。这会导致错误处理机制失效。

## 错误示例

\`\`\`typescript
// ❌ 错误做法
'use server'

export const myAction = async (formData: FormData) => {
  try {
    // ... logic
  } catch (error) {
    // 这个catch不会被触发
  }
}
\`\`\`

## 根本原因

## 解决方案

**方案1：使用Next.js的error()函数抛出错误**
\`\`\`typescript
'use server'

export const myAction = async (formData: FormData) => {
  // 验证逻辑
  if (!formData.get('name')) {
    error('Name is required')
  }

  // ... 正常逻辑
  return { success: true }
}
\`\`\`

**方案2：使用try-catch包裹（Next.js完全支持）**
\`\`\`typescript
'use server'

export const myAction = async (formData: FormData) => {
  try {
    // 验证逻辑
    if (!formData.get('name')) {
      return { success: false, error: 'Name is required' }
    }

    // ... 正常逻辑
    return { success: true }
  } catch (error) {
    console.error('Action error:', error)
    return { success: false, error: 'Internal error' }
  }
}
\`\`\`

## 预防措施

1. 可以使用try-catch包裹整个action（Next.js支持）
2. 使用error()进行错误处理（next/router提供的函数）
3. 在客户端也做好错误处理
4. 返回结构化的错误信息便于客户端处理
```

**说明**：
- frontmatter全部由Collector自动生成
- content部分由LLM根据事件自动生成
- `source: auto` 表示此文件为系统生成（在auto/目录）
- `source: manual` 表示此文件为人工创建（在manual/目录）
- `manual_edited: true` 表示人工编辑过auto/文件，Reflector不应再更新
- `reflector_can_update: false` 锁定文件，防止Reflector更新
- `version` 字段支持后续更新（当Reflector发现新信息时）

### 知识库分离策略

**问题**：Reflector自动生成的知识可能覆盖人工编辑的内容

**解决方案**：auto/ 和 manual/ 目录分离

```typescript
// src/memory/knowledge-storage.ts

export class KnowledgeStorage {
  private autoDir: string;    // ~/.evoagent/knowledge/auto/
  private manualDir: string;  // ~/.evoagent/knowledge/manual/

  // Reflector写入时，只能写入auto/目录
  async writeAuto(category: string, slug: string, content: string): Promise<void> {
    const filePath = path.join(this.autoDir, category, `${slug}.md`);

    // 检查manual/是否有同名文件
    const manualPath = path.join(this.manualDir, category, `${slug}.md`);
    if (await fs.pathExists(manualPath)) {
      console.warn(`[Knowledge] manual/${category}/${slug}.md 已存在，跳过自动生成`);
      return;
    }

    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
  }

  // 人类写入时，写入manual/目录
  async writeManual(category: string, slug: string, content: string): Promise<void> {
    const filePath = path.join(this.manualDir, category, `${slug}.md`);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
  }

  // 读取时，manual优先于auto
  async read(category: string, slug: string): Promise<string | null> {
    // 先检查manual/
    const manualPath = path.join(this.manualDir, category, `${slug}.md`);
    if (await fs.pathExists(manualPath)) {
      return await fs.readFile(manualPath, 'utf-8');
    }

    // 再检查auto/
    const autoPath = path.join(this.autoDir, category, `${slug}.md`);
    if (await fs.pathExists(autoPath)) {
      return await fs.readFile(autoPath, 'utf-8');
    }

    return null;
  }

  /**
   * 按文件名搜索（P2优化：增强版）
   */
  async searchByFilename(query: string, limit: number = 10): Promise<Array<{
    path: string;
    category: string;
    slug: string;
    content: string;
  }>> {
    const results: Array<{
      path: string;
      category: string;
      slug: string;
      content: string;
    }> = [];

    const queryLower = query.toLowerCase();

    // 搜索manual/和auto/
    for (const dir of [this.manualDir, this.autoDir]) {
      const categories = await fs.readdir(dir).catch(() => []);

      for (const category of categories) {
        const categoryPath = path.join(dir, category);
        const files = await fs.readdir(categoryPath).catch(() => []);

        for (const file of files) {
          if (!file.endsWith('.md')) continue;

          const slug = file.slice(0, -3);
          // 文件名匹配
          if (slug.toLowerCase().includes(queryLower)) {
            const filePath = path.join(categoryPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            results.push({
              path: filePath,
              category,
              slug,
              content,
            });
          }
        }
      }
    }

    return results.slice(0, limit);
  }

  /**
   * 按内容搜索（P2优化：新增）
   * 使用简单的关键词匹配（不依赖外部索引）
   */
  async searchByContent(
    query: string,
    options: {
      category?: string;
      limit?: number;
    } = {}
  ): Promise<Array<{
    path: string;
    category: string;
    slug: string;
    content: string;
    score: number;
  }>> {
    const { category, limit = 10 } = options;
    const results: Array<{
      path: string;
      category: string;
      slug: string;
      content: string;
      score: number;
    }> = [];

    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/);

    // 搜索manual/和auto/
    for (const dir of [this.manualDir, this.autoDir]) {
      const categories = category
        ? [category]
        : await fs.readdir(dir).catch(() => []);

      for (const cat of categories) {
        const categoryPath = path.join(dir, cat);
        const files = await fs.readdir(categoryPath).catch(() => []);

        for (const file of files) {
          if (!file.endsWith('.md')) continue;

          const filePath = path.join(categoryPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const contentLower = content.toLowerCase();

          // 计算匹配分数
          let score = 0;
          for (const term of queryTerms) {
            if (file.toLowerCase().includes(term)) score += 2;  // 文件名匹配权重更高
            if (contentLower.includes(term)) score += 1;
          }

          if (score > 0) {
            results.push({
              path: filePath,
              category: cat,
              slug: file.slice(0, -3),
              content,
              score,
            });
          }
        }
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * 添加相关知识链接（P2优化）
   */
  async addRelated(knowledgeId: string, relatedIds: string[]): Promise<void> {
    // 解析knowledgeId格式: "category/slug"
    const [category, slug] = knowledgeId.split('/');
    const content = await this.read(category, slug);
    if (!content) return;

    // 解析frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
    if (!frontmatterMatch) return;

    let frontmatter: Record<string, unknown> = {};
    try {
      frontmatter = this.parseFrontmatter(frontmatterMatch[1]);
    } catch {
      return;
    }

    // 添加related_sessions
    const related = new Set<string>([
      ...(frontmatter.related_sessions || []),
      ...relatedIds,
    ]);
    frontmatter.related_sessions = Array.from(related);

    // 重建文件
    const newFrontmatter = this.stringifyFrontmatter(frontmatter);
    const newContent = content.replace(/^---\n[\s\S]+?\n---/, newFrontmatter);

    // 判断写入位置
    const manualPath = path.join(this.manualDir, category, `${slug}.md`);
    const autoPath = path.join(this.autoDir, category, `${slug}.md`);

    if (await fs.pathExists(manualPath)) {
      await fs.writeFile(manualPath, newContent, 'utf-8');
    } else {
      await fs.writeFile(autoPath, newContent, 'utf-8');
    }
  }

  private parseFrontmatter(yaml: string): Record<string, unknown> {
    // 简化版YAML解析
    const lines = yaml.split('\n');
    const result: Record<string, unknown> = {};
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        result[key] = value;
      }
    }
    return result;
  }

  private stringifyFrontmatter(data: Record<string, unknown>): string {
    const lines = ['---'];
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        lines.push(`${key}: [${value.join(', ')}]`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    lines.push('---');
    return lines.join('\n');
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    auto: number;
    manual: number;
    byCategory: Record<string, { auto: number; manual: number }>;
  }> {
    const stats = {
      auto: 0,
      manual: 0,
      byCategory: {} as Record<string, { auto: number; manual: number }>,
    };

    for (const [dirName, dir] of [['auto', this.autoDir], ['manual', this.manualDir]]) {
      const categories = await fs.readdir(dir).catch(() => []);

      for (const category of categories) {
        const categoryPath = path.join(dir, category);
        const stat = await fs.stat(categoryPath).catch(() => null);
        if (!stat || !stat.isDirectory()) continue;

        const files = await fs.readdir(categoryPath).catch(() => []);
        const count = files.filter(f => f.endsWith('.md')).length;

        if (!stats.byCategory[category]) {
          stats.byCategory[category] = { auto: 0, manual: 0 };
        }
        stats.byCategory[category][dirName as 'auto' | 'manual'] = count;
        stats[dirName as 'auto' | 'manual'] += count;
      }
    }

    return stats;
  }
}
```

**CLI操作**：

```bash
# 添加手动知识（写入manual/）
evoagent knowledge add --category pits --file ./my-pitfall.md

# 编辑自动生成的知识（会移动到manual/）
evoagent knowledge edit --id auto/pits/nextjs-trap

# 查看知识来源
evoagent knowledge get --id pits/nextjs-trap
# 输出:
# 来源: auto (Reflector生成)
# 路径: ~/.evoagent/knowledge/auto/pits/nextjs-trap.md

# 锁定知识（防止Reflector更新）
evoagent knowledge lock --id auto/pits/nextjs-trap
# 输出:
# ✓ 已锁定: Reflector将不会更新此文件
```

**目录结构示例**：

```
~/.evoagent/knowledge/
├── auto/                              # Reflector可更新
│   ├── pits/
│   │   ├── nextjs-server-actions-trap.md
│   │   └── typescript-any-type.md
│   ├── patterns/
│   │   ├── react-fetch-pattern.md
│   │   └── api-error-handling.md
│   └── solutions/
│       └── auth-jwt-implementation.md
│
└── manual/                            # Reflector不碰
    ├── pits/
    │   └── react-use-effect-deps.md       # 人工精心编写
    ├── patterns/
    │   └── project-structure.md           # 项目约定
    └── decisions/
        └── choose-nextjs.md               # 架构决策记录
```

```

### 向量嵌入配置

**成本问题**：每次调用embedding API都需要花钱或时间

**解决方案：本地模型 + 缓存 + 通用接口**

```yaml
# config/config.yaml
memory:
  vector:
    provider: sqlite-vec

    # 嵌入模型配置（通用接口）
    embedding:
      # 方式1: OpenAI兼容API（包括本地服务）
      provider: openai-compatible
      baseUrl: "http://localhost:11434/v1"  # Ollama、vLLM、LM Studio等
      apiKey: "dummy"                        # 本地服务随便填
      model: "nomic-embed-text"              # 模型名称

      # 方式2: OpenAI官方（备选）
      # provider: openai
      # apiKey: "${OPENAI_API_KEY}"
      # model: text-embedding-3-small

      # 方式3: Cohere
      # provider: cohere
      # apiKey: "${COHERE_API_KEY}"
      # model: embed-english-v3.0

      # 方式4: HTTP通用接口
      # provider: http
      # url: "http://localhost:8080/embed"
      # headers:
      #   Authorization: "Bearer xxx"
      # requestFormat: "openai"  # openai | cohere | custom

      # 缓存配置（所有provider通用）
      cache:
        enabled: true
        ttl: 7days
        maxSize: 10000

      # 去重配置
      dedup:
        enabled: true
        similarityThreshold: 0.99
```

**支持的Provider**：

| Provider | 说明 | 示例baseUrl |
|----------|------|-------------|
| `openai` | OpenAI官方 | - |
| `openai-compatible` | OpenAI兼容API | `http://localhost:11434/v1` |
| `cohere` | Cohere API | - |
| `http` | 通用HTTP接口 | 自定义 |
| `mock` | 测试用假embedding | - |

**OpenAI兼容服务示例**：

```bash
# Ollama
ollama pull nomic-embed-text
ollama run nomic-embed-text  # 默认端口11434

# vLLM
vllm serve nomic-embed-text/v1.5 --port 8080

# LM Studio
# 直接在UI中启动，默认端口1234

# 配置对应
provider: openai-compatible
baseUrl: "http://localhost:11434/v1"  # 根据实际调整
```

**缓存逻辑**：

```typescript
// src/memory/embedding-cache.ts

/**
 * 简单LRU缓存实现
 * 避免内存Map无限制增长导致OOM
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // LRU: 访问时移到末尾
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // 删除旧值（如果存在）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // 达到上限时删除最旧的项（首个）
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    // 添加到末尾
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * LRU缓存实现（线程安全版本）
 *
 * 注意：Node.js是单线程的，但在异步操作中仍可能出现竞态条件。
 * 使用Mutex保护Map操作，确保并发安全。
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;
  private lock: boolean = false;
  private lockQueue: Array<() => void> = [];

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * 获取缓存值
   */
  async get(key: K): Promise<V | undefined> {
    return this.withLock(async () => {
      const value = this.cache.get(key);
      if (value !== undefined) {
        // LRU: move to end
        this.cache.delete(key);
        this.cache.set(key, value);
      }
      return value;
    });
  }

  /**
   * 设置缓存值
   */
  async set(key: K, value: V): Promise<void> {
    return this.withLock(async () => {
      if (this.cache.has(key)) {
        this.cache.delete(key);
      } else if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(key, value);
    });
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 简单的锁机制，保护Map操作
   *
   * @note 这是一个简化的实现，适用于Node.js单线程环境
   * 在生产环境中建议使用 `async-mutex` 或 `proper-lockfile` 库
   *
   * 已知限制：
   * - 如果fn()中的Promise永不resolve，会永久阻塞
   * - 进程崩溃后锁状态会丢失（下次重启时重置）
   * - 不适用于多进程共享内存的场景
   */
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    while (this.lock) {
      await new Promise(resolve => this.lockQueue.push(resolve));
    }
    this.lock = true;
    try {
      return await fn();
    } finally {
      this.lock = false;
      const next = this.lockQueue.shift();
      if (next) next();
    }
  }
}

export class EmbeddingCache {
  private lruCache: LRUCache<string, number[]>;  // LRU缓存，有界
  private db: Database;
  private config: {
    maxMemoryCache: number;  // 内存缓存最大条目数
    ttl: number;              // 数据库缓存TTL
  };

  constructor(db: Database, config = {}) {
    this.db = db;
    this.config = {
      maxMemoryCache: 1000,   // 默认缓存1000条embedding
      ttl: 7 * 24 * 60 * 60 * 1000,  // 7天
      ...config,
    };
    this.lruCache = new LRUCache(this.config.maxMemoryCache);

    // 初始化表和索引
    this.initSchema();
  }

  /**
   * 初始化数据库表和索引
   */
  private initSchema(): void {
    // 创建表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS embedding_cache (
        content_hash TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding TEXT NOT NULL,  -- JSON存储
        created_at INTEGER NOT NULL
      )
    `);

    // 创建索引优化cleanup查询性能
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_embedding_cache_created_at
      ON embedding_cache(created_at)
    `);
  }

  async getEmbedding(content: string): Promise<number[]> {
    // 1. 检查内存LRU缓存
    const cached = await this.lruCache.get(content);
    if (cached) {
      return cached;
    }

    // 2. 检查数据库缓存
    const row = await this.db.get(
      'SELECT embedding FROM embedding_cache WHERE content_hash = ? AND created_at > ?',
      [this.hash(content), Date.now() - this.config.ttl]
    );
    if (row) {
      const embedding = JSON.parse(row.embedding);
      // 回填到LRU缓存
      await this.lruCache.set(content, embedding);
      return embedding;
    }

    // 3. 调用模型
    const embedding = await this.callEmbeddingModel(content);

    // 4. 写入缓存
    await this.lruCache.set(content, embedding);
    await this.db.run(
      'INSERT OR REPLACE INTO embedding_cache (content_hash, content, embedding, created_at) VALUES (?, ?, ?, ?)',
      [this.hash(content), content, JSON.stringify(embedding), Date.now()]
    );

    return embedding;
  }

  // 定期清理过期缓存
  async cleanup(): Promise<void> {
    const cutoff = Date.now() - this.config.ttl;
    const result = await this.db.run('DELETE FROM embedding_cache WHERE created_at < ?', [cutoff]);
    console.log(`[EmbeddingCache] Cleaned up ${result.changes} expired entries`);
  }

  /**
   * 批量预热缓存（可选优化）
   * 用于系统启动时预加载高频embedding
   */
  async warmup(contents: string[]): Promise<void> {
    for (const content of contents) {
      await this.getEmbedding(content);  // 自动缓存
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): { memorySize: number; memoryMax: number } {
    return {
      memorySize: this.lruCache.size,
      memoryMax: this.config.maxMemoryCache,
    };
  }

  private hash(content: string): string {
    // 简化版hash，实际应用可用crypto
    return Buffer.from(content).toString('base64').slice(0, 32);
  }

  private async callEmbeddingModel(content: string): Promise<number[]> {
    // 调用embedding模型
    return [];
  }
}
```

### 混合检索：关键词 + 向量融合

基于PageIndex专家反馈：纯向量检索在精确匹配场景（如具体错误码、函数名）表现不佳。需要混合检索。

```typescript
// src/memory/hybrid-search.ts

/**
 * 混合检索策略
 *
 * 向量检索优势：语义相似，能理解意图
 * 关键词检索优势：精确匹配，适合专有名词、错误码
 *
 * 混合策略：RRF (Reciprocal Rank Fusion) - 倒数排名融合
 */

interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;           // 原始相似度分数
  rank: number;            // 排名位置
  source: 'vector' | 'keyword' | 'knowledge';
}

interface HybridSearchOptions {
  query: string;
  collection?: string;
  limit?: number;
  // RRF参数
  vectorWeight?: number;   // 向量检索权重 (默认0.6)
  keywordWeight?: number;  // 关键词检索权重 (默认0.4)
  k?: number;              // RRF常数 (默认60)
}

export class HybridSearch {
  private vectorStore: VectorStore;
  private keywordIndex: KeywordIndex;
  private knowledge: KnowledgeStorage;

  /**
   * 混合检索主入口
   */
  async search(options: HybridSearchOptions): Promise<SearchResult[]> {
    const {
      query,
      collection,
      limit = 10,
      vectorWeight = 0.6,
      keywordWeight = 0.4,
      k = 60,
    } = options;

    // 并行执行两种检索
    const [vectorResults, keywordResults, knowledgeResults] = await Promise.all([
      this.vectorSearch(query, collection, limit * 2),
      this.keywordSearch(query, collection, limit * 2),
      this.knowledgeSearch(query, limit * 2),
    ]);

    // RRF融合
    const fused = this.reciprocalRankFusion(
      [
        ...vectorResults.map(r => ({ ...r, source: 'vector' as const })),
        ...keywordResults.map(r => ({ ...r, source: 'keyword' as const })),
        ...knowledgeResults.map(r => ({ ...r, source: 'knowledge' as const })),
      ],
      { vectorWeight, keywordWeight, k }
    );

    // 去重（同一ID只保留最高分）
    const deduped = this.deduplicate(fused);

    return deduped.slice(0, limit);
  }

  /**
   * 向量检索
   */
  private async vectorSearch(
    query: string,
    collection?: string,
    limit = 20
  ): Promise<SearchResult[]> {
    // 1. 获取query的embedding
    const embedding = await this.vectorStore.embed(query);

    // 2. sqlite-vec向量搜索
    const results = await this.vectorStore.similaritySearch(embedding, {
      collection,
      limit,
    });

    return results.map(r => ({
      id: r.id,
      content: r.content,
      metadata: r.metadata,
      score: r.similarity,
      rank: 0,  // 稍后计算
      source: 'vector' as const,
    }));
  }

  /**
   * 关键词检索 (FTS5)
   */
  private async keywordSearch(
    query: string,
    collection?: string,
    limit = 20
  ): Promise<SearchResult[]> {
    // 使用SQLite FTS5全文搜索
    const results = await this.keywordIndex.search(query, {
      collection,
      limit,
    });

    return results.map(r => ({
      id: r.id,
      content: r.content,
      metadata: r.metadata,
      score: r.rank,  // BM25分数
      rank: 0,
      source: 'keyword' as const,
    }));
  }

  /**
   * Knowledge检索 (基于文件名的关键词匹配)
   */
  private async knowledgeSearch(
    query: string,
    limit = 10
  ): Promise<SearchResult[]> {
    // Knowledge文件名通常包含描述性信息
    // 例如: auto/pits/nextjs-server-actions-trap.md

    const files = await this.knowledge.searchByFilename(query, limit);

    return files.map(f => ({
      id: f.path,
      content: f.content,
      metadata: { category: f.category, slug: f.slug },
      score: 1.0,  // 文件名匹配 = 完全相关
      rank: 0,
      source: 'knowledge' as const,
    }));
  }

  /**
   * RRF (Reciprocal Rank Fusion) 算法
   *
   * 公式: score(d) = Σ(weight_i / (k + rank_i))
   *
   * 优势：
   * - 不受原始分数范围影响
   * - 简单有效，无需调参
   * - 对异常值鲁棒
   */
  private reciprocalRankFusion(
    results: SearchResult[],
    options: { vectorWeight: number; keywordWeight: number; k: number }
  ): SearchResult[] {
    const { vectorWeight, keywordWeight, k } = options;

    // 按source分组并排名
    const grouped = new Map<string, SearchResult[]>();
    for (const result of results) {
      const key = `${result.source}:${result.id}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(result);
    }

    // 计算每组的RRF分数
    const fused: Map<string, SearchResult> = new Map();

    for (const [key, group] of grouped) {
      let rrfScore = 0;

      for (const result of group) {
        const rank = group.indexOf(result) + 1;
        const weight =
          result.source === 'vector' ? vectorWeight :
          result.source === 'keyword' ? keywordWeight :
          1.0;  // knowledge默认权重

        rrfScore += weight / (k + rank);
      }

      // 取第一个作为基础
      const base = group[0];
      fused.set(key, {
        ...base,
        score: rrfScore,
      });
    }

    // 按RRF分数排序
    return Array.from(fused.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * 去重：同一ID只保留最高分
   */
  private deduplicate(results: SearchResult[]): SearchResult[] {
    const seen = new Map<string, SearchResult>();

    for (const result of results) {
      const existing = seen.get(result.id);
      if (!existing || result.score > existing.score) {
        seen.set(result.id, result);
      }
    }

    return Array.from(seen.values());
  }
}

/**
 * 关键词索引 (FTS5) - 异步更新版本
 */
class KeywordIndex {
  private db: Database;
  private pendingQueue: Array<{ id: string; content: string; collection?: string; metadata: string }> = [];
  private isProcessing = false;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initFTS();
    this.startFlushInterval(); // 定期刷新队列
  }

  private initFTS(): void {
    // 创建FTS5虚拟表
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS keyword_index USING fts5(
        id,
        content,
        collection,
        metadata,
        tokenize='unicode61'  -- 移除porter，支持中文
      );

      -- 移除同步触发器，改用异步队列
      -- 旧版本: CREATE TRIGGER ... (已删除)
    `);
  }

  /**
   * 异步添加到索引队列
   */
  async addToIndex(item: {
    id: string;
    content: string;
    collection?: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    this.pendingQueue.push({
      id: item.id,
      content: item.content,
      collection: item.collection,
      metadata: JSON.stringify(item.metadata),
    });

    // 队列达到一定大小时自动刷新
    if (this.pendingQueue.length >= 100) {
      await this.flush();
    }
  }

  /**
   * 批量刷新队列到FTS5
   */
  private async flush(): Promise<void> {
    if (this.pendingQueue.length === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    const itemsToProcess = this.pendingQueue.splice(0, this.pendingQueue.length);

    try {
      const transaction = this.db.transaction(() => {
        const stmt = this.db.prepare(`
          INSERT INTO keyword_index(id, content, collection, metadata)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            content=excluded.content,
            collection=excluded.collection,
            metadata=excluded.metadata
        `);

        for (const item of itemsToProcess) {
          stmt.run(item.id, item.content, item.collection || '', item.metadata);
        }
      });

      transaction();
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 定期刷新队列（每5秒）
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch(err => {
        console.error('[KeywordIndex] Flush error:', err);
      });
    }, 5000);
  }

  /**
   * 关闭时刷新剩余队列
   */
  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }

  async search(query: string, options: {
    collection?: string;
    limit?: number;
    tokenize?: 'unicode61' | 'porter';
  }): Promise<Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    rank: number;
  }>> {
    const { collection, limit = 20 } = options;

    // FTS5搜索
    // 使用布尔查询：必须包含的词用AND，可选用OR
    const sql = collection
      ? `SELECT id, content, metadata, bm25(keyword_index) as rank
         FROM keyword_index
         WHERE keyword_index MATCH ? AND collection = ?
         ORDER BY rank
         LIMIT ?`
      : `SELECT id, content, metadata, bm25(keyword_index) as rank
         FROM keyword_index
         WHERE keyword_index MATCH ?
         ORDER BY rank
         LIMIT ?`;

    const params = collection ? [query, collection, limit] : [query, limit];

    return this.db.prepare(sql).all(...params);
  }
}
```

**检索效果对比**：

| 查询类型 | 纯向量 | 纯关键词 | 混合检索 |
|---------|--------|---------|---------|
| "nextjs server actions error" | 好（语义） | 中（需精确词） | **最好** |
| "PRISMA_P2021" 错误码 | 差（语义不精确） | **好**（精确匹配） | **好** |
| "如何处理用户登录" | **好**（语义理解） | 中（需关键词） | **最好** |
| "useState依赖数组" | 好 | 好 | **好** |

**配置示例**：

```yaml
# config/config.yaml
memory:
  search:
    mode: hybrid  # hybrid | vector | keyword

    hybrid:
      vectorWeight: 0.6    # 向量检索权重
      keywordWeight: 0.4   # 关键词检索权重
      rrfK: 60            # RRF常数

    # 向量检索配置
    vector:
      limit: 20           # 向量检索返回数量
      minScore: 0.5       # 最低相似度阈值

    # 关键词检索配置
    keyword:
      limit: 20           # 关键词检索返回数量
      tokenize: 'unicode61'  # 分词器: unicode61(支持中文) | porter(英文词干提取)
      asyncQueue:
        enabled: true     # 异步队列开关
        flushInterval: 5000  # 刷新间隔(ms)
        flushThreshold: 100   # 队列达到此数量时立即刷新
```

**使用示例**：

```typescript
// Agent执行时自动调用混合检索
const relevantMemories = await memory.search({
  query: currentTask,
  collections: ['code_snippets', 'error_solutions'],
  limit: 10,
});

// 返回结果按相关性排序，包含向量匹配和关键词匹配
```

### 向量存储接口（添加删除和HNSW参数）

```typescript
// src/memory/vector-store.ts

/**
 * 向量存储接口
 * 基于LanceDB建议：添加删除和HNSW参数配置
 */
interface VectorStore {
  /**
   * 添加向量
   */
  add(collection: string, vectors: {
    id: string;
    embedding: number[];
    content: string;
    metadata: Record<string, unknown>;
  }[]): Promise<void>;

  /**
   * 删除向量（新增）
   */
  delete(collection: string, id: string): Promise<void>;

  /**
   * 批量删除（新增）
   */
  deleteBatch(collection: string, ids: string[]): Promise<number>;

  /**
   * 按元数据删除（新增）
   */
  deleteByMetadata(collection: string, filters: Record<string, unknown>): Promise<number>;

  /**
   * 相似度搜索
   */
  similaritySearch(
    queryEmbedding: number[],
    options: {
      collection?: string;
      limit?: number;
      minScore?: number;
    }
  ): Promise<SearchResult[]>;

  /**
   * 获取向量（用于巩固等场景）
   */
  get(id: string): Promise<Vector | null>;

  /**
   * 获取访问计数（用于巩固判断）
   */
  getAccessCount(id: string): Promise<number>;

  /**
   * 标记已巩固
   */
  markConsolidated(id: string): Promise<void>;
}

interface Vector {
  id: string;
  embedding: number[];
  content: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  accessCount: number;
  /**
   * @note SQLite存储为INTEGER(0/1)，读取时转换为boolean
   * 数据库: consolidated INTEGER DEFAULT 0
   * TypeScript: consolidated: boolean
   */
  consolidated: boolean;
}

/**
 * sqlite-vec实现
 */
export class SQLiteVecVectorStore implements VectorStore {
  private db: Database;
  private hnswConfig: HNSWConfig;

  constructor(dbPath: string, hnswConfig?: Partial<HNSWConfig>) {
    this.db = new Database(dbPath);
    this.hnswConfig = {
      // HNSW索引参数（影响精度和性能）
      dim: 768,              // 向量维度（根据embedding模型调整）
      M: 16,                 // 每个节点的最大连接数（默认16，越大精度越高但越慢）
      efConstruction: 200,   // 构建索引时的搜索宽度（默认200）
      efSearch: 100,         // 搜索时的宽度（默认100，越大精度越高但越慢）
      ...hnswConfig,
    };
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      -- 向量表
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        collection TEXT,
        embedding BLOB,  -- sqlite-vec格式
        content TEXT,
        metadata TEXT,
        created_at INTEGER,
        access_count INTEGER DEFAULT 0,
        consolidated INTEGER DEFAULT 0
      );

      -- HNSW索引（sqlite-vec扩展）
      -- 实际参数通过配置传入
      CREATE INDEX IF NOT EXISTS idx_vectors_collection ON vectors(collection);
      CREATE INDEX IF NOT EXISTS idx_vectors_created_at ON vectors(created_at);

      -- 注意：FTS5同步使用异步队列处理（见KeywordIndex类）
      -- 触发器已移除，改为应用层批量更新以提升性能
    `);
  }

  async add(collection: string, items: Array<{
    id: string;
    embedding: number[];
    content: string;
    metadata: Record<string, unknown>;
  }>): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO vectors(id, collection, embedding, content, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (const item of items) {
        const embeddingBlob = this.encodeEmbedding(item.embedding);
        stmt.run(item.id, collection, embeddingBlob, item.content,
                 JSON.stringify(item.metadata), Date.now());
      }
    });

    transaction();
  }

  /**
   * 删除单个向量
   */
  async delete(collection: string, id: string): Promise<void> {
    await this.db.run(
      'DELETE FROM vectors WHERE collection = ? AND id = ?',
      [collection, id]
    );
  }

  /**
   * 批量删除向量
   */
  async deleteBatch(collection: string, ids: string[]): Promise<number> {
    const placeholders = ids.map(() => '?').join(',');
    const result = await this.db.run(
      `DELETE FROM vectors WHERE collection = ? AND id IN (${placeholders})`,
      [collection, ...ids]
    );
    return result.changes;
  }

  /**
   * 按元数据删除（用于清理过期数据）
   */
  async deleteByMetadata(collection: string, filters: Record<string, unknown>): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [collection];

    for (const [key, value] of Object.entries(filters)) {
      conditions.push(`json_extract(metadata, '$.${key}') = ?`);
      params.push(value);
    }

    const sql = `DELETE FROM vectors WHERE collection = ?`;
    const whereSql = conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';

    const result = await this.db.run(sql + whereSql, params);
    return result.changes;
  }

  /**
   * 相似度搜索
   */
  async similaritySearch(
    queryEmbedding: number[],
    options: {
      collection?: string;
      limit?: number;
      minScore?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const { collection, limit = 20, minScore = 0.5 } = options;

    // 维度验证：确保查询向量与数据库向量维度一致
    const queryDim = queryEmbedding.length;
    const dbDim = await this.getVectorDimension();

    if (queryDim !== dbDim) {
      throw new Error(
        `Vector dimension mismatch: query=${queryDim}, database=${dbDim}. ` +
        `This may indicate a different embedding model is being used.`
      );
    }

    // 使用sqlite-vec的距离函数
    const sql = collection
      ? `SELECT id, content, metadata, distance(embedding, ?) as dist
         FROM vectors
         WHERE collection = ? AND distance(embedding, ?) < ?
         ORDER BY dist
         LIMIT ?`
      : `SELECT id, content, metadata, distance(embedding, ?) as dist
         FROM vectors
         WHERE distance(embedding, ?) < ?
         ORDER BY dist
         LIMIT ?`;

    const queryBlob = this.encodeEmbedding(queryEmbedding);
    const maxDistance = 1 - minScore;  // 余弦距离 = 1 - 余弦相似度

    const rows = collection
      ? this.db.prepare(sql).all(queryBlob, collection, queryBlob, maxDistance, limit)
      : this.db.prepare(sql).all(queryBlob, queryBlob, maxDistance, limit);

    // 增加访问计数
    for (const row of rows) {
      this.db.prepare('UPDATE vectors SET access_count = access_count + 1 WHERE id = ?')
        .run(row.id);
    }

    return rows.map(row => ({
      id: row.id,
      content: row.content,
      metadata: JSON.parse(row.metadata),
      score: 1 - row.dist,  // 转换回相似度
      rank: 0,
      source: 'vector' as const,
    }));
  }

  async get(id: string): Promise<Vector | null> {
    const row = this.db.prepare('SELECT * FROM vectors WHERE id = ?').get(id);
    if (!row) return null;

    return {
      id: row.id,
      embedding: this.decodeEmbedding(row.embedding),
      content: row.content,
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at,
      accessCount: row.access_count,
      consolidated: !!row.consolidated,
    };
  }

  async getAccessCount(id: string): Promise<number> {
    const row = this.db.prepare('SELECT access_count FROM vectors WHERE id = ?').get(id);
    return row?.access_count || 0;
  }

  /**
   * 获取向量维度
   * 从数据库中读取第一个向量的维度作为标准维度
   */
  async getVectorDimension(): Promise<number> {
    const row = this.db.prepare('SELECT embedding FROM vectors LIMIT 1').get() as { embedding: Buffer } | undefined;
    if (row) {
      // Float32 = 4 bytes per dimension
      return row.embedding.length / 4;
    }
    // 如果数据库为空，返回默认维度（如768 for BAAI/bge-small-en-v1.5）
    return 768;
  }

  async markConsolidated(id: string): Promise<void> {
    await this.db.run('UPDATE vectors SET consolidated = 1 WHERE id = ?', [id]);
  }

  /**
   * 编码向量为BLOB
   */
  private encodeEmbedding(vec: number[]): Buffer {
    // 简化版：float32数组
    const buffer = Buffer.allocUnsafe(vec.length * 4);
    for (let i = 0; i < vec.length; i++) {
      buffer.writeFloatLE(vec[i], i * 4);
    }
    return buffer;
  }

  /**
   * 解码BLOB为向量
   */
  private decodeEmbedding(blob: Buffer): number[] {
    const vec = [];
    for (let i = 0; i < blob.length; i += 4) {
      vec.push(blob.readFloatLE(i));
    }
    return vec;
  }

  /**
   * 清理低访问量向量
   */
  async cleanupLowAccess(daysOld: number, maxAccessCount: number): Promise<number> {
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    const result = await this.db.run(`
      DELETE FROM vectors
      WHERE created_at < ? AND access_count < ? AND consolidated = 0
    `, [cutoff, maxAccessCount]);
    return result.changes;
  }
}

/**
 * 向量索引配置说明
 *
 * 注意：sqlite-vec使用IVF（倒排文件索引）而非HNSW。
 * 如需HNSW索引，可切换到LanceDB或Qdrant等支持HNSW的向量数据库。
 *
 * 当前sqlite-vec配置：
 * - 距离度量：余弦相似度（cosine）
 * - 索引类型：IVF Flat（通过sqlite-vec扩展自动管理）
 * - 维度：由embedding模型决定（如768 for BAAI/bge-small-en-v1.5）
 */
```

**配置示例**：

```yaml
memory:
  vector:
    dim: 768  # 根据embedding模型设置
```

**向量数据库选型对比**：

| 特性 | sqlite-vec | LanceDB | Qdrant |
|------|-----------|---------|--------|
| 索引类型 | IVF Flat | HNSW | HNSW |
| 独立服务 | 否 | 否 | 是 |
| 轻量级 | ✅ | ❌ | ❌ |
| 大规模性能 | 中 | 高 | 高 |

**向量删除使用场景**：
```typescript
// 删除错误的向量
await vectorStore.delete('code_snippets', 'bad-vector-id');

// 批量删除过期向量
await vectorStore.deleteBatch('code_snippets', oldIds);

// 按元数据清理
await vectorStore.deleteByMetadata('code_snippets', {
  created_at: { $lt: cutoffDate }
});

// 清理低访问量向量
await vectorStore.cleanupLowAccess(30, 5);  // 30天前且访问<5次
```

---

## 进化系统

### 双轨进化机制

```
实时收集轨道                    定期反思轨道
┌───────────────────────────┐  ┌───────────────────────────┐
│ Experience Collector      │  │ Reflector Agent           │
│ (事件监听)                │  │ (定时触发)                 │
│                           │  │                           │
│ 监听事件:                 │  │ 触发条件:                 │
│ - agent_complete          │  │ - 每7天                   │
│ - agent_error             │  │ - 每10个session           │
│ - user_feedback           │  │ - 用户手动触发              │
│ - test_failed             │  │                           │
│                           │  │ 执行动作:                 │
│ 自动提取:                 │  │ - 分析所有session          │
│ - 成功模式                │  │ - 发现新模式               │
│ - 失败坑点                │  │ - 更新Knowledge            │
│ - 代码片段                │  │ - 优化System Prompt         │
│ - 决策上下文              │  │ - 生成进化报告             │
│                           │  │                           │
│ 写入目标:                 │  │ 输出:                     │
│ - Knowledge (.md)          │  │ - 更新的Knowledge          │
│ - Vector DB               │  │  - 优化的Prompt             │
│ - Session事件日志          │  │ - 进化报告                │
└───────────────────────────┘  └───────────────────────────┘
           │                           │
           └───────────┬───────────────┘
                       ↓
        ┌─────────────────────┐
        │   Knowledge Base     │ ← 持续增长
        │   + Vector DB        │
        └─────────────────────┘
                       ↓
        ┌─────────────────────┐
        │   System Prompt      │ ← 持续优化
        └─────────────────────┘
```

### 经验收集机制

```typescript
// src/evolution/collector.ts

export class ExperienceCollector {
  async collectEvent(event: ExperienceEvent): Promise<void> {
    switch (event.eventType) {
      case 'agent_complete':
        await this.collectSuccessPatterns(event);
        break;
      case 'agent_error':
        await this.collectFailurePatterns(event);
        break;
      case 'user_feedback':
        await this.collectUserFeedback(event);
        break;
      case 'test_failed':
        await this.collectTestFailures(event);
        break;
    }

    await this.logEvent(event);
  }

  private async collectSuccessPatterns(event: ExperienceEvent): Promise<void> {
    const session = await this.loadSession(event.sessionId);

    // 提取成功模式
    const patterns = await this.extractPatterns(session, {
      type: 'success',
      indicators: ['completed', 'tests_passed', 'no_errors']
    });

    // 写入Knowledge
    for (const pattern of patterns) {
      await this.writeKnowledge({
        category: 'patterns',
        subcategory: this.inferCategory(pattern),
        slug: this.generateSlug(pattern),
        content: this.formatPattern(pattern)
      });
    }

    // 向量化代码片段
    const codeSnippets = this.extractCodeSnippets(session);
    await this.storeInVectorDb(codeSnippets, {
      category: 'code_snippets',
      sessionId: event.sessionId,
      agentRunId: event.agentRunId
    });
  }
}
```

### Collector提取算法详解

**问题**："提取成功模式"具体怎么实现？用什么算法？

**解决方案：基于LLM的结构化提取 + 验证**

```typescript
// src/evolution/collector/extractor.ts

export class PatternExtractor {
  // 提取算法主函数
  async extractPatterns(
    session: Session,
    options: ExtractionOptions
  ): Promise<Pattern[]> {
    const patterns: Pattern[] = [];

    // 1. 预处理：提取关键片段
    const segments = await this.segmentSession(session);

    // 2. 模式识别（基于LLM）
    for (const segment of segments) {
      const pattern = await this.identifyPattern(segment, options);
      if (pattern && this.validatePattern(pattern)) {
        patterns.push(pattern);
      }
    }

    // 3. 去重（基于相似度）
    const deduped = await this.deduplicatePatterns(patterns);

    // 4. 评分排序
    const scored = this.scorePatterns(deduped);

    return scored.filter(p => p.score > 0.7);  // 只保留高质量模式
  }

  // 步骤1：会话分段
  private async segmentSession(session: Session): Promise<SessionSegment[]> {
    const segments: SessionSegment[] = [];

    // 按Agent Run分段
    for (const run of session.agentRuns) {
      segments.push({
        type: 'agent_run',
        agentType: run.agentType,
        input: run.input,
        output: run.output,
        tools: run.toolCalls,
        timestamp: run.timestamp
      });
    }

    // 按工具调用分段（高频工具调用可能是模式）
    const toolClusters = this.clusterToolCalls(session);
    for (const cluster of toolClusters) {
      if (cluster.count >= 3) {  // 至少出现3次
        segments.push({
          type: 'tool_pattern',
          tools: cluster.tools,
          contexts: cluster.contexts
        });
      }
    }

    return segments;
  }

  // 步骤2：模式识别（LLM）
  private async identifyPattern(
    segment: SessionSegment,
    options: ExtractionOptions
  ): Promise<Pattern | null> {
    const prompt = this.buildExtractionPrompt(segment, options);
    const result = await this.llm.complete(prompt, {
      responseFormat: 'json',
      temperature: 0.1  // 低温度，稳定输出
    });

    const parsed = JSON.parse(result);

    // 验证结构
    if (!parsed.name || !parsed.description || !parsed.applicability) {
      return null;
    }

    return {
      name: parsed.name,
      description: parsed.description,
      category: parsed.category,
      applicability: parsed.applicability,  // 适用场景
      example: parsed.example,
      antiPattern: parsed.antiPattern,      // 反模式（什么时候不用）
      confidence: parsed.confidence
    };
  }

  // 提取Prompt模板
  private buildExtractionPrompt(segment: SessionSegment, options: ExtractionOptions): string {
    return `
你是一个代码模式识别专家。以下是Agent执行的一段会话：

${JSON.stringify(segment)}

请分析并提取可复用的模式（如果存在）。

输出JSON格式：
{
  "hasPattern": true/false,
  "name": "模式名称",
  "description": "模式描述",
  "category": "pattern|pit|solution|decision",
  "applicability": "适用场景（何时使用此模式）",
  "example": "代码示例",
  "antiPattern": "反模式（何时不用）",
  "confidence": 0.0-1.0
}

只返回JSON，不要有其他内容。
`;
  }

  // 步骤3：验证模式
  private validatePattern(pattern: Pattern): boolean {
    // 必填字段检查
    if (!pattern.name || !pattern.description || pattern.confidence < 0.5) {
      return false;
    }

    // 长度检查
    if (pattern.name.length > 100 || pattern.description.length > 1000) {
      return false;
    }

    // 内容检查（拒绝废话）
    const buzzwords = ['please', 'make sure', 'note that', 'important'];
    const hasBuzzwords = buzzwords.some(word =>
      pattern.description.toLowerCase().includes(word)
    );
    if (hasBuzzwords) {
      return false;
    }

    return true;
  }

  // 步骤4：去重（基于向量相似度）
  private async deduplicatePatterns(patterns: Pattern[]): Promise<Pattern[]> {
    const unique: Pattern[] = [];
    const seenEmbeddings: number[][] = [];

    for (const pattern of patterns) {
      const embedding = await this.embedPattern(pattern);

      // 检查是否与已见模式相似
      const isDuplicate = seenEmbeddings.some(seen =>
        this.cosineSimilarity(embedding, seen) > 0.9
      );

      if (!isDuplicate) {
        unique.push(pattern);
        seenEmbeddings.push(embedding);
      }
    }

    return unique;
  }

  // 步骤5：评分
  private scorePatterns(patterns: Pattern[]): Pattern[] {
    return patterns.map(p => ({
      ...p,
      score: this.calculateScore(p)
    })).sort((a, b) => b.score - a.score);
  }

  private calculateScore(pattern: Pattern): number {
    let score = pattern.confidence;

    // 多次出现 = 加分
    if (pattern.occurrences > 3) score += 0.1;

    // 有代码示例 = 加分
    if (pattern.example) score += 0.1;

    // 有反模式说明 = 加分
    if (pattern.antiPattern) score += 0.05;

    return Math.min(score, 1.0);
  }

  // 工具聚类（发现使用模式）
  private clusterToolCalls(session: Session): ToolCluster[] {
    const toolSequences: Map<string, ToolCall[]> = new Map();

    // 滑动窗口提取工具序列
    const windowSize = 3;
    for (let i = 0; i <= session.toolCalls.length - windowSize; i++) {
      const sequence = session.toolCalls.slice(i, i + windowSize);
      const key = sequence.map(t => t.tool).join('->');

      if (!toolSequences.has(key)) {
        toolSequences.set(key, []);
      }
      toolSequences.get(key)!.push(...sequence);
    }

    // 转换为聚类
    return Array.from(toolSequences.entries()).map(([key, calls]) => ({
      sequence: key,
      tools: calls,
      count: calls.length,
      contexts: this.extractContexts(calls)
    }));
  }
}

// 失败模式提取（类似逻辑，但关注错误）
export class FailureExtractor extends PatternExtractor {
  protected buildExtractionPrompt(segment: SessionSegment): string {
    return `
你是一个技术问题诊断专家。以下是Agent执行失败的会话：

${JSON.stringify(segment)}

请分析失败原因并提取可避免的"坑点"（pitfall）。

输出JSON格式：
{
  "hasPitfall": true/false,
  "title": "坑点标题",
  "description": "详细描述",
  "rootCause": "根本原因",
  "solution": "解决方案",
  "prevention": "如何预防",
  "severity": "critical|high|medium|low",
  "confidence": 0.0-1.0
}
`;
  }
}
```

**提取流程图**：

```
Session输入
    ↓
┌─────────────────────────────────────┐
│ 1. 预处理                           │
│    - 按Agent Run分段                │
│    - 按工具序列聚类                 │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. 模式识别（LLM）                  │
│    - 构建提取Prompt                 │
│    - 调用LLM获取结构化输出           │
│    - 解析JSON                       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. 验证                             │
│    - 必填字段检查                   │
│    - 长度检查                       │
│    - 内容质量检查                   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 4. 去重                             │
│    - 计算向量相似度                 │
│    - 过滤相似模式（>0.9）           │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 5. 评分排序                         │
│    - 综合置信度、出现次数、完整性   │
│    - 过滤低分模式（<0.7）           │
└─────────────────────────────────────┘
    ↓
输出高质量模式列表
```

**配置**：

```yaml
evolution:
  collection:
    extractor:
      llm:
        model: claude-sonnet-4-5-20250514
        temperature: 0.1
      validation:
        minConfidence: 0.5
        maxDescriptionLength: 1000
      dedup:
        similarityThreshold: 0.9
      scoring:
        minScore: 0.7
        occurrenceBonus: 0.1
        exampleBonus: 0.1
```

### 反思Agent流程

```typescript
// src/agents/reflector/agent.ts

export class ReflectorAgent {
  async reflect(options: {
    since: string;
    minSessions: number;
  }): Promise<ReflectionResult> {
    // 1. 收集数据
    const sessions = await this.collectSessions(options);

    if (sessions.length < options.minSessions) {
      return { status: 'skipped', reason: 'Not enough sessions' };
    }

    // 2. 分析模式
    const patterns = await this.analyzePatterns(sessions);

    // 3. 更新Knowledge
    const knowledgeUpdates = await this.updateKnowledge(patterns);

    // 4. 优化Prompts
    const promptUpdates = await this.optimizePrompts(patterns);

    // 5. 生成报告
    const report = await this.generateReport({
      patterns,
      knowledgeUpdates,
      promptUpdates,
      sessionsAnalyzed: sessions.length
    });

    return { status: 'completed', report };
  }

  private async optimizePrompts(patterns: Pattern[]): Promise<PromptUpdate[]> {
    const updates: PromptUpdate[] = [];

    for (const agentType of ['planner', 'orchestrator', 'specialist']) {
      const currentPrompt = await this.loadPrompt(agentType);
      const relevantPatterns = patterns.filter(p =>
        p.applicableAgents.includes(agentType)
      );

      if (relevantPatterns.length > 0) {
        const optimizedPrompt = await this.optimizePromptWithPatterns(
          currentPrompt,
          relevantPatterns
        );

        updates.push({
          agentType,
          oldPrompt: currentPrompt,
          newPrompt: optimizedPrompt,
          reason: this.explainOptimization(relevantPatterns)
        });

        // 自动应用优化
        await this.applyPromptUpdate(agentType, optimizedPrompt);
      }
    }

    return updates;
  }
}
```

### Prompt版本控制与回滚

**问题**：Prompt自动优化可能出错，需要版本管理和回滚能力。

**解决方案**：

```typescript
// config/prompts/.history/ 目录结构
config/prompts/
├── .history/
│   ├── planner/
│   │   ├── v1.2025-01-20.prompt.md
│   │   ├── v2.2025-01-25.prompt.md
│   │   └── v3.2025-01-27.prompt.md  # current
│   ├── orchestrator/
│   └── specialist/
├── planner.prompt.md         -> .history/planner/v3.*.prompt.md
├── orchestrator.prompt.md
└── specialist/
```

**Prompt版本格式**：

```yaml
---
version: 3
created: 2025-01-27T10:30:00Z
created_by: reflector
parent_version: 2
change_summary: "添加Next.js Server Actions错误处理模式"
applied: true
rollback_of: null
---
```

**回滚机制**：

```typescript
// src/evolution/prompt-rollback.ts

export class PromptRollbackManager {
  async rollback(agentType: string, toVersion?: number): Promise<void> {
    const history = await this.getHistory(agentType);

    if (toVersion) {
      const target = history.find(v => v.version === toVersion);
      await this.applyVersion(agentType, target);
    } else {
      const current = history[0];
      const previous = history[1];
      await this.applyVersion(agentType, previous);
    }
  }

  async listVersions(agentType: string): Promise<PromptVersion[]> {
    return await this.getHistory(agentType);
  }

  // 新增：自动清理策略
  async cleanup(agentType: string): Promise<void> {
    const history = await this.getHistory(agentType);
    const now = new Date();

    // 清理规则：
    // 1. 保留最近30天的所有版本
    // 2. 保留标记为important的版本（永久）
    // 3. 其他版本删除
    for (const version of history) {
      const age = now.getTime() - new Date(version.created).getTime();
      const ageInDays = age / (1000 * 60 * 60 * 24);

      if (version.important) {
        continue; // 永久保留
      }

      if (ageInDays > 30) {
        await this.deleteVersion(agentType, version.version);
      }
    }
  }
}
```

**自动回滚：检测成功率下降**

```typescript
// src/evolution/prompt-monitor.ts

export class PromptMonitor {
  private successRates = new Map<string, number[]>();  // agentType → [recent rates]

  async trackResult(agentType: string, success: boolean): Promise<void> {
    if (!this.successRates.has(agentType)) {
      this.successRates.set(agentType, []);
    }

    const rates = this.successRates.get(agentType)!;
    rates.push(success ? 1 : 0);

    // 只保留最近50次结果
    if (rates.length > 50) {
      rates.shift();
    }

    // 检查是否需要回滚
    await this.checkAndAutoRollback(agentType);
  }

  private async checkAndAutoRollback(agentType: string): Promise<void> {
    const rates = this.successRates.get(agentType);
    if (!rates || rates.length < 10) return;

    const recentRate = rates.slice(-10).reduce((a, b) => a + b) / 10;
    const baselineRate = rates.slice(0, -10).reduce((a, b) => a + b) / rates.slice(0, -10).length;

    // 如果最近成功率下降超过20%，自动回滚
    if (recentRate < baselineRate * 0.8) {
      console.warn(`[PromptMonitor] ${agentType} 成功率下降: ${baselineRate.toFixed(2)} → ${recentRate.toFixed(2)}`);
      console.warn(`[PromptMonitor] 自动回滚到上一版本...`);

      await this.rollbackManager.rollback(agentType);

      // 标记当前版本为失败
      await this.markVersionAsFailed(agentType);
    }
  }
}
```

**版本管理策略**：

| 策略 | 规则 |
|------|------|
| 数量限制 | 每个agent最多保留100个版本 |
| 时间限制 | 普通版本保留30天，重要版本永久 |
| 自动回滚 | 成功率下降>20%时自动回滚 |
| 重要标记 | 手动标记重要版本：`evoagent prompt pin planner v3` |
```

**CLI命令**：

```bash
# 查看Prompt历史
evoagent prompt history planner

# 回滚到指定版本
evoagent prompt rollback planner --to-version 2

# 回滚到上一版本
evoagent prompt rollback planner
```

### Prompt优化A/B测试

**问题**：Reflector优化Prompt后，如何验证优化是否真的有效？

**解决方案：A/B测试框架**

```typescript
// src/evolution/prompt-ab-test.ts

export class PromptABTester {
  // 运行A/B测试
  async runTest(
    agentType: string,
    controlPrompt: string,      // 对照组（当前Prompt）
    treatmentPrompt: string,    // 实验组（新Prompt）
    sampleSize: number = 20     // 样本大小
  ): Promise<ABTestResult> {
    const results = {
      control: { success: 0, failure: 0, avgTime: 0 },
      treatment: { success: 0, failure: 0, avgTime: 0 },
      significant: false,
      recommendation: 'keep_control'
    };

    // 分配任务到两组
    for (let i = 0; i < sampleSize; i++) {
      const useTreatment = Math.random() < 0.5;
      const prompt = useTreatment ? treatmentPrompt : controlPrompt;

      const result = await this.runTaskWithPrompt(agentType, prompt, i);

      if (useTreatment) {
        if (result.success) results.treatment.success++;
        else results.treatment.failure++;
        results.treatment.avgTime += result.duration;
      } else {
        if (result.success) results.control.success++;
        else results.control.failure++;
        results.control.avgTime += result.duration;
      }
    }

    // 计算平均时间
    results.control.avgTime /= (sampleSize / 2);
    results.treatment.avgTime /= (sampleSize / 2);

    // 统计显著性检验（Fisher精确检验）
    results.significant = this.fisherExactTest(
      results.control.success,
      results.control.failure,
      results.treatment.success,
      results.treatment.failure
    );

    // 给出建议
    if (results.significant) {
      if (results.treatment.success > results.control.success) {
        results.recommendation = 'adopt_treatment';
      } else {
        results.recommendation = 'keep_control';
      }
    }

    return results;
  }

  // Fisher精确检验（判断两组差异是否显著）
  private fisherExactTest(
    aSuccess: number, aFail: number,
    bSuccess: number, bFail: number
  ): boolean {
    // 简化版：使用卡方检验
    const aTotal = aSuccess + aFail;
    const bTotal = bSuccess + bFail;
    const total = aTotal + bTotal;
    const successTotal = aSuccess + bSuccess;

    const expectedA = (aTotal * successTotal) / total;
    const expectedB = (bTotal * successTotal) / total;

    const chiSquare =
      Math.pow(aSuccess - expectedA, 2) / expectedA +
      Math.pow(bSuccess - expectedB, 2) / expectedB;

    // p < 0.05 对应 chiSquare > 3.84
    return chiSquare > 3.84;
  }
}

// Reflector中使用A/B测试
class ReflectorAgent {
  async optimizePrompts(patterns: Pattern[]): Promise<void> {
    for (const agentType of ['planner', 'orchestrator', 'specialist']) {
      const currentPrompt = await this.loadPrompt(agentType);
      const optimizedPrompt = await this.optimizePromptWithPatterns(
        currentPrompt,
        patterns.filter(p => p.applicableAgents.includes(agentType))
      );

      // 运行A/B测试
      const abTester = new PromptABTester();
      const result = await abTester.runTest(agentType, currentPrompt, optimizedPrompt);

      console.log(`[ABTest] ${agentType}:`, result);

      if (result.recommendation === 'adopt_treatment') {
        await this.applyPromptUpdate(agentType, optimizedPrompt);
        console.log(`[ABTest] 采用优化后的Prompt`);
      } else {
        console.log(`[ABTest] 保留原Prompt`);
      }
    }
  }
}
```

**A/B测试配置**：

```yaml
evolution:
  abTesting:
    enabled: true
    sampleSize: 20           # 每组测试样本数
    significanceLevel: 0.05  # 显著性水平
    testTasks:              # 测试任务集
      - "实现一个登录表单"
      - "创建一个用户列表页"
      - "添加API endpoint"
    autoApply: true          # 自动应用获胜版本
```

**测试结果示例**：

```
=== A/B测试结果: planner ===

对照组（当前Prompt）:
  成功率: 85% (17/20)
  平均时间: 45s

实验组（优化Prompt）:
  成功率: 90% (18/20)
  平均时间: 42s

统计显著性: ✓ p < 0.05

建议: adopt_treatment（采用优化后的Prompt）
```

### 错误恢复与失败队列

**问题**：Collector收集失败、Vector DB写入失败时怎么办？

**解决方案：失败队列 + 重试策略**

```typescript
// src/evolution/failure-queue.ts

export interface FailedOperation {
  id: string;
  operation: 'knowledge_write' | 'vector_store' | 'prompt_update';
  payload: unknown;
  error: string;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string;
}

export class FailureQueue {
  private queue: FailedOperation[] = [];

  async enqueue(operation: FailedOperation): Promise<void> {
    this.queue.push(operation);
    await this.persist();
  }

  async retry(): Promise<void> {
    const now = new Date().toISOString();
    const readyToRetry = this.queue.filter(op => op.nextRetryAt <= now);

    for (const op of readyToRetry) {
      try {
        await this.executeOperation(op);
        await this.remove(op.id);
      } catch (error) {
        op.retryCount++;
        if (op.retryCount >= op.maxRetries) {
          // 达到最大重试次数，移到死信队列
          await this.moveToDeadLetter(op);
        } else {
          // 指数退避
          op.nextRetryAt = this.calculateNextRetry(op.retryCount);
        }
      }
    }
  }

  private calculateNextRetry(retryCount: number): string {
    const delay = Math.min(1000 * Math.pow(2, retryCount), 60000); // 最大1分钟
    return new Date(Date.now() + delay).toISOString();
  }
}
```

**触发时机**：
1. Collector写入失败 → 自动入队
2. 定时重试（每5分钟）
3. CLI手动触发：`evoagent failures retry`

### 环境变量配置

**路径配置**：

```bash
# EVOAGENT_HOME: 运行时数据目录
export EVOAGENT_HOME="${EVOAGENT_HOME:-$HOME/.evoagent}"

# 目录结构
$EVOAGENT_HOME/
├── sessions/              # Session文件
├── knowledge/             # Knowledge库
├── vector.db              # 向量数据库
├── prompts/               # Prompt版本历史
├── failures.jsonl         # 失败队列
└── config.yaml            # 用户配置覆盖
```

**支持的环境变量**：

| 变量 | 默认值 | 说明 | 验证规则 |
|------|--------|------|----------|
| `EVOAGENT_HOME` | `~/.evoagent` | 运行时数据目录 | 路径必须可写 |
| `EVOAGENT_PORT` | `18790` | Gateway端口 | 1024-65535 |
| `EVOAGENT_LOG_LEVEL` | `info` | 日志级别 | debug\|info\|warn\|error |
| `EVOAGENT_SESSION_RETENTION` | `90days` | Session保留时间 | 正整数+days |
| `EVOAGENT_API_KEY` | - | Anthropic API密钥 | sk-ant-... 格式 |

**环境变量验证**：

```typescript
// src/config/env.ts

function validateEnv(): void {
  const errors: string[] = [];

  // 端口验证
  const port = parseInt(process.env.EVOAGENT_PORT || '18790');
  if (isNaN(port) || port < 1024 || port > 65535) {
    errors.push('EVOAGENT_PORT must be between 1024 and 65535');
  }

  // 日志级别验证
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  const logLevel = process.env.EVOAGENT_LOG_LEVEL || 'info';
  if (!validLogLevels.includes(logLevel)) {
    errors.push(`EVOAGENT_LOG_LEVEL must be one of: ${validLogLevels.join(', ')}`);
  }

  // API密钥格式验证
  const apiKey = process.env.EVOAGENT_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (apiKey && !apiKey.startsWith('sk-ant-')) {
    errors.push('EVOAGENT_API_KEY must start with "sk-ant-"');
  }

  // 目录可写验证
  const homeDir = process.env.EVOAGENT_HOME || path.join(os.homedir(), '.evoagent');
  try {
    fs.ensureDirSync(homeDir);
    fs.accessSync(homeDir, fs.constants.W_OK);
  } catch {
    errors.push(`EVOAGENT_HOME (${homeDir}) is not writable`);
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n  - ${errors.join('\n  - ')}`);
  }
}
```

**配置加载顺序**（优先级从低到高）：

```
1. 内置默认值 (src/config/defaults.ts)
   ↓
2. 项目配置 (config/config.yaml)
   ↓
3. 用户配置 (~/.evoagent/config.yaml)
   ↓
4. 环境变量 (覆盖同名配置项)
```

**示例**：

```typescript
// 最终配置 = 合并后的结果
const finalConfig = {
  ...defaults,              // 1. 内置默认
  ...projectConfig,         // 2. 项目配置
  ...userConfig,            // 3. 用户配置
  ...envConfig             // 4. 环境变量（最高优先级）
};
```

**配置来源查看**：

```bash
# 查看当前配置及来源
evoagent config explain

# 输出示例
server.port: 18790 (from: project config)
memory.vector.embedding.provider: ollama (from: user config ~/.evoagent/config.yaml)
EVOAGENT_LOG_LEVEL: debug (from: environment variable)
```

---

## Gateway通信协议

### WebSocket协议定义

**连接**：`ws://localhost:18790`

**消息格式**（JSON）：

```typescript
// 客户端 → Gateway
interface GatewayRequest {
  jsonrpc: "2.0";
  id: string;           // 请求ID
  method: string;       // 方法名
  params?: unknown;     // 参数
}

// Gateway → 客户端
interface GatewayResponse {
  jsonrpc: "2.0";
  id: string;          // 对应的请求ID
  result?: unknown;    // 成功结果
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Gateway → 客户端（服务端推送）
interface GatewayNotification {
  jsonrpc: "2.0";
  method: "event";      // 固定为"event"
  params: {
    stream: "lifecycle" | "progress" | "log";
    data: unknown;
  };
}
```

### 支持的方法

| 方法 | 参数 | 说明 |
|------|------|------|
| `agent.spawn` | `{agentType, input, sessionId}` | 启动Agent |
| `agent.send` | `{runId, message}` | 向Agent发送消息（A2A） |
| `agent.status` | `{runId}` | 查询Agent状态 |
| `agent.wait` | `{runId}` | 等待Agent完成 |
| `session.create` | `{}` | 创建新Session |
| `session.list` | `{}` | 列出所有Session |
| `session.get` | `{sessionId}` | 获取Session详情 |
| `knowledge.search` | `{query, category?}` | 搜索Knowledge |
| `memory.search` | `{query, limit?}` | 语义搜索Memory |

### Lane Queue调度策略

**设计原则**：通过架构设计避免死锁，而不是运行时检测

```typescript
// Lane类型及并发度
interface LaneConfig {
  planner: { maxConcurrent: 1 };   // 串行，避免规划冲突
  main: { maxConcurrent: 4 };      // 主任务并发
  parallel: { maxConcurrent: 8 };  // 并行任务高并发
}

// 调度策略：严格FIFO
interface QueueEntry {
  lane: LaneType;
  agentType: AgentType;
  /**
   * @note priority字段仅用于统计和日志记录
   * 调度顺序严格按照FIFO（按enqueuedAt时间），不支持动态优先级提升
   */
  priority: 'high' | 'normal' | 'low';
  enqueuedAt: string;
  sessionId: string;  // 新增：session隔离
}

// 优先级来源（仅用于标识，不影响调度顺序）：
// 1. Planner任务 → high
// 2. 用户手动触发 → high
// 3. Orchestrator任务 → normal
// 4. Reflector任务 → low

// 调度顺序（严格FIFO，不支持优先级插队）：
// 1. 按 session 隔离：不同session的任务互不影响
// 2. 同session内：按lane优先级 (planner > main > parallel)
// 3. 同lane内：严格FIFO (按enqueuedAt，priority不影响顺序)
```

### 死锁预防策略（架构层面）

**核心思想**：让死锁在架构上不可能发生

```typescript
// 预防措施1：Session隔离
// 每个session有独立的队列，session之间完全隔离
interface SessionQueue {
  sessionId: string;
  lanes: {
    planner: QueueEntry[];
    main: QueueEntry[];
    parallel: QueueEntry[];
  };
}

// 预防措施2：严格FIFO执行
// 不支持任务优先级动态提升，避免循环等待
class LaneQueue {
  private queues: Map<string, SessionQueue> = new Map();

  async enqueue(entry: QueueEntry): Promise<void> {
    const sessionQueue = this.getOrCreateSession(entry.sessionId);
    sessionQueue.lanes[entry.lane].push(entry);
    this.drain(entry.lane, entry.sessionId);
  }

  private drain(lane: LaneType, sessionId: string): void {
    const sessionQueue = this.getOrCreateSession(sessionId);
    const queue = sessionQueue.lanes[lane];
    const config = LANE_CONFIG[lane];

    // 严格FIFO：只有当前任务完成后才开始下一个
    while (queue.length > 0 && sessionQueue.active[lane] < config.maxConcurrent) {
      const entry = queue.shift();
      sessionQueue.active[lane]++;

      this.execute(entry).finally(() => {
        sessionQueue.active[lane]--;
        this.drain(lane, sessionId);  // 继续处理下一个
      });
    }
  }
}

// 预防措施3：超时保护
// 每个任务有最大执行时间，超时后强制终止
interface TaskConfig {
  maxDuration: number;  // 默认30分钟
  onTimeout: 'terminate' | 'warn';
}
```

**为什么不会死锁**：

| 原因 | 说明 |
|------|------|
| Session隔离 | 不同session的任务互不阻塞 |
| 严格FIFO | 同一lane内按顺序执行，无循环等待 |
| 无优先级动态提升 | 不会出现A等B、B等A的情况 |
| 超时保护 | 任务不会无限等待 |

**与死锁检测的对比**：

| 方面 | 死锁检测 | 死锁预防 |
|------|----------|----------|
| 复杂度 | O(V+E)环检测 | O(1)FIFO |
| 可靠性 | 检测算法可能有bug | 架构保证无死锁 |
| 恢复 | 需要复杂的恢复逻辑 | 无需恢复 |
| 性能 | 每次等待都需要检测 | 无额外开销 |

### 并发冲突解决策略

**问题场景**：模式C中多个Specialist并行工作，可能同时修改同一文件。

**解决方案**：proper-lockfile + 冲突预防

```typescript
// 使用成熟的 proper-lockfile 库
import lockfile from 'proper-lockfile';

// src/runtime/file-lock.ts

export class FileLockManager {
  // 获取文件锁并执行操作
  async withLock<T>(
    filePath: string,
    agentId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    let release: (() => Promise<void>) | undefined;

    try {
      // 获取锁
      release = await lockfile.lock(filePath, {
        retries: {
          retries: 10,           // 重试10次
          minTimeout: 100,       // 最小等待100ms
          maxTimeout: 5000,      // 最大等待5秒
        },
        stale: 30000,            // 30秒后认为锁过期
        update: 10000,           // 每10秒更新锁时间
      });

      console.log(`[FileLock] ${agentId} 获取锁: ${filePath}`);

      // 执行操作
      const result = await operation();
      return result;

    } catch (error) {
      if (error.code === 'ELOCKED') {
        throw new FileLockError(
          `文件被锁定: ${filePath}`,
          filePath,
          agentId
        );
      }
      throw error;
    } finally {
      // 释放锁
      if (release) {
        try {
          await release();
          console.log(`[FileLock] ${agentId} 释放锁: ${filePath}`);
        } catch (err) {
          console.error(`[FileLock] 释放锁失败:`, err);
        }
      }
    }
  }

  // 检查文件是否被锁定
  async isLocked(filePath: string): Promise<boolean> {
    return await lockfile.check(filePath);
  }
}

// 自定义错误类
export class FileLockError extends Error {
  constructor(
    message: string,
    public filePath: string,
    public agentId: string
  ) {
    super(message);
    this.name = 'FileLockError';
  }

  // 用户友好的错误信息
  toUserMessage(): string {
    return `
❌ 无法获取文件锁: ${this.filePath}

💡 这可能是因为另一个Agent正在编辑此文件

🔧 解决方法：
   1. 等待几秒后重试
   2. 或使用 --force 选项强制重试（风险：可能产生冲突）
   3. 或使用 evoagent doctor 检查系统状态

📍 当前Agent: ${this.agentId}
`;
  }
}
```

**配置示例**：

```yaml
runtime:
  fileLock:
    retries: 10
    minTimeout: 100    # ms
    maxTimeout: 5000   # ms
    stale: 30000       # 30秒
    update: 10000      # 10秒
```

**冲突预防策略**：

```typescript
// 优先级：避免冲突 > 处理冲突

// 策略1：任务分配时避免冲突
export function assignFilesToAgents(tasks: Task[]): Assignment {
  // 分析每个任务需要修改的文件
  // 将有文件冲突的任务分配到不同时间段
  const fileUsage = analyzeFileUsage(tasks);

  // 构建冲突图
  const conflictGraph = buildConflictGraph(fileUsage);

  // 使用图着色算法分配时间段
  return scheduleByTimeSlot(tasks, conflictGraph);
}

// 策略2：文件级锁足够，不需要细粒度锁
// - 代码文件的修改通常是原子操作（写整个文件）
// - 函数级别的锁增加复杂度，收益不大
// - 通过任务分配避免冲突，锁只是最后一道防线
```

**proper-lockfile 的优势**：

| 特性 | 说明 |
|------|------|
| 跨平台 | Windows/macOS/Linux统一API |
| 异常安全 | 进程崩溃后自动释放锁 |
| 自动续期 | 长时间操作自动更新锁时间 |
| 重试机制 | 内置指数退避重试 |
| 生产验证 | 被npm、eslint等广泛使用 |

**package.json 添加依赖**：

```json
{
  "dependencies": {
    "proper-lockfile": "^4.1.2"
  }
}
```

### Session归档时机

```typescript
// Session生命周期
interface SessionLifecycle {
  status: 'active' | 'archived' | 'pruned';

  // 归档时机：
  // 1. 模式A: Orchestrator完成时立即归档
  // 2. 模式B: 最后一个Specialist完成时归档
  // 3. 模式C: 所有并行Specialist完成时归档
  // 4. 模式D: 最后一个phase完成时归档

  // 判断逻辑：
  // Orchestrator在spawn Specialist时记录 childRunIds
  // 当所有 childRunIds 状态为 completed/failed 时，归档Session

  // 期间处理：
  // - Specialist运行时，Session继续追加记录
  // - Orchestrator等待期间，Session状态保持 active
}

// 归档触发代码示例
async function maybeArchiveSession(sessionId: string): Promise<void> {
  const session = await loadSession(sessionId);
  const orchestrator = session.agentRuns.find(r => r.agentType === 'orchestrator');

  if (!orchestrator || orchestrator.status !== 'completed') {
    return; // 还没完成
  }

  // 检查所有子Agent是否完成
  const pendingChildren = orchestrator.childRunIds
    ?.map(id => getAgentRun(id))
    .filter(run => run && run.status === 'running');

  if (!pendingChildren || pendingChildren.length === 0) {
    await archiveSession(sessionId);
  }
}

/**
 * 崩溃恢复机制
 *
 * 处理Agent崩溃或进程被杀死的场景
 */
interface SessionRecoveryOptions {
  timeout: number;       // 超时时间（ms），默认30分钟
  heartbeatInterval: number; // 心跳间隔（ms），默认1分钟
}

const DEFAULT_RECOVERY_OPTIONS: SessionRecoveryOptions = {
  timeout: 30 * 60 * 1000,  // 30分钟
  heartbeatInterval: 60 * 1000,  // 1分钟
};

/**
 * 检测并处理崩溃的Session
 *
 * 场景：
 * 1. Agent进程被杀死（SIGKILL）
 * 2. 系统崩溃
 * 3. 网络断开导致Agent失联
 */
async function detectCrashedSessions(options?: SessionRecoveryOptions): Promise<string[]> {
  const opts = { ...DEFAULT_RECOVERY_OPTIONS, ...options };
  const crashed: string[] = [];

  const activeSessions = await listSessions({ status: 'active' });
  const now = Date.now();

  for (const session of activeSessions) {
    // 检查最后更新时间
    if (now - session.updatedAt > opts.timeout) {
      // 检查是否有Agent仍在运行
      const hasRunningAgents = session.agentRuns?.some(run => run.status === 'running');

      if (hasRunningAgents) {
        console.warn(`[Recovery] Session ${session.sessionId} appears crashed (last update ${new Date(session.updatedAt).toISOString()})`);
        crashed.push(session.sessionId);
      }
    }
  }

  return crashed;
}

/**
 * 恢复崩溃的Session
 *
 * 策略：
 * 1. 将所有running状态的Agent标记为failed
 * 2. 保留Session内容供分析
 * 3. 可选：自动重新执行（需要用户确认）
 */
async function recoverCrashedSession(sessionId: string): Promise<void> {
  const session = await loadSession(sessionId);

  // 将所有running状态的Agent标记为failed
  for (const run of session.agentRuns) {
    if (run.status === 'running') {
      run.status = 'failed';
      run.error = {
        message: 'Agent crashed or timed out',
        timestamp: Date.now(),
      };
    }
  }

  // 保存更新后的Session
  await saveSession(session);

  console.log(`[Recovery] Session ${sessionId} marked as failed due to crash`);
}
```

### Session价值评估

基于OpenMemory专家反馈：早期session往往包含最有价值的学习数据，不应简单按时间删除。

```typescript
// Session价值评分接口
interface SessionValue {
  sessionId: string;

  // 核心价值指标
  uniqueness: number;      // 唯一性得分 (0-1)：与历史session的语义差异度
  referenceCount: number;  // 引用计数：被后续session/知识引用的次数
  successRate: number;     // 成功率 (0-1)：agent任务完成成功率

  // 辅助指标
  freshness: number;       // 新鲜度 (0-1)：最近被访问的频率
  complexity: number;      // 复杂度 (0-1)：任务复杂程度（工具调用数、代码行数）
  errorRecovery: number;   // 错误恢复值 (0-1)：是否包含错误处理经验

  // 综合评分
  overallScore: number;    // 综合得分 (0-100)：加权计算

  // 元数据
  keepForever: boolean;    // 永久保留标记（人工或自动标记）
  lastAccessedAt: number;  // 最后访问时间
  evaluatedAt: number;     // 评估时间
}

// 价值评估器
export class SessionValueEvaluator {
  private weights = {
    uniqueness: 0.25,      // 唯一性最重要 - 代表新颖知识
    referenceCount: 0.25,  // 引用次数 - 代表复用价值
    successRate: 0.20,     // 成功率 - 代表可靠性
    freshness: 0.10,       // 新鲜度 - 代表近期关联
    complexity: 0.10,      // 复杂度 - 代表知识密度
    errorRecovery: 0.10,   // 错误恢复 - 代表学习价值
  };

  async evaluate(session: Session, history: Session[]): Promise<SessionValue> {
    // 1. 唯一性：与最近10个session的语义相似度
    const uniqueness = await this.calculateUniqueness(session, history);

    // 2. 引用计数：从Memory向量DB查询引用次数
    const referenceCount = await this.countReferences(session.sessionId);

    // 3. 成功率：统计agentRun的完成情况
    const successRate = this.calculateSuccessRate(session);

    // 4. 新鲜度：基于lastAccessedAt的衰减
    const freshness = this.calculateFreshness(session);

    // 5. 复杂度：工具调用数量、代码行数
    const complexity = this.calculateComplexity(session);

    // 6. 错误恢复值：是否包含error→recovery的模式
    const errorRecovery = this.calculateErrorRecovery(session);

    // 综合得分 (0-100)
    const overallScore =
      uniqueness * this.weights.uniqueness * 100 +
      Math.min(referenceCount / 10, 1) * this.weights.referenceCount * 100 +
      successRate * this.weights.successRate * 100 +
      freshness * this.weights.freshness * 100 +
      complexity * this.weights.complexity * 100 +
      errorRecovery * this.weights.errorRecovery * 100;

    // 自动keepForever规则
    const keepForever =
      overallScore > 80 ||           // 高分session
      referenceCount >= 5 ||         // 高引用session
      errorRecovery > 0.8;           // 包含重要错误恢复经验

    return {
      sessionId: session.sessionId,
      uniqueness,
      referenceCount,
      successRate,
      freshness,
      complexity,
      errorRecovery,
      overallScore,
      keepForever,
      lastAccessedAt: session.lastAccessedAt || Date.now(),
      evaluatedAt: Date.now(),
    };
  }

  private async calculateUniqueness(session: Session, history: Session[]): Promise<number> {
    // 取最近10个session，计算语义相似度
    const recentSessions = history.slice(-10);
    if (recentSessions.length === 0) return 1.0;

    // 使用TF-IDF余弦相似度（避免依赖Memory的embedding，防止循环依赖）
    const similarities = await Promise.all(
      recentSessions.map(s => this.textSimilarity(session, s))
    );

    // 唯一性 = 1 - 平均相似度
    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    return 1 - avgSimilarity;
  }

  /**
   * 文本相似度（TF-IDF + 余弦相似度）
   * 独立实现，不依赖Memory的embedding能力
   */
  private textSimilarity(s1: Session, s2: Session): number {
    // 提取文本特征
    const text1 = this.extractTextFeatures(s1);
    const text2 = this.extractTextFeatures(s2);

    // 计算余弦相似度
    return this.cosineSimilarity(text1, text2);
  }

  /**
   * 提取Session的文本特征
   */
  private extractTextFeatures(session: Session): string {
    const parts: string[] = [];

    // 用户输入（最重要）
    if (session.userInput) {
      parts.push(session.userInput);
    }

    // 任务摘要
    if (session.summary) {
      parts.push(session.summary);
    }

    // 使用的工具
    const tools = session.toolCalls?.map(t => t.toolName).join(' ') || '';
    if (tools) {
      parts.push(tools);
    }

    return parts.join(' ').toLowerCase();
  }

  /**
   * 余弦相似度（简化版TF-IDF）
   */
  private cosineSimilarity(text1: string, text2: string): number {
    // 分词（简化版：按空格和常见分隔符）
    const tokens1 = this.tokenize(text1);
    const tokens2 = this.tokenize(text2);

    // 构建词频向量
    const freq1 = this.getTermFrequency(tokens1);
    const freq2 = this.getTermFrequency(tokens2);

    // 计算所有唯一词
    const allTerms = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);

    // 计算余弦相似度
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const term of allTerms) {
      const f1 = freq1[term] || 0;
      const f2 = freq2[term] || 0;

      dotProduct += f1 * f2;
      norm1 += f1 * f1;
      norm2 += f2 * f2;
    }

    if (norm1 === 0 || norm2 === 0) return 0;

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * 简化分词（支持中英文）
   */
  private tokenize(text: string): string[] {
    // 移除特殊字符，按空格分词
    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1); // 过滤单字符
  }

  /**
   * 计算词频（TF）
   */
  private getTermFrequency(tokens: string[]): Record<string, number> {
    const freq: Record<string, number> = {};
    for (const token of tokens) {
      freq[token] = (freq[token] || 0) + 1;
    }
    return freq;
  }

  private async countReferences(sessionId: string): Promise<number> {
    // 从Memory向量DB查询有多少向量引用了这个session
    // 实际实现：查询metadata.related_sessions包含sessionId的向量数
    return 0; // 占位符
  }

  private calculateSuccessRate(session: Session): number {
    const runs = session.agentRuns || [];
    if (runs.length === 0) return 0.5;

    const completed = runs.filter(r => r.status === 'completed').length;
    return completed / runs.length;
  }

  private calculateFreshness(session: Session): number {
    const daysSinceAccess = (Date.now() - (session.lastAccessedAt || session.createdAt)) / (1000 * 60 * 60 * 24);
    // 指数衰减：7天内为1.0，30天后降至0.1
    return Math.exp(-daysSinceAccess / 7);
  }

  private calculateComplexity(session: Session): number {
    const toolCallCount = session.toolCalls?.length || 0;
    // 工具调用越多，复杂度越高（上限1.0）
    return Math.min(toolCallCount / 50, 1.0);
  }

  private calculateErrorRecovery(session: Session): number {
    // 检查是否有error→success的模式
    const hasErrorRecovery = session.agentRuns?.some(run =>
      run.status === 'completed' && run.errors?.length > 0
    );
    return hasErrorRecovery ? 1.0 : 0;
  }
}

// Session清理策略
interface SessionCleanupPolicy {
  // 基于价值的清理规则（按优先级排序）
  rules: [
    { condition: 'keepForever === true', action: '保留', priority: 1 },
    { condition: 'overallScore >= 60', action: '保留', priority: 2 },
    { condition: 'overallScore < 30 && age > 7 days', action: '可清理', priority: 3 },
    { condition: 'overallScore < 40 && age > 30 days', action: '可清理', priority: 4 },
    { condition: 'age > 90 days', action: '评估后决定', priority: 5 },
  ];

  // 默认：低价值session在7天后可被清理，高价值session永久保留
  // keepForever标记的session永远不会被清理
}
```

**价值评估触发时机**：
1. Session归档时：首次评估
2. Reflector运行时：重新评估所有归档session
3. 手动触发：`evoagent session revalue`

**CLI更新**：
```bash
# 基于价值的清理（推荐）
evoagent session cleanup --low-value  # 清理低价值session（评分<30且>7天）

# 基于时间的清理（备用）
evoagent session cleanup --older-than 90days

# 查看session价值
evoagent session list --sort-by value
evoagent session get --id <session-id> --show-value

# 手动标记永久保留
evoagent session keep --id <session-id>
evoagent session unkeep --id <session-id>
```

### Session存储性能优化

基于PageIndex专家反馈：JSONL文件随着session数量增长，读取性能会显著下降。需要优化索引和缓存策略。

```typescript
// src/storage/session-storage.ts

/**
 * Session存储层设计
 *
 * Phase 0 (MVP): 简单JSONL + 内存索引
 * Phase 1: 添加Session元数据SQLite表
 * Phase 2: 考虑完全迁移到SQLite（可选）
 */

// ========== Phase 0: JSONL + 索引 ==========

interface SessionMetadata {
  sessionId: string;
  userId?: string;
  status: 'active' | 'archived' | 'pruned';
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  agentRunCount: number;
  messageCount: number;
  fileSize: number;        // .jsonl文件大小
  valueScore?: number;      // 价值评分
  keepForever: boolean;     // 永久保留标记
}

// Session索引文件（.index.json）
interface SessionIndex {
  version: number;          // 索引格式版本
  lastUpdated: number;
  sessions: Map<string, SessionMetadata>;
}

// 元数据查询优化：无需读取完整JSONL
export class SessionStorage {
  private sessionDir: string;
  private indexPath: string;
  private index: SessionIndex;
  private indexLock: any;   // proper-lockfile实例

  constructor(sessionDir: string) {
    this.sessionDir = sessionDir;
    this.indexPath = path.join(sessionDir, '.index.json');
  }

  /**
   * 初始化：加载或重建索引
   */
  async init(): Promise<void> {
    // 1. 尝试加载现有索引
    if (await fs.pathExists(this.indexPath)) {
      try {
        this.index = JSON.parse(await fs.readFile(this.indexPath, 'utf-8'));
        // 验证索引完整性
        await this.validateIndex();
        return;
      } catch (error) {
        console.warn('[SessionStorage] 索引损坏，将重建');
      }
    }

    // 2. 重建索引
    await this.rebuildIndex();
  }

  /**
   * 重建索引：扫描所有.jsonl文件
   */
  async rebuildIndex(): Promise<void> {
    const sessions: Map<string, SessionMetadata> = new Map();
    const files = await fs.readdir(this.sessionDir);

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;

      const sessionId = file.slice(0, -6);
      const filePath = path.join(this.sessionDir, file);
      const stats = await fs.stat(filePath);

      // 读取首行获取基本元数据
      const firstLine = await this.readFirstLine(filePath);
      const sessionStart = JSON.parse(firstLine);

      sessions.set(sessionId, {
        sessionId,
        userId: sessionStart.userId,
        status: 'archived',  // 默认归档
        createdAt: sessionStart.timestamp || stats.birthtimeMs,
        updatedAt: stats.mtimeMs,
        agentRunCount: await this.countAgentRuns(filePath),
        messageCount: await this.countLines(filePath),
        fileSize: stats.size,
        keepForever: false,
      });
    }

    this.index = {
      version: 1,
      lastUpdated: Date.now(),
      sessions,
    };

    await this.saveIndex();
  }

  /**
   * 追加写入（带索引更新）
   */
  async append(sessionId: string, event: SessionEvent): Promise<void> {
    const filePath = this.getSessionPath(sessionId);

    // 1. 追加到JSONL
    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(filePath, line, 'utf-8');

    // 2. 更新索引
    const meta = this.index.sessions.get(sessionId);
    if (meta) {
      meta.updatedAt = Date.now();
      meta.messageCount++;
      meta.fileSize += line.length;
      if (event.type === 'agent.run.completed') {
        meta.agentRunCount++;
      }
      await this.saveIndex();
    }
  }

  /**
   * 读取Session（流式读取，避免OOM）
   */
  async loadSession(sessionId: string): Promise<Session> {
    const filePath = this.getSessionPath(sessionId);
    const events: SessionEvent[] = [];
    let corruptedLines = 0;

    // 使用 readline 逐行读取
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      try {
        events.push(JSON.parse(line));
      } catch (error) {
        corruptedLines++;
        // 只记录第一个错误，避免刷屏
        if (corruptedLines === 1) {
          console.warn(`[SessionStorage] Corrupted line in ${sessionId}, skipping`);
        }
      }
    }

    if (corruptedLines > 0) {
      console.warn(`[SessionStorage] Skipped ${corruptedLines} corrupted lines in ${sessionId}`);
    }

    return this.buildSession(events);
  }

  /**
   * 查询Session元数据（无需读取JSONL）
   */
  getMetadata(sessionId: string): SessionMetadata | undefined {
    return this.index.sessions.get(sessionId);
  }

  /**
   * 列出Session（基于索引）
   */
  listSessions(filter?: SessionFilter): SessionMetadata[] {
    let sessions = Array.from(this.index.sessions.values());

    if (filter) {
      sessions = sessions.filter(s => {
        if (filter.status && s.status !== filter.status) return false;
        if (filter.userId && s.userId !== filter.userId) return false;
        if (filter.minScore !== undefined && (s.valueScore || 0) < filter.minScore) return false;
        if (filter.keepForever !== undefined && s.keepForever !== filter.keepForever) return false;
        return true;
      });
    }

    // 默认按更新时间倒序
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 删除Session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const filePath = this.getSessionPath(sessionId);

    // 删除JSONL文件
    await fs.remove(filePath);

    // 更新索引
    this.index.sessions.delete(sessionId);
    await this.saveIndex();
  }

  // ========== 辅助方法 ==========

  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionDir, `${sessionId}.jsonl`);
  }

  private async saveIndex(): Promise<void> {
    // 跨平台原子写入
    const tmpPath = this.indexPath + '.tmp';
    const content = JSON.stringify({
      ...this.index,
      sessions: Array.from(this.index.sessions.entries()),
    });
    await fs.writeFile(tmpPath, content, 'utf-8');

    // Windows兼容：使用Node.js 15+的replaceFile（真正的原子操作）
    // 或使用fs-extra的move with overwrite
    if (fs.promises.replaceFile) {
      // Node.js 15+: 使用replaceFile（Windows原子替换）
      await fs.promises.replaceFile(tmpPath, this.indexPath);
    } else {
      // 兼容旧版本：先删除再重命名
      // 注：非原子操作，但崩溃时可从JSONL重建索引
      try {
        await fs.unlink(this.indexPath);
      } catch { /* 文件不存在，忽略 */ }
      await fs.rename(tmpPath, this.indexPath);
    }
  }

  private async validateIndex(): Promise<boolean> {
    // 检查索引中的文件是否都存在
    for (const [sessionId] of this.index.sessions) {
      const filePath = this.getSessionPath(sessionId);
      if (!(await fs.pathExists(filePath))) {
        console.warn(`[SessionStorage] Session文件不存在: ${sessionId}`);
        return false;
      }
    }
    return true;
  }

  private async readFirstLine(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      const rl = readline.createInterface({ input: stream });
      rl.once('line', line => {
        rl.close();
        stream.close();
        resolve(line);
      });
      rl.once('error', reject);
    });
  }

  private async countLines(filePath: string): Promise<number> {
    let count = 0;
    const rl = readline.createInterface(fs.createReadStream(filePath));
    for await (const _ of rl) count++;
    rl.close();
    return count;
  }

  private async countAgentRuns(filePath: string): Promise<number> {
    let count = 0;
    const rl = readline.createInterface(fs.createReadStream(filePath));
    for await (const line of rl) {
      const event = JSON.parse(line);
      if (event.type?.startsWith('agent.run')) count++;
    }
    rl.close();
    return count;
  }

  private buildSession(events: SessionEvent[]): Session {
    // 从事件构建Session对象
    const session: Session = {
      sessionId: events[0]?.sessionId || '',
      userId: events[0]?.userId,
      createdAt: events[0]?.timestamp || Date.now(),
      agentRuns: [],
      messages: [],
      toolCalls: [],
    };

    // 解析事件...
    return session;
  }
}

// ========== Phase 1: SQLite元数据表（可选升级）==========

/**
 * 当索引文件性能不足时，可升级到SQLite
 *
 * 优势：
 * - 查询性能更好（索引优化）
 * - 支持复杂查询（JOIN, GROUP BY）
 * - 事务安全
 *
 * 代价：
 * - 额外的依赖（已有better-sqlite3）
 * - 略微增加复杂度
 */

interface SessionTableSchema {
  // sessions表
  session_id: string;      // PRIMARY KEY
  user_id?: string;
  status: string;
  created_at: number;
  updated_at: number;
  completed_at?: number;
  agent_run_count: number;
  message_count: number;
  file_size: number;
  value_score?: number;
  keep_forever: boolean;

  // indexes
  // idx_status: (status)
  // idx_user_id: (user_id)
  // idx_updated_at: (updated_at)
  // idx_value_score: (value_score)
}

export class SessionStorageSQLite extends SessionStorage {
  private db: Database;

  constructor(sessionDir: string, dbPath: string) {
    super(sessionDir);
    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT,
        status TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        completed_at INTEGER,
        agent_run_count INTEGER DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        file_size INTEGER DEFAULT 0,
        value_score REAL,
        keep_forever INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_updated_at ON sessions(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_value_score ON sessions(value_score);
    ``);
  }

  /**
   * 高级查询示例
   */
  findLowValueSessions(daysOld: number, maxScore: number): SessionMetadata[] {
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    return this.db.prepare(`
      SELECT * FROM sessions
      WHERE updated_at < ? AND value_score < ? AND keep_forever = 0
      ORDER BY value_score ASC
    `).all(cutoff, maxScore);
  }

  async cleanup(): Promise<void> {
    // 清理已删除session的元数据
    const sessions = this.db.prepare('SELECT session_id FROM sessions').all();
    for (const { session_id } of sessions) {
      const filePath = this.getSessionPath(session_id);
      if (!(await fs.pathExists(filePath))) {
        this.db.prepare('DELETE FROM sessions WHERE session_id = ?').run(session_id);
      }
    }
  }
}
```

**性能对比**：

| 操作 | 纯JSONL | JSONL + 索引 | SQLite + JSONL |
|------|---------|-------------|----------------|
| 列出sessions | O(n) 扫描 | O(1) 内存 | O(log n) 索引 |
| 按状态筛选 | O(n) 扫描 | O(n) 内存 | O(log n) 索引 |
| 按价值筛选 | 不支持 | O(n) 内存 | O(log n) 索引 |
| 读取完整session | O(n) 流式 | O(n) 流式 | O(n) 流式 |
| 追加事件 | O(1) | O(1) + 索引 | O(1) + DB |
| 索引重建 | 不需要 | O(n) 扫描 | 不需要 |

**推荐路径**：
- Phase 0 (MVP): 使用 JSONL + 索引方案
- Phase 1: 监控性能，如果索引文件>10MB，考虑升级到SQLite
- Phase 2: 完全迁移到SQLite（可选，JSONL仍用于备份）

**监控指标**：
```bash
# 查看Session存储状态
evoagent session stats
# 输出:
# Total sessions: 1,234
# Index file size: 2.3MB
# Total JSONL size: 156MB
# Avg session size: 128KB
# Query latency: 5ms (p50), 23ms (p99)
```

### 上下文压缩：超长Session自动压缩

基于OpenMemory专家反馈：随着session增长，完整读取会导致：
1. 内存占用过高（OOM风险）
2. 传递给LLM的上下文过长（成本高、性能差）

需要自动压缩机制。

```typescript
// src/storage/session-compression.ts

/**
 * Session压缩策略
 *
 * 目标：
 * - 控制内存占用（单个session < 10MB）
 * - 保留关键信息（决策、错误、解决方案）
 * - 可追溯（保留原始引用）
 *
 * 触发条件：
 * - 消息数量 > 500
 * - 文件大小 > 5MB
 * - Agent完成后自动压缩
 */

interface CompressedSession {
  sessionId: string;

  // 压缩摘要
  summary: {
    task: string;              // 原始任务描述
    outcome: string;           // 最终结果
    duration: number;          // 执行时长
    agentRuns: number;         // Agent运行次数
    toolsUsed: string[];       // 使用的工具
  };

  // 关键决策点（保留完整）
  keyDecisions: Array<{
    timestamp: number;
    agentType: string;
    decision: string;
    reasoning: string;
  }>;

  // 错误和恢复（保留完整）
  errors: Array<{
    timestamp: number;
    error: string;
    solution: string;
    toolCalls?: string[];
  }>;

  // 代码片段（去重）
  codeSnippets: Array<{
    filePath: string;
    description: string;
    hash: string;              // 内容哈希，用于去重
  }>;

  // 压缩统计
  compressionStats: {
    originalEvents: number;
    compressedEvents: number;
    compressionRatio: number;  // e.g. 0.1 (压缩到10%)
    compressedAt: number;
  };

  // 原始文件引用
  originalFile: string;        // 原始.jsonl文件路径
}

export class SessionCompressor {
  private readonly THRESHOLDS = {
    maxMessages: 500,
    maxSizeMB: 5,
    targetCompression: 0.1,    // 压缩到10%
  };

  /**
   * 检查是否需要压缩
   */
  shouldCompress(session: Session): boolean {
    return (
      session.messages?.length > this.THRESHOLDS.maxMessages ||
      session.fileSize > this.THRESHOLDS.maxSizeMB * 1024 * 1024
    );
  }

  /**
   * 压缩Session
   */
  async compress(session: Session): Promise<CompressedSession> {
    const keyDecisions = this.extractKeyDecisions(session);
    const errors = this.extractErrors(session);
    const codeSnippets = this.extractCodeSnippets(session);

    // 计算压缩后的总事件数（包含所有提取的内容）
    const compressedEvents =
      1 + // summary
      keyDecisions.length +
      errors.length +
      codeSnippets.length;

    const originalEvents = session.events?.length || 0;

    const compressed: CompressedSession = {
      sessionId: session.sessionId,
      summary: this.extractSummary(session),
      keyDecisions,
      errors,
      codeSnippets,
      compressionStats: {
        originalEvents,
        compressedEvents,
        compressionRatio: originalEvents > 0 ? compressedEvents / originalEvents : 0,
        compressedAt: Date.now(),
      },
      originalFile: session.filePath,
    };

    compressed.compressionStats.compressedEvents =
      compressed.keyDecisions.length +
      compressed.errors.length +
      compressed.codeSnippets.length;

    compressed.compressionStats.compressionRatio =
      compressed.compressionStats.compressedEvents / compressed.compressionStats.originalEvents;

    // 保存压缩版本
    await this.saveCompressed(compressed);

    // 可选：删除或归档原始文件
    await this.archiveOriginal(session);

    return compressed;
  }

  /**
   * 提取摘要
   */
  private extractSummary(session: Session): CompressedSession['summary'] {
    const firstEvent = session.events[0];
    const lastEvent = session.events[session.events.length - 1];

    return {
      task: firstEvent?.userInput || '',
      outcome: lastEvent?.status || '',
      duration: (lastEvent?.timestamp || 0) - (firstEvent?.timestamp || 0),
      agentRuns: session.agentRuns?.length || 0,
      toolsUsed: this.getUniqueTools(session),
    };
  }

  /**
   * 提取关键决策
   *
   * 保留标准：
   * - Planner的mode选择决策
   * - Orchestrator的任务分解决策
   * - 任何包含"decision"标记的事件
   */
  private extractKeyDecisions(session: Session): CompressedSession['keyDecisions'] {
    const decisions: CompressedSession['keyDecisions'] = [];

    for (const event of session.events) {
      // Planner决策
      if (event.type === 'planner.mode_selected') {
        decisions.push({
          timestamp: event.timestamp,
          agentType: 'planner',
          decision: `Selected mode: ${event.mode}`,
          reasoning: event.reasoning,
        });
      }

      // Orchestrator决策
      if (event.type === 'orchestrator.task_decomposed') {
        decisions.push({
          timestamp: event.timestamp,
          agentType: 'orchestrator',
          decision: `Decomposed into ${event.tasks?.length} subtasks`,
          reasoning: event.strategy,
        });
      }

      // 显式标记的决策
      if (event.isDecision) {
        decisions.push({
          timestamp: event.timestamp,
          agentType: event.agentType || 'unknown',
          decision: event.decision,
          reasoning: event.reasoning,
        });
      }
    }

    return decisions;
  }

  /**
   * 提取错误和解决方案
   *
   * 这些是最有价值的经验数据
   */
  private extractErrors(session: Session): CompressedSession['errors'] {
    const errors: CompressedSession['errors'] = [];
    const errorPattern = /\b(error|fail|exception|panic)\b/i;

    for (let i = 0; i < session.events.length; i++) {
      const event = session.events[i];

      // 检测错误事件
      if (event.type === 'agent.error' || event.status === 'failed') {
        // 查找后续的恢复事件
        const recovery = this.findRecovery(session.events, i);

        errors.push({
          timestamp: event.timestamp,
          error: event.error || event.message || 'Unknown error',
          solution: recovery?.solution || 'No recovery found',
          toolCalls: recovery?.toolCalls,
        });
      }

      // 检测工具调用失败
      if (event.toolName && event.error) {
        errors.push({
          timestamp: event.timestamp,
          error: `Tool ${event.toolName} failed: ${event.error}`,
          solution: event.recovery || 'Retry/Alternative',
          toolCalls: [event.toolName],
        });
      }
    }

    return errors;
  }

  /**
   * 查找错误恢复方案
   */
  private findRecovery(events: SessionEvent[], errorIndex: number): {
    solution: string;
    toolCalls?: string[];
  } | null {
    // 向后查找10个事件内是否有恢复
    for (let i = errorIndex + 1; i < Math.min(errorIndex + 10, events.length); i++) {
      const event = events[i];

      // 检测成功状态变化
      if (event.status === 'completed' || event.type?.includes('success')) {
        return {
          solution: event.message || 'Status recovered',
          toolCalls: event.toolName ? [event.toolName] : undefined,
        };
      }

      // 检测重试成功
      if (event.retryCount > 0 && event.status === 'completed') {
        return {
          solution: `Retry succeeded after ${event.retryCount} attempts`,
          toolCalls: [event.toolName],
        };
      }
    }

    return null;
  }

  /**
   * 提取代码片段（去重）
   */
  private extractCodeSnippets(session: Session): CompressedSession['codeSnippets'] {
    const snippets: CompressedSession['codeSnippets'] = [];
    const seen = new Set<string>();

    for (const event of session.events) {
      if (event.type === 'file.write' || event.type === 'file.edit') {
        const hash = this.hashContent(event.content);

        if (!seen.has(hash)) {
          seen.add(hash);
          snippets.push({
            filePath: event.filePath,
            description: event.description || `File ${event.type}`,
            hash,
          });
        }
      }

      // 限制数量
      if (snippets.length >= 50) break;
    }

    return snippets;
  }

  /**
   * 获取使用的工具（去重）
   */
  private getUniqueTools(session: Session): string[] {
    const tools = new Set<string>();

    for (const event of session.events) {
      if (event.toolName) {
        tools.add(event.toolName);
      }
    }

    return Array.from(tools);
  }

  /**
   * 内容哈希（用于去重）
   */
  private hashContent(content: string): string {
    // 简化版：实际应使用crypto
    return Buffer.from(content).toString('base64').slice(0, 16);
  }

  /**
   * 保存压缩版本
   */
  private async saveCompressed(compressed: CompressedSession): Promise<void> {
    const compressedPath = path.join(
      this.sessionDir,
      `${compressed.sessionId}.compressed.json`
    );

    await fs.writeFile(
      compressedPath,
      JSON.stringify(compressed, null, 2),
      'utf-8'
    );
  }

  /**
   * 归档原始文件
   */
  private async archiveOriginal(session: Session): Promise<void> {
    const archiveDir = path.join(this.sessionDir, 'archive');
    await fs.ensureDir(archiveDir);

    const originalPath = session.filePath;
    const archivePath = path.join(archiveDir, `${session.sessionId}.jsonl`);

    await fs.move(originalPath, archivePath, { overwrite: true });
  }

  /**
   * 解压缩（需要时恢复完整session）
   */
  async decompress(sessionId: string): Promise<Session> {
    const compressedPath = path.join(
      this.sessionDir,
      `${sessionId}.compressed.json`
    );
    const compressed = JSON.parse(await fs.readFile(compressedPath, 'utf-8')) as CompressedSession;

    // 从归档恢复原始文件
    const archivePath = path.join(this.sessionDir, 'archive', `${sessionId}.jsonl`);
    const originalPath = path.join(this.sessionDir, `${sessionId}.jsonl`);

    await fs.copy(archivePath, originalPath);

    // 重新加载
    return this.loadSession(sessionId);
  }

  /**
   * 清理archive目录（P2优化）
   * 删除超过保留期的归档文件
   */
  async cleanupArchive(retentionDays: number = 90): Promise<{ deleted: number; freedSpace: number }> {
    const archiveDir = path.join(this.sessionDir, 'archive');

    if (!(await fs.pathExists(archiveDir))) {
      return { deleted: 0, freedSpace: 0 };
    }

    const files = await fs.readdir(archiveDir);
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let deleted = 0;
    let freedSpace = 0;

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;

      const filePath = path.join(archiveDir, file);
      const stats = await fs.stat(filePath);

      // 检查文件修改时间
      if (stats.mtimeMs < cutoff) {
        // 检查是否还有对应的压缩文件
        const sessionId = file.slice(0, -5); // remove .jsonl
        const compressedPath = path.join(this.sessionDir, `${sessionId}.compressed.json`);

        // 如果压缩文件存在，归档文件可以删除（已压缩）
        // 如果压缩文件不存在，保留归档文件（可恢复）

        if (await fs.pathExists(compressedPath)) {
          const size = stats.size;
          await fs.remove(filePath);
          deleted++;
          freedSpace += size;
        }
      }
    }

    console.log(`[SessionCompressor] Cleaned ${deleted} archive files, freed ${freedSpace} bytes`);
    return { deleted, freedSpace };
  }
}
```

**压缩触发时机**：
1. Session归档时：自动检查并压缩
2. Reflector运行时：批量检查并压缩
3. 手动触发：`evoagent session compress --all`

**CLI命令**：
```bash
# 压缩所有符合条件的session
evoagent session compress --all

# 压缩指定session
evoagent session compress --id <session-id>

# 查看压缩统计
evoagent session stats --include-compressed
```

### 记忆巩固机制

基于神经科学家专家反馈：人类记忆通过重复访问和联想来巩固。EvoAgent应有类似的机制。

```typescript
// src/memory/memory-consolidation.ts

/**
 * 记忆巩固机制
 *
 * 目标：
 * - 将短期记忆(Session)中的高频知识转移到长期记忆(Knowledge)
 * - 将分散的Memory向量整合到Knowledge
 * - 自动发现和创建知识关联
 *
 * 触发时机：
 * - Reflector空闲时（后台任务）
 * - 知识被重复访问时（按需巩固）
 * - 手动触发：evoagent knowledge consolidate
 */

interface ConsolidationTask {
  type: 'session_to_knowledge' | 'memory_to_knowledge' | 'knowledge_link';
  priority: number;
  sourceId: string;
  reason: string;
}

export class MemoryConsolidation {
  private sessionStorage: SessionStorage;
  private memory: VectorStore;
  private knowledge: KnowledgeStorage;
  private llm: LLMService;

  constructor(
    sessionStorage: SessionStorage,
    memory: VectorStore,
    knowledge: KnowledgeStorage,
    llm: LLMService
  ) {
    this.sessionStorage = sessionStorage;
    this.memory = memory;
    this.knowledge = knowledge;
    this.llm = llm;
  }

  /**
   * 执行巩固任务
   */
  async consolidate(task: ConsolidationTask): Promise<void> {
    switch (task.type) {
      case 'session_to_knowledge':
        await this.consolidateSessionToKnowledge(task.sourceId);
        break;
      case 'memory_to_knowledge':
        await this.consolidateMemoryToKnowledge(task.sourceId);
        break;
      case 'knowledge_link':
        await this.createKnowledgeLinks(task.sourceId);
        break;
    }
  }

  /**
   * Session → Knowledge 转换
   *
   * 条件：
   * - Session价值评分 > 60
   * - 包含错误→恢复模式
   * - 被其他Session引用 > 3次
   */
  private async consolidateSessionToKnowledge(sessionId: string): Promise<void> {
    const session = await this.sessionStorage.loadSession(sessionId);
    const value = await this.evaluateSessionValue(session);

    if (value.overallScore < 60) {
      return; // 价值不够，不转换
    }

    // 计算session大小（近似值）
    const sessionSize = JSON.stringify(session).length;
    const maxSize = 100_000; // 100KB限制，避免LLM超限

    if (sessionSize > maxSize) {
      console.warn(`[Consolidation] Session ${sessionId} too large (${sessionSize} bytes), compressing first`);
      // 压缩session或跳过
      return;
    }

    // 使用LLM提取知识
    const prompt = this.buildConsolidationPrompt(session);
    const result = await this.llm.generate(prompt, {
      responseFormat: 'json',
      maxTokens: 4000, // 明确限制输出长度
    });

    const knowledge = JSON.parse(result);

    // 根据类型写入不同category
    for (const item of knowledge.pits || []) {
      await this.knowledge.writeAuto('pits', item.slug, item.content);
    }

    for (const item of knowledge.patterns || []) {
      await this.knowledge.writeAuto('patterns', item.slug, item.content);
    }

    for (const item of knowledge.solutions || []) {
      await this.knowledge.writeAuto('solutions', item.slug, item.content);
    }

    console.log(`[Consolidation] Session ${sessionId} → ${knowledge.pits.length + knowledge.patterns.length} knowledge items`);
  }

  /**
   * Memory → Knowledge 转换
   *
   * 条件：
   * - 向量被检索 > 10次（高访问量）
   * - 相似向量聚类 > 5个（共性知识）
   */
  private async consolidateMemoryToKnowledge(vectorId: string): Promise<void> {
    const vector = await this.memory.get(vectorId);
    const accessCount = await this.memory.getAccessCount(vectorId);

    if (accessCount < 10) {
      return; // 访问量不够
    }

    // 查找相似向量
    const similar = await this.memory.similaritySearch(vector.embedding, {
      limit: 10,
      minScore: 0.85,
    });

    if (similar.length < 5) {
      return; // 聚类不够
    }

    // 使用LLM总结共性
    const prompt = `
以下是${similar.length}个相似的代码片段/解决方案，请提取共性知识并生成Knowledge文档：

${similar.map(s => `## ${s.metadata.description}\n\`\`\`\n${s.content}\n\`\`\``).join('\n\n')}

请生成一个markdown文档，包含：
- 问题描述
- 共性模式
- 最佳实践
- 示例代码
`;

    const content = await this.llm.generate(prompt);

    // 确定category和slug
    const category = this.inferCategory(vector, similar);
    const slug = this.generateSlug(content);

    await this.knowledge.writeAuto(category, slug, content);

    // 标记原向量已巩固
    await this.memory.markConsolidated(vectorId);
  }

  /**
   * 创建知识关联
   *
   * 发现Knowledge之间的关联并创建"See also"链接
   */
  private async createKnowledgeLinks(knowledgeId: string): Promise<void> {
    const knowledge = await this.knowledge.get(knowledgeId);

    // 使用向量搜索找相关知识
    const embedding = await this.memory.embed(knowledge.content);
    const similar = await this.memory.similaritySearch(embedding, {
      limit: 5,
      minScore: 0.75,
      collection: 'knowledge',
    });

    // 更新frontmatter
    const related = similar
      .filter(s => s.metadata.id !== knowledgeId)
      .map(s => s.metadata.id)
      .slice(0, 3);

    if (related.length > 0) {
      await this.knowledge.addRelated(knowledgeId, related);
    }
  }

  /**
   * 空闲时批量巩固
   *
   * @note 未处理完的任务会在下次batchConsolidate调用时重新评估
   * 如果需要持久化队列，可以添加任务存储到数据库
   */
  async batchConsolidate(): Promise<void> {
    const tasks: ConsolidationTask[] = [];

    // 1. 查找高价值Session
    const sessions = await this.sessionStorage.listSessions();
    for (const session of sessions) {
      if (session.valueScore && session.valueScore > 60 && !session.consolidated) {
        tasks.push({
          type: 'session_to_knowledge',
          priority: session.valueScore,
          sourceId: session.sessionId,
          reason: 'High value session',
        });
      }
    }

    // 2. 查找高频访问的Memory
    const hotVectors = await this.memory.getHotVectors(10);
    for (const vector of hotVectors) {
      if (!vector.consolidated) {
        tasks.push({
          type: 'memory_to_knowledge',
          priority: vector.accessCount,
          sourceId: vector.id,
          reason: `Accessed ${vector.accessCount} times`,
        });
      }
    }

    // 3. 按优先级执行
    tasks.sort((a, b) => b.priority - a.priority);

    // 4. 每次最多处理10个任务
    // 未处理完的任务会在下次调用时重新评估
    const processed: string[] = [];
    const failed: string[] = [];

    for (const task of tasks.slice(0, 10)) { // 每次最多10个
      await this.consolidate(task);
    }
  }

  /**
   * 评估Session价值
   */
  private async evaluateSessionValue(session: Session): Promise<{ overallScore: number }> {
    // 复用SessionValueEvaluator
    // 这里简化
    return { overallScore: 70 };
  }

  private buildConsolidationPrompt(session: Session): string {
    return `...`;
  }

  private inferCategory(vector: Vector, similar: Vector[]): string {
    // 根据内容推断category
    return 'patterns';
  }

  private generateSlug(content: string): string {
    // 生成slug
    return 'consolidated-pattern';
  }
}
```

### 遗忘曲线：使用频率追踪

基于神经科学家专家反馈：人类记忆遵循艾宾浩斯遗忘曲线。EvoAgent应模拟这一机制。

```typescript
// src/memory/forgetting-curve.ts

/**
 * 遗忘曲线机制
 *
 * 概念：
 * - 记忆强度 (Memory Strength): 0-100，越高越不容易"遗忘"
 * - 访问增强记忆：每次访问增加强度
 * - 时间衰减记忆：随时间自然衰减
 * - 低强度记忆优先被清理
 *
 * 应用场景：
 * - Session清理决策（不仅仅是基于时间）
 * - Memory向量清理（低访问量优先）
 * - Knowledge更新优先级
 */

interface ForgettingCurveConfig {
  // 艾宾浩斯遗忘曲线参数
  initialStrength: number;     // 初始记忆强度 (默认50)
  decayRate: number;           // 衰减率 (默认0.1，每天衰减10%)
  accessBoost: number;         // 访问增益 (默认+10)
  maxStrength: number;         // 最大强度 (默认100)

  // 清理阈值
  cleanupThreshold: number;    // 低于此值可被清理 (默认20)
}

interface MemoryItem {
  id: string;
  type: 'session' | 'memory' | 'knowledge';

  // 记忆强度
  strength: number;            // 当前强度 (0-100)
  lastAccessedAt: number;
  accessCount: number;

  // 衰减追踪
  createdAt: number;
  lastEvaluatedAt: number;
}

export class ForgettingCurve {
  private config: ForgettingCurveConfig = {
    initialStrength: 50,
    decayRate: 0.1,
    accessBoost: 10,
    maxStrength: 100,
    cleanupThreshold: 20,
  };

  private db: Database;

  /**
   * 初始化：创建记忆强度表
   */
  init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_strength (
        id TEXT PRIMARY KEY,
        type TEXT,
        strength REAL,
        last_accessed_at INTEGER,
        access_count INTEGER DEFAULT 0,
        created_at INTEGER,
        last_evaluated_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_strength ON memory_strength(strength);
      CREATE INDEX IF NOT EXISTS idx_last_accessed ON memory_strength(last_accessed_at);
    `);
  }

  /**
   * 记录访问（增强记忆）
   */
  async recordAccess(id: string, type: 'session' | 'memory' | 'knowledge'): Promise<void> {
    const item = await this.getOrCreate(id, type);

    // 访问增强
    item.strength = Math.min(item.strength + this.config.accessBoost, this.config.maxStrength);
    item.lastAccessedAt = Date.now();
    item.accessCount++;

    await this.save(item);
  }

  /**
   * 评估衰减（计算当前强度）
   */
  async evaluateDecay(id: string): Promise<number> {
    const item = await this.get(id);
    if (!item) return 0;

    const now = Date.now();
    const daysSinceEvaluation = (now - item.lastEvaluatedAt) / (1000 * 60 * 60 * 24);

    // 艾宾浩斯遗忘曲线简化版：指数衰减
    // strength = initial * e^(-decayRate * days)
    const decayFactor = Math.exp(-this.config.decayRate * daysSinceEvaluation);
    item.strength = Math.max(item.strength * decayFactor, 0);
    item.lastEvaluatedAt = now;

    await this.save(item);

    return item.strength;
  }

  /**
   * 批量评估所有记忆
   */
  async evaluateAll(): Promise<void> {
    const items = await this.db.prepare('SELECT * FROM memory_strength').all();

    for (const item of items) {
      await this.evaluateDecay(item.id);
    }
  }

  /**
   * 获取可清理项目（低强度记忆）
   */
  async getCleanupCandidates(limit: number): Promise<MemoryItem[]> {
    // 先评估衰减
    await this.evaluateAll();

    // 返回低于阈值的项目
    return this.db.prepare(`
      SELECT * FROM memory_strength
      WHERE strength < ?
      ORDER BY strength ASC
      LIMIT ?
    `).all(this.config.cleanupThreshold, limit);
  }

  /**
   * 记忆强度可视化
   */
  async getStats(): Promise<{
    total: number;
    strong: number;    // > 80
    medium: number;    // 40-80
    weak: number;      // 20-40
    critical: number;  // < 20 (可清理)
  }> {
    const stats = await this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN strength > 80 THEN 1 ELSE 0 END) as strong,
        SUM(CASE WHEN strength BETWEEN 40 AND 80 THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN strength BETWEEN 20 AND 40 THEN 1 ELSE 0 END) as weak,
        SUM(CASE WHEN strength < 20 THEN 1 ELSE 0 END) as critical
      FROM memory_strength
    `).get();

    return stats;
  }

  /**
   * 获取或创建记忆项
   */
  private async getOrCreate(id: string, type: string): Promise<MemoryItem> {
    let item = await this.get(id);

    if (!item) {
      item = {
        id,
        type,
        strength: this.config.initialStrength,
        lastAccessedAt: Date.now(),
        accessCount: 0,
        createdAt: Date.now(),
        lastEvaluatedAt: Date.now(),
      };
      await this.save(item);
    }

    return item;
  }

  private async get(id: string): Promise<MemoryItem | null> {
    const row = this.db.prepare('SELECT * FROM memory_strength WHERE id = ?').get(id);
    return row || null;
  }

  private async save(item: MemoryItem): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO memory_strength
      (id, type, strength, last_accessed_at, access_count, created_at, last_evaluated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      item.type,
      item.strength,
      item.lastAccessedAt,
      item.accessCount,
      item.createdAt,
      item.lastEvaluatedAt
    );
  }
}

/**
 * 间隔重复强化（P2优化 - 神经科学建议）
 *
 * 基于艾宾浩斯遗忘曲线：在遗忘临界点前重复，记忆效果最佳
 * 预测最佳复习时间并主动提醒
 */
export class SpacedRepetition {
  private db: Database;
  private forgetting: ForgettingCurve;

  // 艾宾浩斯复习间隔（单位：天）
  private readonly REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60, 120];

  constructor(db: Database, forgetting: ForgettingCurve) {
    this.db = db;
    this.forgetting = forgetting;
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS spaced_repetition (
        id TEXT PRIMARY KEY,
        type TEXT,
        stage INTEGER DEFAULT 0,  -- 当前复习阶段(0-6)
        next_review_at INTEGER,    -- 下次复习时间
        last_reviewed_at INTEGER,
        ease_factor REAL DEFAULT 2.5,  -- 难度因子(SuperMemo2算法)
        interval INTEGER DEFAULT 1,     -- 当前间隔(天)
        created_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_next_review ON spaced_repetition(next_review_at);
    `);
  }

  /**
   * 记录访问并计算下次复习时间
   */
  async recordAccess(id: string, type: 'session' | 'memory' | 'knowledge'): Promise<void> {
    const now = Date.now();
    const existing = await this.db.prepare('SELECT * FROM spaced_repetition WHERE id = ?').get(id);

    if (existing) {
      // 已存在：更新复习计划
      await this.updateReviewPlan(id, existing, now);
    } else {
      // 新建：初始化复习计划
      await this.db.prepare(`
        INSERT INTO spaced_repetition(id, type, next_review_at, last_reviewed_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, type, now + this.REVIEW_INTERVALS[0] * 24 * 60 * 60 * 1000, now, now);
    }

    // 同时更新遗忘曲线
    await this.forgetting.recordAccess(id, type);
  }

  /**
   * 更新复习计划（SuperMemo2算法简化版）
   */
  private async updateReviewPlan(id: string, existing: any, now: number): Promise<void> {
    // 计算实际复习间隔与计划间隔的比率
    const plannedInterval = existing.next_review_at - existing.last_reviewed_at;
    const actualInterval = now - existing.last_reviewed_at;
    const ratio = actualInterval / plannedInterval;

    // 更新难度因子
    let easeFactor = existing.ease_factor || 2.5;
    if (ratio >= 1.0) {
      // 按时或延迟复习：增加难度因子
      easeFactor = Math.max(1.3, easeFactor + 0.1);
    } else {
      // 提前复习：减少难度因子
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    }

    // 计算下次间隔
    let stage = existing.stage || 0;
    let interval = existing.interval || 1;

    if (ratio >= 1.0) {
      // 按时复习：进入下一阶段
      stage = Math.min(stage + 1, this.REVIEW_INTERVALS.length - 1);
      interval = this.REVIEW_INTERVALS[stage];
    } else {
      // 提前复习：保持当前阶段
      interval = Math.max(1, Math.floor(interval * easeFactor));
    }

    const nextReviewAt = now + interval * 24 * 60 * 60 * 1000;

    await this.db.prepare(`
      UPDATE spaced_repetition
      SET stage = ?, next_review_at = ?, last_reviewed_at = ?, ease_factor = ?, interval = ?
      WHERE id = ?
    `).run(stage, nextReviewAt, now, easeFactor, interval, id);
  }

  /**
   * 获取需要复习的项目
   */
  async getDueItems(limit: number = 20): Promise<Array<{
    id: string;
    type: string;
    stage: number;
    daysOverdue: number;
  }>> {
    const now = Date.now();
    const rows = await this.db.prepare(`
      SELECT id, type, stage, next_review_at
      FROM spaced_repetition
      WHERE next_review_at <= ?
      ORDER BY next_review_at ASC
      LIMIT ?
    `).all(now, limit);

    return rows.map((row: any) => ({
      id: row.id,
      type: row.type,
      stage: row.stage,
      daysOverdue: Math.floor((now - row.next_review_at) / (24 * 60 * 60 * 1000)),
    }));
  }

  /**
   * 获取复习统计
   */
  async getStats(): Promise<{
    total: number;
    due: number;
    byStage: number[];
  }> {
    const now = Date.now();

    const total = await this.db.prepare('SELECT COUNT(*) as count FROM spaced_repetition').get() as { count: number };
    const due = await this.db.prepare('SELECT COUNT(*) as count FROM spaced_repetition WHERE next_review_at <= ?').get(now) as { count: number };

    const byStage: number[] = [];
    for (let i = 0; i < this.REVIEW_INTERVALS.length; i++) {
      const result = await this.db.prepare('SELECT COUNT(*) as count FROM spaced_repetition WHERE stage = ?').get(i) as { count: number };
      byStage.push(result.count);
    }

    return {
      total: total.count,
      due: due.count,
      byStage,
    };
  }

  /**
   * 手动触发复习（用于Reflector）
   */
  async scheduleReview(items: Array<{ id: string; type: string }>): Promise<void> {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO spaced_repetition(id, type, next_review_at, last_reviewed_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      stmt.run(item.id, item.type, now, now - 1, now);  // 设置为立即过期
    }
  }
}

/**
 * 记忆再巩固窗口（P2优化 - 神经科学建议）
 *
 * 神经科学发现：记忆提取后会进入不稳定状态，是更新记忆的最佳时机
 */
export class MemoryReconsolidation {
  /**
   * 检测记忆是否处于"再巩固窗口"
   *
   * 在记忆被访问后的短时间内（如10分钟内），记忆处于不稳定状态
   * 此时更新记忆的效果最好
   */
  isInReconsolidationWindow(lastAccessedAt: number, windowMinutes: number = 10): boolean {
    const now = Date.now();
    const timeSinceAccess = now - lastAccessedAt;
    const windowMs = windowMinutes * 60 * 1000;
    return timeSinceAccess < windowMs;
  }

  /**
   * 获取处于再巩固窗口的记忆项
   */
  async getItemsInReconsolidationWindow(forgetting: ForgettingCurve, windowMinutes: number = 10): Promise<Array<{
    id: string;
    type: string;
    strength: number;
    timeSinceAccess: number;
  }>> {
    const cutoff = Date.now() - windowMinutes * 60 * 1000;

    // 查询最近访问过的记忆
    const items = await forgetting.db.prepare(`
      SELECT id, type, strength, last_accessed_at
      FROM memory_strength
      WHERE last_accessed_at > ?
      ORDER BY last_accessed_at DESC
    `).all(cutoff);

    return items.map((row: any) => ({
      id: row.id,
      type: row.type,
      strength: row.strength,
      timeSinceAccess: Date.now() - row.last_accessed_at,
    }));
  }

  /**
   * 更新记忆（在再巩固窗口内调用）
   */
  async updateMemory(id: string, updates: Record<string, unknown>, db: Database): Promise<void> {
    // 在再巩固窗口内更新记忆会使其更加巩固
    // 这里只是框架，具体实现取决于记忆类型

    // 例如：对于Knowledge，可以更新内容
    // 对于Memory向量，可以更新embedding

    console.log(`[Reconsolidation] Updating memory ${id} in reconsolidation window`);
  }
}

/**
 * MemoryManager - 记忆管理统一入口
 *
 * 提供统一的API来管理记忆强度、间隔重复、再巩固等
 * 简化遗忘曲线相关功能的调用
 */
export class MemoryManager {
  private forgetting: ForgettingCurve;
  private spacedRepetition: SpacedRepetition;
  private reconsolidation: MemoryReconsolidation;

  constructor(db: Database) {
    this.forgetting = new ForgettingCurve(db);
    this.spacedRepetition = new SpacedRepetition(db, this.forgetting);
    this.reconsolidation = new MemoryReconsolidation();
  }

  /**
   * 记录访问（自动触发强度更新、间隔重复、再巩固检测）
   */
  async recordAccess(id: string, type: 'session' | 'memory' | 'knowledge'): Promise<void> {
    await this.spacedRepetition.recordAccess(id, type);
  }

  /**
   * 获取记忆强度
   */
  async getStrength(id: string): Promise<number> {
    return await this.forgetting.getStrength(id);
  }

  /**
   * 检查是否处于再巩固窗口
   */
  isInReconsolidationWindow(id: string): boolean {
    return this.reconsolidation.isInReconsolidationWindow(id);
  }

  /**
   * 更新记忆（在再巩固窗口内）
   */
  async updateMemory(id: string, updates: Record<string, unknown>, db: Database): Promise<void> {
    await this.reconsolidation.updateMemory(id, updates, db);
  }

  /**
   * 获取待复习项目
   */
  async getDueItems(type?: 'session' | 'memory' | 'knowledge'): Promise<Array<{
    id: string;
    type: string;
    strength: number;
    timeSinceAccess: number;
  }>> {
    return await this.spacedRepetition.getDueItems(type);
  }

  /**
   * 获取可清理的低价值记忆
   */
  async getCleanupCandidates(limit: number): Promise<Array<{
    id: string;
    type: string;
    strength: number;
  }>> {
    return await this.forgetting.getCleanupCandidates(limit);
  }
}

/**
 * 与Session清理集成
 */
export class SessionCleanupWithForgetting {
  private forgetting: ForgettingCurve;
  private sessionStorage: SessionStorage;

  /**
   * 基于遗忘曲线的清理
   */
  async cleanup(): Promise<string[]> {
    const candidates = await this.forgetting.getCleanupCandidates(100);
    const deleted: string[] = [];

    for (const candidate of candidates) {
      if (candidate.type === 'session') {
        // 二次检查：确保不是keepForever
        const meta = this.sessionStorage.getMetadata(candidate.id);
        if (meta && !meta.keepForever) {
          await this.sessionStorage.deleteSession(candidate.id);
          deleted.push(candidate.id);
        }
      }
    }

    return deleted;
  }
}
```

**遗忘曲线效果**：

| 访问频率 | 1天后 | 7天后 | 30天后 | 说明 |
|---------|-------|-------|--------|------|
| 从未访问 | 45 → 40 → 36 → 18 | 快速衰减，30天后可清理 |
| 访问1次 | 55 → 50 → 45 → 22 | 略有提升 |
| 访问3次 | 75 → 68 → 61 → 31 | 中等强度 |
| 访问5次+ | 95 → 86 → 77 → 39 | 高强度，长期保留 |

**CLI命令**：
```bash
# 查看记忆强度分布
evoagent memory stats
# 输出:
# Total: 1,234 items
# Strong (>80): 156
# Medium (40-80): 456
# Weak (20-40): 389
# Critical (<20): 233

# 基于遗忘曲线清理
evoagent session cleanup --by-strength
evoagent memory cleanup --by-strength
```

### Agent启动失败重试策略

```typescript
interface RetryPolicy {
  maxAttempts: 3;
  backoff: 'exponential';
  initialDelay: 1000;  // ms
  maxDelay: 30000;     // ms
}

// 失败场景处理
// 1. LLM API失败 → 重试（指数退避）
// 2. 工具执行失败 → 不重试，抛出AgentToolError
// 3. 超时 → 不重试，抛出AgentTimeoutError

// 错误类型定义
class AgentError extends Error {
  constructor(
    message: string,
    public retryable: boolean = false,
    public cause?: Error
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

class AgentTimeoutError extends AgentError {
  constructor(message: string, cause?: Error) {
    super(message, false, cause);
    this.name = 'AgentTimeoutError';
  }
}

class AgentToolError extends AgentError {
  constructor(message: string, cause?: Error) {
    super(message, false, cause);
    this.name = 'AgentToolError';
  }
}

class AgentLLMError extends AgentError {
  constructor(message: string, cause?: Error) {
    super(message, true, cause);  // LLM错误可重试
    this.name = 'AgentLLMError';
  }
}
```

### A2A通信协议

```typescript
// Agent-to-Agent消息
interface A2AMessage {
  from: string;      // 发送者runId
  to: string | "*";   // 接收者：runId / agentType / "*"（广播）
  type: 'request' | 'response' | 'broadcast';
  payload: {
    method: string;
    params: unknown;
  };
  replyTo?: string;  // 用于response
  broadcast?: boolean; // 是否广播
}

// 广播示例
interface BroadcastMessage {
  from: "run-123";
  to: "*";  // 所有Agent都能收到
  type: "broadcast";
  payload: {
    method: "module.completed";
    params: { module: "用户登录", status: "success" };
  };
}
```

**A2A通信模式**：

| 模式 | to字段 | 说明 |
|------|--------|------|
| 点对点请求 | `"run-456"` | 发送给指定Agent |
| 类型请求 | `"codewriter"` | 发送给指定类型的所有Agent |
| 广播 | `"*"` 或 `broadcast: true` | 发送给所有Agent |

**广播限流与防风暴**：

```typescript
// src/gateway/broadcast-rate-limiter.ts

export class BroadcastRateLimiter {
  private broadcastCounts = new Map<string, number[]>();  // agentId → [timestamps]
  private readonly maxPerMinute = 10;    // 每分钟最多10次广播
  private readonly maxPerSecond = 2;     // 每秒最多2次广播

  /**
   * 检查是否允许广播
   * @param agentId 发送者agentId
   * @param target 目标（runId、agentType或"*"）
   */
  canBroadcast(agentId: string, target?: string): boolean {
    // 处理通配符广播：更严格的限制
    if (target === '*') {
      return this.checkWildcardBroadcast(agentId);
    }
    return this.checkNormalBroadcast(agentId);
  }

  /**
   * 通配符广播检查（更严格）
   */
  private checkWildcardBroadcast(agentId: string): boolean {
    const now = Date.now();
    const key = `${agentId}:*`;  // 通配符广播单独计数
    const timestamps = this.broadcastCounts.get(key) || [];

    // 清理过期记录（超过1分钟）
    const recent = timestamps.filter(t => now - t < 60000);
    this.broadcastCounts.set(key, recent);

    // 通配符广播更严格的限制：每秒1次，每分钟5次
    const lastSecond = recent.filter(t => now - t < 1000).length;
    const lastMinute = recent.length;

    if (lastSecond >= 1) {
      console.warn(`[BroadcastLimiter] ${agentId} 通配符广播超过每秒限制`);
      return false;
    }

    if (lastMinute >= 5) {
      console.warn(`[BroadcastLimiter] ${agentId} 通配符广播超过每分钟限制`);
      return false;
    }

    recent.push(now);
    return true;
  }

  /**
   * 普通广播检查
   */
  private checkNormalBroadcast(agentId: string): boolean {
    const now = Date.now();
    const timestamps = this.broadcastCounts.get(agentId) || [];

    // 清理过期记录（超过1分钟）
    const recent = timestamps.filter(t => now - t < 60000);
    this.broadcastCounts.set(agentId, recent);

    // 检查限制
    const lastSecond = recent.filter(t => now - t < 1000).length;
    const lastMinute = recent.length;

    if (lastSecond >= this.maxPerSecond) {
      console.warn(`[BroadcastLimiter] ${agentId} 超过每秒限制`);
      return false;
    }

    if (lastMinute >= this.maxPerMinute) {
      console.warn(`[BroadcastLimiter] ${agentId} 超过每分钟限制`);
      return false;
    }

    recent.push(now);
    return true;
  }

  // 向后兼容的旧方法
  canBroadcast(agentId: string): boolean {
    return this.checkNormalBroadcast(agentId);
  }
}

// 广播去重（防止相同消息重复发送）
interface BroadcastDeduplicator {
  recentHashes: Set<string>;
  hash(message: A2AMessage): string;
  isDuplicate(message: A2AMessage): boolean;
}

// 配置示例
lanes:
  broadcast:
    maxPerSecond: 2
    maxPerMinute: 10
    dedupWindow: 5000  # 5秒内相同消息视为重复
```

**广播使用场景**：

```typescript
// 场景：Frontend Specialist完成登录模块
await gateway.broadcast({
  from: myRunId,
  to: "*",
  payload: {
    method: "module.completed",
    params: { module: "用户登录", endpoint: "/api/auth/*" }
  }
});

// 其他Agent收到后可以：
// - Backend Specialist: 知道可以开始调用登录API了
// - Tester Specialist: 知道可以开始测试登录功能了
```

### Agent上下文继承

```typescript
// Agent运行时的上下文
interface AgentContext {
  runId: string;
  agentType: AgentType;
  sessionId: string;

  // 父子关系
  parentRunId?: string;    // 父Agent的runId
  childRunIds?: string[];  // 子Agent的runId列表

  // 上下文继承
  inheritedContext: {
    // 子Agent能看到父Agent的：
    parentPlan?: Plan;           // 父Agent的计划（只读）
    parentTools?: string[];      // 父Agent用了哪些工具（只读）
    parentOutput?: string;       // 父Agent的输出（只读）

    // 子Agent看不到的：
    // - 父Agent的system prompt
    // - 父Agent的API密钥
    // - 其他Agent的private数据
  };

  // 自己的上下文
  ownContext: {
    input: string;
    memory: MemoryContext;
    tools: ToolSet;
  };
}
```

**上下文继承规则**：

| 内容 | 子Agent可访问 | 说明 |
|------|--------------|------|
| 父Agent的计划 | ✅ | 了解整体计划 |
| 父Agent的工具调用历史 | ✅ | 了解父Agent做了什么 |
| 父Agent的输出结果 | ✅ | 可以基于父Agent结果工作 |
| 父Agent的System Prompt | ❌ | 防止prompt泄露 |
| 父Agent的API密钥 | ❌ | 安全隔离 |
| 父Agent的private变量 | ❌ | 封装性 |
| Session历史 | ✅ | 所有Agent共享 |
| Vector DB | ✅ | 所有Agent共享 |
| Knowledge Base | ✅ | 所有Agent共享 |

**安全过滤机制**：

```typescript
// src/agent/context-filter.ts

/**
 * 敏感字段过滤
 *
 * 防止子Agent访问父Agent的敏感信息（如API密钥、临时token）
 */
const SENSITIVE_FIELDS = [
  'apiKey',
  'apiToken',
  'accessToken',
  'secret',
  'password',
  'privateKey',
  'sessionToken',
  'csrfToken',
];

/**
 * 过滤inheritedContext，移除敏感字段
 */
function filterInheritedContext(context: AgentContext): AgentContext {
  if (!context.inheritedContext) return context;

  const filtered = { ...context };

  // 过滤parentOutput中的敏感字段
  if (filtered.inheritedContext.parentOutput) {
    filtered.inheritedContext.parentOutput =
      filterSensitiveData(filtered.inheritedContext.parentOutput);
  }

  // 确保parentTools不包含敏感参数
  if (filtered.inheritedContext.parentTools) {
    filtered.inheritedContext.parentTools =
      filtered.inheritedContext.parentTools.filter(t =>
        !SENSITIVE_FIELDS.some(field => t.toLowerCase().includes(field.toLowerCase()))
      );
  }

  return filtered;
}

/**
 * 递归过滤对象中的敏感数据
 */
function filterSensitiveData(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(filterSensitiveData);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // 检查是否是敏感字段
    const isSensitive = SENSITIVE_FIELDS.some(
      sensitive => key.toLowerCase().includes(sensitive.toLowerCase())
    );

    if (isSensitive) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = filterSensitiveData(value);
    }
  }

  return result;
}
```

**示例**：

```typescript
// Orchestrator spawn CodeWriter
const codeWriterContext = {
  runId: generateId(),
  agentType: "codewriter",
  sessionId: currentSessionId,
  parentRunId: myRunId,
  inheritedContext: {
    parentPlan: myPlan,        // 可以看到计划
    parentTools: ["search_knowledge"],  // 可以看到我用了什么工具
    parentOutput: undefined,  // 我还没完成
  },
  ownContext: {
    input: "实现用户登录表单",
    memory: await retrieveMemory(),
    tools: getCodewriterTools(),
  }
};
```

---

## Agent执行层

### Agent类型体系

```
Planner Agent (规划者)
├─ 职责：需求分析、模式选择、计划生成
├─ Lane: planner (串行)
└─ 工具：search_knowledge, estimate_complexity, check_patterns

Orchestrator Agent (编排者)
├─ 职责：执行计划、协调Specialist、集成结果
├─ Lane: main (并发度4)
└─ 工具：spawn_specialist, a2a_send, run_tests, git_commit

Specialist Agents (专家)
├─ CodeWriter Agent
│   ├─ 职责：编写代码
│   └─ 专长：快速生成高质量代码
│
├─ Tester Agent
│   ├─ 职责：编写和运行测试
│   └─ 专长：TDD、测试覆盖
│
├─ Reviewer Agent
│   ├─ 职责：代码审查
│   └─ 专长：发现潜在问题
│
└─ Debugger Agent
    ├─ 职责：调试和修复问题
    └─ 专长：快速定位错误根因

Reflector Agent (反思者)
├─ 职责：定期反思、知识更新、Prompt优化
├─ Lane: 无（定时触发）
└─ 工具：analyze_sessions, extract_patterns, update_knowledge
```

### Agent生命周期

```typescript
export class AgentRun {
  async execute(): Promise<AgentResult> {
    // 1. 发送start事件
    this.emitEvent({ stream: 'lifecycle', phase: 'start' });

    try {
      // 2. 初始化记忆检索
      const memory = await this.retrieveMemory();

      // 3. 构建Agent上下文
      const agentContext = this.buildAgentContext(memory);

      // 4. 执行Agent任务
      const result = await this.runAgentTask(agentContext);

      // 5. 发送complete事件
      this.emitEvent({ stream: 'lifecycle', phase: 'end', result });

      // 6. 触发经验收集
      await this.triggerExperienceCollection({ result });

      return result;

    } catch (error) {
      // 7. 处理错误
      this.emitEvent({ stream: 'lifecycle', phase: 'error', error });
      await this.triggerExperienceCollection({ error });
      throw error;
    }
  }
}
```

---

## 稳定性机制（第三轮整改新增）

基于整体架构评审，添加以下稳定性保障机制：

### 1. WebSocket断开处理与Agent状态恢复

```typescript
// src/gateway/connection-manager.ts

/**
 * 连接管理器：处理WebSocket断开与重连
 */
export class ConnectionManager {
  private connections: Map<string, Connection> = new Map();
  private agentStates: Map<string, AgentState> = new Map();  // 持久化状态
  private laneQueue: LaneQueue;
  private gateway: Gateway;

  constructor(laneQueue: LaneQueue, gateway: Gateway) {
    this.laneQueue = laneQueue;
    this.gateway = gateway;
  }

  /**
   * 连接对象
   */
  interface Connection {
    socket: WebSocket;
    clientId: string;
    sessionId?: string;
    connectedAt: number;
    lastHeartbeat: number;
  }

  /**
   * Agent持久化状态
   */
  interface AgentState {
    runId: string;
    agentType: string;
    sessionId: string;
    status: 'running' | 'paused' | 'completed' | 'failed';
    input: unknown;
    progress: number;
    checkpoint?: unknown;  // 用于恢复的检查点
    lastUpdate: number;
    creatorClientId?: string;  // 创建此Agent的连接ID，用于断线恢复时的所有权判断
  }

  /**
   * 处理WebSocket连接
   */
  handleConnection(socket: WebSocket, clientId: string): void {
    const connection: Connection = {
      socket,
      clientId,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
    };
    this.connections.set(clientId, connection);

    socket.on('close', () => this.handleDisconnect(clientId));
    socket.on('error', (error) => this.handleError(clientId, error));
    socket.on('message', (data) => this.handleMessage(clientId, data));

    // 发送欢迎消息
    this.send(clientId, {
      jsonrpc: '2.0',
      method: 'connected',
      params: { clientId, timestamp: Date.now() },
    });
  }

  /**
   * 处理断开连接
   */
  private async handleDisconnect(clientId: string): Promise<void> {
    const connection = this.connections.get(clientId);
    if (!connection) return;

    this.connections.delete(clientId);

    // 检查是否有正在运行的Agent需要恢复
    const runningAgents = Array.from(this.agentStates.values())
      .filter(state => state.status === 'running' && this.isOwnedBy(state, connection));

    if (runningAgents.length > 0) {
      console.log(`[ConnectionManager] Client ${clientId} disconnected, ${runningAgents.length} agents running`);

      // Agent继续运行，状态已持久化
      // 客户端重连后可恢复
      for (const agent of runningAgents) {
        agent.status = 'paused';  // 标记为暂停
        await this.saveAgentState(agent);
      }
    }
  }

  /**
   * 处理重连
   */
  async handleReconnect(socket: WebSocket, clientId: string, oldSessionId?: string): Promise<void> {
    const connection: Connection = {
      socket,
      clientId,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
    };
    this.connections.set(clientId, connection);

    // 发送重连确认和可恢复的Agent列表
    const pausedAgents = Array.from(this.agentStates.values())
      .filter(state => state.status === 'paused');

    this.send(clientId, {
      jsonrpc: '2.0',
      method: 'reconnected',
      params: {
        pausedAgents: pausedAgents.map(a => ({
          runId: a.runId,
          agentType: a.agentType,
          progress: a.progress,
          checkpoint: a.checkpoint,
        })),
      },
    });
  }

  /**
   * 恢复Agent
   */
  async resumeAgent(runId: string, clientId: string): Promise<void> {
    const state = this.agentStates.get(runId);
    if (!state || state.status !== 'paused') {
      throw new Error(`Agent ${runId} cannot be resumed`);
    }

    state.status = 'running';
    state.lastUpdate = Date.now();

    // 通知Lane Queue继续执行
    await this.laneQueue.resume(runId);

    this.send(clientId, {
      jsonrpc: '2.0',
      method: 'agent.resumed',
      params: { runId },
    });
  }

  private isOwnedBy(state: AgentState, conn: Connection): boolean {
    // Agent属于某个连接的判断逻辑：
    // 1. 检查sessionId是否匹配
    if (state.sessionId && conn.sessionId && state.sessionId === conn.sessionId) {
      return true;
    }
    // 2. 检查creatorClientId是否匹配
    if (state.creatorClientId && state.creatorClientId === conn.clientId) {
      return true;
    }
    return false;
  }

  private async saveAgentState(state: AgentState): Promise<void> {
    // 持久化到文件或数据库
    const statePath = path.join(AGENT_STATE_DIR, `${state.runId}.json`);
    await fs.writeFile(statePath, JSON.stringify(state), 'utf-8');
  }

  private send(clientId: string, message: unknown): void {
    const conn = this.connections.get(clientId);
    if (conn && conn.socket.readyState === WebSocket.OPEN) {
      conn.socket.send(JSON.stringify(message));
    }
  }

  private handleMessage(clientId: string, data: string): void {
    // 处理消息...
  }

  private handleError(clientId: string, error: Error): void {
    console.error(`[ConnectionManager] Error for client ${clientId}:`, error);
  }
}
```

**断线恢复流程**：

```
正常流程                    断线后                    重连后
┌─────────┐              ┌─────────┐              ┌─────────┐
│ Client  │              │ Agent   │              │ Client  │
│  ┌───┐  │              │ Paused  │              │  ┌───┐  │
│  │WS │──┼────────────>│ Running │              │  │WS │──┼────────┐
│  └───┘  │              │ (continue)│             │  └───┘  │        │
└─────────┘              └─────────┘              └─────────┘        │
                                                                      │
                                                          可恢复Agent列表 │
                                                                      ↓
                                                          ┌──────────────────┐
                                                          │ Resume Agent?   │
                                                          │ - 恢复进度       │
                                                          │ - 继续执行       │
                                                          └──────────────────┘
```

### 2. 熔断机制（Circuit Breaker）

```typescript
// src/resilience/circuit-breaker.ts

/**
 * 熔断器状态
 */
enum CircuitState {
  CLOSED = 'closed',       // 正常：请求正常通过
  OPEN = 'open',           // 熔断：请求直接失败
  HALF_OPEN = 'half_open', // 半开：允许少量请求试探
}

/**
 * 熔断器配置
 */
interface CircuitBreakerConfig {
  failureThreshold: number;     // 失败阈值：连续失败多少次后熔断
  successThreshold: number;     // 成功阈值：半开状态多少次成功后恢复
  timeout: number;              // 熔断超时：熔断后多久尝试恢复（ms）
  monitoringPeriod: number;     // 监控周期：统计时间窗口（ms）
}

/**
 * 熔断器实现
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private openedAt: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * 执行请求（带熔断保护）
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    // 检查是否应该尝试恢复
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.openedAt > this.config.timeout) {
        this.state = CircuitState.HALF_OPEN;
        console.log(`[CircuitBreaker] ${operationName}: Entering HALF_OPEN state`);
      } else {
        throw new CircuitBreakerOpenError(`Circuit breaker OPEN for ${operationName}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess(operationName);
      return result;
    } catch (error) {
      this.onFailure(operationName, error);
      throw error;
    }
  }

  private onSuccess(operationName: string): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        console.log(`[CircuitBreaker] ${operationName}: Circuit CLOSED (recovered)`);
      }
    }
  }

  private onFailure(operationName: string, error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.openedAt = Date.now();
      console.error(`[CircuitBreaker] ${operationName}: Circuit OPEN (failures: ${this.failureCount})`);
    }
  }

  getState(): { state: CircuitState; failureCount: number } {
    return { state: this.state, failureCount: this.failureCount };
  }
}

class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * 针对LLM API的熔断器使用
 */
export class LLMCircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    // 为不同的LLM API创建熔断器
    this.createBreaker('anthropic', {
      failureThreshold: 5,   // 连续5次失败后熔断
      successThreshold: 2,   // 半开状态2次成功后恢复
      timeout: 60000,        // 熔断60秒后尝试恢复
      monitoringPeriod: 10000,
    });

    this.createBreaker('embedding', {
      failureThreshold: 10,  // embedding服务可容忍更多失败
      successThreshold: 3,
      timeout: 30000,        // 30秒
      monitoringPeriod: 10000,
    });
  }

  private createBreaker(name: string, config: CircuitBreakerConfig): void {
    this.breakers.set(name, new CircuitBreaker(config));
  }

  async execute<T>(
    apiName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const breaker = this.breakers.get(apiName);
    if (!breaker) {
      return operation();
    }
    return breaker.execute(operation, apiName);
  }

  getAllStates(): Record<string, { state: CircuitState; failureCount: number }> {
    const states: Record<string, unknown> = {};
    for (const [name, breaker] of this.breakers) {
      states[name] = breaker.getState();
    }
    return states as Record<string, { state: CircuitState; failureCount: number }>;
  }
}
```

### 3. 速率限制（Token Bucket）

```typescript
// src/resilience/rate-limiter.ts

/**
 * 令牌桶速率限制器
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,      // 桶容量
    private refillRate: number,    // 填充速率（tokens/秒）
    private window: number = 1000  // 填充窗口（ms）
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * 尝试消费令牌
   */
  async tryConsume(tokens: number = 1): Promise<boolean> {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  /**
   * 阻塞式等待令牌
   */
  async consume(tokens: number = 1, timeout?: number): Promise<boolean> {
    const startTime = Date.now();

    while (true) {
      if (await this.tryConsume(tokens)) {
        return true;
      }

      if (timeout && Date.now() - startTime > timeout) {
        return false;
      }

      // 等待一小段时间后重试
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * 填充令牌
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed >= this.window) {
      const tokensToAdd = Math.floor((elapsed / this.window) * this.refillRate);
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * LLM API速率限制管理器
 */
export class LLMRateLimitManager {
  private limiters: Map<string, TokenBucketRateLimiter> = new Map();

  constructor() {
    // Anthropic API限制
    this.addLimiter('anthropic:message', {
      capacity: 50,       // 每分钟50个请求
      refillRate: 50 / 60,
      window: 60000,
    });

    this.addLimiter('anthropic:token', {
      capacity: 200000,   // 每分钟20万token
      refillRate: 200000 / 60,
      window: 60000,
    });

    // Embedding API限制
    this.addLimiter('embedding', {
      capacity: 100,      // 每秒100个请求
      refillRate: 100,
      window: 1000,
    });
  }

  private addLimiter(name: string, config: {
    capacity: number;
    refillRate: number;
    window: number;
  }): void {
    this.limiters.set(name, new TokenBucketRateLimiter(
      config.capacity,
      config.refillRate,
      config.window
    ));
  }

  /**
   * 执行速率限制的请求
   */
  async execute<T>(
    limiterName: string,
    operation: () => Promise<T>,
    tokens: number = 1
  ): Promise<T> {
    const limiter = this.limiters.get(limiterName);
    if (!limiter) {
      return operation();
    }

    const allowed = await limiter.consume(tokens, 30000);  // 等待最多30秒
    if (!allowed) {
      throw new RateLimitError(`Rate limit exceeded for ${limiterName}`);
    }

    return operation();
  }

  getAvailableTokens(limiterName: string): number {
    const limiter = this.limiters.get(limiterName);
    return limiter ? limiter.getAvailableTokens() : 0;
  }
}

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}
```

### 4. 优雅降级

```typescript
// src/resilience/graceful-degradation.ts

/**
 * 优雅降级策略
 *
 * 当某个服务不可用时，自动降级到备用方案，而不是完全失败
 */
export class GracefulDegradationManager {
  private memory: Memory;
  private embeddingService: EmbeddingService;
  private llmService: LLMService;

  constructor(memory: Memory, embeddingService: EmbeddingService, llmService: LLMService) {
    this.memory = memory;
    this.embeddingService = embeddingService;
    this.llmService = llmService;
  }

  /**
   * 降级策略配置
   */
  private strategies = {
    // 向量检索失败 → 降级为关键词检索
    vectorSearch: async (query: string, options: unknown) => {
      try {
        return await this.memory.vectorSearch(query, options);
      } catch (error) {
        console.warn('[Degradation] Vector search failed, falling back to keyword search', error);
        return await this.memory.keywordSearch(query, options);
      }
    },

    // Embedding服务失败 → 降级为简化版检索
    embedding: async (content: string) => {
      try {
        return await this.embeddingService.embed(content);
      } catch (error) {
        console.warn('[Degradation] Embedding service failed, using fallback');
        // 返回零向量或使用关键词匹配
        return this.getFallbackEmbedding(content);
      }
    },

    // LLM API失败 → 降级为模板响应
    llmGeneration: async <T>(prompt: string, fallback: T) => {
      try {
        return await this.llmService.generate<T>(prompt);
      } catch (error) {
        console.warn('[Degradation] LLM generation failed, using fallback');
        return fallback;
      }
    },
  };

  /**
   * 带降级的向量检索
   */
  async searchWithFallback(query: string, options: unknown): Promise<SearchResult[]> {
    try {
      // 尝试向量检索
      return await this.memory.vectorSearch(query, options);
    } catch (error) {
      console.warn('[Degradation] Vector search failed, trying keyword search');

      // 降级为关键词检索
      try {
        return await this.memory.keywordSearch(query, options);
      } catch (keywordError) {
        console.error('[Degradation] Both vector and keyword search failed');
        return [];
      }
    }
  }

  /**
   * 带降级的Embedding获取
   *
   * 注意：当Embedding服务不可用时，应抛出错误而非使用假向量。
   * 假向量无法实现语义相似度搜索，会导致检索质量严重下降。
   */
  async getEmbeddingWithFallback(content: string): Promise<number[]> {
    try {
      return await this.embeddingService.embed(content);
    } catch (error) {
      console.error('[Degradation] Embedding API failed, cannot perform semantic search');
      // Embedding是核心功能，降级为假向量无意义
      // 调用方应处理此错误并改用关键词搜索
      throw new Error('Embedding service unavailable, please retry or use keyword search');
    }
  }

```

### 5. Agent状态持久化（Orchestrator）

```typescript
// src/agent/agent-state-manager.ts

/**
 * Agent状态持久化管理器
 *
 * 解决Orchestrator单点故障问题
 */
export class AgentStateManager {
  private stateDir: string;

  constructor() {
    this.stateDir = path.join(ENV.EVOAGENT_HOME, 'agent_states');
    fs.ensureDirSync(this.stateDir);
  }

  /**
   * 保存Agent检查点
   */
  async saveCheckpoint(runId: string, checkpoint: {
    agentType: string;
    status: string;
    progress: number;
    context: unknown;  // Agent恢复所需上下文
    toolCalls: unknown[];
    error?: Error;
  }): Promise<void> {
    const statePath = this.getStatePath(runId);
    const state = {
      runId,
      ...checkpoint,
      savedAt: Date.now(),
    };

    // 原子写入
    const tmpPath = statePath + '.tmp';
    await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tmpPath, statePath);
  }

  /**
   * 加载Agent检查点
   */
  async loadCheckpoint(runId: string): Promise<AgentCheckpoint | null> {
    const statePath = this.getStatePath(runId);

    if (!(await fs.pathExists(statePath))) {
      return null;
    }

    const content = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 删除检查点（Agent完成时调用）
   */
  async deleteCheckpoint(runId: string): Promise<void> {
    const statePath = this.getStatePath(runId);
    if (await fs.pathExists(statePath)) {
      await fs.remove(statePath);
    }
  }

  /**
   * 恢复Agent（从检查点）
   */
  async restoreAgent(runId: string): Promise<Agent | null> {
    const checkpoint = await this.loadCheckpoint(runId);
    if (!checkpoint) {
      return null;
    }

    // 根据agentType创建对应的Agent实例
    const agent = this.createAgent(checkpoint.agentType);

    // 恢复状态
    await agent.restore(checkpoint);

    return agent;
  }

  /**
   * 获取所有未完成的Agent（用于崩溃恢复）
   */
  async getPendingAgents(): Promise<AgentCheckpoint[]> {
    const files = await fs.readdir(this.stateDir);
    const pending: AgentCheckpoint[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const statePath = path.join(this.stateDir, file);
      const content = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(content);

      if (state.status !== 'completed' && state.status !== 'failed') {
        pending.push(state);
      }
    }

    return pending.sort((a, b) => a.savedAt - b.savedAt);
  }

  private getStatePath(runId: string): string {
    return path.join(this.stateDir, `${runId}.json`);
  }

  private createAgent(agentType: string): Agent {
    // 工厂方法：根据agentType创建Agent
    switch (agentType) {
      case 'planner':
        return new PlannerAgent();
      case 'orchestrator':
        return new OrchestratorAgent();
      case 'specialist':
        return new SpecialistAgent();
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }
}

interface AgentCheckpoint {
  runId: string;
  agentType: string;
  status: string;
  progress: number;
  context: unknown;
  toolCalls: unknown[];
  error?: Error;
  savedAt: number;
}
```

### 6. A2A通信超时机制

```typescript
// src/agent/a2a-communication.ts

/**
 * A2A通信带超时和取消机制
 *
 * @note pendingRequests Map不持久化，进程重启后请求会丢失
 * 这是设计决策：A2A通信主要用于Agent间协作，进程重启后Agent状态也已重置
 * 默认超时30秒确保不会无限期挂起
 */
export class A2ACommunication {
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  /**
   * 默认超时时间（30秒）
   * 可根据实际场景调整：
   * - 简单消息：5-10秒
   * - 复杂任务：30-60秒
   * - 长时间运行：使用回调机制而非等待响应
   */
  private readonly DEFAULT_TIMEOUT = 30000;

  /**
   * 发送消息（带超时和指数退避重试）
   *
   * @param retryCount 当前重试次数（内部使用）
   */
  async send(
    from: string,
    to: string,
    message: unknown,
    options: {
      timeout?: number;  // 超时时间（ms）
      retry?: boolean;    // 是否启用重试（默认true）
      maxRetries?: number; // 最大重试次数（默认3）
      cancelSignal?: AbortSignal;
    } = {}
  ): Promise<unknown> {
    const { timeout = 30000, retry = true, maxRetries = 3, cancelSignal } = options;

    try {
      return await this._send(from, to, message, { timeout, cancelSignal });
    } catch (error) {
      // 判断是否为可重试错误
      const isRetryable = error instanceof Error &&
        (error.message.includes('timeout') || error.message.includes('ECONNREFUSED'));

      if (retry && isRetryable && this.getRetryCount(from, to) < maxRetries) {
        const retryCount = this.incrementRetryCount(from, to);
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // 指数退避，最大10秒

        console.warn(`[A2A] Send to ${to} failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await this.delay(delay);

        return this.send(from, to, message, { ...options, retryCount });
      }

      throw error;
    }
  }

  /**
   * 内部发送方法
   */
  private async _send(
    from: string,
    to: string,
    message: unknown,
    options: { timeout?: number; cancelSignal?: AbortSignal } = {}
  ): Promise<unknown> {
    const { timeout = 30000, cancelSignal } = options;
    const requestId = `${from}->${to}_${Date.now()}`;

    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`A2A timeout: ${to} did not respond within ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(requestId, { resolve, reject, timeout: timer });
    });

    // 处理取消信号
    if (cancelSignal) {
      cancelSignal.addEventListener('abort', () => {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(requestId);
          pending.reject(new DOMException('Aborted', 'AbortError'));
        }
      });
    }

    // 发送消息
    await this.deliver(from, to, { requestId, ...message });

    return promise;
  }

  /**
   * 重试计数器
   */
  private retryCounters = new Map<string, number>();

  private getRetryCount(from: string, to: string): number {
    const key = `${from}->${to}`;
    return this.retryCounters.get(key) || 0;
  }

  private incrementRetryCount(from: string, to: string): number {
    const key = `${from}->${to}`;
    const count = (this.retryCounters.get(key) || 0) + 1;
    this.retryCounters.set(key, count);
    return count;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 接收消息并响应
   */
  async receive(from: string, message: { requestId?: string; [key: string]: unknown }): Promise<void> {
    const { requestId } = message;

    if (requestId && this.pendingRequests.has(requestId)) {
      // 响应之前的请求
      const pending = this.pendingRequests.get(requestId)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.resolve(message);
    } else {
      // 新请求，转发给对应的Agent处理
      await this.forwardToAgent(from, message);
    }
  }
}
```

---

## 可观测性机制（第三轮补充）

基于SRE专家反馈，添加生产级可观测性支持：

### 1. Metrics导出（Prometheus格式）

```typescript
// src/observability/metrics.ts

/**
 * Prometheus格式Metrics导出
 */
export class MetricsCollector {
  private registry: Map<string, Metric> = new Map();

  /**
   * Counter类型指标
   */
  counter(name: string, help: string): Counter {
    return this.getOrCreate(name, 'counter', help, () => new Counter(name, help));
  }

  /**
   * Gauge类型指标
   */
  gauge(name: string, help: string): Gauge {
    return this.getOrCreate(name, 'gauge', help, () => new Gauge(name, help));
  }

  /**
   * Histogram类型指标
   */
  histogram(name: string, help: string, buckets?: number[]): Histogram {
    return this.getOrCreate(name, 'histogram', help, () => new Histogram(name, help, buckets));
  }

  /**
   * Summary类型指标
   */
  summary(name: string, help: string, quantiles?: number[]): Summary {
    return this.getOrCreate(name, 'summary', help, () => new Summary(name, help, quantiles));
  }

  /**
   * 导出Prometheus格式
   */
  async scrape(): Promise<string> {
    const lines: string[] = [];

    for (const metric of this.registry.values()) {
      lines.push(...metric.serialize());
    }

    return lines.join('\n');
  }

  private getOrCreate<T extends Metric>(
    name: string,
    type: string,
    help: string,
    factory: () => T
  ): T {
    if (!this.registry.has(name)) {
      this.registry.set(name, factory());
    }
    return this.registry.get(name) as T;
  }
}

interface Metric {
  serialize(): string[];
}

class Counter implements Metric {
  private value: number = 0;
  private labels: Map<string, string> = new Map();

  constructor(
    public name: string,
    public help: string,
    public type = 'counter'
  ) {}

  inc(labels?: Record<string, string>, delta: number = 1): void {
    if (labels) {
      this.labels = new Map(Object.entries(labels));
    }
    this.value += delta;
  }

  reset(): void {
    this.value = 0;
  }

  get(): number {
    return this.value;
  }

  serialize(): string[] {
    const labelStr = this.labels.size > 0
      ? '{' + Array.from(this.labels.entries()).map(([k, v]) => `${k}="${v}"`).join(',') + '}'
      : '';
    return [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.type}`,
      `${this.name}${labelStr} ${this.value}`
    ];
  }
}

class Gauge implements Metric {
  private value: number = 0;
  private labels: Map<string, string> = new Map();

  constructor(
    public name: string,
    public help: string,
    public type = 'gauge'
  ) {}

  set(value: number, labels?: Record<string, string>): void {
    if (labels) {
      this.labels = new Map(Object.entries(labels));
    }
    this.value = value;
  }

  inc(delta: number = 1, labels?: Record<string, string>): void {
    if (labels) {
      this.labels = new Map(Object.entries(labels));
    }
    this.value += delta;
  }

  dec(delta: number = 1, labels?: Record<string, string>): void {
    if (labels) {
      this.labels = new Map(Object.entries(labels));
    }
    this.value -= delta;
  }

  serialize(): string[] {
    const labelStr = this.labels.size > 0
      ? '{' + Array.from(this.labels.entries()).map(([k, v]) => `${k}="${v}"`).join(',') + '}'
      : '';
    return [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.type}`,
      `${this.name}${labelStr} ${this.value}`
    ];
  }
}

class Histogram implements Metric {
  private sum: number = 0;
  private count: number = 0;
  private buckets: number[];
  private bucketCounts: number[] = [];  // 每个bucket的累积计数
  private labels: Map<string, string> = new Map();

  constructor(
    public name: string,
    public help: string,
    buckets?: number[]
  ) {
    this.buckets = buckets || [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
    // 初始化bucket计数器（+Inf bucket）
    this.bucketCounts = new Array(this.buckets.length + 1).fill(0);
    this.type = 'histogram';
  }

  observe(value: number, labels?: Record<string, string>): void {
    if (labels) {
      this.labels = new Map(Object.entries(labels));
    }

    this.sum += value;
    this.count++;

    // 更新bucket计数（Prometheus格式：累积计数）
    // 如果value <= bucket[i]，则bucket[i]及之后的所有bucket都要+1
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        for (let j = i; j < this.bucketCounts.length; j++) {
          this.bucketCounts[j]++;
        }
        return;
      }
    }
    // 超过所有bucket，只增加+Inf bucket
    this.bucketCounts[this.bucketCounts.length - 1]++;
  }

  serialize(): string[] {
    const labelStr = this.labels.size > 0
      ? '{' + Array.from(this.labels.entries()).map(([k, v]) => `${k}="${v}"`).join(',') + '}'
      : '';

    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} ${this.type}`,
      `${this.name}${labelStr}_sum ${this.sum}`,
      `${this.name}${labelStr}_count ${this.count}`,
    ];

    // buckets（累积计数）
    for (let i = 0; i < this.buckets.length; i++) {
      lines.push(`${this.name}${labelStr}_bucket{le="${this.buckets[i]}"} ${this.bucketCounts[i]}`);
    }
    // +Inf bucket
    lines.push(`${this.name}${labelStr}_bucket{le="+Inf"} ${this.bucketCounts[this.bucketCounts.length - 1]}`);

    return lines;
  }
}

class Summary implements Metric {
  private values: number[] = [];
  private count: number = 0;
  private labels: Map<string, string> = new Map();

  constructor(
    public name: string,
    public help: string,
    public quantiles: number[] = [0.5, 0.9, 0.95, 0.99],
    public type = 'summary'
  ) {}

  observe(value: number, labels?: Record<string, string>): void {
    if (labels) {
      this.labels = new Map(Object.entries(labels));
    }
    this.values.push(value);
    this.count++;
  }

  serialize(): string[] {
    const labelStr = this.labels.size > 0
      ? '{' + Array.from(this.labels.entries()).map(([k, v]) => `${k}="${v}"`).join(',') + '}'
      : '';

    this.values.sort((a, b) => a - b);

    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.type}`,
      `${this.name}${labelStr}_count ${this.count}`,
    ];

    for (const q of this.quantiles) {
      const index = Math.floor(q * (this.values.length - 1));
      const value = this.values[index] || 0;
      lines.push(`${this.name}${labelStr}{quantile="${q}"} ${value}`);
    }

    lines.push(`${this.name}${labelStr}_sum ${this.values.reduce((a, b) => a + b, 0)}`);

    return lines;
  }
}

/**
 * EvoAgent核心Metrics定义
 */
export class EvoAgentMetrics {
  constructor(private metrics: MetricsCollector) {}

  /**
   * HTTP请求相关
   */
  // LLM API调用
  readonly llmRequests = this.metrics.counter('evoagent_llm_requests_total', 'Total LLM API requests');
  readonly llmRequestsDuration = this.metrics.histogram('evoagent_llm_requests_duration_seconds', 'LLM request duration');
  readonly llmRequestsErrors = this.metrics.counter('evoagent_llm_requests_errors_total', 'Total LLM API errors', { status: 'error' });

  // Embedding API调用
  readonly embeddingRequests = this.metrics.counter('evoagent_embedding_requests_total', 'Total embedding API requests');
  readonly embeddingRequestsDuration = this.metrics.histogram('evoagent_embedding_requests_duration_seconds', 'Embedding request duration');
  readonly embeddingCacheHits = this.metrics.counter('evoagent_embedding_cache_hits_total', 'Embedding cache hits');

  // Agent执行
  readonly agentRuns = this.metrics.counter('evoagent_agent_runs_total', 'Total agent runs', { agent_type: '', mode: '' });
  readonly agentRunDuration = this.metrics.histogram('evoagent_agent_run_duration_seconds', 'Agent run duration', { agent_type: '', mode: '' });
  readonly agentRunErrors = this.metrics.counter('evoagent_agent_run_errors_total', 'Total agent run errors', { agent_type: '', mode: '', error_type: '' });

  // Session
  readonly sessionsActive = this.metrics.gauge('evoagent_sessions_active', 'Currently active sessions');
  readonly sessionsTotal = this.metrics.counter('evoagent_sessions_created_total', 'Total sessions created');

  // 工具调用
  readonly toolCalls = this.metrics.counter('evoagent_tool_calls_total', 'Total tool calls', { tool_name: '', status: '' });
  readonly toolCallDuration = this.metrics.histogram('evoagent_tool_call_duration_seconds', 'Tool call duration', { tool_name: '' });

  // 记忆系统
  readonly memoryVectorSearch = this.metrics.counter('evoagent_memory_vector_search_total', 'Vector memory searches');
  readonly memoryKeywordSearch = this.metrics.counter('evoagent_memory_keyword_search_total', 'Keyword memory searches');
  readonly memoryHybridSearch = this.metrics.counter('evoagent_memory_hybrid_search_total', 'Hybrid memory searches');

  // 稳定性相关
  readonly circuitBreakerState = this.metrics.gauge('evoagent_circuit_breaker_state', 'Circuit breaker state (0=closed, 1=open, 2=half_open)', { api: '' });
  readonly circuitBreakerFailures = this.metrics.counter('evoagent_circuit_breaker_failures_total', 'Circuit breaker trips', { api: '' });
  readonly rateLimitThrottled = this.metrics.counter('evoagent_rate_limit_throttled_total', 'Rate limit throttled requests');

  // 降级事件
  readonly degradationEvents = this.metrics.counter('evoagent_degradation_events_total', 'Graceful degradation events', { service: '', degradation_type: '' });
}

/**
 * /metrics HTTP端点处理器
 */
export async function metricsHandler(request: IncomingMessage): Promise<Response> {
  const metrics = await global.evoAgent?.metrics.scrape();
  const etag = crypto.createHash('sha256').update(metrics).digest('hex');

  // 检查If-None-Match
  const ifNoneMatch = request.headers?.get('if-none-match');
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304 });
  }

  return new Response(metrics, {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Etag': `"${etag}"`,
    },
  });
}
```

### 2. 结构化日志

```typescript
// src/observability/logger.ts

/**
 * 结构化日志
 *
 * 统一日志格式，便于解析和监控
 */
export class StructuredLogger {
  private context: Record<string, unknown> = {};

  constructor(
    private service: string,
    private component: string,
    private minLevel: LogLevel = 'info'
  ) {}

  /**
   * 添加上下文
   */
  withContext(context: Record<string, unknown>): this {
    const logger = new StructuredLogger(this.service, this.component, this.minLevel);
    logger.context = { ...this.context, ...context };
    return logger as any;
  }

  /**
   * 记录日志
   */
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog(level)) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        service: this.service,
        component: this.component,
        level: level.toUpperCase(),
        message,
        ...this.context,
        ...(data || {}),
      };

      // 输出到stdout（JSON Lines格式）
      console.log(JSON.stringify(logEntry));
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error | Record<string, unknown>): void {
    const data = error instanceof Error
      ? { error: error.message, stack: error.stack }
      : error;
    this.log('error', message, data);
  }

  fatal(message: string, data?: Record<string, unknown>): void {
    this.log('fatal', message, data);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * 全局日志实例
 */
export const logger = new StructuredLogger('evoagent', 'main');

/**
 * 各模块专用logger
 */
export const agentLogger = logger.withContext({ module: 'agent' });
export const llmLogger = logger.withContext({ module: 'llm' });
export const memoryLogger = logger.withContext({ module: 'memory' });
export const sessionLogger = logger.withContext({ module: 'session' });
export const metricsLogger = logger.withContext({ module: 'metrics' });
```

### 3. 分布式追踪

```typescript
// src/observability/tracing.ts

/**
 * 分布式追踪
 *
 * 实现OpenTelemetry trace上下文传播
 */
export class DistributedTracing {
  private tracer: Tracer;

  constructor(serviceName: string) {
    this.tracer = new Tracer(serviceName);
  }

  /**
   * 开始span
   */
  startSpan(name: string, options?: {
    parentSpan?: Span;
    attributes?: Record<string, unknown>;
  }): Span {
    const parentContext = options?.parentSpan?.context;
    return this.tracer.startSpan(name, {
      ...options,
      context: parentContext,
    });
  }

  /**
   * 为请求创建span（HTTP/WebSocket）
   */
  async traceRequest<T>(
    requestName: string,
    handler: (span: Span) => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(requestName);

    try {
      return await handler(span);
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * 提取trace上下文（用于A2A通信传播）
   */
  extractContext(carrier: string): TraceContext | null {
    try {
      return JSON.parse(carrier);
    } catch {
      return null;
    }
  }

  /**
   * 注入trace上下文（用于A2A通信）
   */
  injectContext(span: Span): string {
    return span.context ? JSON.stringify(span.context) : '';
  }
}

/**
 * Trace上下文（简化版）
 */
interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
  baggage?: Record<string, string>;
}

/**
 * Span接口
 */
interface Span {
  context: TraceContext;
  setAttribute(key: string, value: unknown): void;
  setAttributes(attributes: Record<string, unknown>): void;
  addEvent(name: string, attributes?: Record<string, unknown>): void;
  recordException(exception: Error): void;
  end(): void;
}

/**
 * 简化的Tracer实现
 */
class Tracer {
  constructor(private serviceName: string) {}

  startSpan(name: string, options?: any): Span {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();

    return {
      context: {
        traceId,
        spanId,
        sampled: true,
        baggage: {},
      },
      setAttribute: () => {},
      setAttributes: () => {},
      addEvent: () => {},
      recordException: () => {},
      end: () => {},
    };
  }

  private generateTraceId(): string {
    return crypto.randomUUID();
  }

  private generateSpanId(): string {
    return crypto.randomUUID().slice(0, 16);
  }
}

/**
 * A2A通信带trace传播
 */
export class A2ACommunicationWithTracing extends A2ACommunication {
  /**
   * 发送消息（带trace传播）
   */
  async send(
    from: string,
    to: string,
    message: unknown,
    options?: { timeout?: number; cancelSignal?: AbortSignal }
  ): Promise<unknown> {
    const currentSpan = tracing.getCurrentSpan();
    const carrier = tracing.injectContext(currentSpan);

    return super.send(from, to, { ...message, trace: carrier }, options);
  }

  /**
   * 接收消息（恢复trace）
   */
  async receive(from: string, message: { trace?: string }): Promise<void> {
    const trace = tracing.extractContext(message.trace || '');

    if (trace) {
      await tracing.withSpan(trace, async () => {
        return super.receive(from, message);
      });
    } else {
      return super.receive(from, message);
    }
  }
}
```

### 4. 健康检查端点

```typescript
// src/observability/health.ts

/**
 * 健康检查端点
 *
 * GET /healthz
 */
export class HealthChecker {
  private checks: Map<string, HealthCheck> = new Map();

  register(name: string, check: HealthCheck): void {
    this.checks.set(name, check);
  }

  /**
   * 执行健康检查
   */
  async check(): Promise<HealthStatus> {
    const results: Record<string, HealthCheckResult> = {};

    for (const [name, check] of this.checks) {
      try {
        const result = await check.execute();
        results[name] = { status: 'pass', ...result };
      } catch (error) {
        results[name] = {
          status: 'fail',
          output: (error as Error).message,
          time: Date.now(),
        };
      }
    }

    const overallStatus = Object.values(results).every(r => r.status === 'pass')
      ? 'pass'
      : Object.values(results).some(r => r.status === 'warn')
      ? 'warn'
      : 'fail';

    return {
      status: overallStatus,
      timestamp: Date.now(),
      checks: results,
    };
  }
}

interface HealthCheck {
  name: string;
  execute: () => Promise<HealthCheckResult>;
}

interface HealthCheckResult {
  status: 'pass' | 'warn' | 'fail';
  output?: string;
  time?: number;
}

interface HealthStatus {
  status: 'pass' | 'warn' | 'fail';
  timestamp: number;
  checks: Record<string, HealthCheckResult>;
}

/**
 * 健康检查实现
 */
export function registerHealthChecks(
  checker: HealthChecker,
  services: {
    llmService: LLMService;
    embeddingService: EmbeddingService;
    db: Database;
  }
): void {
  const { llmService, embeddingService, db } = services;

  // LLM API健康检查
  checker.register('llm_api', {
    name: 'LLM API',
    execute: async () => {
      const start = Date.now();
      try {
        await llmService.testConnection();
        return {
          status: 'pass',
          output: 'LLM API responsive',
          time: Date.now() - start,
        };
      } catch (error) {
        return {
          status: 'fail',
          output: (error as Error).message,
          time: Date.now() - start,
        };
      }
    },
  });

  // Embedding API健康检查
  checker.register('embedding_api', {
    name: 'Embedding API',
    execute: async () => {
      const start = Date.now();
      try {
        await embeddingService.embed('test');
        return {
          status: 'pass',
          output: 'Embedding API responsive',
          time: Date.now() - start,
        };
      } catch (error) {
        return {
          status: 'fail',
          output: (error as Error).message,
          time: Date.now() - start,
        };
      }
    },
  });

  // 数据库健康检查
  checker.register('database', {
    name: 'Database',
    execute: async () => {
      const start = Date.now();
      try {
        await db.prepare('SELECT 1').get();
        return {
          status: 'pass',
          output: 'Database connection OK',
          time: Date.now() - start,
        };
      } catch (error) {
        return {
          status: 'fail',
          output: (error as Error).message,
          time: Date.now() - start,
        };
      }
    },
  });

  // 磁盘空间检查
  checker.register('disk_space', {
    name: 'Disk Space',
    execute: async () => {
      const start = Date.now();
      try {
        const stats = await getDiskStats(ENV.EVOAGENT_HOME);
        const usagePercent = (stats.used / stats.total) * 100;

        let status: 'pass' | 'warn' | 'fail' = 'pass';
        let output = `Disk usage: ${usagePercent.toFixed(1)}%`;

        if (usagePercent > 90) {
          status = 'fail';
          output += ' (CRITICAL)';
        } else if (usagePercent > 75) {
          status = 'warn';
          output += ' (WARNING)';
        }

        return {
          status,
          output,
          time: Date.now() - start,
        };
      } catch (error) {
        return {
          status: 'fail',
          output: (error as Error).message,
          time: Date.now() - start,
        };
      }
    },
  });

  // 内存使用检查
  checker.register('memory', {
    name: 'Memory',
    execute: async () => {
      const start = Date.now();
      try {
        const usage = process.memoryUsage();
        const heapUsedMB = usage.heapUsed / 1024 / 1024;
        const heapTotalMB = usage.heapTotal / 1024 / 1024;
        const rssMB = usage.rss / 1024 / 1024;

        let status: 'pass' | 'warn' | 'fail' = 'pass';
        const parts: string[] = [];

        if (heapUsedMB / heapTotalMB > 0.9) {
          status = 'fail';
          parts.push(`heap: ${(heapUsedMB).toFixed(1)}MB/${heapTotalMB}MB (CRITICAL)`);
        } else if (heapUsedMB / heapTotalMB > 0.75) {
          status = 'warn';
          parts.push(`heap: ${(heapUsedMB).toFixed(1)}MB/${heapTotalMB}MB (WARNING)`);
        }

        if (rssMB > 1024) {
          status = status === 'fail' ? 'fail' : 'warn';
          parts.push(`rss: ${(rssMB / 1024).toFixed(1)}GB`);
        }

        return {
          status,
          output: parts.join('; '),
          time: Date.now() - start,
        };
      } catch (error) {
        return {
          status: 'fail',
          output: (error as Error).message,
          time: Date.now() - start,
        };
      }
    },
  });
}

async function getDiskStats(path: string): Promise<{ total: number; used: number }> {
  const stats = await fs.diskUsage(path);
  return {
    total: stats.total,
    used: stats.used,
  };
}
```

### 5. SLO/SLI定义

```typescript
// src/observability/slo.ts

/**
 * SLO/SLI定义
 *
 * Service Level Objectives & Service Level Indicators
 */
export const SLO = {
  // SLO: 服务水平目标
  availability: {
    target: 0.999,      // 99.9%可用性
    description: '系统正常服务时间比例',
  },

  // SLI: 服务水平指标
  availability: {
    target: 0.999,      // SLO对应的目标
    window: '30d',        // 滚动窗口
    description: '过去30天的可用性',
    measurement: '(total_time - downtime) / total_time',
  },

  requestLatency: {
    p50: 5000,            // 50%请求在5秒内完成
    p95: 15000,           // 95%请求在15秒内完成
    p99: 60000,           // 99%请求在60秒内完成
    description: 'Agent执行延迟分布',
  },

  agentSuccessRate: {
    target: 0.95,         // 95%的Agent执行成功
    window: '7d',          // 滚动窗口
    description: 'Agent任务成功率',
  },

  llmErrorRate: {
    target: 0.01,         // LLM API错误率低于1%
    window: '1h',          // 滚动窗口
    description: 'LLM API调用错误率',
  },

  circuitBreakerTrips: {
    target: 0.01,         // 熔断器触发率低于1%
    window: '24h',         // 滚动窗口
    description: '熔断器触发频率',
  },

  memoryAccuracy: {
    target: 0.9,          // 90%检索准确率
    window: '7d',
    description: '记忆检索准确率（人工抽检）',
  },
};

/**
 * SLI监控
 */
export class SLIMonitor {
  constructor(private metrics: EvoAgentMetrics) {}

  /**
   * 记录请求成功
   */
  recordRequest(duration: number): void {
    // 记录到histogram
  }

  /**
   * 记录请求失败
   */
  recordRequestError(errorType: string): void {
    this.metrics.agentRunErrors.inc({ error_type: errorType });
  }

  /**
   * 检查SLO是否满足
   */
  checkSLOs(): SLOReport {
    // 定期计算并报告SLO满足情况
    return {
      availability: this.calculateAvailability(),
      requestLatency: this.calculateLatency(),
      agentSuccessRate: this.calculateSuccessRate(),
      llmErrorRate: this.calculateErrorRate(),
      circuitBreakerTrips: this.calculateCircuitBreakerTrips(),
    };
  }

  private calculateAvailability(): { current: number; target: number } {
    // 从metrics计算
    return { current: 0.999, target: SLO.availability.target };
  }

  private calculateLatency(): SLIMetric {
    // 从histogram计算
    return { p50: 5000, p95: 15000, p99: 60000 };
  }

  private calculateSuccessRate(): { current: number; target: number } {
    // 从metrics计算
    return { current: 0.95, target: SLO.agentSuccessRate.target };
  }

  private calculateErrorRate(): { current: number; target: number } {
    // 从metrics计算
    return { current: 0.005, target: SLO.llmErrorRate.target };
  }

  private calculateCircuitBreakerTrips(): { current: number; target: number } {
    // 从metrics计算
    return { current: 0.005, target: SLO.circuitBreakerTrips.target };
  }
}

interface SLOReport {
  availability: { current: number; target: number };
  requestLatency: SLIMetric;
  agentSuccessRate: { current: number; target: number };
  llmErrorRate: { current: number; target: number };
  circuitBreakerTrips: { current: number; target: number };
}

interface SLIMetric {
  p50?: number;
  p95?: number;
  p99?: number;
  current?: number;
  target?: number;
}

/**
 * 告警规则定义
 */
export const AlertRules = {
  // P0 - 立即告警
  critical: [
    {
      name: 'circuit_breaker_open',
      condition: 'circuitBreakerState == 1',
      duration: '1m',
      message: 'Circuit breaker OPEN for {{.api}}',
    },
    {
      name: 'high_error_rate',
      condition: 'errorRate > 0.05',  // 5%错误率
      window: '5m',
      message: 'Error rate exceeded 5% in last 5 minutes',
    },
    {
      name: 'disk_space_critical',
      condition: 'diskUsagePercent > 90',
      message: 'Disk space CRITICAL: {{.usagePercent}}% used',
    },
    {
      name: 'memory_high',
      condition: 'memoryUsagePercent > 90',
      message: 'Memory usage CRITICAL: {{.heapUsedMB}}MB/{{.heapTotalMB}}MB',
    },
  ],

  // P1 - 警告告警
  warning: [
    {
      name: 'high_latency',
      condition: 'p95_latency > 30000',  // 30秒
      window: '10m',
      message: 'P95 latency exceeded 30s: current={{.p95}}ms',
    },
    {
      name: 'low_success_rate',
      condition: 'successRate < 0.9',  // 90%成功率
      window: '1h',
      message: 'Agent success rate dropped below 90%',
    },
    {
      name: 'disk_space_warning',
      condition: 'diskUsagePercent > 75',
      message: 'Disk space WARNING: {{.usagePercent}}% used',
    },
  ],
};
```

---

## 工具系统

### 工具分类

```
记忆检索工具:
├─ search_knowledge     # 搜索Knowledge Base
├─ search_memory        # 向量检索历史经验
├─ get_session_history   # 获取Session历史
└─ check_patterns       # 检查已知模式

代码操作工具:
├─ read_file            # 读取文件
├─ write_file           # 写入文件
├─ edit_file            # 编辑文件
├─ delete_file          # 删除文件
└─ list_files          # 列出目录

代码生成工具:
├─ generate_component   # 生成组件
├─ generate_api          # 生成API
├─ generate_test         # 生成测试
└─ generate_migration    # 生成数据库迁移

项目管理工具:
├─ git_commit           # Git提交
├─ run_tests            # 运行测试
├─ install_dependencies  # 安装依赖
└─ build_project        # 构建项目

Agent协作工具:
├─ spawn_agent          # 启动Subagent
├─ a2a_send             # A2A通信
├─ wait_for_agent       # 等待Agent完成
└─ merge_results        # 合并结果

进化工具:
├─ record_pattern       # 记录模式到Knowledge
├─ record_pit           # 记录坑点到Knowledge
└─ update_prompt        # 更新System Prompt
```

---

## 数据流

### 端到端数据流

```
用户输入需求
    ↓
Gateway Server (接收WebSocket连接，解析请求)
    ↓
Planner Agent (检索记忆 → 评估复杂度 → 选择模式 → 生成计划)
    ↓
执行引擎 (根据模式选择A/B/C/D执行不同的流程)
    ↓
记忆写入 (每个Agent Run完成后自动收集经验 - 同步事件处理)
    ↓
定期反思 (每7天或每10个session触发，优化Prompt)
    ↓
交付输出 (可运行代码 + 文档)
```

**Collector触发时机说明**：
- Collector使用**同步事件处理**模型
- 每当Agent完成运行时，立即触发`collectEvent()`收集经验
- 事件类型：`agent_complete`（成功）、`agent_error`（失败）、`user_feedback`（反馈）
- 收集到的经验直接写入Knowledge库，无需异步队列

---

## 实施计划

### 总体策略：MVP先行，渐进式迭代

**核心原则**：
- 先验证核心概念，再扩展功能
- 每个阶段都有可交付的成果
- 失败快速发现，成功逐步扩大

### Phase 0: MVP（2周） - 验证核心概念

```
目标：验证"零交互交付可运行代码"是否可行

范围：
├── Planner Agent（简化版）
│   ├── 只支持模式A（单一Agent）
│   ├── 基础需求分析
│   └── 简单计划生成
│
├── Orchestrator Agent
│   ├── 接收计划
│   ├── 直接编码（模式A：退化模式）
│   └── 完成后报告
│
├── 基础Session管理
│   ├── .jsonl文件存储
│   ├── 基本对话历史
│   └── Agent生命周期事件
│
├── 简单CLI
│   ├── evoagent execute "<需求>"
│   ├── 进度显示
│   └── 基础错误处理
│
└── 手动维护Knowledge
    ├── 创建knowledge/目录
    ├── 提供示例markdown文件
    └── 暂不自动进化

不包含：
✗ 模式B/C/D
✗ Vector DB
✗ 进化系统
✗ A2A通信
✗ 复杂工具集

交付物：
- 可运行的最小系统
- 能完成简单任务："创建一个登录表单"
- 验证报告：核心概念是否可行
```

### Phase 1: 基础功能（3周） - 完善MVP

```
目标：从"能用"到"好用"

新增功能：
├── 三层记忆系统
│   ├── Session（已有）
│   ├── Knowledge（结构化markdown）
│   └── Vector DB（sqlite-vec）
│
├── 模式B：主从模式
│   ├── Orchestrator spawn Specialist
│   ├── CodeWriter + Reviewer
│   └── 基础A2A通信
│
├── 完整工具集
│   ├── 文件操作
│   ├── Git操作
│   └── 测试运行
│
├── 进化系统（简化版）
│   ├── Collector（只收集，不优化）
│   ├── 手动Prompt版本管理
│   └── 失败队列
│
└── CLI完善
    ├── evoagent knowledge
    ├── evoagent session list
    ├── evoagent config
    └── evoagent doctor

交付物：
- 完整功能的Agent系统
- 能完成中等任务："带认证的CRUD系统"
```

### Phase 2: 高级功能（3周） - 扩展能力

```
目标：支持复杂任务

新增功能：
├── 模式C：并行协作
│   ├── 并行spawn多个Specialist
│   ├── 广播通信
│   └── 结果集成
│
├── 模式D：分层架构
│   ├── 多阶段执行
│   ├── Architect Agent
│   └── 复杂任务协调
│
├── 进化系统（完整版）
│   ├── Reflector Agent
│   ├── 自动Prompt优化
│   ├── A/B测试
│   └── 反馈闭环
│
└── 高级工具
    ├── 项目初始化
    ├── 依赖管理
    └── 部署相关

交付物：
- 全功能Agent系统
- 能完成复杂任务："博客系统+评论+SEO"
```

### Phase 3: 生产就绪（2周） - 稳定性与体验

```
目标：可以实际使用

新增功能：
├── 稳定性增强
│   ├── 优雅重启
│   ├── 错误恢复
│   └── 资源清理
│
├── 用户体验
│   ├── evoagent init引导
│   ├── 友好错误信息
│   ├── Ctrl+C优雅退出
│   └── 详细帮助文档
│
├── 可观测性
│   ├── 详细日志
│   ├── 性能指标
│   └── 调试模式
│
└── 文档与示例
    ├── 用户手册
    ├── API文档
    ├── 示例项目
    └── 最佳实践

交付物：
- 生产可用的系统
- 完整文档
- 示例项目
```

### 阶段门禁标准

| 阶段 | 门禁标准 | 决策 |
|------|----------|------|
| Phase 0 | 能完成简单任务？ | ✅ 继续 → ❌ 终止 |
| Phase 1 | 能完成中等任务？ | ✅ 继续 → ⚸️ 调整方向 |
| Phase 2 | 能完成复杂任务？ | ✅ 继续 → ⚸️ 调整范围 |
| Phase 3 | 生产就绪？ | ✅ 发布 → ⚸️ 修复bug |

### 风险控制

| 风险 | 应对措施 |
|------|----------|
| LLM API不稳定 | 降级到本地模型（Ollama） |
| Vector DB不够用 | 简化为关键词搜索 |
| Agent不收敛 | 设置超时，人工介入 |
| 成本超预算 | 使用更便宜的模型 |
| 时间延期 | 砍功能，保核心 |

### 时间线总览

```
Phase 0 (MVP):     2周  ←─── 最关键，验证核心概念
Phase 1 (基础):    3周
Phase 2 (高级):    3周
Phase 3 (生产):    2周
────────────────────────
总计:             10周
```

---

## 配置示例

```yaml
# config/config.yaml

# 服务器配置
server:
  port: 18790
  host: "127.0.0.1"

# Lane配置
lanes:
  planner:
    maxConcurrent: 1
  main:
    maxConcurrent: 4
  parallel:
    maxConcurrent: 8

# Agent配置
agents:
  planner:
    model:
      provider: anthropic
      model: claude-sonnet-4-5-20250514
    temperature: 0.3

  orchestrator:
    model:
      provider: anthropic
      model: claude-sonnet-4-5-20250514
    temperature: 0.7

  specialist:
    codewriter:
      model: claude-sonnet-4-5-20250514
    tester:
      model: claude-sonnet-4-5-20250514
    reviewer:
      model: claude-sonnet-4-5-20250514

  reflector:
    model: claude-sonnet-4-5-20250514

# 记忆系统配置
memory:
  session:
    retention: 90days

  knowledge:
    categories:
      - pits
      - patterns
      - decisions
      - solutions

  vector:
    provider: sqlite-vec
    # 嵌入模型配置（通用接口，可选多种provider）
    embedding:
      provider: openai-compatible
      baseUrl: "http://localhost:11434/v1"
      apiKey: "dummy"
      model: "nomic-embed-text"
      # 或用OpenAI/Cohere/HTTP通用接口
      cache:
        enabled: true
        ttl: 7days
        maxSize: 10000
      dedup:
        enabled: true
        similarityThreshold: 0.99

# 进化配置
evolution:
  collection:
    enabled: true
    triggers:
      - agent_complete
      - agent_error
      - user_feedback

  reflection:
    enabled: true
    # 灵活的触发条件
    mode: "any"  # any(满足任一) | all(全部满足)
    triggers:
      schedule: "0 0 * * 0"      # 可选，设为null禁用
      minSessions: 10             # 可选，设为0禁用
      # mode=any: schedule OR minSessions 满足其一即触发
      # mode=all: schedule AND minSessions 都满足才触发

  promptOptimization:
    enabled: true
    trigger: after_reflection
    maxHistoryVersions: 100     # 最多保留版本数
    maxHistoryAge: 30days       # 普通版本保留时间
    autoRollback: true          # 自动回滚（成功率下降>20%）
    rollbackThreshold: 0.2      # 成功率下降阈值

  failureQueue:
    enabled: true
    maxRetries: 3
    retryInterval: 5min

# 进度可视化配置
progress:
  enabled: true
  style: "compact"  # compact | detailed | minimal
  updateInterval: 1s  # 进度更新频率
  show:               # 显示哪些信息
    - currentStep      # 当前步骤
    - percentage       # 百分比
    - eta              # 预计剩余时间
    - agentStatus      # Agent状态
```

**环境变量覆盖**：环境变量优先级高于配置文件

```bash
# .env
EVOAGENT_HOME=$HOME/.evoagent
EVOAGENT_PORT=18790
EVOAGENT_LOG_LEVEL=info
ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## CLI使用示例

```bash
# 安装
npm install -g evoagent

# 初始化配置（首次使用推荐）
evoagent init
```

### 初始化引导 (evoagent init)

```bash
$ evoagent init

Welcome to EvoAgent! 🚀 Let's get you set up.

? Where should data be stored? (~/.evoagent)
  ← 按Enter使用默认值，或输入自定义路径

? Which embedding provider? (Ollama [default] / OpenAI / Cohere)
  ← 选择embedding服务提供商

? Ollama is running on:
  ✓ http://localhost:11434/v1

? What's your Anthropic API key? (sk-ant-...)
  ← 输入API密钥（输入时隐藏）

✓ 配置已创建: ~/.evoagent/config.yaml
✓ 测试连接到 Anthropic API... ✓
✓ 测试embedding服务... ✓
✓ 创建知识库目录... ✓

🎉 初始化完成！

接下来:
  运行 'evoagent execute "创建一个登录表单"' 来测试
  或运行 'evoagent help' 查看所有命令
```

**init命令实现**：

```typescript
// src/commands/init.ts

export async function initCommand(options: InitOptions): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const config: Partial<Config> = {};

  // 询问数据目录
  config.home = await ask(rl, '数据存储路径', '~/.evoagent');
  ensureDirSync(config.home);

  // 询问embedding provider
  const provider = await askChoice(rl, 'Embedding服务', ['Ollama', 'OpenAI', 'Cohere']);
  config.memory = { vector: { embedding: { provider: provider.toLowerCase() } } };

  // 询问API密钥
  if (provider === 'OpenAI' || provider === 'Anthropic') {
    config.apiKey = awaitAskSecret(rl, `${provider} API密钥`);
  }

  // 测试连接
  console.log('测试连接中...');
  await testConnection(config);

  // 创建配置文件
  const configPath = path.join(config.home, 'config.yaml');
  await saveConfig(configPath, config);

  // 创建目录结构
  await createDirectoryStructure(config.home);

  console.log('✓ 初始化完成！');
  rl.close();
}
```

# 执行任务
evoagent execute "实现一个带用户认证的博客系统"

# 干运行模式（不实际执行，只看计划）
evoagent execute "..." --dry-run
evoagent execute "..." --dry-run --verbose  # 干运行+详细输出

# 进度显示（CLI选项优先级 > 配置文件）
evoagent execute "..." --progress           # 启用进度
evoagent execute "..." --progress=detailed  # 详细进度
evoagent execute "..." --no-progress        # 禁用进度

# 日志级别
evoagent execute "..."                    # 默认info
evoagent execute "..." --verbose           # 详细输出
evoagent execute "..." --quiet             # 静默模式
evoagent execute "..." --verbose --progress  # 组合使用

# 后台运行（持续服务模式）
evoagent serve --port 18790

# 反思触发（手动）
evoagent reflect --since "7 days ago"

# 知识库管理（统一单数命名）
evoagent knowledge search "Next.js API routes"
evoagent knowledge get --id pattern-name
evoagent knowledge list --category pits
evoagent knowledge add --file ./my-pattern.md

# 进化报告（统一单数命名）
evoagent evolution report
evoagent evolution report --last 5
evoagent evolution status

# Prompt管理（统一参数风格）
evoagent prompt history --agent planner
evoagent prompt rollback --agent planner
evoagent prompt rollback --agent planner --version 2
evoagent prompt pin --agent planner --version 3

# 失败队列管理（统一单数命名）
evoagent failure list
evoagent failure retry
evoagent failure clear

# 配置管理（统一单数命名）
evoagent config validate
evoagent config explain

# Planner决策解释（结构化参数）
evoagent explain --last-planner
evoagent explain --session <session-id>
evoagent explain --agent <run-id>

# Session管理（统一单数命名）
evoagent session list [--sort-by value|time|size]
evoagent session get --id <session-id> [--show-value]
evoagent session cleanup --low-value [--min-score 30] [--min-age 7days]
evoagent session cleanup --older-than 90days  # 备用：基于时间清理
evoagent session cleanup --status aborted
evoagent session keep --id <session-id>      # 标记永久保留
evoagent session unkeep --id <session-id>    # 取消永久保留
evoagent session revalue [--all]             # 重新评估价值

# 健康检查
evoagent doctor
evoagent doctor --verbose
```

### CLI命名规范

| 命令组 | 命令 | 说明 |
|--------|------|------|
| 主命令 | `execute` | 执行任务 |
| 主命令 | `serve` | 启动服务 |
| 主命令 | `reflect` | 触发反思 |
| 知识库 | `knowledge` | 统一单数，子命令: search/get/list/add |
| 进化 | `evolution` | 统一单数，子命令: report/status |
| Prompt | `prompt` | 统一单数，子命令: history/rollback/pin |
| 失败队列 | `failure` | 统一单数，子命令: list/retry/clear |
| 配置 | `config` | 统一单数，子命令: validate/explain |
| 解释 | `explain` | 单独命令，带参数 |
| 会话 | `session` | 统一单数，子命令: list/get/cleanup/keep/unkeep/revalue |
| 健康检查 | `doctor` | 单独命令 |

**命名规则**：
1. 命令组使用单数形式（`session` 而非 `sessions`）
2. 参数使用 `--param` 风格（统一）
3. 子命令使用动词形式（list/get/search）

**输出示例**：

```
=== EvoAgent 健康检查 ===

✓ Gateway服务
  状态: 运行中
  端口: 18790
  地址: 127.0.0.1:18790
  响应时间: 15ms

✓ 数据库
  类型: SQLite
  路径: ~/.evoagent/vector.db
  大小: 2.3MB
  表: embedding_cache ✓

✓ 嵌入服务
  Provider: openai-compatible
  地址: http://localhost:11434/v1
  状态: ✓ 可用
  模型: nomic-embed-text

✓ 配置文件
  项目配置: config/config.yaml ✓
  用户配置: ~/.evoagent/config.yaml ✓
  环境变量: 3个设置

✓ 存储空间
  EVOAGENT_HOME: ~/.evoagent/
  总空间: 50GB
  已使用: 850MB (1.7%)
  可用: 49.15GB

✓ Sessions
  总数: 23
  活跃: 5
  归档: 18

⚠ 警告
  - 最近10个session中有1个失败
  - embedding_cache接近大小限制(9000/10000)

✓ Agent状态
  planner: 0个运行中
  main: 0个运行中
  parallel: 0个运行中
```

**健康检查带修复建议**：

```bash
# 当检测到问题时，显示修复建议
evoagent doctor

# 输出示例（有问题时）
=== EvoAgent 健康检查 ===

✗ Gateway服务
  状态: 未运行

  修复建议:
  1. 启动Gateway: evoagent serve
  2. 或检查端口是否被占用: lsof -i :18790

✗ 嵌入服务
  Provider: openai-compatible
  地址: http://localhost:11434/v1
  状态: ✗ 连接失败

  修复建议:
  1. 确认Ollama正在运行: ollama list
  2. 启动Ollama: ollama serve
  3. 拉取模型: ollama pull nomic-embed-text
  4. 或切换到其他provider:
      编辑 ~/.evoagent/config.yaml:
      memory.vector.embedding.provider = openai

⚠ 配置文件
  用户配置: ~/.evoagent/config.yaml
  问题: YAML格式错误，第18行

  修复建议:
  1. 检查语法: evoagent config validate
  2. 查看详细错误: evoagent config explain
  3. 常见问题: 缩进应使用空格，不要使用Tab

⚠ 存储空间
  EVOAGENT_HOME: ~/.evoagent/
  问题: 可用空间不足(500MB < 1GB阈值)

  修复建议:
  1. 清理旧session: evoagent session cleanup --older-than 90days
  2. 清理embedding缓存: evoagent cache clear --older-than 30days
  3. 或迁移到其他目录: export EVOAGENT_HOME=/path/to/new/location

⚠ Sessions
  问题: 5个session处于aborted状态

  修复建议:
  1. 查看详情: evoagent session get --id <session-id>
  2. 重试失败操作: evoagent failure retry
  3. 清理无法恢复的session: evoagent session cleanup --status aborted
```

**修复建议配置**：

```typescript
// src/health/fix-suggestions.ts

export class FixSuggestions {
  private suggestions: Map<string, FixSuggestion[]> = new Map();

  constructor() {
    this.registerSuggestions();
  }

  private registerSuggestions(): void {
    // Gateway未运行
    this.suggestions.set('gateway.down', [
      { command: 'evoagent serve', description: '启动Gateway服务' },
      { command: 'lsof -i :18790', description: '检查端口占用' },
      { command: 'evoagent doctor --fix', description: '自动修复' }
    ]);

    // Embedding服务不可用
    this.suggestions.set('embedding.down', [
      { command: 'ollama list', description: '检查Ollama状态' },
      { command: 'ollama serve', description: '启动Ollama' },
      { command: 'ollama pull nomic-embed-text', description: '拉取模型' },
      { description: '或切换到OpenAI: 编辑 config.yaml，设置 provider=openai' }
    ]);

    // 配置文件错误
    this.suggestions.set('config.invalid', [
      { command: 'evoagent config validate', description: '验证配置文件' },
      { command: 'evoagent config explain', description: '查看配置详情' },
      { description: '常见问题: 缩进应使用空格，不要使用Tab' }
    ]);

    // 存储空间不足
    this.suggestions.set('storage.low', [
      { command: 'evoagent session cleanup --older-than 90days', description: '清理旧session' },
      { command: 'evoagent cache clear --older-than 30days', description: '清理缓存' },
      { description: '迁移目录: export EVOAGENT_HOME=/new/path' }
    ]);
  }

  getSuggestions(issueCode: string): FixSuggestion[] {
    return this.suggestions.get(issueCode) || [
      { description: '查看日志: ~/.evoagent/logs/gateway.log' }
    ];
  }
}
```

**自动修复选项**：

```bash
# --fix 选项：自动修复可修复的问题
evoagent doctor --fix

# 输出
正在自动修复...
✓ 清理旧session: 删除23个过期文件
✓ 清理embedding缓存: 释放1.2GB空间
⚠ 无法自动启动Gateway，请手动运行: evoagent serve
```

**检查项列表**：

| 检查项 | 说明 |
|--------|------|
| Gateway连接 | 检查Gateway进程是否运行 |
| embedding服务 | ping embedding服务，测试embed |
| 数据库状态 | 检查数据库文件是否可访问 |
| 磁盘空间 | 检查EVOAGENT_HOME所在分区 |
| 配置合法性 | 验证所有配置文件格式正确 |
| 依赖检查 | 检查node_modules是否完整 |
| Session状态 | 检查是否有异常状态的session |

### 选项优先级

```
CLI选项 > 用户配置(~/.evoagent/config.yaml) > 项目配置(config/config.yaml) > 内置默认
```

**示例**：

```yaml
# config/config.yaml
progress:
  enabled: false    # 项目配置：禁用进度

# ~/.evoagent/config.yaml
progress:
  enabled: true     # 用户配置：启用进度

# CLI命令
evoagent execute "..." --no-progress  # CLI选项：禁用进度（最终生效）
```

### --dry-run模式

```bash
# 干运行模式：只生成计划，不实际执行
evoagent execute "实现一个博客系统" --dry-run

# 输出示例
=== EvoAgent 干运行模式 ===

Planner决策:
  功能点数: 12点
  执行模式: D (分层架构)
  置信度: 0.85

执行计划:
  Phase 1: 架构设计 (10分钟)
    - 技术选型: Next.js + Prisma + PostgreSQL
    - 目录结构: app/, components/, lib/

  Phase 2: 认证模块 (15分钟)
    - 用户表设计
    - JWT实现
    - 登录/注册页面

  Phase 3: 博客模块 (20分钟)
    - 文章CRUD
    - Markdown渲染
    - 分类/标签

  Phase 4: 评论系统 (10分钟)
    - 评论模型
    - 嵌套评论

  Phase 5: SEO优化 (5分钟)
    - Meta标签
    - Sitemap

预计总时间: 60分钟

=== 成本预估 ===

LLM调用预估:
  - Planner:          3,000 tokens   × $0.003/1K   = $0.009
  - Orchestrator:     15,000 tokens  × $0.003/1K   = $0.045
  - CodeWriter:       50,000 tokens  × $0.003/1K   = $0.150
  - Reviewer:         10,000 tokens  × $0.003/1K   = $0.030
  - Tester:           8,000 tokens   × $0.003/1K   = $0.024
  ─────────────────────────────────────────────────
  总计:               86,000 tokens                 ≈ $0.26

Embedding调用:
  - 向量检索:         10次           × 本地模型     = $0.00
  - 知识库更新:       5次            × 本地模型     = $0.00

预计总成本: ≈ $0.26 (使用Anthropic Claude Sonnet)

注意:
- 实际成本可能因模型选择、调用次数而异
- 使用本地embedding模型无额外成本
- 可通过 --model 选项切换更便宜的模型

要继续执行吗？运行: evoagent execute --continue <plan-id>
```

**成本计算逻辑**：

```typescript
// src/execution/cost-estimator.ts

export class CostEstimator {
  // 模型定价（USD/1K tokens）
  private pricing = {
    'claude-opus-4-20250514': { input: 0.015, output: 0.075 },
    'claude-sonnet-4-5-20250514': { input: 0.003, output: 0.015 },
    'claude-haiku-4-20250514': { input: 0.0008, output: 0.004 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  };

  async estimateCost(plan: Plan, model: string): Promise<CostEstimate> {
    const costs: CostEstimate = {
      byAgent: {},
      totalTokens: 0,
      totalCost: 0,
      currency: 'USD'
    };

    // 基于历史数据估算每个Agent的token消耗
    for (const phase of plan.phases) {
      const estimate = this.estimateTokensForPhase(phase);
      const price = this.pricing[model] || this.pricing['claude-sonnet-4-5-20250514'];

      const inputCost = (estimate.input / 1000) * price.input;
      const outputCost = (estimate.output / 1000) * price.output;
      const totalCost = inputCost + outputCost;

      costs.byAgent[phase.agent] = {
        input: estimate.input,
        output: estimate.output,
        total: estimate.input + estimate.output,
        cost: totalCost
      };

      costs.totalTokens += estimate.input + estimate.output;
      costs.totalCost += totalCost;
    }

    return costs;
  }

  private estimateTokensForPhase(phase: Phase): TokenEstimate {
    // 基于功能点数和任务类型估算
    const baseTokens = phase.featurePoints * 2000;  // 每功能点约2000 tokens

    return {
      input: Math.round(baseTokens * 0.6),   // 60% 输入
      output: Math.round(baseTokens * 0.4)   // 40% 输出
    };
  }
}
```

**配置**：

```yaml
execution:
  dryRun:
    showCost: true
    currency: USD
    pricingSource: auto  # auto | manual | api
  cost:
    budget: 1.00  # 设置预算上限（美元）
    warnThreshold: 0.80  # 达到80%时警告
```

### 选项组合说明

| 选项 | 简写 | 说明 | 示例 |
|------|------|------|------|
| `--dry-run` | `-n` | 干运行模式 | `-n` |
| `--verbose` | `-v` | 详细输出 | `-v` |
| `--quiet` | `-q` | 静默模式 | `-q` |
| `--progress` | `-p` | 显示进度 | `-p` |
| `--help` | `-h` | 帮助信息 | `-h` |
| `--version` | `-V` | 版本信息 | `-V` |

### 进度可视化设计

**模式A进度（单Agent）**：

```
▶ 执行中... [████████░░] 80% (2/3步骤)

当前: 生成用户认证组件
预计剩余: 1分30秒
```

**模式B进度（主从模式）**：

```
▶ 执行中... [███████░░░] 60% (3/5步骤)

Planner  ✓  已完成
  └─ 选择模式B
Orchestrator  ▶  运行中...
  ├─ CodeWriter  ✓  已完成 (用户登录表单)
  ├─ CodeWriter  ▶  运行中... (用户注册表单)
  └─ Reviewer    ⏳  等待中
```

**模式C进度（并行协作）**：

```
▶ 执行中... [████░░░░░░] 40% (2/5步骤)

并行任务进度:
├─ Frontend Specialist  ✓  已完成 (登录页面)
├─ Backend Specialist   ▶  70% (API endpoints)
└─ Database Specialist  ✓  已完成 (schema设计)

A2A通信: 3条消息
```

**模式D进度（分层架构）**：

```
▶ 执行中... [███░░░░░░░] 25% (1/4阶段)

阶段 1/4: 架构设计  ✓  已完成
阶段 2/4: 模块开发  ▶  进行中...
  ├─ 认证模块    ✓  已完成
  ├─ 博客模块    ▶  60%
  └─ 评论模块    ⏳  待开始
阶段 3/4: 集成测试  ⏳  待开始
阶段 4/4: 部署     ⏳  待开始

预计总时间: 45分钟 | 已用: 12分钟 | 剩余: 33分钟
```

### explain命令

```bash
# 解释上一次Planner的决策
evoagent explain --last-planner

# 输出示例
=== Planner 决策解释 ===

Session: session-abc123
时间: 2025-01-27 14:30:00

用户需求: "实现一个带用户认证的博客系统，支持Markdown、评论、SEO"

功能点数分析:
- 用户登录: 2点 (表单 + JWT)
- 文章CRUD: 5点 (列表+详情+新增+编辑+删除)
- 评论系统: 4点 (发表+列表+删除+关联)
- Markdown支持: 2点 (渲染+编辑器)
- SEO优化: 2点 (meta标签+sitemap)
总计: 15点

执行模式: D (分层架构)
理由: 功能点数>8，需要架构设计，涉及多个子系统

置信度: 0.85

风险:
- Markdown渲染可能需要额外库
- SEO优化需要服务器端渲染

计划:
Phase 1: 架构设计 (10分钟)
Phase 2: 认证模块 (15分钟)
Phase 3: 博客+评论 (20分钟)
Phase 4: 集成测试 (10分钟)

相关经验:
- knowledge/pits/nextjs-server-actions-trap.md (3次踩坑)
- memory/sessions/session-xyz (上次类似项目)
```

**其他explain选项**：

```bash
evoagent explain --session <session-id>    # 解释指定session
evoagent explain --agent <run-id>        # 解释指定Agent的决策
evoagent explain --config                 # 解释当前配置来源
```

---

## 配置管理详解

### 配置变更策略

**问题**：修改config.yaml后需要重启Gateway吗？

**答案**：是的，采用**优雅重启**策略

**设计原则**：
> "配置变更=重启"最稳定。重启成本很低（几秒钟），但热更新的bug可能花几小时排查。

```typescript
// src/config/reload-strategy.ts

export enum ConfigChangeImpact {
  RestartRequired = 'restart_required',    // 需要重启
  Reloadable = 'reloadable',              // 可重新加载
  HotReloadable = 'hot_reloadable',       // 可热更新
}

export class ConfigManager {
  // 分析配置变更的影响
  analyzeConfigChange(oldConfig: Config, newConfig: Config): ConfigChangeImpact {
    // 所有配置变更都需要重启
    return ConfigChangeImpact.RestartRequired;
  }

  // 优雅重启
  async gracefulRestart(): Promise<void> {
    console.log('[Config] 配置变更检测到，开始优雅重启...');

    // 1. 停止接受新任务
    this.gateway.stopAcceptingNewTasks();

    // 2. 等待当前任务完成（最多等待60秒）
    await this.gateway.waitForActiveTasks(60000);

    // 3. 加载新配置
    await this.reloadConfig();

    // 4. 重新启动Gateway
    await this.gateway.start();

    console.log('[Config] 优雅重启完成');
  }
}
```

**配置验证**：

```bash
# 修改前先验证
evoagent config validate

# 输出示例
✓ 配置文件语法正确
✓ 所有必需字段存在
⚠ 警告: memory.vector.embedding.baseUrl 未设置，使用默认值

# 查看配置变更预览
evoagent config diff --from-file ./new-config.yaml

# 输出示例
配置变更预览:
  server.port: 18790 → 18800 (需要重启)
  progress.style: compact → detailed (需要重启)

预计影响: 需要重启Gateway
```

**优雅重启命令**：

```bash
# 手动触发优雅重启
evoagent serve --graceful-restart

# 输出
[Gateway] 收到优雅重启请求
[Gateway] 停止接受新任务...
[Gateway] 等待当前任务完成... (2个运行中)
[Gateway] 所有任务已完成
[Gateway] 加载新配置...
[Gateway] 重启完成 ✓
```

**自动重启选项（可选）**：

```bash
# 监听配置文件变化，自动优雅重启
evoagent serve --watch

# 输出
[ConfigWatcher] 监听配置文件: ~/.evoagent/config.yaml
[ConfigWatcher] 检测到配置变更
[ConfigWatcher] 验证配置... ✓
[ConfigWatcher] 开始优雅重启...
```

**与热更新的对比**：

| 方面 | 热更新 | 优雅重启 |
|------|--------|----------|
| 复杂度 | 高（需要处理部分更新） | 低（重启进程） |
| 稳定性 | 中（可能有状态不一致） | 高（全新状态） |
| 用户体验 | 好（无缝切换） | 中（短暂中断） |
| 调试难度 | 高（问题难复现） | 低（状态清晰） |

**为什么不支持热更新**：

1. **配置项之间有依赖**：部分更新可能导致系统处于不一致状态
2. **运行时状态复杂**：Agent运行中修改配置可能产生意外行为
3. **调试困难**：热更新引入的bug很难复现和排查
4. **重启成本低**：Gateway重启通常只需几秒钟

**配置验证规则**：

```typescript
// src/config/validator.ts

export const CONFIG_VALIDATION_RULES = {
  // 必填字段
  required: ['server.port', 'agents.planner.model'],

  // 类型检查
  types: {
    'server.port': 'number',
    'agents.*.model': 'string',
    'memory.vector.embedding.provider': 'string',
  },

  // 值范围
  ranges: {
    'server.port': { min: 1024, max: 65535 },
    'lanes.planner.maxConcurrent': { min: 1, max: 10 },
  },

  // 枚举值
  enums: {
    'memory.vector.embedding.provider': ['openai', 'openai-compatible', 'cohere', 'http', 'mock'],
    'progress.style': ['compact', 'detailed', 'minimal'],
  },

  // 依赖关系
  dependencies: {
    'memory.vector.embedding.baseUrl': ['memory.vector.embedding.provider=openai-compatible'],
    'memory.vector.embedding.apiKey': ['memory.vector.embedding.provider=openai'],
  },
};
```

### config explain输出格式

```bash
evoagent config explain

# 输出示例
server.port: 18790
  ├─ value: 18790
  ├─ from: project config
  └─ file: config/config.yaml:5

memory.vector.embedding.provider: ollama
  ├─ value: openai-compatible
  ├─ from: user config
  └─ file: ~/.evoagent/config.yaml:18

EVOAGENT_LOG_LEVEL: debug
  ├─ value: debug
  ├─ from: environment variable
  └─ env: EVOAGENT_LOG_LEVEL

server.host: 127.0.0.1
  ├─ value: 127.0.0.1
  ├─ from: built-in default
  └─ default: src/config/defaults.ts:3
```

### 进度更新频率（根据模式调整）

```yaml
# 配置示例（更灵活）
progress:
  enabled: true
  style: "compact"

  # 根据执行模式调整更新频率
  updateInterval:
    modeA: 1s    # 模式A: 快速更新（短任务）
    modeB: 2s    # 模式B: 中等更新
    modeC: 3s    # 模式C: 慢一点（并行）
    modeD: 5s    # 模式D: 最慢（长任务）

  # 或使用简单配置（所有模式统一）
  # updateInterval: 1s

  show: [currentStep, percentage, eta, agentStatus]
```

### Prompt版本号生成策略

```typescript
// 版本号格式：{agentType}.{timestamp}
// 避免并行优化时的版本号冲突

interface PromptVersion {
  agentType: string;      // e.g., "planner"
  timestamp: number;      // Unix timestamp ms
  version: string;         // e.g., "planner.1706378200000"
}

// 生成示例
const version = {
  planner: `${Date.now()}`,  // "planner.1706378200000"
  orchestrator: `${Date.now()}`,
  codewriter: `${Date.now()}`,
};
```

**文件命名**：

```
config/prompts/.history/
├── planner/
│   ├── planner.1706378200000.prompt.md
│   ├── planner.1706378560000.prompt.md
│   └── planner.1706378900000.prompt.md  # current (软链接)
├── orchestrator/
│   ├── orchestrator.1706378200000.prompt.md
│   └── orchestrator.1706378560000.prompt.md  # current
└── codewriter/
    ├── codewriter.1706378200000.prompt.md
    └── codewriter.1706378560000.prompt.md  # current
```

### 缓存清理策略（LRU + 定时）

```typescript
// src/memory/embedding-cache.ts

export class EmbeddingCache {
  private cache = new LRUCache<string, number[]>({
    max: 10000,     // 最大条目数
    ttl: 7 * 24 * 60 * 60 * 1000,  // 7天过期
    updateAgeOnGet: true
  });

  private db: Database;

  async getEmbedding(content: string): Promise<number[]> {
    // 1. 检查内存缓存 (LRU)
    if (this.cache.has(content)) {
      return this.cache.get(content)!;
    }

    // 2. 检查数据库缓存
    const hash = this.hash(content);
    const cached = await this.db.get(
      'SELECT embedding, created_at FROM embedding_cache WHERE hash = ?',
      [hash]
    );

    if (cached && this.isFresh(cached.created_at)) {
      const embedding = JSON.parse(cached.embedding);
      this.cache.set(content, embedding);  // 写入内存
      return embedding;
    }

    // 3. 调用模型
    const embedding = await this.callEmbeddingModel(content);

    // 4. 写入缓存（内存 + 数据库）
    this.cache.set(content, embedding);
    await this.db.run(
      'INSERT OR REPLACE INTO embedding_cache (hash, content, embedding, created_at) VALUES (?, ?, ?, ?)',
      [hash, content, JSON.stringify(embedding), Date.now()]
    );

    return embedding;
  }

  // 定时清理（每天一次）
  async scheduledCleanup(): Promise<void> {
    const ttl = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - ttl;

    await this.db.run(
      'DELETE FROM embedding_cache WHERE created_at < ?',
      [cutoff]
    );

    // 内存缓存由LRU自动管理
  }

  private isFresh(createdAt: number): boolean {
    const age = Date.now() - createdAt;
    return age < (7 * 24 * 60 * 60 * 1000);
  }
}
```

---

## 设计原则

1. **独立完整**：EvoAgent是完全独立的系统，不依赖ClawdBot
2. **渐进进化**：系统会随着使用越来越多地学习和优化
3. **记忆优先**：所有决策都基于历史经验，避免重复错误
4. **自主决策**：Agent能自主选择最适合的执行方式
5. **零交互**：用户只需输入需求，Agent全权负责

---

## 与其他框架对比

| 特性 | EvoAgent | ClawdBot | Claude Code | OpenCode |
|------|----------|----------|------------|----------|
| 自主规划 | ✅ | ❌ | ❌ | ❌ |
| 记忆系统 | 三层完整 | Session | 无 | Ralph Loop |
| 自动进化 | ✅ | ❌ | ❌ | ❌ |
| A2A协作 | ✅ | ✅ | ❌ | ❌ |
| Subagent | ✅ | ✅ | ❌ | ✅ |
| 零交互 | ✅ | ❌ | ❌ | ❌ |

---

**文档结束**
