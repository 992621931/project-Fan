# 实施计划：任务系统（Quest System）

## 概述

将任务系统实现分为：类型定义 → 数据文件 → 核心逻辑 → 检测系统 → UI集成 → 持久化 → 日常重置。每步构建在前一步之上，测试穿插在实现中。

## Tasks

- [x] 1. 定义任务类型与创建数据文件
  - [x] 1.1 创建 `src/game/data/quest-types.ts`，定义 QuestObjectiveType、QuestObjective、QuestReward、QuestType、QuestStatus、QuestDefinition、QuestState、QuestSaveData 接口
    - _Requirements: 1.1, 1.4, 1.5_
  - [x] 1.2 创建 `src/game/data/quests.json`，包含主线任务（8-10个，覆盖 village_chief → bartender → recruit → grassland → blacksmith → alchemist → chef → trainer → summoner → scholar 的完整链路）、每个NPC的支线任务、每个NPC的日常任务
    - 主线任务使用 prerequisites 字段形成链式依赖
    - 支线任务按NPC角色分配（铁匠给制作任务、厨师给烹饪任务等）
    - 日常任务为低难度小奖励
    - 所有文本使用中文
    - _Requirements: 2.2, 2.3, 3.2, 4.2_
  - [ ]* 1.3 编写属性测试：任务数据结构完整性
    - **Property 1: 任务数据结构完整性**
    - **Validates: Requirements 1.1**

- [x] 2. 实现核心任务管理逻辑
  - [x] 2.1 在 `GameUI` 中添加任务相关属性：questDefinitions (从JSON加载的定义)、questStates (运行时状态 Map<string, QuestState>)、lastDailyReset (时间戳)
    - 实现 `loadQuestData()` 异步加载 quests.json
    - 在 `initialize()` 中调用 loadQuestData
    - _Requirements: 1.2, 1.3_
  - [x] 2.2 实现 `initQuestSystem()`：遍历所有任务定义，根据 prerequisites 和 type 设置初始状态（首个主线任务设为 available，其余根据前置条件判断）
    - 实现 `isQuestAvailable(quest)` 检查前置条件是否满足
    - _Requirements: 2.1, 2.2_
  - [x] 2.3 实现 `acceptQuest(questId)`：将任务从 available 移至 inProgress
    - 实现 `getQuestsForNpc(npcId)` 返回指定NPC的所有相关任务（按类型和sortOrder排序）
    - _Requirements: 3.3, 3.1_
  - [x] 2.4 重写 `completeQuest(questId)`：处理奖励发放（gold通过CurrencySystem、crystal通过CurrencySystem、items通过ItemSystem）、NPC解锁（从lockedNPCs移除）、关卡解锁、主线任务链推进（使下一个主线任务available）
    - 添加 crystal 奖励支持到 CurrencySystem 调用
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 2.2, 2.4_
  - [ ]* 2.5 编写属性测试：任务接受状态转换 & 支线任务一次性完成不变量
    - **Property 7: 任务接受状态转换**
    - **Property 8: 支线任务一次性完成不变量**
    - **Validates: Requirements 3.3, 3.4**
  - [ ]* 2.6 编写属性测试：主线任务链推进 & NPC解锁
    - **Property 4: 主线任务链推进**
    - **Property 5: 主线任务NPC解锁**
    - **Validates: Requirements 2.2, 2.4**
  - [ ]* 2.7 编写属性测试：奖励发放正确性
    - **Property 3: 奖励发放正确性**
    - **Validates: Requirements 1.5, 7.1, 7.2, 7.3**

- [x] 3. Checkpoint - 确保核心逻辑测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 4. 实现任务检测系统
  - [x] 4.1 实现 `setupQuestDetection()`：通过 EventSystem 订阅游戏事件
    - 实现 `checkQuestProgress(type, target, amount)` 核心检测方法：遍历所有 inProgress 任务，匹配目标类型和target，更新 currentAmount（不超过 requiredAmount）
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - [x] 4.2 在现有游戏操作中添加事件发射：
    - `switchScene()` 中 emit `quest:scene_visited`
    - `completeCooking()` / `completeCookingInDetailsPanel()` 中 emit `quest:craft_completed`
    - `completeEquipmentCrafting()` 中 emit `quest:craft_completed`
    - `completeAlchemyCrafting()` 中 emit `quest:craft_completed`
    - `handleRecruitClick()` 成功招募后 emit `quest:recruited`
    - `handleGiftClick()` 送礼后 emit `quest:gift_given`
    - `checkAffinityRewards()` / affinity更新后 emit `quest:affinity_changed`
    - 物品获取处（战利品拾取、制作产出等）emit `quest:item_gained`
    - 战斗胜利时 emit `quest:combat_completed`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - [x] 4.3 实现 `checkMainQuestAutoComplete()`：检查所有 inProgress 的主线任务，如果所有目标都已完成则自动调用 completeQuest
    - 在每次 checkQuestProgress 后调用
    - _Requirements: 2.5_
  - [ ]* 4.4 编写属性测试：任务检测进度更新 & 目标独立追踪 & 主线自动完成
    - **Property 11: 任务检测进度更新**
    - **Property 2: 目标独立追踪**
    - **Property 6: 主线任务自动完成**
    - **Validates: Requirements 5.1-5.7, 1.4, 2.5**

- [x] 5. Checkpoint - 确保检测系统测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 6. 集成UI：任务面板与NPC按钮
  - [x] 6.1 重写 `showQuestPanel(npcId?: string)`：支持可选的NPC过滤参数
    - 三个标签页：可接任务、进行中、已完成
    - 按任务类型分组显示（主线 > 支线 > 日常）
    - 当 npcId 提供时，只显示该NPC相关的任务
    - 无任务时显示空状态而非 "coming soon"
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  - [x] 6.2 修改 `showNPCDetails()` 中的任务按钮点击处理：
    - 移除 village_chief 的特殊判断，所有NPC统一调用 `showQuestPanel(npcData.id)`
    - 移除 "coming soon" 通知逻辑
    - _Requirements: 6.1_
  - [x] 6.3 重写 `createQuestCard(quest)` 和 `showQuestDetails(quest)`：
    - 使用新的 QuestDefinition/QuestState 数据结构
    - 显示每个目标的独立进度条
    - 主线任务不显示接受/拒绝按钮（自动进行）
    - 支线/日常任务显示接受按钮
    - 所有目标完成时显示完成按钮
    - _Requirements: 6.2, 6.4_
  - [x] 6.4 重写 `updateQuestRedDots()` 和 `hasCompletableQuests()`：使用新的 questStates 数据结构
    - 在每个NPC的任务按钮上显示红点（如果该NPC有可完成的任务）
    - _Requirements: 6.4_
  - [ ]* 6.5 编写属性测试：NPC任务过滤 & 红点指示器正确性
    - **Property 9: NPC任务过滤**
    - **Property 12: 红点指示器正确性**
    - **Validates: Requirements 3.1, 6.1, 6.4**

- [x] 7. 实现日常任务重置
  - [x] 7.1 实现 `resetDailyQuests()`：遍历所有日常任务，将已完成的重置为 available，清除所有目标进度
    - 在 `onDawnEvents()` 中调用 resetDailyQuests
    - 更新 lastDailyReset 时间戳
    - _Requirements: 4.3, 4.4, 4.5_
  - [ ]* 7.2 编写属性测试：日常任务黎明重置
    - **Property 10: 日常任务黎明重置**
    - **Validates: Requirements 4.3, 4.4**

- [x] 8. 实现任务持久化
  - [x] 8.1 实现 `serializeQuestState()` 和 `deserializeQuestState(data)`
    - 序列化：将 questStates Map 和 lastDailyReset 转为 JSON 兼容对象
    - 反序列化：从保存数据恢复 questStates Map，检查日常任务是否需要重置
    - 集成到现有的 localStorage 保存/加载流程中
    - _Requirements: 8.1, 8.2, 8.4_
  - [ ]* 8.2 编写属性测试：任务状态序列化往返 & 过期日常任务加载重置
    - **Property 13: 任务状态序列化往返**
    - **Property 14: 过期日常任务加载重置**
    - **Validates: Requirements 8.3, 8.4**

- [x] 9. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选测试任务，可跳过以加快MVP进度
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点确保增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
