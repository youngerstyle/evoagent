---
title: "Server Actions 不能用 try-catch 包裹"
category: "pits"
tags: ["nextjs", "server-actions", "error-handling"]
discovered: "2025-01-29"
source: "auto"
severity: "critical"
occurrences: 1
related_sessions: undefined
manual_edited: undefined
reflector_can_update: false
version: undefined
---

## 问题

Next.js Server Actions 不能在文件边缘使用 try-catch 包裹。

### 错误代码
```typescript
// ❌ 错误写法
try {
  'use server';
  export async function updateProfile(data: Profile) {
    // ...
  }
} catch (error) {
  // 这样写会导致错误
}
```

### 正确写法
```typescript
// ✅ 正确写法
'use server';

import { revalidatePath } from 'next/cache';

export async function updateProfile(data: Profile) {
  try {
    // 处理逻辑
    revalidatePath('/profile');
  } catch (error) {
    // 错误处理在函数内部
    console.error('Update failed:', error);
    throw error;
  }
}
```

## 影响

- Server Actions 必须在文件顶部使用 'use server'
- try-catch 只能在函数内部使用
- 边缘层不能有异步错误处理

## 相关

- Session: session-2025-01-29-001
- Agent: CodeWriter