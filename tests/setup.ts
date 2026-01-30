/**
 * Jest测试环境设置
 */

// 设置测试超时
jest.setTimeout(10000);

// Mock环境变量
process.env.EVOAGENT_LOG_LEVEL = 'error';

// 全局测试钩子
beforeAll(async () => {
  // 在所有测试前执行
});

afterAll(async () => {
  // 在所有测试后执行
});

afterEach(() => {
  jest.clearAllMocks();
});
