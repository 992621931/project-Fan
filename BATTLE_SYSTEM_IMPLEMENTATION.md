# 战斗系统实现说明

## 概述
实现了一个完整的战斗系统，包括角色生成、移动、生命值/魔法值恢复等功能。

## 主要变更

### 1. NPCData 接口更新 (`src/game/systems/NPCSystem.ts`)
- ✅ 添加 `currentHP: number` - 当前生命值
- ✅ 添加 `currentMP: number` - 当前魔法值
- ✅ 新角色初始化时：
  - `currentHP = maxHP` (满血)
  - `currentMP = 0` (初始魔法值为0)

### 2. 新建 BattleSystem (`src/game/systems/BattleSystem.ts`)
完整的战斗系统，包含以下功能：

#### 角色生成
- `spawnCharacter(character)` - 在随机位置生成角色
- 角色会显示为圆形头像，带有HP/MP进度条
- 支持图片头像和emoji

#### 角色移动
- 每个角色有随机的移动方向
- 移动速度 = `20 + character.moveSpeed` 像素/秒
- 碰到边界会反弹（改变方向）
- 使用 `requestAnimationFrame` 实现流畅动画

#### 生命值/魔法值恢复
- 每秒恢复一次
- HP恢复量 = `character.hpRegen`
- MP恢复量 = `character.mpRegen`
- 不会超过最大值
- 实时更新进度条显示

#### 其他功能
- `despawnCharacter(id)` - 移除角色
- `clearAll()` - 清除所有角色
- `shutdown()` - 关闭系统，清理资源

### 3. GameUI 集成 (`src/ui/GameUI.ts`)

#### 初始化
- 在构造函数中创建 `BattleSystem` 实例
- 导入 `NPCData` 类型

#### 草原关卡集成
- 切换到草原关卡时自动初始化战斗场景
- 创建 `battle-scene-container` 作为角色容器
- 调用 `battleSystem.initialize(container)`

#### 编队系统集成
- 添加角色到编队槽位时，自动在战斗场景中生成
- 从编队槽位移除角色时，自动从战斗场景中移除
- 支持一键编队功能

#### 场景切换
- 离开草原关卡时自动清理战斗场景
- 返回草原关卡时重新初始化并生成编队中的角色

#### UI更新
- 编队槽位显示当前HP/MP（而非最大值）
- NPC详情面板显示当前HP/MP/EXP
- 进度条根据当前值动态更新

### 4. 测试文件 (`test-battle-system.html`)
创建了独立的测试页面，用于演示战斗系统功能：
- 可以手动生成测试角色
- 显示角色移动和恢复效果
- 包含详细的功能说明

## 使用方法

### 在游戏中体验
1. 启动游戏
2. 使用开发者功能招募4个冒险者
3. 完成"初到村庄"任务解锁草原关卡
4. 切换到草原关卡
5. 在右侧编队面板添加角色到编队槽位
6. 角色会立即在场景中生成并开始移动
7. 观察HP/MP进度条的恢复效果

### 使用测试页面
1. 打开 `test-battle-system.html`
2. 点击"生成角色"按钮添加角色
3. 观察角色移动和恢复效果
4. 点击"清除所有"清空场景

## 技术细节

### 移动算法
```typescript
// 每帧更新位置
sprite.x += sprite.velocityX * deltaTime;
sprite.y += sprite.velocityY * deltaTime;

// 边界检测和反弹
if (sprite.x <= 0 || sprite.x >= maxX) {
  sprite.velocityX = -sprite.velocityX;
}
if (sprite.y <= 0 || sprite.y >= maxY) {
  sprite.velocityY = -sprite.velocityY;
}
```

### 恢复算法
```typescript
// 每秒执行一次
if (timeSinceLastRegen >= 1.0) {
  character.currentHP = Math.min(
    character.maxHP,
    character.currentHP + character.hpRegen
  );
  character.currentMP = Math.min(
    character.maxMP,
    character.currentMP + character.mpRegen
  );
}
```

### 性能优化
- 使用 `requestAnimationFrame` 而非 `setInterval`
- 只在需要时更新DOM元素
- 使用CSS transitions实现平滑的进度条动画
- 定期更新容器边界（而非每帧）

## 未来扩展

可以基于此系统添加：
- 敌人生成和AI
- 战斗逻辑（攻击、技能）
- 碰撞检测（角色之间）
- 经验值获取
- 掉落物品
- 战斗特效
- 音效系统

## 注意事项

1. 角色的 `currentMP` 初始值为 0，需要通过恢复或其他方式获得
2. 移动速度受 `moveSpeed` 属性影响，基础速度为 20 像素/秒
3. 恢复速度受 `hpRegen` 和 `mpRegen` 属性影响
4. 战斗系统只在草原关卡激活
5. 切换关卡时会自动清理战斗场景资源
