# 评审报告模板

**日期**: {{date}}
**版本**: {{version}}
**评审对象**: {{designDoc}} - {{section}}
**参会专家**: {{expertList}}
**执行者**: AI Agent

---

## 评审对象

- **文档**: {{designDoc}}
- **版本**: {{version}}
- **章节**: {{section}}
- **评审焦点**: {{focusTopics}}

---

## 专家反馈

{{#each feedbacks}}
### 👤 {{@key}}

{{#each this.p0}}
#### P0 (必须修复)
| ID | 问题描述 | 影响 | 建议方案 |
|----|---------|------|---------|
{{#each this}}
| {{@index}} | {{description}} | {{impact}} | {{suggestion}} |
{{/each}}
{{/each}}

{{#each this.p1}}
#### P1 (强烈建议)
| ID | 问题描述 | 影响 | 建议方案 |
|----|---------|------|---------|
{{#each this}}
| {{@index}} | {{description}} | {{impact}} | {{suggestion}} |
{{/each}}
{{/each}}

{{#each this.ratings}}
#### 总体评价
- 设计合理性: {{reasonableness}}
- 实施可行性: {{feasibility}}
- 创新性价值: {{innovation}}

#### 专家点评
> "{{quote}}"
{{/each}}

---

{{/each}}

## 问题汇总

### 按优先级汇总

#### P0 (必须修复) - {{p0Count}}项

| ID | 专家 | 问题描述 | 建议 |
|----|------|---------|------|
{{#each p0Issues}}
| {{id}} | {{expert}} | {{description}} | {{suggestion}} |
{{/each}}

#### P1 (强烈建议) - {{p1Count}}项

| ID | 专家 | 问题描述 | 建议 |
|----|------|---------|------|
{{#each p1Issues}}
| {{id}} | {{expert}} | {{description}} | {{suggestion}} |
{{/each}}

#### P2 (可选优化) - {{p2Count}}项

| ID | 专家 | 问题描述 | 建议 |
|----|------|---------|------|
{{#each p2Issues}}
| {{id}} | {{expert}} | {{description}} | {{suggestion}} |
{{/each}}

---

## 评分汇总

| 专家 | 合理性 | 可行性 | 创新性 | 平均 |
|------|--------|--------|--------|------|
{{#each ratings}}
| {{expert}} | {{reasonableness}} | {{feasibility}} | {{innovation}} | {{average}} |
{{/each}}
| **平均** | **{{avgReasonableness}}** | **{{avgFeasibility}}** | **{{avgInnovation}}** | **{{overallAverage}}** |

---

## 结论

### 整体评价

{{summary}}

### 需要改进的关键点

{{#each keyImprovements}}
{{@index}}. {{this}}
{{/each}}

### 下一步行动

| 优先级 | 任务 | 负责人 |
|--------|------|--------|
{{#each actionItems}}
| {{priority}} | {{task}} | {{owner}} |
{{/each}}

---

**报告生成时间**: {{timestamp}}
**下次评审**: {{nextReviewDate}}
