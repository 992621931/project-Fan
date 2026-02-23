# Implementation Plan: Passive Skills Expansion

## Overview

本实现计划将在现有游戏系统中添加12个新的被动技能。实现分为5个阶段：数据添加、基础效果支持、条件效果支持、碰撞效果支持和伤害修正支持。每个阶段都包含相应的测试任务，确保功能的正确性和稳定性。

## Tasks

- [x] 1. 添加技能数据到skills.json
  - 在src/game/data/skills.json中添加12个新技能的完整数据
  - 包含所有必需字段：id, name, description, type, maxLevel, manaCost, cooldown, icon, effects, learnConditions
  - 确保所有技能的type为"passive"，manaCost为0，cooldown为0
  - _Requirements: 1.1, 1.3, 1.5, 2.1, 3.1, 4.1, 5.1, 5.4, 6.1, 7.1, 7.5, 8.1, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1_

- [ ]* 1.1 编写技能数据结构验证测试
  - 创建单元测试验证所有12个新技能存在于skills.json
  - 验证每个技能包含所有必需字段
  - 验证技能ID的唯一性
  - **Property 1: 所有新技能存在于数据文件中**
  - **Property 2: 技能数据结构完整性**
  - **Property 3: 技能ID唯一性**
  - **Validates: Requirements 1.1, 1.3, 1.5, 2.1, 3.1, 4.1, 5.1, 5.4, 6.1, 7.1, 7.5, 8.1, 9.1, 9.2, 9.3, 9.4, 9.5, 13.1**

- [ ]* 1.2 编写技能数据格式属性测试
  - 使用fast-check生成随机技能索引
  - 验证效果对象结构完整性
  - 验证永久效果的duration为-1
  - 验证图标路径格式
  - 验证描述包含数值信息
  - **Property 11: 效果对象结构完整性**
  - **Property 12: 永久效果持续时间标记**
  - **Property 13: 图标路径格式正确**
  - **Property 14: 描述包含数值信息**
  - **Validates: Requirements 9.6, 9.7, 10.2, 11.2**

- [ ] 2. 实现基础永久属性加成技能
  - [x] 2.1 验证SkillSystem支持attribute_bonus效果类型
    - 检查SkillSystem.applyPassiveSkillEffect方法
    - 确保能够处理attribute_bonus类型的效果
    - 如果不支持，扩展该方法以支持
    - _Requirements: 12.1_

  - [x] 2.2 实现瞄准弱点、残忍至极、奥术至尊技能效果
    - 确保SkillSystem能够正确应用critRate、critDamage、magicPower属性加成
    - 测试技能学习后属性值的变化
    - _Requirements: 1.2, 1.4, 2.2_

  - [x] 2.3 实现泰坦血脉、搬运者技能效果
    - 确保SkillSystem能够正确应用bodySize、bodyWeight、carryingCapacity属性加成
    - 实现百分比修正效果（搬运者的移速-30%）
    - _Requirements: 5.2, 5.3, 5.5, 5.6_

  - [x] 2.4 实现胃炎技能效果
    - 确保SkillSystem能够正确应用maxHealth减少和satietyConsumptionRate减少
    - 处理负数属性值的边界情况
    - _Requirements: 8.2, 8.3_

  - [ ]* 2.5 编写永久属性加成属性测试
    - 使用fast-check生成随机角色和随机永久属性加成技能
    - 验证学习技能后属性值正确变化
    - 测试至少100次迭代
    - **Property 4: 永久属性加成正确应用**
    - **Validates: Requirements 1.2, 1.4, 2.2, 5.2, 5.3, 5.5, 5.6, 8.2, 8.3**

- [x] 3. Checkpoint - 确保基础技能测试通过
  - 运行所有单元测试和属性测试
  - 确保所有测试通过，如有问题请询问用户

- [ ] 4. 实现时间依赖型条件技能
  - [x] 4.1 扩展技能效果数据结构支持条件
    - 在SkillEffect接口中添加可选的condition字段
    - 定义TimeCondition类型（type: 'time_of_day', value: 'day' | 'night'）
    - _Requirements: 12.2_

  - [x] 4.2 实现conditional_bonus效果类型处理
    - 在SkillSystem中添加updateConditionalPassiveSkills方法
    - 监听TimeSystem的时间变化事件
    - 根据当前时间状态应用或移除条件加成
    - _Requirements: 12.2_

  - [x] 4.3 实现月之祝福技能效果
    - 在夜晚时增加攻击力15%和防御力10
    - 在白天时移除这些加成
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 4.4 实现光合作用技能效果
    - 在白天时增加生命恢复+1和魔法恢复+1
    - 在夜晚时移除这些加成
    - _Requirements: 7.6, 7.7, 7.8_

  - [ ]* 4.5 编写时间条件效果属性测试
    - 使用fast-check生成随机角色和随机时间状态
    - 验证月之祝福在夜晚生效，白天失效
    - 验证光合作用在白天生效，夜晚失效
    - 测试至少100次迭代
    - **Property 9: 月之祝福夜晚效果**
    - **Property 10: 光合作用白天效果**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.6, 7.7, 7.8**

- [x] 5. Checkpoint - 确保条件技能测试通过
  - 运行所有单元测试和属性测试
  - 确保时间依赖技能正确工作，如有问题请询问用户

- [ ] 6. 实现碰撞触发效果技能
  - [~] 6.1 扩展CombatSystem支持碰撞事件
    - 在CombatSystem中添加handleCollisionDamage方法
    - 在造成碰撞伤害后触发碰撞事件
    - 将事件传递给SkillSystem处理
    - _Requirements: 12.3_

  - [~] 6.2 实现on_collision_heal效果类型
    - 在SkillSystem中添加handleCollisionEffects方法
    - 检查攻击者是否拥有饮血技能
    - 计算治疗量为伤害的10%
    - 立即应用治疗效果
    - _Requirements: 6.2, 6.3, 6.4_

  - [~] 6.3 实现on_collision_gold效果类型
    - 检查攻击者是否拥有麦达斯之触技能
    - 生成1到3之间的随机金币数量
    - 将金币添加到角色的货币组件
    - _Requirements: 4.2, 4.3_

  - [ ]* 6.4 编写碰撞触发效果属性测试
    - 使用fast-check生成随机角色和随机碰撞伤害
    - 验证饮血效果正确应用（治疗量=伤害*10%）
    - 验证麦达斯之触效果正确应用（金币在1-3范围内）
    - 测试至少100次迭代
    - **Property 7: 饮血效果正确应用**
    - **Property 8: 麦达斯之触金币奖励**
    - **Validates: Requirements 4.2, 4.3, 6.2, 6.3, 6.4**

- [~] 7. Checkpoint - 确保碰撞技能测试通过
  - 运行所有单元测试和属性测试
  - 确保碰撞触发技能正确工作，如有问题请询问用户

- [ ] 8. 实现伤害修正型技能
  - [~] 8.1 扩展CombatSystem支持目标类型识别
    - 添加getTargetType方法识别目标是普通敌人、BOSS还是资源点
    - 可以通过组件标签或特定组件来识别目标类型
    - _Requirements: 12.4_

  - [~] 8.2 实现damage_modifier效果类型
    - 在SkillSystem中添加getDamageModifier方法
    - 根据目标类型和角色技能返回伤害修正倍率
    - _Requirements: 12.4_

  - [~] 8.3 集成伤害修正到伤害计算
    - 在CombatSystem的伤害计算中调用getDamageModifier
    - 将基础伤害乘以修正倍率
    - _Requirements: 1.6, 3.2_

  - [~] 8.4 实现挑战者技能效果
    - 对BOSS敌人造成的伤害增加15%
    - _Requirements: 1.6_

  - [~] 8.5 实现自然学技能效果
    - 对资源点造成的伤害增加100%
    - _Requirements: 3.2_

  - [ ]* 8.6 编写伤害修正属性测试
    - 使用fast-check生成随机角色、随机基础伤害、随机目标类型
    - 验证拥有挑战者技能时对BOSS伤害为基础伤害的115%
    - 验证拥有自然学技能时对资源点伤害为基础伤害的200%
    - 测试至少100次迭代
    - **Property 5: BOSS伤害加成正确计算**
    - **Property 6: 资源点伤害加成正确计算**
    - **Validates: Requirements 1.6, 3.2**

- [~] 9. Checkpoint - 确保伤害修正技能测试通过
  - 运行所有单元测试和属性测试
  - 确保伤害修正技能正确工作，如有问题请询问用户

- [ ] 10. 最终集成和验证
  - [~] 10.1 运行完整的测试套件
    - 运行所有单元测试（npm run test:unit）
    - 运行所有属性测试（npm run test:property）
    - 确保测试覆盖率达到目标
    - _Requirements: All_

  - [ ]* 10.2 编写系统效果类型支持验证测试
    - 验证SkillSystem支持所有新增的效果类型
    - 测试每种效果类型都能被正确处理
    - **Property 15: 系统支持所需效果类型**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**

  - [~] 10.3 手动测试游戏中的技能效果
    - 在游戏中学习每个新技能
    - 验证技能效果在实际游戏中正确显示和应用
    - 测试昼夜切换时条件技能的表现
    - 测试战斗中碰撞触发技能的表现

- [~] 11. Final Checkpoint - 确保所有测试通过
  - 确保所有测试通过，代码质量符合标准
  - 如有任何问题或疑问，请询问用户

## Notes

- 任务标记为 `*` 的是可选测试任务，可以跳过以加快MVP开发
- 每个任务都引用了具体的需求编号，便于追溯
- Checkpoint任务确保增量验证，及早发现问题
- 属性测试使用fast-check库，每个测试至少100次迭代
- 单元测试验证具体实现细节和边界情况
- 所有新技能数据已在设计文档中详细定义
- 实现过程中如遇到现有系统不支持的功能，需要扩展相应系统
