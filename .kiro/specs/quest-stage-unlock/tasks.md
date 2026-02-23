# 实施计划：任务驱动关卡解锁

## 概述

通过修改任务数据和初始状态，实现完成主线任务3后解锁草原关卡。同时扩展存档系统以持久化关卡解锁状态。

## 任务

- [x] 1. 修改任务数据和初始状态
  - [x] 1.1 修改 `src/game/data/quests.json` 中 `main_03_first_recruit` 的 rewards，添加 `"unlockStage": "grassland"`
    - 将 `{ "gold": 300 }` 改为 `{ "gold": 300, "unlockStage": "grassland" }`
    - _Requirements: 2.1_

  - [x] 1.2 修改 `src/ui/GameUI.ts` 中 `unlockedStages` 的初始值，移除 `'grassland'`
    - 将 `new Set(['village', 'grassland'])` 改为 `new Set(['village'])`
    - _Requirements: 1.1_

  - [ ]* 1.3 编写单元测试验证任务数据和初始状态
    - 验证 `main_03_first_recruit` 的 rewards 包含 `unlockStage: "grassland"`
    - 验证 `main_04_explore_grassland` 的 prerequisites 包含 `main_03_first_recruit`
    - _Requirements: 2.1, 4.1_

  - [ ]* 1.4 编写属性测试：任务完成解锁关卡
    - **Property 1: 任务完成解锁关卡**
    - **Validates: Requirements 2.2, 2.3**

- [x] 2. 实现关卡解锁状态持久化
  - [x] 2.1 扩展 `src/game/data/quest-types.ts` 中的 `QuestSaveData` 接口，添加 `unlockedStages?: string[]` 字段
    - _Requirements: 3.1_

  - [x] 2.2 修改 `src/ui/GameUI.ts` 中的 `serializeQuestState()` 方法，将 `unlockedStages` 序列化到存档数据中
    - _Requirements: 3.2_

  - [x] 2.3 修改 `src/ui/GameUI.ts` 中的 `deserializeQuestState()` 方法，从存档数据恢复 `unlockedStages`，并实现旧存档兼容逻辑
    - 如果存档包含 `unlockedStages`，直接恢复
    - 如果不包含，从已完成任务的 `unlockStage` 奖励推导
    - _Requirements: 3.3, 3.4_

  - [ ]* 2.4 编写属性测试：序列化/反序列化往返一致性
    - **Property 2: 已解锁关卡序列化/反序列化往返一致性**
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 2.5 编写属性测试：旧存档兼容性推导
    - **Property 3: 旧存档兼容性——从已完成任务推导解锁关卡**
    - **Validates: Requirements 3.4**

- [x] 3. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快开发速度
- 每个任务引用了具体的需求编号以便追溯
- 现有的 `completeQuest` → `unlockStage` 调用链无需修改
- 属性测试使用 `fast-check` 库，每个测试至少运行 100 次迭代
