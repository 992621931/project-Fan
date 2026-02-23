# 需求文档：任务系统（Quest System）

## 简介

为「代号：饭」村庄经营RPG游戏实现一套完整的任务系统，包含主线任务、支线任务和日常任务三种类型。任务系统将引导玩家逐步解锁NPC和游戏功能，提供持续的游戏目标和奖励机制。任务通过自动检测系统判断完成条件，支持物品持有、场景访问、制作完成、战斗探索、招募、送礼和好感度等多种检测类型。

## 术语表

- **Quest_System（任务系统）**: 管理所有任务的创建、追踪、检测和完成的核心系统
- **Main_Quest（主线任务）**: 游戏开始即可用的引导性任务链，逐步解锁NPC和功能
- **Side_Quest（支线任务）**: 从NPC任务按钮接取的中等难度一次性任务
- **Daily_Quest（日常任务）**: 从NPC任务按钮接取的低难度每日重置任务
- **Quest_Detection_System（任务检测系统）**: 自动检测任务完成条件的子系统
- **Quest_Panel（任务面板）**: 显示任务列表和详情的UI面板
- **NPC_Quest_Button（NPC任务按钮）**: NPC详情面板上的📜任务按钮
- **Dawn_Reset（黎明重置）**: 昼夜循环从夜晚转为白天时触发的重置事件
- **Quest_Data（任务数据）**: 存储在JSON文件中的任务定义数据
- **Progress_Tracker（进度追踪器）**: 追踪每个任务目标当前进度的组件

## 需求

### 需求 1：任务数据模型与存储

**用户故事：** 作为开发者，我希望有一个结构化的任务数据模型，以便系统能够统一管理不同类型的任务。

#### 验收标准

1. THE Quest_System SHALL define a quest data structure containing: id, name, description, type (main/side/daily), npcId, objectives (array), rewards, prerequisites, and status
2. THE Quest_System SHALL store quest definitions in a JSON data file (`quests.json`) separate from game logic
3. THE Quest_System SHALL load quest definitions asynchronously during game initialization
4. WHEN a quest has multiple objectives, THE Quest_System SHALL track progress for each objective independently
5. THE Quest_System SHALL support the following reward types: gold, crystal, and items (with itemId and quantity)

### 需求 2：主线任务链

**用户故事：** 作为玩家，我希望有一系列主线任务引导我认识各个NPC和游戏功能，以便我能逐步了解游戏玩法。

#### 验收标准

1. WHEN the game starts, THE Quest_System SHALL make the first main quest available without any prerequisites
2. WHEN a main quest is completed, THE Quest_System SHALL automatically make the next main quest in the chain available
3. THE Quest_System SHALL provide 8-10 main quests covering the progression: village_chief → bartender (tavern) → recruit adventurer → grassland exploration → blacksmith_zz (crafting) → alchemist_tuanzi (alchemy) → chef_curry (cooking) → trainer_alin (job change) → summoner_kaoezi (summoning) → scholar_xiaomei (card collection)
4. WHEN a main quest objective involves unlocking an NPC, THE Quest_System SHALL unlock that NPC from the lockedNPCs set upon quest completion
5. THE Quest_System SHALL auto-detect main quest completion without requiring manual turn-in by the player

### 需求 3：支线任务

**用户故事：** 作为玩家，我希望能从各个NPC处接取专属支线任务，以便获得额外奖励和挑战。

#### 验收标准

1. WHEN a player clicks the quest button on an NPC detail panel, THE Quest_Panel SHALL display quests specific to that NPC
2. THE Quest_System SHALL provide NPC-specific side quests: blacksmith_zz provides crafting quests, chef_curry provides cooking quests, alchemist_tuanzi provides alchemy quests, and other NPCs provide quests matching their roles
3. WHEN a player accepts a side quest, THE Quest_System SHALL move the quest from available to inProgress status
4. WHEN a side quest is completed, THE Quest_System SHALL prevent the same quest from becoming available again
5. THE Quest_System SHALL offer medium-difficulty side quests with rewards including gold, potions, dishes, materials, equipment, and crystals

### 需求 4：日常任务

**用户故事：** 作为玩家，我希望每天有可重复的日常任务，以便我有持续的短期目标和稳定的收入来源。

#### 验收标准

1. WHEN a player clicks the quest button on an NPC detail panel, THE Quest_Panel SHALL display daily quests specific to that NPC alongside side quests
2. THE Quest_System SHALL provide NPC-specific daily quests with low difficulty and small rewards
3. WHEN dawn occurs (dayNightProgress cycles from night to day), THE Quest_System SHALL reset all completed daily quests to available status
4. WHEN a daily quest is reset, THE Quest_System SHALL clear the previous progress for that quest
5. THE Quest_System SHALL integrate daily quest reset into the existing onDawnEvents() method

### 需求 5：任务完成自动检测

**用户故事：** 作为玩家，我希望任务进度能自动更新，以便我不需要手动报告完成情况。

#### 验收标准

1. WHEN an item is added to the player inventory, THE Quest_Detection_System SHALL update progress for all active quests with item-possession objectives
2. WHEN the player switches to a new scene, THE Quest_Detection_System SHALL update progress for all active quests with scene-visit objectives
3. WHEN the player completes a crafting recipe (cooking, equipment, or alchemy), THE Quest_Detection_System SHALL update progress for all active quests with crafting-completion objectives
4. WHEN the player completes a battle in a combat stage, THE Quest_Detection_System SHALL update progress for all active quests with combat objectives
5. WHEN the player recruits an adventurer, THE Quest_Detection_System SHALL update progress for all active quests with recruitment objectives
6. WHEN the player gives a gift to an NPC, THE Quest_Detection_System SHALL update progress for all active quests with gift-giving objectives
7. WHEN an NPC's affinity changes, THE Quest_Detection_System SHALL update progress for all active quests with affinity-level objectives

### 需求 6：NPC任务按钮与面板集成

**用户故事：** 作为玩家，我希望所有NPC的任务按钮都能正常工作，以便我能从任何NPC处查看和接取任务。

#### 验收标准

1. WHEN a player clicks the quest button on any NPC, THE Quest_Panel SHALL open and display quests filtered by that NPC
2. THE Quest_Panel SHALL display three tabs: available quests (可接任务), in-progress quests (进行中), and completed quests (已完成)
3. WHEN displaying NPC-specific quests, THE Quest_Panel SHALL show main quests (if relevant to that NPC), side quests, and daily quests for that NPC
4. WHEN a quest has completable objectives, THE Quest_Panel SHALL show a red dot indicator on the NPC's quest button and on the in-progress tab
5. IF no quests are available for an NPC, THEN THE Quest_Panel SHALL display an empty state message instead of the "coming soon" notification

### 需求 7：任务奖励发放

**用户故事：** 作为玩家，我希望完成任务后能立即获得奖励，以便我有成就感和继续游戏的动力。

#### 验收标准

1. WHEN a quest is completed, THE Quest_System SHALL grant all specified gold rewards using the CurrencySystem
2. WHEN a quest is completed, THE Quest_System SHALL grant all specified crystal rewards using the CurrencySystem
3. WHEN a quest is completed, THE Quest_System SHALL grant all specified item rewards using the ItemSystem
4. WHEN rewards are granted, THE Quest_System SHALL display a notification listing all received rewards
5. WHEN a main quest completion unlocks an NPC, THE Quest_System SHALL remove that NPC from the lockedNPCs set and display an unlock notification

### 需求 8：任务持久化

**用户故事：** 作为玩家，我希望任务进度在游戏保存和加载时能被保留，以便我不会丢失任务进度。

#### 验收标准

1. WHEN the game state is saved, THE Quest_System SHALL serialize all quest states including status, progress, and completion history
2. WHEN the game state is loaded, THE Quest_System SHALL restore all quest states from the saved data
3. FOR ALL valid quest state objects, serializing then deserializing SHALL produce an equivalent quest state (round-trip property)
4. WHEN a saved game contains completed daily quests from a previous day, THE Quest_System SHALL reset those daily quests upon loading
