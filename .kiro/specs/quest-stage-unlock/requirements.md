# 需求文档

## 简介

实现任务驱动的关卡解锁机制：当玩家完成主线任务3（招募伙伴）后，关卡选择面板中的草原关卡从灰色锁定状态变为可点击的解锁状态。目前草原在初始化时就已解锁，需要修正为仅在任务完成后解锁。

## 术语表

- **Stage_Selection_Panel（关卡选择面板）**：游戏UI中用于选择不同关卡的面板，显示所有关卡及其解锁状态
- **Unlocked_Stages（已解锁关卡集合）**：`GameUI` 中维护的 `Set<string>`，记录当前已解锁的关卡ID
- **Quest_Reward_System（任务奖励系统）**：`completeQuest` 方法中处理任务奖励的逻辑，包括金币、物品、解锁NPC和解锁关卡
- **Quest_Definition（任务定义）**：`quests.json` 中定义的任务数据，包含 `rewards` 字段
- **QuestSaveData（任务存档数据）**：`quest-types.ts` 中定义的任务持久化数据接口

## 需求

### 需求 1：草原关卡初始锁定

**用户故事：** 作为玩家，我希望草原关卡在游戏开始时处于锁定状态，这样我需要通过完成任务来解锁新区域，获得成就感。

#### 验收标准

1. WHEN the game initializes, THE Unlocked_Stages SHALL contain only 'village'
2. WHILE the grassland stage is locked, THE Stage_Selection_Panel SHALL display the grassland stage as grayed out with opacity 0.5 and cursor set to 'not-allowed'
3. WHILE the grassland stage is locked, THE Stage_Selection_Panel SHALL display '未解锁' as the grassland stage description
4. WHILE the grassland stage is locked, THE Stage_Selection_Panel SHALL prevent click events on the grassland stage item

### 需求 2：完成任务解锁草原

**用户故事：** 作为玩家，我希望完成主线任务3（招募伙伴）后自动解锁草原关卡，这样我可以继续推进主线任务4（草原历练）。

#### 验收标准

1. THE Quest_Definition for 'main_03_first_recruit' SHALL include `"unlockStage": "grassland"` in its rewards
2. WHEN the player completes quest 'main_03_first_recruit', THE Quest_Reward_System SHALL call `unlockStage('grassland')`
3. WHEN the grassland stage is unlocked, THE Unlocked_Stages SHALL contain 'grassland'
4. WHEN the grassland stage is unlocked, THE Stage_Selection_Panel SHALL update to display the grassland stage as clickable with full opacity
5. WHEN the grassland stage is unlocked, THE Stage_Selection_Panel SHALL display a notification '🎉 新关卡已解锁：草原！'

### 需求 3：解锁状态持久化

**用户故事：** 作为玩家，我希望关卡解锁状态在存档和读档后保持不变，这样我不需要重复完成任务来解锁关卡。

#### 验收标准

1. THE QuestSaveData interface SHALL include an `unlockedStages` field of type `string[]`
2. WHEN the game state is serialized, THE Quest_Reward_System SHALL include all unlocked stage IDs in the save data
3. WHEN the game state is deserialized, THE Quest_Reward_System SHALL restore the Unlocked_Stages from the save data
4. IF the save data does not contain `unlockedStages` field, THEN THE Quest_Reward_System SHALL derive unlocked stages from completed quest rewards as a fallback

### 需求 4：任务与关卡解锁的顺序一致性

**用户故事：** 作为玩家，我希望任务链的前置条件与关卡解锁顺序一致，这样游戏进度是连贯的。

#### 验收标准

1. THE Quest_Definition for 'main_04_explore_grassland' SHALL have 'main_03_first_recruit' in its prerequisites
2. WHEN quest 'main_03_first_recruit' is completed, THE grassland stage SHALL be unlocked before quest 'main_04_explore_grassland' becomes available
