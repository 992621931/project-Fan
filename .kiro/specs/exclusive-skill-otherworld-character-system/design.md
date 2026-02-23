# 设计文档

## 概述

本设计为游戏添加两个新的数据存储系统：专属技能库和异界角色库。专属技能库存储具有复杂投射物机制、伤害计算和视觉特效的角色专属技能。异界角色库存储来自异界的特殊角色，这些角色拥有独特的初始配置和专属技能。

设计目标：
- 创建与现有数据系统兼容的新JSON数据文件
- 扩展TypeScript类型定义以支持新的数据结构
- 集成到现有的DataLoader和ConfigManager系统
- 提供完整的数据验证机制
- 包含初始内容：伏魔斩技能和Allenes角色

## 架构

### 数据文件结构

```
src/game/data/
├── exclusive-skills.json      # 专属技能数据
├── otherworld-characters.json # 异界角色数据
├── skills.json                # 现有技能数据
├── characters.json            # 现有角色数据
└── DataLoader.ts              # 数据加载器（需更新）
```

### 数据流

```
JSON文件 → DataLoader.loadGameData() → ConfigManager.initialize() → 游戏系统访问
```

1. DataLoader从JSON文件加载原始数据
2. ConfigManager验证并存储配置数据
3. 游戏系统通过ConfigManager访问配置

### 集成点

- **DataLoader**: 扩展以加载新的JSON文件
- **ConfigManager**: 扩展以存储和验证新的配置类型
- **ConfigTypes**: 添加新的TypeScript接口定义
- **GameConfig**: 添加新的配置字段

## 组件和接口

### 1. 专属技能配置接口

```typescript
/**
 * 投射物配置
 */
export interface ProjectileConfig {
  image: string;              // 投射物图片路径
  speed: number;              // 移动速度（像素/秒）
  lifetime: number;           // 生命周期（秒）
  directions: ProjectileDirection[]; // 发射方向
  rotateWithDirection: boolean; // 是否随移动方向旋转
  collisionBehavior: 'destroy' | 'pierce' | 'bounce'; // 碰撞行为
}

/**
 * 投射物方向
 */
export interface ProjectileDirection {
  type: 'horizontal' | 'vertical' | 'diagonal' | 'custom';
  angle?: number;  // 自定义角度（度）
  side?: 'left' | 'right' | 'up' | 'down'; // 预设方向
}

/**
 * 伤害计算配置
 */
export interface DamageFormulaConfig {
  baseDamage: number;         // 基础伤害
  attackScaling: number;      // 攻击力加成百分比（1.25 = 125%）
  attributeType: 'attack' | 'magicPower' | 'technique'; // 使用的属性类型
}

/**
 * 粒子特效配置
 */
export interface ParticleEffectConfig {
  type: 'explosion' | 'trail' | 'aura' | 'impact';
  color: string;              // 颜色（CSS颜色值或预设）
  trigger: 'onHit' | 'onCast' | 'continuous'; // 触发时机
  position: 'caster' | 'target' | 'projectile'; // 特效位置
  intensity: number;          // 强度（0-1）
  duration: number;           // 持续时间（秒）
}

/**
 * 专属技能配置
 */
export interface ExclusiveSkillConfig extends SkillConfig {
  type: 'exclusive';          // 固定为 'exclusive'
  icon: string;               // 技能图标路径
  tags: string[];             // 技能标签
  projectile?: ProjectileConfig; // 投射物配置（可选）
  damageFormula?: DamageFormulaConfig; // 伤害计算（可选）
  particleEffects?: ParticleEffectConfig[]; // 粒子特效列表（可选）
}
```

### 2. 异界角色配置接口

```typescript
/**
 * 初始状态配置
 */
export interface InitialStateConfig {
  level: number;              // 初始等级
  maxHealth: number;          // 最大生命值
  maxMana: number;            // 最大魔法值
  maxHunger: number;          // 最大饱腹度
}

/**
 * 初始技能配置
 */
export interface InitialSkillsConfig {
  passive: string[];          // 被动技能ID列表
  active: string[];           // 主动技能ID列表
}

/**
 * 异界角色配置
 */
export interface OtherworldCharacterConfig extends CharacterConfig {
  characterTypes: string[];   // 角色类型标签（如 ["异界", "冒险者"]）
  portrait: string;           // 头像图片路径
  initialState: InitialStateConfig; // 初始状态
  initialSkills: InitialSkillsConfig; // 初始技能
}
```

### 3. 扩展GameConfig接口

```typescript
export interface GameConfig {
  version: string;
  characters: CharacterConfig[];
  items: ItemConfig[];
  recipes: Recipe[];
  dungeons: DungeonConfig[];
  jobs: JobConfig[];
  skills: SkillConfig[];
  achievements: AchievementConfig[];
  shops: ShopConfig[];
  crops: CropConfig[];
  // 新增字段
  exclusiveSkills: ExclusiveSkillConfig[];
  otherworldCharacters: OtherworldCharacterConfig[];
}
```

## 数据模型

### exclusive-skills.json 结构

```json
{
  "exclusiveSkills": [
    {
      "id": "fumo_zhan",
      "name": "伏魔斩",
      "description": "每次和敌人碰撞后会闪烁到安全的位置",
      "type": "exclusive",
      "icon": "images/zhudongjineng_fumozhan",
      "tags": ["持续", "游侠", "舞者"],
      "maxLevel": 10,
      "manaCost": 15,
      "cooldown": 3,
      "projectile": {
        "image": "images/texiao_chongjibo.png",
        "speed": 400,
        "lifetime": 1.5,
        "directions": [
          {
            "type": "horizontal",
            "side": "left"
          },
          {
            "type": "horizontal",
            "side": "right"
          }
        ],
        "rotateWithDirection": true,
        "collisionBehavior": "destroy"
      },
      "damageFormula": {
        "baseDamage": 10,
        "attackScaling": 1.25,
        "attributeType": "attack"
      },
      "particleEffects": [
        {
          "type": "explosion",
          "color": "darkred",
          "trigger": "onHit",
          "position": "target",
          "intensity": 0.8,
          "duration": 0.5
        }
      ],
      "effects": [],
      "learnConditions": []
    }
  ]
}
```

### otherworld-characters.json 结构

```json
{
  "otherworldCharacters": [
    {
      "id": "allenes",
      "name": "Allenes",
      "title": "异界旅者",
      "characterTypes": ["异界", "冒险者"],
      "portrait": "images/touxiang_yijie_Allenes",
      "rarity": 2,
      "isSpecial": true,
      "initialState": {
        "level": 1,
        "maxHealth": 100,
        "maxMana": 100,
        "maxHunger": 100
      },
      "baseAttributes": {
        "strength": 10,
        "agility": 5,
        "wisdom": 3,
        "technique": 2
      },
      "startingJob": "warrior",
      "availableJobs": ["warrior", "rogue"],
      "initialSkills": {
        "passive": [],
        "active": ["fumo_zhan"]
      },
      "description": "来自异界的神秘战士，掌握着独特的战斗技巧。"
    }
  ]
}
```

## 正确性属性

*正确性属性是关于系统应该具备的特征或行为的形式化陈述，这些陈述应该在所有有效执行中保持为真。属性是人类可读规范和机器可验证正确性保证之间的桥梁。*


### 属性反思

在分析验收标准后，识别出以下可以合并的属性：

- 需求1.2-1.8关于专属技能字段完整性的多个验证可以合并为一个综合的数据结构完整性属性
- 需求2.2-2.8关于异界角色字段完整性的多个验证可以合并为一个综合的数据结构完整性属性
- 需求3.1和3.2关于文件加载可以合并为一个属性
- 需求3.4和3.5关于数据合并可以合并为一个属性
- 需求4.1和4.4关于必需字段验证可以合并为一个属性
- 需求4.6和4.7关于引用完整性可以合并为一个属性

### 正确性属性列表

属性 1: 专属技能数据结构完整性
*对于任意*专属技能配置对象，它应该包含所有必需的字段（id、name、type、icon、tags、description），并且如果包含投射物配置，则投射物配置应包含所有必需字段（image、speed、lifetime、directions、rotateWithDirection、collisionBehavior）
**验证需求: 1.2, 1.3, 1.4, 1.6, 1.7, 1.8**

属性 2: 异界角色数据结构完整性
*对于任意*异界角色配置对象，它应该包含所有必需的字段（id、name、characterTypes、portrait、initialState、baseAttributes、startingJob、initialSkills），并且initialState应包含level、maxHealth、maxMana、maxHunger，initialSkills应包含passive和active数组
**验证需求: 2.2, 2.3, 2.4, 2.5, 2.6, 2.8**

属性 3: 数据文件加载
*对于任意*有效的DataLoader实例，当调用loadGameData()时，应该成功加载exclusive-skills.json和otherworld-characters.json文件，并且加载的数据应该可以通过ConfigManager访问
**验证需求: 3.1, 3.2**

属性 4: 数据加载错误处理
*对于任意*无效的JSON文件或缺失的文件，当DataLoader尝试加载时，应该捕获错误并记录包含文件路径和错误原因的有意义的错误消息
**验证需求: 3.3**

属性 5: 数据合并正确性
*对于任意*成功加载的专属技能和异界角色数据，这些数据应该被正确合并到ConfigManager的技能配置和角色配置中，并且可以通过相应的getter方法访问
**验证需求: 3.4, 3.5**

属性 6: 统计信息更新
*对于任意*成功加载的游戏配置，ConfigManager的统计信息应该包含正确的专属技能数量和异界角色数量
**验证需求: 3.7**

属性 7: 必需字段验证
*对于任意*缺少必需字段的专属技能或异界角色配置，验证过程应该失败并返回包含缺失字段路径的错误信息
**验证需求: 4.1, 4.4**

属性 8: 数值范围验证
*对于任意*专属技能配置，如果包含投射物配置，则投射物的speed应该大于0，lifetime应该大于0；如果包含伤害公式，则baseDamage应该大于等于0，attackScaling应该大于0
**验证需求: 4.2, 4.3**

属性 9: 角色属性值验证
*对于任意*异界角色配置，initialState中的maxHealth、maxMana、maxHunger应该大于0，baseAttributes中的所有属性值应该大于等于0
**验证需求: 4.5**

属性 10: 引用完整性验证
*对于任意*异界角色配置，如果initialSkills中引用了技能ID，则该技能ID应该在技能配置中存在；如果startingJob引用了职业ID，则该职业ID应该在职业配置中存在
**验证需求: 4.6, 4.7**

属性 11: 验证错误消息质量
*对于任意*验证失败的情况，错误消息应该包含字段路径（如"exclusiveSkills[0].projectile.speed"）和具体的错误原因（如"must be greater than 0"）
**验证需求: 4.8**

属性 12: 数据结构兼容性
*对于任意*专属技能配置，它应该可以被现有的SkillSystem处理而不会导致类型错误或运行时错误；对于任意异界角色配置，它应该可以被现有的CharacterRecruitmentSystem处理而不会导致类型错误或运行时错误
**验证需求: 1.5, 2.7**

## 错误处理

### 文件加载错误

1. **文件不存在**: 记录警告并使用空数组作为默认值
2. **JSON解析错误**: 记录错误并抛出异常，包含文件路径和解析错误详情
3. **网络错误**: 记录错误并使用回退配置

### 数据验证错误

1. **缺少必需字段**: 收集所有缺失字段并返回详细的验证错误列表
2. **数值超出范围**: 记录具体的字段路径和期望的范围
3. **引用不存在**: 记录引用的ID和引用类型（技能/职业）
4. **类型不匹配**: 记录字段路径、期望类型和实际类型

### 错误消息格式

```typescript
interface ValidationError {
  type: 'missing_field' | 'invalid_value' | 'missing_reference' | 'type_mismatch';
  path: string;  // 如 "exclusiveSkills[0].projectile.speed"
  message: string;
  expected?: any;
  actual?: any;
}
```

## 测试策略

### 单元测试

单元测试用于验证特定的例子和边缘情况：

1. **数据文件存在性测试**
   - 验证exclusive-skills.json文件存在
   - 验证otherworld-characters.json文件存在

2. **特定内容测试**
   - 验证"伏魔斩"技能的所有配置正确
   - 验证"Allenes"角色的所有配置正确

3. **边缘情况测试**
   - 空的技能列表
   - 空的角色列表
   - 缺少可选字段的配置

4. **错误处理测试**
   - 无效的JSON格式
   - 缺失的文件
   - 网络错误模拟

### 属性测试

属性测试用于验证通用规则，每个测试运行至少100次迭代：

1. **数据结构完整性属性**
   - 生成随机的专属技能配置，验证所有必需字段存在
   - 生成随机的异界角色配置，验证所有必需字段存在
   - 标签: **Feature: exclusive-skill-otherworld-character-system, Property 1: 专属技能数据结构完整性**
   - 标签: **Feature: exclusive-skill-otherworld-character-system, Property 2: 异界角色数据结构完整性**

2. **数据加载和合并属性**
   - 生成随机的配置数据，验证加载后可以通过ConfigManager访问
   - 标签: **Feature: exclusive-skill-otherworld-character-system, Property 3: 数据文件加载**
   - 标签: **Feature: exclusive-skill-otherworld-character-system, Property 5: 数据合并正确性**

3. **验证逻辑属性**
   - 生成缺少必需字段的配置，验证验证失败
   - 生成数值超出范围的配置，验证验证失败
   - 生成无效引用的配置，验证验证失败
   - 标签: **Feature: exclusive-skill-otherworld-character-system, Property 7: 必需字段验证**
   - 标签: **Feature: exclusive-skill-otherworld-character-system, Property 8: 数值范围验证**
   - 标签: **Feature: exclusive-skill-otherworld-character-system, Property 9: 角色属性值验证**
   - 标签: **Feature: exclusive-skill-otherworld-character-system, Property 10: 引用完整性验证**

4. **错误消息质量属性**
   - 生成各种无效配置，验证错误消息包含字段路径和错误原因
   - 标签: **Feature: exclusive-skill-otherworld-character-system, Property 11: 验证错误消息质量**

5. **兼容性属性**
   - 生成随机的专属技能和异界角色配置，验证可以被现有系统处理
   - 标签: **Feature: exclusive-skill-otherworld-character-system, Property 12: 数据结构兼容性**

### 测试库配置

- 使用fast-check作为TypeScript的属性测试库
- 每个属性测试配置为运行100次迭代
- 使用自定义的Arbitrary生成器来生成符合接口的随机数据

### 测试覆盖目标

- 单元测试覆盖所有具体的数据内容和边缘情况
- 属性测试覆盖所有通用的数据验证规则
- 集成测试验证DataLoader和ConfigManager的完整工作流程
