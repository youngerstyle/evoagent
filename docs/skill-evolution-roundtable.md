# EvoAgent 技能进化系统 - 圆桌会议记录

**日期**: 2025-01-30
**参与专家**: Planner、Orchestrator、Reflector、ExperienceCollector、CodeWriter、Reviewer
**主持**: 系统架构师

---

## 会议议题

**核心问题**: 如何设计技能进化系统，使其与记忆进化系统保持一致的"事后复盘"哲学？

---

## 第一轮：现状理解

### Reflector 发言

我是负责**事后复盘**的。我的工作节奏是：

1. **触发时机**: 每7天或每10个session
2. **输入**: 历史Session数据 + 收集的经验
3. **输出**:
   - 发现新模式 → 写入Knowledge
   - 优化System Prompt
   - 生成改进报告

我的核心哲学：**进化需要时间沉淀，不是即时反应**。

### ExperienceCollector 补充

我是负责**实时收集**的，但只做原始数据采集：

1. **触发时机**: Agent完成/报错时立即
2. **工作**: 提取事件数据，不做分析
3. **输出**: 原始经验记录 → 供Reflector使用

我不做判断，我只是记录员。

---

## 第二轮：Clawdbot的技能系统分析

### 架构师分享

研究了 Clawdbot 的技能系统后，我发现：

```
技能生命周期:
创建 → 打包 → 发现 → 执行 → 迭代
  ↑      ↑      ↑      ↑      ↑
 手工   手工   自动   自动   人工
```

**关键差异**:
- Clawdbot的技能**主要是手工创建**的
- Agent可以**使用**技能，但**自动创建技能**的能力有限
- 技能的**迭代**依赖于人工反馈

### Planner 质疑

那么问题来了：我们希望Agent**自动创建技能**吗？

这和我生成执行计划是不同层次的抽象：
- 我的计划：**单次任务的步骤**
- 技能：**可复用的能力模式**

---

## 第三轮：技能进化的核心问题

### Orchestrator 观点

从执行协调的角度看，技能应该是我可以调用的"能力包"。

当前我只能调用 CodeWriter、Tester、Reviewer。

如果有技能系统：
- 我应该能**发现**现有技能
- 我应该能**请求**创建新技能
- 技能应该有**版本**和**质量评分**

### CodeWriter 实践视角

我写代码的时候，经常发现一些模式：
- 某种React组件结构
- 某种API错误处理模式
- 某种测试写法

这些如果能沉淀成技能，下次我就不用从头写。

**但是**：谁来决定什么时候值得创建技能？
- 不是每个模式都值得技能化
- 需要足够复用价值

### Reviewer 质量视角

我审查代码时发现的问题，也可以成为技能：
- 常见错误模式
- 安全检查清单
- 性能优化模式

**但是**：技能需要质量保证
- 谁来验证技能的正确性？
- 技能如何测试？

---

## 第四轮：设计共识

### 一致的哲学：事后复盘，不是即时反应

与会专家一致同意：**技能进化应该遵循与记忆进化相同的模式**

```
┌─────────────────────────────────────────────────────────────┐
│                    技能进化循环                               │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐│
│  │ Agent    │───→│ 收集     │───→│ 复盘     │───→│ 技能   ││
│  │ 执行任务  │    │ 原始数据  │    │ 模式发现  │    │ 创建   ││
│  └──────────┘    └──────────┘    └──────────┘    └────────┘│
│       ↑                                                         │
│       └────────────────── 使用已验证的技能 ──────────────────┘│
│                                                              │
│  时序:  实时 → 实时 → 定期(7天/10session) → 定期               │
└─────────────────────────────────────────────────────────────┘
```

---

## 第五轮：具体设计

### Collector 扩展：收集技能候选

在现有 ExperienceCollector 基础上扩展：

```typescript
// 新增：技能候选收集
interface SkillCandidate {
  pattern: string;           // 模式描述
  examples: string[];        // 使用示例
  sourceAgent: string;       // 来源Agent
  occurrence: number;        // 出现次数
  lastSeen: Date;           // 最后出现时间
}

class ExperienceCollector {
  // 现有：收集经验
  async collectEvent(event: AgentEvent): Promise<void>

  // 新增：记录模式候选
  async recordPattern(pattern: SkillCandidate): Promise<void>
}
```

**触发时机**: Agent执行过程中，发现重复模式时记录

### Reflector 扩展：技能生成

```typescript
class Reflector {
  // 现有：生成Knowledge
  async reflect(sessions: Session[]): Promise<ReflectionResult>

  // 新增：从模式生成技能
  async generateSkill(candidates: SkillCandidate[]): Promise<Skill | null> {
    // 1. 分析候选模式
    // 2. 验证复用价值（出现次数 > 阈值）
    // 3. 提取可复用部分
    // 4. 生成技能定义
    // 5. 生成技能测试
  }
}
```

**触发时机**: 与Reflector同期（每7天或每10session）

### Reviewer 扩展：技能验证

```typescript
class ReviewerAgent {
  // 新增：验证技能质量
  async validateSkill(skill: Skill): Promise<SkillValidation> {
    // 1. 语法检查
    // 2. 逻辑验证
    // 3. 边界测试
    // 4. 与现有技能冲突检查
  }
}
```

### 技能存储结构

```
skills/
├── auto/                    # 自动生成的技能
│   ├── react-component-creation/
│   │   ├── SKILL.md         # 技能定义
│   │   ├── templates/       # 代码模板
│   │   ├── tests/           # 测试用例
│   │   └── meta.json        # 元数据
│   └── api-error-handling/
├── manual/                  # 手工编写的技能
└── deprecated/              # 废弃的技能
```

### 技能元数据

```yaml
---
name: react-component-creation
description: "创建React组件的标准模式"
version: "1.0.0"
created: "2025-01-30"
source: "auto"              # auto | manual
author: "Reflector"
occurrence: 15               # 产生此技能的样本数
validation:
  status: "validated"        # draft | validated | deprecated
  score: 0.95                # 质量评分
  testResults: "passing"
tags: ["react", "component", "frontend"]
dependencies: []
---
```

---

## 第六轮：与Clawdbot的对比

| 特性 | Clawdbot | EvoAgent (设计) |
|------|----------|-----------------|
| 技能创建 | 人工为主 | **自动生成** + 人工辅助 |
| 进化方式 | 人工迭代 | **Reflector自动发现** |
| 验证机制 | 运行时测试 | **Reviewer预验证** |
| 版本管理 | 手工 | **自动版本化** |
| 质量跟踪 | 无 | **评分 + 使用统计** |

---

## 第七轮：开放问题

### 待讨论问题

1. **技能触发阈值**: 一个模式出现多少次才值得技能化？
   - 建议：3次以上

2. **技能冲突处理**: 如果两个技能做相似的事？
   - 建议：基于评分和使用频率选择优胜者

3. **技能退役**: 技能过时怎么办？
   - 建议：移入deprecated/，保留30天后删除

4. **技能组合**: 技能可以依赖其他技能吗？
   - 建议：允许，但需要依赖图检查循环

5. **人工干预**: 用户可以编辑自动生成的技能吗？
   - 建议：可以，编辑后标记为"手工修正"，降低自动覆盖优先级

---

## 结论

### 下一步行动

| 任务 | 负责人 | 优先级 |
|------|--------|--------|
| 1. 设计SkillCollector接口 | ExperienceCollector Lead | P0 |
| 2. 实现Reflector.generateSkill() | Reflector Lead | P0 |
| 3. 设计技能存储格式 | 架构师 | P0 |
| 4. 实现Skill验证机制 | Reviewer Lead | P1 |
| 5. 实现技能发现和加载 | Orchestrator Lead | P1 |
| 6. 技能可视化/管理CLI | CLI Lead | P2 |

### 核心原则

> **技能进化 = 事后复盘 + 模式沉淀 + 质量验证**

与记忆进化保持一致的哲学：**先收集，后反思，再进化**。

---

**会议记录**: v1.0
**下次会议**: 技能存储格式详细设计
