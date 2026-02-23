# 需求文档

## 简介

本功能为游戏添加两个新的数据存储系统：专属技能库和异界角色库。专属技能库用于存储具有独特机制的角色专属技能，这些技能包含复杂的投射物系统、伤害计算和视觉特效。异界角色库用于存储来自异界的特殊角色预制体，这些角色拥有独特的属性配置和专属技能。

## 术语表

- **System**: 指整个游戏系统
- **DataLoader**: 游戏数据加载器，负责从JSON文件加载游戏配置数据
- **ConfigManager**: 配置管理器，管理和验证游戏配置数据
- **Exclusive_Skill**: 专属技能，角色独有的特殊技能类型
- **Otherworld_Character**: 异界角色，来自异界的特殊角色类型
- **Projectile**: 投射物，技能效果产生的可移动攻击实体
- **Particle_Effect**: 粒子特效，用于视觉反馈的粒子系统效果
- **Skill_Tag**: 技能标签，用于分类和筛选技能的标记
- **Character_Type**: 角色类型，用于分类角色的标记（如"异界"、"冒险者"）

## 需求

### 需求 1: 专属技能数据存储

**用户故事:** 作为游戏开发者，我想要存储专属技能数据，以便角色可以使用具有复杂效果的独特技能。

#### 验收标准

1. THE System SHALL 创建一个新的JSON文件 `exclusive-skills.json` 用于存储专属技能数据
2. WHEN 专属技能数据被定义时，THE System SHALL 包含技能的基本属性（id、名称、类型、图标路径、描述）
3. WHEN 专属技能数据被定义时，THE System SHALL 包含技能标签列表用于分类和筛选
4. WHEN 专属技能数据被定义时，THE System SHALL 包含详细的技能效果配置（投射物属性、伤害计算公式、视觉特效）
5. THE System SHALL 确保专属技能数据结构与现有的 `skills.json` 格式兼容
6. THE System SHALL 支持投射物配置，包括图片路径、移动速度、生命周期、移动方向
7. THE System SHALL 支持伤害计算公式配置，包括基础伤害和属性加成百分比
8. THE System SHALL 支持粒子特效配置，包括特效类型、颜色、触发时机、位置

### 需求 2: 异界角色数据存储

**用户故事:** 作为游戏开发者，我想要存储异界角色数据，以便游戏可以包含来自异界的特殊角色。

#### 验收标准

1. THE System SHALL 创建一个新的JSON文件 `otherworld-characters.json` 用于存储异界角色数据
2. WHEN 异界角色数据被定义时，THE System SHALL 包含角色的基本信息（id、名称、角色类型标签、头像路径）
3. WHEN 异界角色数据被定义时，THE System SHALL 包含角色的初始属性（等级、生命值、魔法值、饱腹度）
4. WHEN 异界角色数据被定义时，THE System SHALL 包含角色的基础属性（力量、敏捷、智慧、技巧）
5. WHEN 异界角色数据被定义时，THE System SHALL 包含角色的初始职业配置
6. WHEN 异界角色数据被定义时，THE System SHALL 包含角色的初始技能列表（被动技能和主动技能）
7. THE System SHALL 确保异界角色数据结构与现有的 `characters.json` 格式兼容
8. THE System SHALL 支持角色类型标签列表，用于标识角色的特殊分类（如"异界"、"冒险者"）

### 需求 3: DataLoader集成

**用户故事:** 作为游戏系统，我想要通过DataLoader加载新的数据类型，以便在游戏运行时可以访问专属技能和异界角色数据。

#### 验收标准

1. WHEN DataLoader初始化时，THE System SHALL 加载 `exclusive-skills.json` 文件
2. WHEN DataLoader初始化时，THE System SHALL 加载 `otherworld-characters.json` 文件
3. WHEN 数据加载失败时，THE System SHALL 记录错误信息并提供有意义的错误消息
4. WHEN 数据加载成功时，THE System SHALL 将专属技能数据合并到技能配置中
5. WHEN 数据加载成功时，THE System SHALL 将异界角色数据合并到角色配置中
6. THE System SHALL 验证加载的数据符合预期的数据结构
7. THE System SHALL 在ConfigManager的统计信息中包含专属技能和异界角色的数量

### 需求 4: 数据结构验证

**用户故事:** 作为游戏系统，我想要验证数据的完整性和正确性，以便在运行时避免因数据错误导致的问题。

#### 验收标准

1. WHEN 专属技能数据被加载时，THE System SHALL 验证所有必需字段都存在
2. WHEN 专属技能数据被加载时，THE System SHALL 验证投射物配置的数值在合理范围内（速度>0，生命周期>0）
3. WHEN 专属技能数据被加载时，THE System SHALL 验证伤害计算公式的参数有效
4. WHEN 异界角色数据被加载时，THE System SHALL 验证所有必需字段都存在
5. WHEN 异界角色数据被加载时，THE System SHALL 验证属性值在合理范围内（生命值>0，属性值>=0）
6. WHEN 异界角色引用初始技能时，THE System SHALL 验证技能ID在技能库中存在
7. WHEN 异界角色引用初始职业时，THE System SHALL 验证职业ID在职业配置中存在
8. WHEN 数据验证失败时，THE System SHALL 提供详细的错误信息，包括字段路径和错误原因

### 需求 5: 初始数据内容

**用户故事:** 作为游戏内容，我想要包含指定的专属技能和异界角色，以便玩家可以立即使用这些新内容。

#### 验收标准

1. THE System SHALL 在 `exclusive-skills.json` 中包含"伏魔斩"技能
2. WHEN "伏魔斩"技能被定义时，THE System SHALL 设置技能名称为"伏魔斩"
3. WHEN "伏魔斩"技能被定义时，THE System SHALL 设置技能类型为"exclusive"
4. WHEN "伏魔斩"技能被定义时，THE System SHALL 设置图标路径为"images/zhudongjineng_fumozhan"
5. WHEN "伏魔斩"技能被定义时，THE System SHALL 设置技能标签为["持续", "游侠", "舞者"]
6. WHEN "伏魔斩"技能被定义时，THE System SHALL 设置技能描述为"每次和敌人碰撞后会闪烁到安全的位置"
7. WHEN "伏魔斩"技能被定义时，THE System SHALL 配置投射物向左右两个方向发射
8. WHEN "伏魔斩"技能被定义时，THE System SHALL 配置投射物图片为"images/texiao_chongjibo.png"
9. WHEN "伏魔斩"技能被定义时，THE System SHALL 配置投射物移动速度为400
10. WHEN "伏魔斩"技能被定义时，THE System SHALL 配置投射物生命周期为1.5秒
11. WHEN "伏魔斩"技能被定义时，THE System SHALL 配置伤害公式为"10 + 施法者攻击力 * 1.25"
12. WHEN "伏魔斩"技能被定义时，THE System SHALL 配置命中时产生暗红色粒子爆炸特效
13. THE System SHALL 在 `otherworld-characters.json` 中包含"Allenes"角色
14. WHEN "Allenes"角色被定义时，THE System SHALL 设置角色名为"Allenes"
15. WHEN "Allenes"角色被定义时，THE System SHALL 设置角色类型标签为["异界", "冒险者"]
16. WHEN "Allenes"角色被定义时，THE System SHALL 设置头像路径为"images/touxiang_yijie_Allenes"
17. WHEN "Allenes"角色被定义时，THE System SHALL 设置初始等级为1
18. WHEN "Allenes"角色被定义时，THE System SHALL 设置最大生命值为100
19. WHEN "Allenes"角色被定义时，THE System SHALL 设置最大魔法值为100
20. WHEN "Allenes"角色被定义时，THE System SHALL 设置最大饱腹度为100
21. WHEN "Allenes"角色被定义时，THE System SHALL 设置力量为10
22. WHEN "Allenes"角色被定义时，THE System SHALL 设置敏捷为5
23. WHEN "Allenes"角色被定义时，THE System SHALL 设置智慧为3
24. WHEN "Allenes"角色被定义时，THE System SHALL 设置技巧为2
25. WHEN "Allenes"角色被定义时，THE System SHALL 设置初始职业为"战士"
26. WHEN "Allenes"角色被定义时，THE System SHALL 设置初始主动技能为["伏魔斩"]
27. WHEN "Allenes"角色被定义时，THE System SHALL 设置初始被动技能为空列表

### 需求 6: 配置类型扩展

**用户故事:** 作为TypeScript类型系统，我想要为新的数据类型提供类型定义，以便在开发时获得类型安全和自动补全支持。

#### 验收标准

1. THE System SHALL 在 `ConfigTypes.ts` 中定义 `ExclusiveSkillConfig` 接口
2. WHEN `ExclusiveSkillConfig` 被定义时，THE System SHALL 包含投射物配置类型 `ProjectileConfig`
3. WHEN `ExclusiveSkillConfig` 被定义时，THE System SHALL 包含粒子特效配置类型 `ParticleEffectConfig`
4. WHEN `ExclusiveSkillConfig` 被定义时，THE System SHALL 包含伤害计算配置类型 `DamageFormulaConfig`
5. THE System SHALL 在 `ConfigTypes.ts` 中定义 `OtherworldCharacterConfig` 接口
6. WHEN `OtherworldCharacterConfig` 被定义时，THE System SHALL 扩展现有的 `CharacterConfig` 接口
7. WHEN `OtherworldCharacterConfig` 被定义时，THE System SHALL 包含初始状态配置（等级、生命值、魔法值、饱腹度）
8. WHEN `OtherworldCharacterConfig` 被定义时，THE System SHALL 包含初始技能配置（被动技能列表、主动技能列表）
9. THE System SHALL 更新 `GameConfig` 接口以包含 `exclusiveSkills` 和 `otherworldCharacters` 字段
