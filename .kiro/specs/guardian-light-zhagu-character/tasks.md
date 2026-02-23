# 实施计划: 守护之光技能与扎古角色

## 概述

本实施计划为游戏添加守护之光专属技能和扎古异界角色。实施顺序：先添加数据（JSON），再扩展类型定义以支持 combatStats 覆盖，然后更新角色创建逻辑，接着实现 BattleSystem 中的 shield_all_allies 效果，最后编写测试。

## 任务

- [x] 1. 添加守护之光技能数据
  - [x] 1.1 在 `src/game/data/exclusive-skills.json` 的 `exclusiveSkills` 数组中添加守护之光技能条目
    - id: "shouhu_zhiguang"
    - name: "守护之光"
    - type: "exclusive"
    - icon: "images/zhudongjineng_shouhuzhiguang.png"
    - tags: ["护盾", "群体"]
    - description: "给所有友方角色添加护盾，自身防御越高，护盾数值越高"
    - effects 中配置 type: "shield_all_allies"，shieldAmount.base: 15，shieldAmount.defenseMultiplier: 1.0，duration: 10000
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.1, 4.2, 4.3, 4.4_

- [x] 2. 添加扎古角色数据并扩展类型支持
  - [x] 2.1 在 `src/game/config/ConfigTypes.ts` 中添加 `CombatStatsOverride` 接口，并在 `OtherworldCharacterConfig` 中添加可选的 `combatStats?: CombatStatsOverride` 字段
    - CombatStatsOverride 包含所有可覆盖的战斗属性（attack, defense, moveSpeed, dodgeRate, critRate, critDamage, resistance, magicPower, carryWeight, volume, expRate, healthRegen, manaRegen, weight），均为可选
    - _需求: 3.9_

  - [x] 2.2 在 `src/game/data/otherworld-characters.json` 的 `otherworldCharacters` 数组中添加扎古角色条目
    - id: "zhagu", name: "扎古", title: "异界守卫"
    - characterTypes: ["异界", "冒险者"]
    - portrait: "images/touxiang_yijie_zhagu.png"
    - rarity: 2, isSpecial: true
    - initialState: level 1, maxHealth 200, maxMana 100, currentMana 0, maxHunger 100, currentHunger 0
    - baseAttributes: strength 6, agility 2, wisdom 6, technique 6
    - combatStats: attack 5, defense 10, moveSpeed 21, dodgeRate 0, critRate 0, critDamage 150, resistance 10, magicPower 0, carryWeight 60, volume 100, expRate 100, healthRegen 1, manaRegen 0, weight 65
    - startingJob: "warrior", availableJobs: ["warrior"]
    - initialSkills: passive [], active ["shouhu_zhiguang"]
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x] 2.3 更新 `src/ui/GameUI.ts` 的 `createOtherworldCharacter` 方法，支持 combatStats 覆盖
    - 在创建 npcData 后，检查 `charConfig.combatStats` 是否存在
    - 如果存在，用 combatStats 中的值覆盖 calculateSecondaryAttributes 计算的结果
    - 同时支持 `initialState.maxHealth` 覆盖计算的 maxHP（当 initialState.maxHealth 与计算值不同时使用配置值）
    - _需求: 3.5, 3.9_

- [x] 3. 实现 shield_all_allies 效果
  - [x] 3.1 在 `src/game/systems/BattleSystem.ts` 的 `applySkillEffect` 方法的 switch 语句中添加 `case 'shield_all_allies'`，调用新方法 `applyShieldAllAlliesEffect`
    - _需求: 4.5_

  - [x] 3.2 在 `src/game/systems/BattleSystem.ts` 中实现 `applyShieldAllAlliesEffect(caster, effect)` 方法
    - 遍历所有 sprites，筛选出与施法者同阵营的存活角色（包含施法者自身）
    - 计算护盾值：base + caster.character.defense * defenseMultiplier（默认 15 + defense * 1）
    - 为每个友方角色设置 currentShield（累加到现有护盾上）
    - 调用 showShieldVisualEffect 显示护盾特效
    - 调用 showBuffNotification 显示护盾数值通知
    - 使用 setTimeout 设置护盾生命周期（与现有 shield_ally 机制一致）
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 4. 检查点 - 确保编译通过和基本功能正常
  - 确保所有代码编译通过，没有 TypeScript 错误
  - 确保 JSON 数据文件格式正确
  - 询问用户是否有任何问题

- [x] 5. 编写测试
  - [x] 5.1 编写守护之光技能数据单元测试
    - 验证 exclusive-skills.json 中包含 shouhu_zhiguang 技能
    - 验证技能所有字段值正确（名称、类型、图标、标签、描述、效果配置）
    - _需求: 1.1-1.7, 4.1-4.4_

  - [x] 5.2 编写扎古角色数据单元测试
    - 验证 otherworld-characters.json 中包含 zhagu 角色
    - 验证角色所有字段值正确（名称、类型标签、头像、属性、职业、技能、战斗属性）
    - _需求: 3.1-3.9_

  - [x] 5.3 编写护盾公式属性测试
    - 使用 fast-check 生成随机防御力值
    - 验证护盾数值 = 15 + defense * 1
    - 配置100次迭代
    - **属性 2: 护盾数值公式正确性**
    - **验证需求: 2.2**

  - [x] 5.4 编写护盾覆盖属性测试
    - 使用 fast-check 生成随机数量的友方和敌方角色
    - 施放守护之光后验证所有友方角色都获得了护盾
    - 配置100次迭代
    - **属性 1: 守护之光覆盖所有友方角色**
    - **验证需求: 2.1**

- [x] 6. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，没有 TypeScript 类型错误
  - 询问用户是否有任何问题

## 注意事项

- 标记为 `*` 的任务是可选的，可以跳过以加快开发
- 守护之光的护盾机制复用现有的 shield_ally 模式（currentShield、视觉特效、生命周期），区别在于目标是所有友方角色而非单个随机友方
- combatStats 覆盖机制是向后兼容的：现有的 Allenes 和 Coki 角色没有 combatStats 字段，行为不变
