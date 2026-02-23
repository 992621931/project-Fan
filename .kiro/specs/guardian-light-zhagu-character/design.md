# 设计文档

## 概述

本设计为游戏添加守护之光专属技能和扎古异界角色。守护之光是一个群体护盾技能，使用新的效果类型 `shield_all_allies` 为所有友方角色添加护盾。护盾数值基于施法者防御力计算（15 + 防御力 * 1）。扎古是一个高防御力的异界战士角色，初始携带守护之光技能。

设计目标：
- 在现有 `exclusive-skills.json` 中添加守护之光技能数据
- 在现有 `otherworld-characters.json` 中添加扎古角色数据
- 在 BattleSystem 中实现 `shield_all_allies` 效果类型
- 复用现有的护盾机制（`currentShield`、视觉特效、生命周期管理）

## 架构

### 数据变更

```
src/game/data/
├── exclusive-skills.json      # 添加守护之光技能条目
├── otherworld-characters.json # 添加扎古角色条目
```

### 代码变更

```
src/game/systems/
├── BattleSystem.ts            # 添加 shield_all_allies 效果处理逻辑
```

### 数据流

```
守护之光技能数据 (exclusive-skills.json)
  → BattleSystem.applySkillEffect()
    → 识别 "shield_all_allies" 效果类型
      → applyShieldAllAlliesEffect()
        → 遍历所有友方角色
          → 计算护盾值 (15 + caster.defense * 1)
          → 设置 character.currentShield
          → 显示护盾视觉特效
          → 设置护盾生命周期定时器
```

### 与现有系统的集成

守护之光的护盾效果复用现有的护盾机制：
- `character.currentShield` 字段存储护盾值
- `applyDamageWithShield()` 方法处理护盾吸收伤害
- `showShieldVisualEffect()` / `removeShieldVisualEffect()` 处理视觉特效
- 护盾生命周期通过 `setTimeout` 管理（与现有 `shield_ally` 效果一致）

## 组件和接口

### 1. 守护之光技能效果配置

```typescript
// 在 exclusive-skills.json 中的效果配置
{
  "type": "shield_all_allies",
  "shieldAmount": {
    "base": 15,
    "defenseMultiplier": 1.0
  },
  "duration": 10000
}
```

### 2. BattleSystem 新增方法

```typescript
/**
 * 应用 shield_all_allies 效果（守护之光）
 * 为所有存活的友方角色添加护盾
 */
private applyShieldAllAlliesEffect(caster: CharacterSprite, effect: any): void {
  // 1. 获取所有友方角色（包含施法者）
  // 2. 计算护盾值 = base + caster.defense * defenseMultiplier
  // 3. 为每个友方角色添加护盾
  // 4. 显示视觉特效和通知
  // 5. 设置护盾生命周期
}
```

### 3. 扎古角色战斗属性覆盖机制

当前异界角色的战斗属性（attack、defense、moveSpeed等）是通过 `NPCSystem.calculateSecondaryAttributes()` 从基础属性（strength、agility、wisdom、technique）计算得出的。但扎古角色需要自定义的战斗属性值（如 attack=5, defense=10, moveSpeed=21），这些值与公式计算结果不同。

因此需要在 `OtherworldCharacterConfig` 中添加可选的 `combatStats` 字段。当该字段存在时，`createOtherworldCharacter` 方法应使用 `combatStats` 中的值覆盖公式计算的结果。

```typescript
// 在 ConfigTypes.ts 中添加
export interface CombatStatsOverride {
  attack?: number;
  defense?: number;
  moveSpeed?: number;
  dodgeRate?: number;
  critRate?: number;
  critDamage?: number;
  resistance?: number;
  magicPower?: number;
  carryWeight?: number;
  volume?: number;
  expRate?: number;
  healthRegen?: number;
  manaRegen?: number;
  weight?: number;
}

// 在 OtherworldCharacterConfig 中添加可选字段
export interface OtherworldCharacterConfig extends CharacterConfig {
  // ... 现有字段
  combatStats?: CombatStatsOverride; // 可选的战斗属性覆盖
}
```

在 `GameUI.createOtherworldCharacter()` 中，当 `charConfig.combatStats` 存在时，用其值覆盖 `calculateSecondaryAttributes` 的计算结果：

```typescript
// 应用 combatStats 覆盖（如果存在）
if (charConfig.combatStats) {
  const cs = charConfig.combatStats;
  if (cs.attack !== undefined) npcData.attack = cs.attack;
  if (cs.defense !== undefined) npcData.defense = cs.defense;
  if (cs.moveSpeed !== undefined) npcData.moveSpeed = cs.moveSpeed;
  // ... 其他属性同理
}
```

## 数据模型

### exclusive-skills.json 新增条目

```json
{
  "id": "shouhu_zhiguang",
  "name": "守护之光",
  "description": "给所有友方角色添加护盾，自身防御越高，护盾数值越高",
  "type": "exclusive",
  "icon": "images/zhudongjineng_shouhuzhiguang.png",
  "tags": ["护盾", "群体"],
  "maxLevel": 10,
  "manaCost": 20,
  "cooldown": 8,
  "effects": [
    {
      "type": "shield_all_allies",
      "shieldAmount": {
        "base": 15,
        "defenseMultiplier": 1.0
      },
      "duration": 10000
    }
  ],
  "learnConditions": []
}
```

### otherworld-characters.json 新增条目

注意：当前系统中 maxHP 和 maxMP 是通过 `NPCSystem.calculateMaxHPMP()` 从基础属性计算的，战斗属性通过 `calculateSecondaryAttributes()` 计算。扎古角色需要自定义值（maxHealth=200, attack=5, defense=10 等），因此需要 `combatStats` 覆盖机制。同时 `initialState.maxHealth` 和 `initialState.maxMana` 也需要在 `createOtherworldCharacter` 中作为覆盖值使用（当与计算值不同时）。

```json
{
  "id": "zhagu",
  "name": "扎古",
  "title": "异界守卫",
  "characterTypes": ["异界", "冒险者"],
  "portrait": "images/touxiang_yijie_zhagu.png",
  "rarity": 2,
  "isSpecial": true,
  "initialState": {
    "level": 1,
    "maxHealth": 200,
    "maxMana": 100,
    "currentMana": 0,
    "maxHunger": 100,
    "currentHunger": 0
  },
  "baseAttributes": {
    "strength": 6,
    "agility": 2,
    "wisdom": 6,
    "technique": 6
  },
  "combatStats": {
    "attack": 5,
    "defense": 10,
    "moveSpeed": 21,
    "dodgeRate": 0,
    "critRate": 0,
    "critDamage": 150,
    "resistance": 10,
    "magicPower": 0,
    "carryWeight": 60,
    "volume": 100,
    "expRate": 100,
    "healthRegen": 1,
    "manaRegen": 0,
    "weight": 65
  },
  "startingJob": "warrior",
  "availableJobs": ["warrior"],
  "initialSkills": {
    "passive": [],
    "active": ["shouhu_zhiguang"]
  },
  "description": "来自异界的守卫战士，擅长使用护盾保护队友。"
}
```


## 正确性属性

*正确性属性是关于系统应该具备的特征或行为的形式化陈述，这些陈述应该在所有有效执行中保持为真。属性是人类可读规范和机器可验证正确性保证之间的桥梁。*

属性 1: 守护之光覆盖所有友方角色
*对于任意*战斗场景配置（包含任意数量的友方角色和敌方角色），当施法者施放守护之光时，所有存活的友方角色（包含施法者自身）的 `currentShield` 值应该增加，且不存在任何存活的友方角色未获得护盾。
**验证需求: 2.1**

属性 2: 护盾数值公式正确性
*对于任意*非负整数防御力值 `defense`，守护之光产生的护盾数值应该等于 `15 + defense * 1`。即护盾数值与施法者防御力呈线性关系，基础值为15，防御力系数为1。
**验证需求: 2.2**

## 错误处理

### 技能施放错误

1. **无友方角色存活**: 当场景中没有存活的友方角色时，技能效果不执行任何操作，不产生错误
2. **施法者已死亡**: BattleSystem 现有逻辑已处理死亡角色不能施放技能的情况
3. **效果配置缺失**: 如果 `shieldAmount` 配置缺失，使用默认值（base: 15, defenseMultiplier: 1.0）

### 数据加载错误

1. **技能ID引用错误**: 如果扎古引用的 `shouhu_zhiguang` 技能不存在，ConfigValidator 的引用完整性验证会报告错误
2. **数据格式错误**: JSON 解析错误由现有的 DataLoader 错误处理机制捕获

## 测试策略

### 单元测试

单元测试用于验证特定的数据内容和边缘情况：

1. **守护之光技能数据验证**
   - 验证 `exclusive-skills.json` 中包含 `shouhu_zhiguang` 技能
   - 验证技能的所有字段值正确（名称、类型、图标、标签、描述）
   - 验证效果配置正确（类型为 `shield_all_allies`，基础值15，防御力系数1.0）

2. **扎古角色数据验证**
   - 验证 `otherworld-characters.json` 中包含 `zhagu` 角色
   - 验证角色的所有字段值正确（名称、类型标签、头像、属性、职业、技能）
   - 验证战斗属性正确（攻击力5、防御力10、移动速度21等）

3. **边缘情况测试**
   - 施法者防御力为0时，护盾数值应为15
   - 场景中只有施法者一人时，只有施法者获得护盾

### 属性测试

属性测试用于验证通用规则，每个测试运行至少100次迭代：

1. **护盾覆盖属性测试**
   - 生成随机数量的友方和敌方角色
   - 施放守护之光后验证所有友方角色都获得了护盾
   - 标签: **Feature: guardian-light-zhagu-character, Property 1: 守护之光覆盖所有友方角色**

2. **护盾公式属性测试**
   - 生成随机的防御力值
   - 验证护盾数值 = 15 + defense * 1
   - 标签: **Feature: guardian-light-zhagu-character, Property 2: 护盾数值公式正确性**

### 测试库配置

- 使用 fast-check 作为 TypeScript 的属性测试库
- 每个属性测试配置为运行100次迭代
- 使用 vitest 作为测试运行器
