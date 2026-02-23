# 实施计划：冒险者和异界角色饱腹度奖励

## 概述

在角色招募系统中添加饱腹度奖励机制。当生成新的冒险者或异界角色时，为其当前饱腹度增加30~50的随机值。这是一个非常简单的改动，只需要在一个方法中添加2行代码。

## 任务

- [x] 1. 在 CharacterRecruitmentSystem 中添加饱腹度奖励逻辑
  - [x] 1.1 修改 generateCharacter 方法添加饱腹度奖励
    - 在创建 HungerComponent 之后，添加组件之前插入代码
    - 生成 30~50 的随机整数作为饱腹度奖励
    - 将奖励值添加到 hunger.current
    - 使用 Math.min 确保不超过 maximum
    - _需求：1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 4.2, 4.3_

  - [x] 1.2 添加代码注释说明饱腹度奖励逻辑
    - 注释说明这是为冒险者和异界角色添加的初始饱腹度
    - 注释说明随机范围是 30~50
    - 引用相关需求编号
    - _需求：4.1_

- [-] 2. 编写单元测试验证饱腹度奖励
  - [x] 2.1 测试饱腹度奖励范围
    - 生成 100 个冒险者角色
    - 验证每个角色的 hunger.current 在 [30, 50] 范围内
    - _需求：1.1, 2.1, 3.2_

  - [ ] 2.2 测试饱腹度不超过最大值
    - 生成多个角色
    - 验证所有角色的 hunger.current <= hunger.maximum
    - _需求：1.3, 2.3, 4.2_

  - [ ] 2.3 测试最大饱腹度不变
    - 生成多个角色
    - 验证所有角色的 hunger.maximum === 100
    - _需求：1.4, 2.4, 4.3_

  - [ ] 2.4 测试饱腹度奖励的随机性
    - 生成 50 个角色
    - 收集所有的 hunger.current 值
    - 验证至少有 3 个不同的值（证明有随机性）
    - _需求：3.1, 3.3_

- [x] 3. 编写属性测试验证正确性属性
  - [x] 3.1 编写属性测试：饱腹度奖励范围
    - **Property 1: 饱腹度奖励范围**
    - **Validates: Requirements 1.1, 2.1, 3.2**
    - 使用 fast-check 生成多个角色
    - 验证每个角色的饱腹度奖励在 [30, 50] 范围内

  - [x] 3.2 编写属性测试：当前饱腹度不超过最大值
    - **Property 2: 当前饱腹度不超过最大值**
    - **Validates: Requirements 1.3, 2.3, 4.2**
    - 验证 current <= maximum 恒成立

  - [x] 3.3 编写属性测试：最大饱腹度不变
    - **Property 3: 最大饱腹度不变**
    - **Validates: Requirements 1.4, 2.4, 4.3**
    - 验证 maximum 始终为 100

  - [x] 3.4 编写属性测试：饱腹度奖励独立性
    - **Property 4: 饱腹度奖励独立性**
    - **Validates: Requirements 3.1, 3.3**
    - 生成多个角色，验证奖励值的独立性和随机分布

- [x] 4. 集成测试验证完整流程
  - [x] 4.1 测试金币招募冒险者
    - 使用 recruitWithGold 招募角色
    - 验证新角色的饱腹度在 [30, 50] 范围内
    - _需求：1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 4.2 测试特殊道具招募异界角色
    - 使用 recruitWithItem 招募异界角色
    - 验证新角色的饱腹度在 [30, 50] 范围内
    - _需求：2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.3 测试存档和读档
    - 招募一个角色并记录其饱腹度
    - 保存游戏
    - 读取存档
    - 验证角色的饱腹度值保持不变
    - _需求：6.1, 6.2, 6.3, 6.4_

- [x] 5. 最终检查点 - 完整功能验证
  - 运行所有单元测试和属性测试
  - 手动测试招募多个角色，观察饱腹度值
  - 验证所有需求都已实现
  - 如有问题请询问用户

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快开发速度
- 每个任务引用了具体的需求编号以便追溯
- 这是一个非常简单的改动，核心代码只有2行
- 属性测试使用 `fast-check` 库，每个测试至少运行 100 次迭代
- 单元测试使用 vitest 框架

## 实现提示

### 核心代码位置

在 `src/game/systems/CharacterRecruitmentSystem.ts` 的 `generateCharacter` 方法中，找到这段代码：

```typescript
// Create hunger component
// Requirement 2.1, 2.2, 2.3: Initialize with 0 hunger (hungry state)
// Requirement 7.1, 7.2, 7.3, 7.4: Validate hunger values
const hunger: HungerComponent = validateHunger({
  type: 'hunger',
  current: 0,
  maximum: 100
});
```

在这段代码之后，添加组件之前，插入：

```typescript
// 新增：为冒险者和异界角色添加饱腹度奖励 (30~50)
// Requirement 1.1, 1.2, 2.1, 2.2, 3.1, 3.2
const hungerBonus = Math.floor(Math.random() * 21) + 30; // 30~50 的随机整数
hunger.current = Math.min(hunger.current + hungerBonus, hunger.maximum);
```

### 测试文件位置

- 单元测试：在现有的 `src/game/systems/CharacterRecruitmentSystem.property.test.ts` 中添加新的测试用例
- 或创建新文件：`src/game/systems/CharacterRecruitmentSystem.hunger-bonus.test.ts`
