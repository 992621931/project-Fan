# 需求文档：冒险者和异界角色饱腹度奖励

## 简介

为了让新招募的冒险者和异界角色更具游戏性，在角色生成时为他们提供初始饱腹度奖励。普通冒险者和异界角色在生成后，当前饱腹度会随机增加30~50点，而不是从0开始。

## 术语表

- **Adventurer_Character（冒险者角色）**：通过招募系统随机生成的普通角色（isSpecial=false）
- **Otherworld_Character（异界角色）**：来自异界的特殊角色，定义在 `otherworld-characters.json` 中
- **HungerComponent（饱腹度组件）**：角色的饱腹度数据组件，包含 current 和 maximum 字段
- **CharacterRecruitmentSystem（角色招募系统）**：负责生成和初始化新角色的系统
- **Hunger_Bonus（饱腹度奖励）**：角色生成时获得的随机饱腹度增量（30~50）

## 需求

### 需求 1：冒险者角色饱腹度奖励

**用户故事：** 作为玩家，我希望新招募的冒险者角色拥有一定的初始饱腹度，这样他们不会立即处于饥饿状态，更符合刚加入队伍的设定。

#### 验收标准

1. WHEN a new adventurer character is generated (isSpecial=false), THE system SHALL generate a random hunger bonus between 30 and 50 (inclusive)
2. WHEN the hunger bonus is generated, THE system SHALL add this value to the character's current hunger
3. WHEN the current hunger is increased, THE system SHALL ensure it does not exceed the maximum hunger value (100)
4. THE hunger bonus SHALL only affect the current hunger value, NOT the maximum hunger value
5. THE hunger bonus SHALL be applied after the HungerComponent is created and validated

### 需求 2：异界角色饱腹度奖励

**用户故事：** 作为玩家，我希望新招募的异界角色也拥有初始饱腹度，这样他们在加入队伍时就有一定的战斗准备。

#### 验收标准

1. WHEN a new otherworld character is generated (from otherworld-characters.json), THE system SHALL generate a random hunger bonus between 30 and 50 (inclusive)
2. WHEN the hunger bonus is generated, THE system SHALL add this value to the character's current hunger
3. WHEN the current hunger is increased, THE system SHALL ensure it does not exceed the maximum hunger value
4. THE hunger bonus SHALL only affect the current hunger value, NOT the maximum hunger value
5. THE hunger bonus SHALL be applied after the HungerComponent is created and validated

### 需求 3：随机性和公平性

**用户故事：** 作为玩家，我希望每个新角色的初始饱腹度有所不同，增加游戏的随机性和趣味性。

#### 验收标准

1. THE hunger bonus SHALL be randomly generated for each character independently
2. THE random value SHALL be uniformly distributed between 30 and 50 (inclusive)
3. THE same character type recruited multiple times SHALL receive different hunger bonuses
4. THE hunger bonus generation SHALL use the game's existing random number generator

### 需求 4：数据一致性

**用户故事：** 作为开发者，我希望饱腹度奖励不会破坏现有的数据验证逻辑，确保系统稳定性。

#### 验收标准

1. WHEN hunger bonus is applied, THE resulting hunger value SHALL pass the validateHunger function
2. THE current hunger SHALL always be within [0, maximum] range after bonus application
3. THE hunger bonus SHALL NOT modify the maximum hunger value
4. THE hunger bonus SHALL be applied before the character_recruited event is emitted

### 需求 5：特殊角色排除

**用户故事：** 作为开发者，我需要明确哪些角色类型应该获得饱腹度奖励，避免给不应该获得奖励的角色添加奖励。

#### 验收标准

1. NPC characters (village_chief, bartender, maid, etc.) SHALL NOT receive hunger bonus
2. Only characters generated through CharacterRecruitmentSystem SHALL receive hunger bonus
3. Starter characters (if any) SHALL follow the same rules as adventurer characters
4. The hunger bonus logic SHALL be applied in the generateCharacter method

### 需求 6：向后兼容性

**用户故事：** 作为玩家，我希望这个改动不会影响我现有的存档和已招募的角色。

#### 验收标准

1. Existing characters in save files SHALL NOT be affected by this change
2. Only newly recruited characters SHALL receive the hunger bonus
3. The save/load system SHALL continue to work without modifications
4. No migration of existing save data is required
