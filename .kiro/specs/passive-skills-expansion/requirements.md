# Requirements Document

## Introduction

本功能旨在扩展游戏的被动技能库，添加12个新的被动技能，为玩家提供更多样化的角色成长路径和战斗策略选择。这些技能涵盖了攻击增强、防御提升、资源管理、特殊效果等多个方面，丰富游戏的深度和可玩性。

## Glossary

- **Passive_Skill_System**: 被动技能系统，负责管理和应用被动技能效果
- **Skill_Data_File**: 技能数据文件（src/game/data/skills.json），存储所有技能的配置信息
- **Attribute_System**: 属性系统，管理角色的各项属性值
- **Combat_System**: 战斗系统，处理战斗相关的逻辑和伤害计算
- **Time_System**: 时间系统，管理游戏内的昼夜循环
- **Collision_Damage**: 碰撞伤害，角色与敌人碰撞时造成的伤害
- **Resource_Point**: 资源点，游戏中可采集的资源节点
- **BOSS_Enemy**: BOSS敌人，游戏中的特殊强力敌人
- **Critical_Rate**: 暴击率，攻击造成暴击的概率
- **Critical_Damage**: 暴击伤害，暴击时造成的额外伤害倍率
- **Magic_Power**: 魔法强度，影响魔法技能效果的属性
- **Satiety**: 饱腹度，角色的饥饿状态值
- **Day_Time**: 白天时段，游戏时间系统中的白天阶段
- **Night_Time**: 夜晚时段，游戏时间系统中的夜晚阶段

## Requirements

### Requirement 1: 添加攻击型被动技能

**User Story:** 作为玩家，我想要学习增强攻击能力的被动技能，以便提升我的战斗输出能力。

#### Acceptance Criteria

1. THE Skill_Data_File SHALL include a passive skill "瞄准弱点" with id "aim_weakness"
2. WHEN "瞄准弱点" is learned, THE Passive_Skill_System SHALL increase the character's Critical_Rate by 8%
3. THE Skill_Data_File SHALL include a passive skill "残忍至极" with id "extreme_cruelty"
4. WHEN "残忍至极" is learned, THE Passive_Skill_System SHALL increase the character's Critical_Damage by 10%
5. THE Skill_Data_File SHALL include a passive skill "挑战者" with id "challenger"
6. WHEN "挑战者" is learned, THE Combat_System SHALL increase damage dealt to BOSS_Enemy by 15%

### Requirement 2: 添加魔法型被动技能

**User Story:** 作为魔法职业玩家，我想要学习增强魔法能力的被动技能，以便提升魔法技能的效果。

#### Acceptance Criteria

1. THE Skill_Data_File SHALL include a passive skill "奥术至尊" with id "arcane_supremacy"
2. WHEN "奥术至尊" is learned, THE Passive_Skill_System SHALL increase the character's Magic_Power by 8

### Requirement 3: 添加资源采集型被动技能

**User Story:** 作为玩家，我想要学习提升资源采集效率的被动技能，以便更快地收集游戏资源。

#### Acceptance Criteria

1. THE Skill_Data_File SHALL include a passive skill "自然学" with id "natural_science"
2. WHEN "自然学" is learned, THE Combat_System SHALL increase damage dealt to Resource_Point by 100%

### Requirement 4: 添加经济型被动技能

**User Story:** 作为玩家，我想要学习增加金币收入的被动技能，以便获得更多的游戏货币。

#### Acceptance Criteria

1. THE Skill_Data_File SHALL include a passive skill "麦达斯之触" with id "midas_touch"
2. WHEN a character with "麦达斯之触" deals Collision_Damage to an enemy, THE Combat_System SHALL grant the character 1 to 3 gold coins
3. THE Combat_System SHALL generate the gold amount randomly within the range [1, 3] for each collision

### Requirement 5: 添加体型调整型被动技能

**User Story:** 作为玩家，我想要学习改变角色体型的被动技能，以便适应不同的游戏策略。

#### Acceptance Criteria

1. THE Skill_Data_File SHALL include a passive skill "泰坦血脉" with id "titan_bloodline"
2. WHEN "泰坦血脉" is learned, THE Attribute_System SHALL increase the character's body size by 30
3. WHEN "泰坦血脉" is learned, THE Attribute_System SHALL increase the character's body weight by 10
4. THE Skill_Data_File SHALL include a passive skill "搬运者" with id "carrier"
5. WHEN "搬运者" is learned, THE Attribute_System SHALL increase the character's carrying capacity by 30
6. WHEN "搬运者" is learned, THE Attribute_System SHALL decrease the character's movement speed by 30%

### Requirement 6: 添加生命恢复型被动技能

**User Story:** 作为玩家，我想要学习生命恢复类的被动技能，以便在战斗中保持生存能力。

#### Acceptance Criteria

1. THE Skill_Data_File SHALL include a passive skill "饮血" with id "lifesteal"
2. WHEN a character with "饮血" deals Collision_Damage to an enemy, THE Combat_System SHALL heal the character
3. THE Combat_System SHALL calculate the healing amount as 10% of the Collision_Damage dealt
4. THE Combat_System SHALL apply the healing effect immediately after the damage is dealt

### Requirement 7: 添加时间依赖型被动技能

**User Story:** 作为玩家，我想要学习根据游戏时间提供不同效果的被动技能，以便在特定时段获得优势。

#### Acceptance Criteria

1. THE Skill_Data_File SHALL include a passive skill "月之祝福" with id "moon_blessing"
2. WHILE the Time_System indicates Night_Time, THE Passive_Skill_System SHALL increase the character's attack power by 15%
3. WHILE the Time_System indicates Night_Time, THE Passive_Skill_System SHALL increase the character's defense by 10
4. WHILE the Time_System indicates Day_Time, THE Passive_Skill_System SHALL remove the "月之祝福" bonuses
5. THE Skill_Data_File SHALL include a passive skill "光合作用" with id "photosynthesis"
6. WHILE the Time_System indicates Day_Time, THE Passive_Skill_System SHALL increase the character's health regeneration by 1 per tick
7. WHILE the Time_System indicates Day_Time, THE Passive_Skill_System SHALL increase the character's mana regeneration by 1 per tick
8. WHILE the Time_System indicates Night_Time, THE Passive_Skill_System SHALL remove the "光合作用" bonuses

### Requirement 8: 添加饱腹度管理型被动技能

**User Story:** 作为玩家，我想要学习影响饱腹度消耗的被动技能，以便更好地管理角色的饥饿状态。

#### Acceptance Criteria

1. THE Skill_Data_File SHALL include a passive skill "胃炎" with id "gastritis"
2. WHEN "胃炎" is learned, THE Attribute_System SHALL decrease the character's maximum health by 10
3. WHEN "胃炎" is learned, THE Passive_Skill_System SHALL decrease the character's Satiety consumption rate by 50%

### Requirement 9: 技能数据结构一致性

**User Story:** 作为开发者，我需要确保新技能的数据结构与现有技能保持一致，以便系统能够正确加载和处理这些技能。

#### Acceptance Criteria

1. FOR ALL new passive skills, THE Skill_Data_File SHALL include the following required fields: id, name, description, type, maxLevel, manaCost, cooldown, effects, learnConditions
2. FOR ALL new passive skills, THE type field SHALL be set to "passive"
3. FOR ALL new passive skills, THE manaCost field SHALL be set to 0
4. FOR ALL new passive skills, THE cooldown field SHALL be set to 0
5. FOR ALL new passive skills, THE effects array SHALL contain at least one effect object
6. FOR ALL effect objects, THE effect SHALL include type, target, attribute, value, and duration fields
7. FOR ALL new passive skills with permanent effects, THE duration field SHALL be set to -1

### Requirement 10: 技能图标资源引用

**User Story:** 作为开发者，我需要在技能数据中正确引用图标资源路径，以便UI能够显示技能图标。

#### Acceptance Criteria

1. FOR ALL new passive skills, THE Skill_Data_File SHALL include an icon field
2. THE icon field SHALL reference the correct image path in the images directory
3. THE Passive_Skill_System SHALL validate that referenced icon files exist when loading skill data

### Requirement 11: 技能描述文本

**User Story:** 作为玩家，我想要看到清晰的技能描述文本，以便理解每个技能的效果。

#### Acceptance Criteria

1. FOR ALL new passive skills, THE description field SHALL clearly explain the skill's effects in Chinese
2. THE description SHALL include specific numerical values for all bonuses and penalties
3. THE description SHALL be concise and easy to understand for players

### Requirement 12: 技能效果类型支持

**User Story:** 作为开发者，我需要确保技能系统支持所有新技能所需的效果类型，以便正确应用技能效果。

#### Acceptance Criteria

1. THE Passive_Skill_System SHALL support "attribute_bonus" effect type for permanent attribute modifications
2. THE Passive_Skill_System SHALL support "conditional_bonus" effect type for time-dependent bonuses
3. THE Passive_Skill_System SHALL support "on_hit_effect" effect type for collision-triggered effects
4. THE Passive_Skill_System SHALL support "damage_modifier" effect type for damage calculation modifications
5. IF a skill effect type is not currently supported, THEN THE Passive_Skill_System SHALL be extended to support it

### Requirement 13: 技能数据结构一致性

**User Story:** 作为开发者，我需要确保新技能的数据结构与现有技能保持一致，以便系统能够正确加载和处理这些技能。

#### Acceptance Criteria

1. FOR ALL new passive skills, THE Skill_Data_File SHALL include the following required fields: id, name, description, type, maxLevel, manaCost, cooldown, effects, learnConditions
2. FOR ALL new passive skills, THE type field SHALL be set to "passive"
3. FOR ALL new passive skills, THE manaCost field SHALL be set to 0
4. FOR ALL new passive skills, THE cooldown field SHALL be set to 0
5. FOR ALL new passive skills, THE effects array SHALL contain at least one effect object
6. FOR ALL effect objects, THE effect SHALL include type, target, attribute, value, and duration fields
7. FOR ALL new passive skills with permanent effects, THE duration field SHALL be set to -1
