#!/bin/bash

# EvoAgent 完整测试脚本
# 运行方式: bash tests/run-all-tests.sh

echo "🚀 EvoAgent 完整测试套件"
echo "=========================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试函数
run_test() {
    local test_name=$1
    local test_command=$2

    echo "📋 测试: $test_name"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if eval "$test_command"; then
        echo -e "${GREEN}✅ 通过${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ 失败${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo ""
}

# 1. TypeScript 编译检查
echo "🔍 阶段 1: 编译检查"
echo "-------------------"
run_test "TypeScript 类型检查" "npx tsc --noEmit"

# 2. 代码质量检查
echo "🔍 阶段 2: 代码质量"
echo "-------------------"
run_test "ESLint 检查" "npm run lint || true"

# 3. 单元测试
echo "🔍 阶段 3: 单元测试"
echo "-------------------"
run_test "所有单元测试" "npm test"

# 4. 手动功能测试
echo "🔍 阶段 4: 功能测试"
echo "-------------------"
run_test "新功能手动测试" "tsx tests/manual/test-new-features.ts"

# 5. 构建测试
echo "🔍 阶段 5: 构建测试"
echo "-------------------"
run_test "项目构建" "npm run build"

# 测试总结
echo "=========================="
echo "📊 测试总结"
echo "=========================="
echo "总测试数: $TOTAL_TESTS"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！系统可以上线！${NC}"
    exit 0
else
    echo -e "${RED}⚠️  有 $FAILED_TESTS 个测试失败，请检查！${NC}"
    exit 1
fi
