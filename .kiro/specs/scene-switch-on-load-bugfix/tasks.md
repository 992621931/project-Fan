# 实施计划：场景切换加载 Bug 修复

## 概述

修复 `GameUI.ts` 中 `saveToSlot` 和 `loadFromSlot` 的两个关联 Bug，确保存档加载后恢复玩家实际位置，并允许自动保存在所有关卡中生效。

## 任务

- [x] 1. 修复 `saveToSlot` 允许自动保存在战斗关卡中生效
  - [x] 1.1 修改 `saveToSlot` 中的关卡限制逻辑，使 `isAuto=true` 时跳过 `isNonCombatStage` 守卫
    - 将 `if (!this.isNonCombatStage(...)) { ... return; }` 改为仅在 `!isAuto` 时 return
    - 保持手动保存在战斗关卡中的阻止行为不变
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 1.2 编写 `saveToSlot` 属性测试
    - **Property 2: 自动保存在所有关卡中均可成功**
    - **Property 3: 手动保存在战斗关卡中被阻止**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 2. 修复 `loadFromSlot` 恢复玩家实际保存位置
  - [x] 2.1 移除 `loadFromSlot` 中强制覆写 `currentStage='village'` 和 `currentScene='square'` 的代码
    - 删除 `this.currentStage = 'village';` 和 `this.currentScene = 'square';`
    - 替换为根据已恢复的 `currentStage` 类型调用正确的场景加载逻辑
    - 对于村庄关卡：调用 `switchScene(this.currentScene)` 加载具体场景
    - 对于战斗关卡：调用 `loadStageDefaultScene()` 加载背景和探索面板
    - 添加对无效 `currentStage`/`currentScene` 的回退处理（默认 village/square）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3_

  - [ ]* 2.2 编写 `loadFromSlot` 属性测试
    - **Property 1: 存档加载关卡/场景往返一致性**
    - **Validates: Requirements 1.1**

- [x] 3. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 每个任务引用了具体的需求编号以便追溯
- 属性测试使用 `vitest` + `fast-check`，与项目现有测试模式一致
