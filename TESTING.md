# 🧪 EvoAgent 测试指南

## 快速开始

### 方式 1: 一键运行所有测试（推荐）

**Windows:**
```bash
tests\run-all-tests.bat
```

**Linux/Mac:**
```bash
bash tests/run-all-tests.sh
```

### 方式 2: 分步测试

#### 步骤 1: TypeScript 编译检查
```bash
npm run typecheck
```
✅ **预期结果**: 无编译错误

#### 步骤 2: 运行单元测试
```bash
npm test
```
✅ **预期结果**: 所有测试通过

#### 步骤 3: 手动功能测试
```bash
tsx tests/manual/test-new-features.ts
```
✅ **预期结果**: 所有功能测试通过

#### 步骤 4: 构建项目
```bash
npm run build
```
✅ **预期结果**: 构建成功，生成 dist 目录

---

## 详细测试说明

### 一、编译测试

#### 1.1 TypeScript 类型检查
```bash
npm run typecheck
```

**检查内容**:
- ✅ 所有类型定义正确
- ✅ 无类型错误
- ✅ 无未使用的变量
- ✅ 无未使用的导入

**预期输出**:
```
✓ TypeScript compilation successful - no errors found
```

#### 1.2 项目构建
```bash
npm run build
```

**检查内容**:
- ✅ 清理旧构建
- ✅ 编译所有 TypeScript 文件
- ✅ 生成 dist 目录
- ✅ 生成所有 .js 和 .d.ts 文件

**预期输出**:
```
dist/
├── agent/
├── core/
├── evolution/
│   └── skills/
│       ├── sandbox/
│       │   ├── WorkerSandbox.js
│       │   └── sandbox-worker.js
│       ├── SkillExecutor.js
│       ├── SkillStore.js
│       ├── InputValidator.js
│       └── SkillConfig.js
└── observability/
    ├── health/
    └── metrics/
```

---

### 二、单元测试

#### 2.1 运行所有测试
```bash
npm test
```

#### 2.2 监听模式（开发时推荐）
```bash
npm run test:watch
```

#### 2.3 查看测试覆盖率
```bash
npm run test:coverage
```

**新增的测试文件**:

1. **SkillExecutor.test.ts** - 技能执行器测试
   - ✅ 安全验证测试（6个用例）
   - ✅ 执行流程测试（2个用例）

2. **SkillDependencyResolver.test.ts** - 依赖解析测试
   - ✅ 依赖验证测试（5个用例）
   - ✅ 循环依赖检测（1个用例）
   - ✅ 依赖查询测试（3个用例）

3. **InputValidator.test.ts** - 输入验证测试
   - ✅ 技能ID验证（5个用例）
   - ✅ 分数验证（3个用例）
   - ✅ 组合验证（2个用例）

**测试覆盖的安全场景**:
```typescript
// 危险代码检测
✅ require() 调用
✅ eval() 调用
✅ process 访问
✅ fs 文件系统访问
✅ child_process 子进程
✅ 代码长度超限
✅ 嵌套深度超限
```

---

### 三、功能测试

#### 3.1 手动功能测试
```bash
tsx tests/manual/test-new-features.ts
```

**测试内容**:

1. **安全验证测试**
   - ✅ 危险代码检测
   - ✅ 安全代码通过

2. **输入验证测试**
   - ✅ 有效ID验证
   - ✅ 无效ID拒绝
   - ✅ 分数范围验证

3. **技能存储测试**
   - ✅ 技能保存
   - ✅ 技能加载
   - ✅ 依赖验证
   - ✅ 循环依赖检测

4. **健康检查测试**
   - ✅ 健康状态查询
   - ✅ 多个检查项
   - ✅ 运行时间统计

5. **指标收集测试**
   - ✅ Counter 计数器
   - ✅ Gauge 仪表盘
   - ✅ Histogram 直方图
   - ✅ Prometheus 格式导出

**预期输出示例**:
```
🧪 开始手动功能测试...

📋 测试 1: 安全验证
  危险代码检测: ✅ 通过
  检测到的问题: 2 个
  问题列表: Direct require() calls are not allowed, Direct filesystem access is not allowed
  安全代码检测: ✅ 通过

📋 测试 2: 输入验证
  有效ID验证: ✅ 通过
  无效ID验证: ✅ 通过
  错误信息: Skill ID can only contain letters, numbers, hyphens, and underscores
  有效分数验证: ✅ 通过
  无效分数验证: ✅ 通过

📋 测试 3: 技能存储和依赖解析
  保存技能 A: ✅ 成功
  保存技能 B: ✅ 成功
  加载技能 A: ✅ 成功
  依赖验证: ✅ 通过
  执行顺序: skill-a -> skill-b
  循环依赖检测: ✅ 通过

📋 测试 4: 健康检查
  健康状态: healthy
  运行时间: 0 秒
  检查项数量: 2
  所有检查通过: ✅ 是

📋 测试 5: 指标收集
  指标导出: ✅ 成功
  指标数量: 4
  示例指标:
    skill_execution_total{status="success"} 2 1738569600000
    skill_execution_total{status="failure"} 1 1738569600000
    active_skills 10 1738569600000

✅ 所有手动测试完成！
```

---

### 四、集成测试

#### 4.1 技能系统集成测试
```bash
npm test tests/integration/skill-system.test.ts
```

**测试内容**:
- ✅ 技能保存和加载
- ✅ 技能搜索
- ✅ 技能索引更新

---

### 五、代码质量检查

#### 5.1 ESLint 检查
```bash
npm run lint
```

#### 5.2 自动修复
```bash
npm run lint:fix
```

#### 5.3 代码格式化
```bash
npm run format
```

---

## 测试结果解读

### 成功标准

所有测试通过时，你会看到：

```
========================================
📊 测试总结
========================================
总测试数: 5
通过: 5
失败: 0

🎉 所有测试通过！系统可以上线！
```

### 失败处理

如果有测试失败：

1. **TypeScript 编译失败**
   - 检查错误信息
   - 修复类型错误
   - 重新运行 `npm run typecheck`

2. **单元测试失败**
   - 查看失败的测试用例
   - 检查错误堆栈
   - 修复代码后重新运行 `npm test`

3. **功能测试失败**
   - 查看具体失败的功能
   - 检查日志输出
   - 修复后重新运行手动测试

4. **构建失败**
   - 清理构建目录: `npm run clean`
   - 重新构建: `npm run build`

---

## 性能测试（可选）

### 测试技能执行性能
```bash
tsx tests/performance/skill-execution-benchmark.ts
```

### 测试依赖解析性能
```bash
tsx tests/performance/dependency-resolution-benchmark.ts
```

---

## 持续集成（CI）配置

如果你使用 GitHub Actions，可以添加以下配置：

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

---

## 常见问题

### Q1: 测试运行很慢怎么办？
**A**: 使用 `npm run test:watch` 只运行修改的测试

### Q2: 如何只运行特定的测试文件？
**A**: `npm test tests/unit/evolution/skills/SkillExecutor.test.ts`

### Q3: 如何查看详细的测试输出？
**A**: 在测试文件中添加 `console.log` 或使用 `--reporter=verbose`

### Q4: Worker Threads 测试失败？
**A**: 确保 Node.js 版本 >= 20.0.0

### Q5: 测试覆盖率不够怎么办？
**A**: 运行 `npm run test:coverage` 查看未覆盖的代码，然后补充测试

---

## 下一步

测试全部通过后：

1. ✅ 提交代码到 Git
2. ✅ 创建 Pull Request
3. ✅ 等待 Code Review
4. ✅ 部署到测试环境
5. ✅ 灰度发布
6. ✅ 全量上线

---

## 联系支持

如果遇到问题：
- 查看错误日志
- 检查 Node.js 版本
- 确保依赖安装完整: `npm install`
- 清理并重新构建: `npm run clean && npm run build`
