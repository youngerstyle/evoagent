# 技能进化系统设计评审邀请

---

**收件人**: OpenMemory 核心开发

**项目**: EvoAgent - 自动进化编码Agent系统

**评审主题**: 技能进化系统 - 与记忆系统的集成

---

## 您的专长

作为 OpenMemory 的核心开发者，您在记忆系统设计和实现方面拥有深厚经验。

---

## 评审背景

EvoAgent 现有记忆系统：
- **Session**: 短期对话记忆
- **Knowledge**: 结构化知识（.md 文件）
- **Vector**: 向量语义搜索

我们计划新增**技能系统**：

```
知识 (Knowledge)            技能 (Skills)
├── 描述性知识                ├── 可执行能力
├── "React组件应该..."         ├── "创建React组件"
├── 存储: .md 文件             ├── 存储: SKILL.md + templates/
└── 检索: 全文+向量             └── 使用: Agent调用
```

---

## 核心问题

### 1. 技能与知识的边界

**问题**：
- 技能和知识的边界是否清晰？
- 什么内容应该存在 Knowledge，什么应该成为技能？
- 是否会内容重叠？

我们的判断标准：
- **Knowledge**: 描述性知识、"应该做..."、"最佳实践..."
- **Skill**: 可执行能力、具体步骤、模板代码

**您的看法**：这个区分标准是否合理？

### 2. 进化触发机制

**记忆进化触发**:
- Collector: Agent 完成后立即收集
- Reflector: 每 7 天或每 10 session

**技能进化触发**:
- Collector: 发现模式候选时记录
- Reflector: 每 7 天或每 10 session + 候选数≥3
- Reviewer: 生成后立即验证

**问题**：
- 两个系统使用相同的 Reflector 是否会成为瓶颈？
- 是否应该分离 MemoryReflector 和 SkillReflector？

### 3. 存储和检索

**Knowledge 存储**:
```
memory/knowledge/
├── pits/           # 坑点
├── patterns/       # 模式
├── solutions/      # 解决方案
└── decisions/      # 决策记录
```

**Skills 存储**:
```
skills/
├── auto/           # 自动生成
├── manual/         # 手工编写
└── deprecated/     # 废弃技能
```

**问题**：
- 两个系统是否需要统一的索引？
- 向量搜索是否需要同时检索 Knowledge 和 Skills？
- 如何避免冗余？

### 4. 数据一致性

当模式升级为技能后：

```
Pattern (Knowledge) → Skill (validated)
```

**问题**：
- Knowledge 中的原始模式是否需要保留？
- 如何建立 Skill 到来源 Knowledge 的引用？
- Skill 进化后，Knowledge 是否需要同步？

---

## 与向量搜索的集成

当前向量搜索支持：
- 搜索 Knowledge (.md 文件)
- 搜索 Session (语义搜索)
- 搜索 Vector DB

**扩展需求**：
- 搜索 Skills (SKILL.md 内容)
- 根据技能描述查找相关技能

**问题**：
- 如何设计统一的向量检索接口？
- 技能搜索的权重如何设置？
- 是否需要技能相关性评分？

---

## 评审文档

- **设计文档**: `docs/design.md` (v2.1)
  - 记忆系统 > 三层记忆架构
  - 进化系统 > 技能进化系统
- **圆桌会议记录**: `docs/skill-evolution-roundtable.md`

---

## 期望您的反馈

特别希望您关注：

1. **技能与知识的边界定义**
2. **进化机制的协同设计**
3. **检索和发现的一致性**

---

## 时间安排

- **反馈截止**: 2025-02-07
- **反馈形式**: 回复此邮件或提交 Issue

---

**感谢您在记忆系统方面的专业指导！**

**EvoAgent 团队** 2025-01-30
