---
title: "Next.js Server Actions 正确的错误处理方式"
category: solutions
tags: ["nextjs", "server-actions", "error-handling"]
discovered: 2025-01-29
source: auto
---

## 解决方案

Server Actions 的错误处理必须在函数内部进行。

### 实现步骤

1. 在文件顶部添加 'use server'
2. 在函数内部使用 try-catch
3. 使用 revalidatePath 更新缓存

### 代码示例

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

export async function updateProfile(userId: string, data: ProfileData) {
  try {
    const updated = await db.user.update({
      where: { id: userId },
      data
    });

    revalidatePath('/profile');
    revalidatePath('/users/[id]');

    return { success: true, data: updated };
  } catch (error) {
    console.error('Failed to update profile:', error);
    return { success: false, error: 'Update failed' };
  }
}
```

## 相关坑点

- nextjs-server-actions-trap
