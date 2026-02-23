# 实施计划：主动技能投射物系统

## 概述

基于现有的 BattleSystem 和技能数据架构，添加旋风飞斧和能量箭矢两个主动技能及其技能书物品。实现环绕投射物的多投射物生成、自转、拖尾效果，以及线性投射物的反弹和伤害递增机制。

## 任务

- [x] 1. 添加技能和物品数据
  - [x] 1.1 在 `src/game/data/active-skills.json` 中添加旋风飞斧（whirlwind_axe）和能量箭矢（energy_arrow）技能数据
    - 旋风飞斧：spawn_orbit 效果，count:3, hitOnce:true, selfSpin:true, hasTrail:true, trailColor:"red", damage.base:5, damage.attackMultiplier:0.5, lifetime:6000, image:"images/texiao_futou.png"
    - 能量箭矢：spawn_projectile 效果，randomDirection:true, destroyOnHit:true, bounce:true, bounceDamageIncrease:5, hasTrail:true, trailColor:"blue", speed.base:600, damage.base:5, damage.attackMultiplier:1.0, lifetime:6000, image:"images/toushewu_jianshi.png"
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 1.2 在 `src/game/data/items.json` 中添加两个技能书物品条目
    - skill_book_whirlwind_axe：type:"consumable", subTypes:["skill_book"], rarity:0, baseValue:1000, skillId:"whirlwind_axe", icon:"images/wupin_jinengshu.png"
    - skill_book_energy_arrow：type:"consumable", subTypes:["skill_book"], rarity:0, baseValue:1000, skillId:"energy_arrow", icon:"images/wupin_jinengshu.png"
    - 为两本技能书设计描述文本
    - _Requirements: 5.1, 5.2_

  - [x] 1.3 在 `src/game/data/item-prefabs.json` 中添加两个技能书物品预制体条目
    - 格式参照现有的 skill_book_heavy_punch 条目，type:"book", subType:"skill_book"
    - _Requirements: 5.1, 5.2_

- [x] 2. 扩展环绕投射物机制（旋风飞斧）
  - [x] 2.1 修改 `BattleSystem.applySpawnOrbitEffect` 支持 `effect.count` 参数，循环生成多个环绕投射物
    - 读取 effect.count（默认为 1），循环调用 createOrbitProjectile
    - 传递 angleOffset 参数，每个投射物的初始角度偏移为 `i * (2π / count)`
    - _Requirements: 2.1_

  - [x] 2.2 修改 `BattleSystem.createOrbitProjectile` 接受 angleOffset 参数
    - 在计算 orbital 初始位置时应用 angleOffset
    - 在碰撞检测的角度计算中也应用 angleOffset
    - _Requirements: 2.1_

  - [x] 2.3 在 `BattleSystem.createOrbitProjectile` 中添加自转支持
    - 当 effect.selfSpin === true 时，为 orbital 元素添加独立的 CSS 旋转动画
    - 使用 effect.selfSpinSpeed 控制自转速度
    - 注入 orbit-self-spin CSS keyframes（如果尚未存在）
    - _Requirements: 2.2, 6.1_

  - [x] 2.4 在 `BattleSystem.createOrbitProjectile` 中添加拖尾效果支持
    - 当 effect.hasTrail === true 时，在 animateOrbit 循环中定期生成拖尾粒子
    - 拖尾颜色由 effect.trailColor 决定，支持 "red" 颜色
    - 复用现有 createProjectile 中的拖尾粒子生成逻辑
    - _Requirements: 2.3, 6.2_

- [x] 3. 扩展线性投射物机制（能量箭矢）
  - [x] 3.1 在 `BattleSystem.applySpawnProjectileEffect` 中添加 `randomDirection` 方向支持
    - 当 effect.randomDirection === true 时，生成随机方向向量
    - _Requirements: 4.1_

  - [x] 3.2 在 `BattleSystem.createProjectile` 中实现反弹机制
    - 当 effect.bounce === true 且投射物碰到场景边缘时：
      - 将投射物位置限制在边界内
      - 生成新的随机方向向量
      - 增加伤害：damage += effect.bounceDamageIncrease
      - 清空 hitTargets Set
      - 更新投射物旋转角度以匹配新方向
    - 替换现有的出界销毁逻辑（仅当 bounce 为 false 时销毁）
    - _Requirements: 4.2, 4.3, 7.1, 7.2, 7.3_

  - [x] 3.3 在 `BattleSystem.createProjectile` 的拖尾效果中添加蓝色（blue）颜色支持
    - 在 createTrail 函数中添加 isBlueTrail 分支
    - 配置蓝色系的 RGB 渐变值
    - _Requirements: 4.5_

- [x] 4. 检查点 - 确保所有功能正常工作
  - 确保所有测试通过，如有问题请询问用户。

- [ ]* 5. 属性测试
  - [ ]* 5.1 编写伤害计算公式的属性测试
    - **Property 1: 伤害计算公式正确性**
    - **Validates: Requirements 1.4, 3.4**

  - [ ]* 5.2 编写反弹伤害递增的属性测试
    - **Property 2: 反弹伤害递增**
    - **Validates: Requirements 4.3, 7.2**

  - [ ]* 5.3 编写反弹后投射物存活的属性测试
    - **Property 3: 反弹后投射物存活**
    - **Validates: Requirements 7.1**

  - [ ]* 5.4 编写反弹后命中列表重置的属性测试
    - **Property 4: 反弹后命中列表重置**
    - **Validates: Requirements 7.3**

  - [ ]* 5.5 编写技能书使用学习技能的属性测试
    - **Property 5: 技能书使用学习技能**
    - **Validates: Requirements 5.3, 5.4**

- [x] 6. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点确保增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
