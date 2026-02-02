---
name: virtual-roundtable
description: "组织虚拟专家圆桌会议，模拟多位专家对设计方案进行评审"
version: "1.0.0"
created: "2025-01-30"
source: "manual"
author: "System Architect"
occurrence: 1
validation:
  status: "validated"
  score: 1.0
  testResults: "n/a"
tags: ["meeting", "review", "expert", "simulation"]
dependencies: []
requirements:
  bins: []
  env: []
confidence: 1.0
cautiousFactor: 0
timesUsed: 0
timesSucceeded: 0
timesFailed: 0
probationThreshold: 5
---

## 适用场景

当需要对技术设计方案进行专家评审时，使用此技能组织虚拟圆桌会议，模拟多位领域专家的评审意见。

**典型场景**：
- 新功能设计评审（如技能进化系统）
- 架构变更评审（如并发控制、通信机制）
- 生产就绪评估（如可观测性、稳定性）
- 问题整改确认（针对反馈进行整改后）

## 执行步骤

### Step 1: 确定评审对象

```yaml
输入参数:
  designDoc: string      # 设计文档路径，如 docs/design.md
  version: string        # 当前版本号
  section?: string       # 可选：特定评审章节
  focusTopics: string[]  # 评审焦点主题列表
```

**示例输入**：
```yaml
designDoc: "docs/design.md"
version: "v2.2"
section: "技能进化系统"
focusTopics:
  - 架构设计
  - 并发控制
  - 可观测性
  - 存储方案
```

### Step 2: 选择虚拟专家

根据评审主题选择合适的专家组合：

| 专家角色 | 专长领域 | 适用场景 |
|---------|---------|---------|
| @architect | 整体架构、模块划分 | 所有设计评审 |
| @concurrency | 并发控制、Actor模型 | 多Agent、通信机制 |
| @database | 数据库、存储、事务 | 数据持久化、缓存 |
| @frontend | CLI、用户体验 | 命令行工具、交互 |
| @memory | 记忆系统、向量搜索 | Session、Knowledge |
| @sre | 可观测性、稳定性 | Metrics、健康检查 |
| @neuro | 认知科学、学习曲线 | 进化机制、生命周期 |
| @security | 安全、漏洞防护 | 敏感操作、权限控制 |

### Step 3: 专家角色扮演模板

为每个专家生成反馈时，使用以下角色设定：

```markdown
## 专家：@{expert_role}

### 身份
你是一位{expert_role}专家，拥有以下背景：
- {expertise_description}
- 关注点：{concerns}
- 评审风格：{review_style}

### 评审框架
1. **P0 问题**（必须修复）：{p0_criteria}
2. **P1 问题**（强烈建议）：{p1_criteria}
3. **P2 问题**（可选优化）：{p2_criteria}

### 输出格式
```markdown
### 👤 @{expert_role}

#### P0 (必须修复)
| ID | 问题描述 | 影响 | 建议方案 |
|----|---------|------|---------|
| 1 | ... | ... | ... |

#### P1 (强烈建议)
| ID | 问题描述 | 影响 | 建议方案 |
|----|---------|------|---------|
| 1 | ... | ... | ... |

#### 总体评价
- 设计合理性: ⭐⭐⭐⭐☆ (1-5)
- 实施可行性: ⭐⭐⭐⭐☆ (1-5)
- 创新性价值: ⭐⭐⭐⭐☆ (1-5)

#### 专家点评
> "{quote_from_expert}"
```

### Step 4: 执行虚拟评审

```python
# 伪代码：虚拟评审执行流程
def run_virtual_roundtable(params):
    # 1. 读取设计文档
    design_content = read_file(params.designDoc)
    relevant_section = extract_section(design_content, params.section)

    # 2. 选择专家
    experts = select_experts(params.focusTopics)

    # 3. 并行生成专家反馈
    feedbacks = []
    for expert in experts:
        prompt = build_expert_prompt(expert, relevant_section, params.focusTopics)
        feedback = call_llm(prompt)
        feedbacks.append({
            "expert": expert.name,
            "feedback": parse_feedback(feedback)
        })

    # 4. 汇总问题
    all_issues = collect_all_issues(feedbacks)

    # 5. 生成评审报告
    report = {
        "date": now(),
        "version": params.version,
        "experts": [e.name for e in experts],
        "feedbacks": feedbacks,
        "summary": summarize_issues(all_issues),
        "next_steps": generate_action_plan(all_issues)
    }

    # 6. 保存报告
    save_report(f"docs/reviews/virtual-review-{date}.md", report)

    return report
```

### Step 5: 生成评审报告

评审报告保存在 `docs/reviews/` 目录，格式如下：

```markdown
# {主题} 虚拟专家评审会

**日期**: {YYYY-MM-DD}
**版本**: {version}
**评审对象**: {designDoc} - {section}
**参会专家**: {expert_list}
**执行者**: AI Agent

---

## 评审对象

- 文档: {designDoc}
- 版本: {version}
- 章节: {section}
- 评审焦点: {focusTopics}

---

## 专家反馈

### 👤 @expert1

... (按 Step 3 的格式)

### 👤 @expert2

... (按 Step 3 的格式)

---

## 问题汇总

### 按优先级汇总

#### P0 (必须修复) - {n}项

| ID | 专家 | 问题描述 | 建议 |
|----|------|---------|------|
| ... | ... | ... | ... |

#### P1 (强烈建议) - {n}项

...

#### P2 (可选优化) - {n}项

...

---

## 评分汇总

| 专家 | 合理性 | 可行性 | 创新性 | 平均 |
|------|--------|--------|--------|------|
| @expert1 | ⭐⭐⭐⭐☆ | ⭐⭐⭐⭐☆ | ⭐⭐⭐⭐⭐ | 4.33 |
| **平均** | **3.75** | **3.88** | **4.13** | **3.92** |

---

## 结论

### 整体评价

{summary_text}

### 需要改进的关键点

1. {key_improvement_1}
2. {key_improvement_2}
3. {key_improvement_3}

### 下一步行动

| 优先级 | 任务 | 负责人 |
|--------|------|--------|
| P0 | {task_1} | - |
| P0 | {task_2} | - |
| P1 | {task_3} | - |

---

**报告生成时间**: {timestamp}
**下次评审**: {next_review_date}
```

## 专家角色定义

### @architect (架构师)

```yaml
身份: 系统架构专家
专长:
  - 模块划分和依赖设计
  - 接口定义和抽象层次
  - 架构模式和最佳实践
关注点:
  - 模块职责是否清晰
  - 依赖关系是否合理
  - 扩展性如何
评审风格: 重点关注架构的可维护性和扩展性
```

### @concurrency (并发专家)

```yaml
身份: 并发编程专家
专长:
  - Actor模型、CSP、协程
  - 并发控制和同步原语
  - 死锁预防和竞态条件
关注点:
  - 是否存在并发安全问题
  - 死锁风险如何
  - 性能瓶颈在哪里
评审风格: 重点关注并发安全性和性能
```

### @database (数据库专家)

```yaml
身份: 数据库专家
专长:
  - SQL和NoSQL数据库
  - 事务处理和隔离级别
  - 索引优化和查询性能
关注点:
  - 数据一致性如何保证
  - 查询性能是否满足需求
  - 存储方案是否合理
评审风格: 重点关注数据一致性和性能
```

### @frontend (前端专家)

```yaml
身份: CLI/前端专家
专长:
  - 命令行工具设计
  - 用户体验和交互设计
  - 终端输出格式化
关注点:
  - 命令是否直观易用
  - 输出是否清晰友好
  - 错误提示是否有帮助
评审风格: 重点关注用户体验
```

### @memory (记忆系统专家)

```yaml
身份: 记忆系统专家
专长:
  - 向量数据库和语义搜索
  - Session管理和持久化
  - 知识图谱和RAG
关注点:
  - 记忆结构是否合理
  - 检索效率如何
  - 数据一致性如何
评审风格: 重点关注记忆系统的有效性
```

### @sre (SRE专家)

```yaml
身份: 站点可靠性工程师
专长:
  - 可观测性（Metrics/Logging/Tracing）
  - 容错和自愈机制
  - 告警和故障处理
关注点:
  - 系统可观测性如何
  - 故障时能否快速恢复
  - 告警是否及时准确
评审风格: 重点关注系统可靠性
```

### @neuro (认知科学专家)

```yaml
身份: 认知科学专家
专长:
  - 记忆巩固和遗忘曲线
  - 学习理论和技能习得
  - 人机交互和认知负荷
关注点:
  - 设计是否符合认知规律
  - 学习曲线是否平滑
  - 是否存在认知过载
评审风格: 重点关注人机协同的有效性
```

### @security (安全专家)

```yaml
身份: 安全专家
专长:
  - 漏洞分析和安全审计
  - 权限控制和访问管理
  - 数据加密和安全传输
关注点:
  - 是否存在安全漏洞
  - 权限控制是否完善
  - 敏感数据是否保护
评审风格: 重点关注系统安全性
```

## 使用示例

### 示例 1: 评审技能进化系统

```yaml
输入:
  designDoc: "docs/design.md"
  version: "v2.2"
  section: "技能进化系统"
  focusTopics:
    - 技能存储方案
    - 验证机制
    - 生命周期管理

选择的专家:
  - @architect (架构设计)
  - @database (存储方案)
  - @sre (可观测性)
  - @neuro (生命周期)

输出: docs/reviews/skill-evolution-virtual-review.md
```

### 示例 2: 评审并发控制机制

```yaml
输入:
  designDoc: "docs/design.md"
  version: "v2.2"
  section: "Lane Queue调度策略"
  focusTopics:
    - 死锁预防
    - 并发性能
    - 优先级策略

选择的专家:
  - @concurrency (并发控制)
  - @architect (架构设计)
  - @sre (可靠性)

输出: docs/reviews/concurrency-virtual-review.md
```

## 注意事项

1. **真实性**：专家反馈应基于实际专业知识，避免空泛建议
2. **建设性**：每个问题应提供具体可执行的改进建议
3. **完整性**：确保覆盖所有评审焦点主题
4. **可追溯**：报告中应标注问题来源（哪个专家提出的）
5. **可操作**：汇总时应生成明确的下一步行动计划

## 相关文件

- 模板: `templates/review-report.md`
- 专家定义: `templates/experts.yaml`
- 示例报告: `examples/skill-evolution-virtual-review.md`

## 反模式（不适用场景）

- 真实的外部专家评审（此技能模拟虚拟专家）
- 日常代码审查（使用 code-review 技能）
- 简单的设计确认（不需要完整评审会）
