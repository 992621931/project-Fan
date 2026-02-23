# 敌人系统实现文档

## 概述
敌人系统负责管理游戏中的敌人生成、行为和数据。系统支持从预制体模板创建敌人实例，并与战斗系统集成。

## 文件结构

### 数据文件
- `src/game/data/enemies.json` - 敌人预制体数据

### 系统文件
- `src/game/systems/EnemySystem.ts` - 敌人系统核心逻辑

### 测试文件
- `test-enemy-system.html` - 敌人系统测试页面

## 敌人预制体列表

### 1. 湿地双头蛇
- **ID**: `enemy_wetland_two_headed_snake`
- **等级**: 1
- **生命值**: 35
- **攻击力**: 10
- **防御力**: 1
- **移动速度**: 25
- **体重**: 25
- **特点**: 基础敌人，属性均衡

### 2. 甜浆史莱姆
- **ID**: `enemy_sweet_syrup_slime`
- **等级**: 1
- **生命值**: 45
- **攻击力**: 8
- **防御力**: 0
- **移动速度**: 15
- **体重**: 44
- **特点**: 高生命值，低攻击力，移动缓慢

### 3. 巨型草菇虫
- **ID**: `enemy_giant_grass_mushroom_worm`
- **等级**: 1
- **生命值**: 38
- **攻击力**: 12
- **防御力**: 2
- **移动速度**: 33
- **体重**: 65
- **特点**: 高攻击力，移动较快

### 4. 赤鬃
- **ID**: `enemy_red_mane`
- **等级**: 1
- **生命值**: 150
- **攻击力**: 19
- **防御力**: 3
- **移动速度**: 50
- **体重**: 54
- **特点**: BOSS级敌人，高生命值和攻击力

### 5. 苦根葵
- **ID**: `enemy_bitter_root_sunflower`
- **等级**: 1
- **生命值**: 66
- **攻击力**: 22
- **防御力**: 5
- **移动速度**: 8
- **体重**: 23
- **特点**: 高防御力，移动极慢

### 6. 蓝芝蛛
- **ID**: `enemy_blue_mushroom_spider`
- **等级**: 1
- **生命值**: 71
- **攻击力**: 25
- **防御力**: 4
- **移动速度**: 24
- **体重**: 23
- **特点**: 高攻击力

### 7. 蜜牙猪
- **ID**: `enemy_honey_tooth_pig`
- **等级**: 1
- **生命值**: 71
- **攻击力**: 25
- **防御力**: 4
- **移动速度**: 24
- **体重**: 23
- **特点**: 属性与蓝芝蛛相同

### 8. 盐石巨兽
- **ID**: `enemy_salt_stone_behemoth`
- **等级**: 1
- **生命值**: 71
- **攻击力**: 25
- **防御力**: 4
- **移动速度**: 24
- **体重**: 23
- **特点**: 属性与蓝芝蛛相同

## EnemySystem API

### 构造函数
```typescript
constructor(world: World)
```
创建敌人系统实例，需要传入World对象。

### 主要方法

#### createEnemy(templateId: string): EnemyData | null
从模板创建敌人实例
- **参数**: `templateId` - 敌人模板ID
- **返回**: 敌人数据对象，失败返回null

#### createRandomEnemy(): EnemyData | null
创建随机敌人
- **返回**: 随机敌人数据对象，失败返回null

#### getEnemy(enemyId: string): EnemyData | undefined
获取指定敌人
- **参数**: `enemyId` - 敌人实例ID
- **返回**: 敌人数据对象

#### getAllEnemies(): EnemyData[]
获取所有已生成的敌人
- **返回**: 敌人数据数组

#### removeEnemy(enemyId: string): void
移除敌人（击败时调用）
- **参数**: `enemyId` - 敌人实例ID

#### clearAllEnemies(): void
清除所有敌人

#### getEnemyTemplateIds(): string[]
获取所有敌人模板ID
- **返回**: 模板ID数组

#### getEnemyTemplate(templateId: string): EnemyTemplate | undefined
获取敌人模板
- **参数**: `templateId` - 模板ID
- **返回**: 模板数据对象

#### getAllEnemyTemplates(): EnemyTemplate[]
获取所有敌人模板
- **返回**: 模板数据数组

#### damageEnemy(enemyId: string, damage: number): boolean
对敌人造成伤害
- **参数**: 
  - `enemyId` - 敌人实例ID
  - `damage` - 伤害值
- **返回**: true表示敌人被击败，false表示仍存活

#### healEnemy(enemyId: string, amount: number): void
治疗敌人
- **参数**:
  - `enemyId` - 敌人实例ID
  - `amount` - 治疗量

## 数据结构

### EnemyData
```typescript
interface EnemyData extends NPCData {
  weight: number;      // 体重
  size: number;        // 体积（1.0 = 100%）
  skills: string[];    // 技能列表
  drops: string[];     // 掉落物列表
}
```

### EnemyTemplate
```typescript
interface EnemyTemplate {
  id: string;          // 模板ID
  name: string;        // 名称
  type: string;        // 类型（"Enemy"）
  emoji: string;       // 头像图片路径
  level: number;       // 等级
  maxHP: number;       // 最大生命值
  maxMP: number;       // 最大魔法值
  attack: number;      // 攻击力
  defense: number;     // 防御力
  moveSpeed: number;   // 移动速度
  weight: number;      // 体重
  size: number;        // 体积
  skills: string[];    // 技能列表
  drops: string[];     // 掉落物列表
}
```

## 与战斗系统集成

### 视觉区分
- **友方角色**: 蓝色渐变背景 + 白色边框
- **敌方角色**: 红色渐变背景 + 红色边框

### 生成敌人到战斗场景
```typescript
const enemySystem = new EnemySystem(world);
const battleSystem = new BattleSystem();

// 创建敌人
const enemy = enemySystem.createEnemy('enemy_wetland_two_headed_snake');

// 在战斗场景中生成
if (enemy) {
  battleSystem.spawnCharacter(enemy);
}
```

## 敌人特性

### 初始状态
- 当前生命值 = 最大生命值
- 当前魔法值 = 0（敌人初始无魔法）
- 当前经验值 = 0

### 恢复机制
- 生命值恢复速度 = 0（不自动恢复）
- 魔法值恢复速度 = 0（不自动恢复）

### 移动行为
- 移动速度 = 20 + moveSpeed属性
- 随机方向移动
- 碰到边界会反弹

## 使用示例

### 创建并生成敌人
```typescript
import { EnemySystem } from './game/systems/EnemySystem';
import { BattleSystem } from './game/systems/BattleSystem';
import { World } from './ecs/World';

const world = new World();
const enemySystem = new EnemySystem(world);
const battleSystem = new BattleSystem();

// 初始化战斗系统
const battleContainer = document.getElementById('battle-area');
battleSystem.initialize(battleContainer);

// 创建特定敌人
const snake = enemySystem.createEnemy('enemy_wetland_two_headed_snake');
if (snake) {
  battleSystem.spawnCharacter(snake);
}

// 创建随机敌人
const randomEnemy = enemySystem.createRandomEnemy();
if (randomEnemy) {
  battleSystem.spawnCharacter(randomEnemy);
}
```

### 战斗逻辑示例
```typescript
// 对敌人造成伤害
const isDefeated = enemySystem.damageEnemy(enemyId, 20);

if (isDefeated) {
  // 敌人被击败
  battleSystem.despawnCharacter(enemyId);
  enemySystem.removeEnemy(enemyId);
  
  // 处理掉落物、经验值等
}
```

## 测试

打开 `test-enemy-system.html` 进行测试：
1. 点击右侧敌人卡片生成对应敌人
2. 点击"生成随机敌人"按钮生成随机敌人
3. 点击"生成所有敌人"按钮生成所有类型的敌人
4. 观察敌人在场景中的移动和显示效果
5. 注意敌人的红色边框与友方角色的白色边框区分

## 未来扩展

### 计划功能
1. **AI行为系统**: 敌人追击、攻击玩家角色
2. **技能系统**: 实现敌人技能释放
3. **掉落系统**: 击败敌人后掉落物品
4. **难度系统**: 根据关卡调整敌人属性
5. **BOSS机制**: 特殊BOSS敌人的行为模式
6. **敌人波次**: 分波生成敌人
7. **敌人状态**: 眩晕、中毒等状态效果

## 注意事项

1. 敌人头像图片必须放在 `images/` 目录下
2. 敌人模板ID必须唯一
3. 敌人实例ID由系统自动生成，格式为 `enemy_{counter}_{timestamp}`
4. 敌人类型必须设置为 "Enemy" 以正确显示红色边框
5. 敌人数据文件加载是异步的，需要等待加载完成后才能创建敌人
