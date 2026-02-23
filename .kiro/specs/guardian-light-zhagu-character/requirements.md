# 需求文档

## 简介

本功能为游戏添加一个新的专属主动技能"守护之光"和一个新的异界角色"扎古"。守护之光是一个群体护盾技能，能够为所有友方角色添加基于施法者防御力的护盾。扎古是一个高防御力的异界战士角色，初始携带守护之光技能。

## 术语表

- **System**: 指整个游戏系统
- **BattleSystem**: 战斗系统，负责处理战斗中的技能效果、伤害计算和护盾机制
- **Exclusive_Skill**: 专属技能，角色独有的特殊技能类型，存储在 `exclusive-skills.json` 中
- **Otherworld_Character**: 异界角色，来自异界的特殊角色类型，存储在 `otherworld-characters.json` 中
- **Shield**: 护盾，一种可以抵挡伤害的临时防护效果，拥有统一的生命周期管理
- **Guardian_Light**: 守护之光技能，给所有友方角色添加基于防御力的护盾
- **Zhagu**: 扎古角色，一个高防御力的异界战士

## 需求

### 需求 1: 守护之光技能数据定义

**用户故事:** 作为游戏开发者，我想要在专属技能库中添加守护之光技能数据，以便角色可以使用该群体护盾技能。

#### 验收标准

1. THE System SHALL 在 `exclusive-skills.json` 的 `exclusiveSkills` 数组中添加守护之光技能条目
2. WHEN 守护之光技能数据被定义时，THE System SHALL 设置技能ID为 "shouhu_zhiguang"
3. WHEN 守护之光技能数据被定义时，THE System SHALL 设置技能名称为 "守护之光"
4. WHEN 守护之光技能数据被定义时，THE System SHALL 设置技能类型为 "exclusive"
5. WHEN 守护之光技能数据被定义时，THE System SHALL 设置图标路径为 "images/zhudongjineng_shouhuzhiguang.png"
6. WHEN 守护之光技能数据被定义时，THE System SHALL 设置技能标签为 ["护盾", "群体"]
7. WHEN 守护之光技能数据被定义时，THE System SHALL 设置技能描述为 "给所有友方角色添加护盾，自身防御越高，护盾数值越高"

### 需求 2: 守护之光技能效果实现

**用户故事:** 作为玩家，我想要使用守护之光技能为所有友方角色添加护盾，以便在战斗中保护队友。

#### 验收标准

1. WHEN 守护之光技能被施放时，THE BattleSystem SHALL 为场景中所有存活的友方角色（包含施法者自身）添加护盾
2. WHEN 计算护盾数值时，THE BattleSystem SHALL 使用公式：护盾数值 = 15 + 施法者的防御力 * 1
3. WHEN 护盾被添加时，THE BattleSystem SHALL 为每个受到护盾保护的角色显示护盾视觉特效
4. WHEN 护盾被添加时，THE BattleSystem SHALL 为每个受到护盾保护的角色显示护盾数值通知
5. WHEN 护盾生命周期结束时，THE BattleSystem SHALL 移除护盾数值并清除护盾视觉特效
6. THE BattleSystem SHALL 确保守护之光的护盾与其他护盾（如庇护技能的护盾）使用统一的生命周期管理机制

### 需求 3: 扎古角色数据定义

**用户故事:** 作为游戏开发者，我想要在异界角色库中添加扎古角色数据，以便玩家可以招募和使用该角色。

#### 验收标准

1. THE System SHALL 在 `otherworld-characters.json` 的 `otherworldCharacters` 数组中添加扎古角色条目
2. WHEN 扎古角色数据被定义时，THE System SHALL 设置角色名为 "扎古"
3. WHEN 扎古角色数据被定义时，THE System SHALL 设置角色类型标签为 ["异界", "冒险者"]
4. WHEN 扎古角色数据被定义时，THE System SHALL 设置头像路径为 "images/touxiang_yijie_zhagu.png"
5. WHEN 扎古角色数据被定义时，THE System SHALL 设置初始等级为1，最大生命值为200，最大魔法值为100，初始当前魔法值为0，最大饱腹度为100，初始当前饱腹度为0
6. WHEN 扎古角色数据被定义时，THE System SHALL 设置基础属性为：力量6、敏捷2、智慧6、技巧6
7. WHEN 扎古角色数据被定义时，THE System SHALL 设置初始职业为 "warrior"（战士）
8. WHEN 扎古角色数据被定义时，THE System SHALL 设置初始被动技能为空列表，初始主动技能为 ["shouhu_zhiguang"]
9. WHEN 扎古角色数据被定义时，THE System SHALL 设置战斗属性为：攻击力5、防御力10、移动速度21、闪避率0、暴击率0、暴伤150、抗性10、魔法强度0、负重60、体积100、经验率100、回血1、回魔0、体重65

### 需求 4: 守护之光技能效果数据配置

**用户故事:** 作为游戏开发者，我想要在守护之光技能数据中配置正确的效果参数，以便 BattleSystem 可以正确解析和执行技能效果。

#### 验收标准

1. WHEN 守护之光技能效果被配置时，THE System SHALL 设置效果类型为 "shield_all_allies"
2. WHEN 守护之光技能效果被配置时，THE System SHALL 设置护盾基础值为15
3. WHEN 守护之光技能效果被配置时，THE System SHALL 设置防御力加成系数为1.0
4. WHEN 守护之光技能效果被配置时，THE System SHALL 配置护盾持续时间与现有护盾机制一致
5. THE System SHALL 确保效果配置结构与 BattleSystem 的技能效果处理逻辑兼容
