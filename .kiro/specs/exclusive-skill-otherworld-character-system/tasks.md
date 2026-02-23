# 实施计划: 专属技能和异界角色系统

## 概述

本实施计划将为游戏添加专属技能库和异界角色库的数据存储功能。实施将按照以下顺序进行：首先扩展TypeScript类型定义，然后创建JSON数据文件，接着更新DataLoader和ConfigManager以支持新的数据类型，最后添加验证逻辑和测试。

## 任务

- [x] 1. 扩展TypeScript类型定义
  - 在 `src/game/config/ConfigTypes.ts` 中添加新的接口定义
  - 定义 `ProjectileConfig`、`ProjectileDirection`、`DamageFormulaConfig`、`ParticleEffectConfig` 接口
  - 定义 `ExclusiveSkillConfig` 接口（扩展 `SkillConfig`）
  - 定义 `InitialStateConfig`、`InitialSkillsConfig` 接口
  - 定义 `OtherworldCharacterConfig` 接口（扩展 `CharacterConfig`）
  - 更新 `GameConfig` 接口，添加 `exclusiveSkills` 和 `otherworldCharacters` 字段
  - _需求: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

- [x] 2. 创建专属技能数据文件
  - [x] 2.1 创建 `src/game/data/exclusive-skills.json` 文件
    - 创建JSON文件结构，包含 `exclusiveSkills` 数组
    - _需求: 1.1_
  
  - [x] 2.2 添加"伏魔斩"技能数据
    - 配置技能基本属性（id: "fumo_zhan", name: "伏魔斩", type: "exclusive"）
    - 配置图标路径: "images/zhudongjineng_fumozhan"
    - 配置技能标签: ["持续", "游侠", "舞者"]
    - 配置技能描述: "每次和敌人碰撞后会闪烁到安全的位置"
    - 配置投射物属性（图片、速度400、生命周期1.5秒、左右两个方向）
    - 配置伤害公式（基础伤害10、攻击力加成125%）
    - 配置粒子特效（暗红色爆炸、命中时触发、目标位置）
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12_

- [x] 3. 创建异界角色数据文件
  - [x] 3.1 创建 `src/game/data/otherworld-characters.json` 文件
    - 创建JSON文件结构，包含 `otherworldCharacters` 数组
    - _需求: 2.1_
  
  - [x] 3.2 添加"Allenes"角色数据
    - 配置角色基本信息（id: "allenes", name: "Allenes", title: "异界旅者"）
    - 配置角色类型标签: ["异界", "冒险者"]
    - 配置头像路径: "images/touxiang_yijie_Allenes"
    - 配置初始状态（等级1、生命值100、魔法值100、饱腹度100）
    - 配置基础属性（力量10、敏捷5、智慧3、技巧2）
    - 配置初始职业: "warrior"
    - 配置初始技能（被动技能: [], 主动技能: ["fumo_zhan"]）
    - 配置稀有度和特殊标记
    - _需求: 5.13, 5.14, 5.15, 5.16, 5.17, 5.18, 5.19, 5.20, 5.21, 5.22, 5.23, 5.24, 5.25, 5.26, 5.27_

- [x] 4. 更新ConfigManager以支持新数据类型
  - 在 `src/game/config/ConfigManager.ts` 中添加存储新配置的私有字段
  - 添加 `getExclusiveSkills()` 方法返回专属技能列表
  - 添加 `getOtherworldCharacters()` 方法返回异界角色列表
  - 添加 `getExclusiveSkillById(id: string)` 方法
  - 添加 `getOtherworldCharacterById(id: string)` 方法
  - 更新 `getStats()` 方法，包含专属技能和异界角色的数量统计
  - 更新 `initialize()` 方法，接收并存储新的配置数据
  - _需求: 3.4, 3.5, 3.7_

- [x] 5. 更新DataLoader以加载新数据文件
  - [x] 5.1 更新 `loadGameData()` 方法
    - 添加加载 `exclusive-skills.json` 的逻辑
    - 添加加载 `otherworld-characters.json` 的逻辑
    - 将加载的数据传递给ConfigManager
    - _需求: 3.1, 3.2_
  
  - [x] 5.2 添加错误处理逻辑
    - 捕获文件加载错误并记录详细的错误信息
    - 捕获JSON解析错误并提供有意义的错误消息
    - 对于缺失的文件，使用空数组作为默认值并记录警告
    - _需求: 3.3_
  
  - [x] 5.3 更新 `getEmbeddedConfig()` 方法
    - 在嵌入式配置中添加空的 `exclusiveSkills` 和 `otherworldCharacters` 数组
    - _需求: 3.1, 3.2_

- [x] 6. 实现数据验证逻辑
  - [x] 6.1 创建验证辅助函数
    - 创建 `src/game/config/ConfigValidator.ts` 文件
    - 实现 `validateExclusiveSkill(skill: any): ValidationError[]` 函数
    - 实现 `validateOtherworldCharacter(character: any): ValidationError[]` 函数
    - 实现 `validateProjectileConfig(projectile: any, path: string): ValidationError[]` 函数
    - 实现 `validateDamageFormula(formula: any, path: string): ValidationError[]` 函数
    - 实现 `validateInitialState(state: any, path: string): ValidationError[]` 函数
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 6.2 实现引用完整性验证
    - 实现 `validateSkillReferences(character: OtherworldCharacterConfig, allSkills: SkillConfig[]): ValidationError[]` 函数
    - 实现 `validateJobReference(character: OtherworldCharacterConfig, allJobs: JobConfig[]): ValidationError[]` 函数
    - _需求: 4.6, 4.7_
  
  - [x] 6.3 集成验证到ConfigManager
    - 在ConfigManager的 `initialize()` 方法中调用验证函数
    - 收集所有验证错误并在有错误时抛出异常
    - 确保错误消息包含字段路径和具体错误原因
    - _需求: 4.8_

- [x] 7. 检查点 - 确保基本功能正常
  - 确保所有代码编译通过，没有TypeScript错误
  - 确保数据文件可以被正确加载
  - 询问用户是否有任何问题

- [x] 8. 编写单元测试
  - [x] 8.1 测试数据文件存在性
    - 编写测试验证 `exclusive-skills.json` 文件存在
    - 编写测试验证 `otherworld-characters.json` 文件存在
    - _需求: 1.1, 2.1_
  
  - [x] 8.2 测试特定内容
    - 编写测试验证"伏魔斩"技能的所有配置正确
    - 编写测试验证"Allenes"角色的所有配置正确
    - _需求: 5.1-5.27_
  
  - [x] 8.3 测试边缘情况
    - 编写测试处理空的技能列表
    - 编写测试处理空的角色列表
    - 编写测试处理缺少可选字段的配置
  
  - [x] 8.4 测试错误处理
    - 编写测试模拟无效的JSON格式
    - 编写测试模拟缺失的文件
    - 编写测试验证错误消息的质量
    - _需求: 3.3, 4.8_

- [x] 9. 编写属性测试
  - [x] 9.1 编写专属技能数据结构完整性属性测试
    - 使用fast-check生成随机的专属技能配置
    - 验证所有必需字段存在
    - 配置100次迭代
    - **属性 1: 专属技能数据结构完整性**
    - **验证需求: 1.2, 1.3, 1.4, 1.6, 1.7, 1.8**
  
  - [x] 9.2 编写异界角色数据结构完整性属性测试
    - 使用fast-check生成随机的异界角色配置
    - 验证所有必需字段存在
    - 配置100次迭代
    - **属性 2: 异界角色数据结构完整性**
    - **验证需求: 2.2, 2.3, 2.4, 2.5, 2.6, 2.8**
  
  - [x] 9.3 编写数据加载属性测试
    - 生成随机的配置数据
    - 验证加载后可以通过ConfigManager访问
    - 配置100次迭代
    - **属性 3: 数据文件加载**
    - **验证需求: 3.1, 3.2**
  
  - [x] 9.4 编写数据加载错误处理属性测试
    - 生成无效的JSON数据
    - 验证错误被正确捕获和记录
    - 配置100次迭代
    - **属性 4: 数据加载错误处理**
    - **验证需求: 3.3**
  
  - [x] 9.5 编写数据合并正确性属性测试
    - 生成随机的专属技能和异界角色数据
    - 验证数据被正确合并到ConfigManager
    - 配置100次迭代
    - **属性 5: 数据合并正确性**
    - **验证需求: 3.4, 3.5**
  
  - [x] 9.6 编写统计信息更新属性测试
    - 生成随机数量的配置数据
    - 验证统计信息包含正确的数量
    - 配置100次迭代
    - **属性 6: 统计信息更新**
    - **验证需求: 3.7**
  
  - [x] 9.7 编写必需字段验证属性测试
    - 生成缺少必需字段的配置
    - 验证验证失败并返回正确的错误信息
    - 配置100次迭代
    - **属性 7: 必需字段验证**
    - **验证需求: 4.1, 4.4**
  
  - [x] 9.8 编写数值范围验证属性测试
    - 生成数值超出范围的配置
    - 验证验证失败
    - 配置100次迭代
    - **属性 8: 数值范围验证**
    - **验证需求: 4.2, 4.3**
  
  - [x] 9.9 编写角色属性值验证属性测试
    - 生成无效属性值的角色配置
    - 验证验证失败
    - 配置100次迭代
    - **属性 9: 角色属性值验证**
    - **验证需求: 4.5**
  
  - [x] 9.10 编写引用完整性验证属性测试
    - 生成包含无效引用的配置
    - 验证验证失败
    - 配置100次迭代
    - **属性 10: 引用完整性验证**
    - **验证需求: 4.6, 4.7**
  
  - [x] 9.11 编写验证错误消息质量属性测试
    - 生成各种无效配置
    - 验证错误消息包含字段路径和错误原因
    - 配置100次迭代
    - **属性 11: 验证错误消息质量**
    - **验证需求: 4.8**
  
  - [x] 9.12 编写数据结构兼容性属性测试
    - 生成随机的专属技能和异界角色配置
    - 验证可以被现有系统处理
    - 配置100次迭代
    - **属性 12: 数据结构兼容性**
    - **验证需求: 1.5, 2.7**

- [x] 10. 最终检查点 - 确保所有测试通过
  - 运行所有单元测试和属性测试
  - 确保没有TypeScript类型错误
  - 确保数据可以被正确加载和验证
  - 询问用户是否有任何问题

## 注意事项

- 标记为 `*` 的任务是可选的，可以跳过以加快MVP开发
- 每个任务都引用了具体的需求以便追溯
- 检查点确保增量验证
- 属性测试验证通用的正确性属性
- 单元测试验证具体的例子和边缘情况
