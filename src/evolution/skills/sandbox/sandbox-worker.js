/**
 * Sandbox Worker
 *
 * 在隔离的 Worker Thread 中执行用户代码
 */

const { parentPort, workerData } = require('worker_threads');

// 安全的上下文对象
const safeContext = {
  // 提供安全的 console
  console: {
    log: (...args) => {
      // 只记录，不输出到主线程
    },
    error: (...args) => {
      // 只记录，不输出到主线程
    },
    warn: (...args) => {
      // 只记录，不输出到主线程
    }
  },
  // 提供用户上下文
  context: workerData.context || {},
  // 结果存储
  __result: null
};

// 禁用危险的全局对象
delete global.require;
delete global.process;
delete global.Buffer;
delete global.setImmediate;
delete global.setInterval;
delete global.setTimeout;

try {
  // 包装用户代码
  const wrappedCode = `
    (async function() {
      'use strict';
      const { console, context } = safeContext;
      ${workerData.code}
    })()
  `;

  // 创建安全的函数
  const fn = new Function('safeContext', wrappedCode);

  // 执行代码
  const promise = fn(safeContext);

  // 处理结果
  if (promise && typeof promise.then === 'function') {
    promise
      .then((result) => {
        parentPort.postMessage({
          success: true,
          output: result
        });
      })
      .catch((error) => {
        parentPort.postMessage({
          success: false,
          error: error.message || String(error)
        });
      });
  } else {
    parentPort.postMessage({
      success: true,
      output: promise
    });
  }
} catch (error) {
  parentPort.postMessage({
    success: false,
    error: error.message || String(error)
  });
}
