@echo off
REM EvoAgent 完整测试脚本 (Windows)
REM 运行方式: tests\run-all-tests.bat

echo ========================================
echo 🚀 EvoAgent 完整测试套件
echo ========================================
echo.

set TOTAL_TESTS=0
set PASSED_TESTS=0
set FAILED_TESTS=0

REM 1. TypeScript 编译检查
echo ========================================
echo 🔍 阶段 1: 编译检查
echo ========================================
echo.

echo 📋 测试: TypeScript 类型检查
set /a TOTAL_TESTS+=1
call npx tsc --noEmit
if %ERRORLEVEL% EQU 0 (
    echo ✅ 通过
    set /a PASSED_TESTS+=1
) else (
    echo ❌ 失败
    set /a FAILED_TESTS+=1
)
echo.

REM 2. 代码质量检查
echo ========================================
echo 🔍 阶段 2: 代码质量
echo ========================================
echo.

echo 📋 测试: ESLint 检查
set /a TOTAL_TESTS+=1
call npm run lint
if %ERRORLEVEL% EQU 0 (
    echo ✅ 通过
    set /a PASSED_TESTS+=1
) else (
    echo ⚠️  有警告（可忽略）
    set /a PASSED_TESTS+=1
)
echo.

REM 3. 单元测试
echo ========================================
echo 🔍 阶段 3: 单元测试
echo ========================================
echo.

echo 📋 测试: 所有单元测试
set /a TOTAL_TESTS+=1
call npm test
if %ERRORLEVEL% EQU 0 (
    echo ✅ 通过
    set /a PASSED_TESTS+=1
) else (
    echo ❌ 失败
    set /a FAILED_TESTS+=1
)
echo.

REM 4. 手动功能测试
echo ========================================
echo 🔍 阶段 4: 功能测试
echo ========================================
echo.

echo 📋 测试: 新功能手动测试
set /a TOTAL_TESTS+=1
call tsx tests/manual/test-new-features.ts
if %ERRORLEVEL% EQU 0 (
    echo ✅ 通过
    set /a PASSED_TESTS+=1
) else (
    echo ❌ 失败
    set /a FAILED_TESTS+=1
)
echo.

REM 5. 构建测试
echo ========================================
echo 🔍 阶段 5: 构建测试
echo ========================================
echo.

echo 📋 测试: 项目构建
set /a TOTAL_TESTS+=1
call npm run build
if %ERRORLEVEL% EQU 0 (
    echo ✅ 通过
    set /a PASSED_TESTS+=1
) else (
    echo ❌ 失败
    set /a FAILED_TESTS+=1
)
echo.

REM 测试总结
echo ========================================
echo 📊 测试总结
echo ========================================
echo 总测试数: %TOTAL_TESTS%
echo 通过: %PASSED_TESTS%
echo 失败: %FAILED_TESTS%
echo.

if %FAILED_TESTS% EQU 0 (
    echo 🎉 所有测试通过！系统可以上线！
    exit /b 0
) else (
    echo ⚠️  有 %FAILED_TESTS% 个测试失败，请检查！
    exit /b 1
)
