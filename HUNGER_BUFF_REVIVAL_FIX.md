# 饥饿BUFF复活修复

## 问题描述

当角色处于"饥饿"BUFF状态（饱腹度≤0）并从重伤状态复活后，虽然角色身上仍然显示"饥饿"BUFF图标，但BUFF的减益效果没有实际作用。角色的属性（移动速度、攻击力、生命恢复、魔法恢复）恢复正常，而不是保持饥饿状态的减益。

## 根本原因

在 `BattleSystem.reviveCharacter()` 方法中，角色复活时只执行了以下操作：
1. 恢复生命值至最大值
2. 重置受伤和死亡状态
3. 重新定位角色位置
4. 生成新的移动速度

但是**没有重新应用BUFF效果**。虽然 `BuffSystem` 中仍然保留着饥饿BUFF的记录，但角色的实际属性没有反映BUFF的减益效果。

## 修复方案

在 `GameUI.handleCharacterRevived()` 方法中添加了对 `checkHungerBuff()` 的调用，确保角色复活后重新检查并应用饥饿BUFF效果。

### 修改文件
- `src/ui/GameUI.ts` - `handleCharacterRevived()` 方法（第17766行）

### 修改内容

```typescript
private handleCharacterRevived(characterId: string): void {
  console.log(`[GameUI] Character ${characterId} revived`);
  
  // Clear the countdown interval
  const injuredData = this.injuredCharacters.get(characterId);
  if (injuredData) {
    clearInterval(injuredData.intervalId);
    this.injuredCharacters.delete(characterId);
  }
  
  // Update the UI to remove grayscale and countdown
  this.updateRevivedCharacterUI(characterId);
  
  // Check if character is in party slots
  const characterInParty = this.partySlots.find(slot => slot && slot.id === characterId);
  
  // ✨ 新增：Re-apply hunger BUFF effects if character still has hunger ≤ 0
  if (characterInParty && characterInParty.currentHunger !== undefined) {
    this.checkHungerBuff(characterId, characterInParty.currentHunger);
  }
  
  // If character is in party and we're in a battle stage, respawn them
  if (characterInParty && this.isCurrentStageCombat() && this.battleSceneContainer) {
    console.log(`[GameUI] Respawning revived character ${characterInParty.name} in battle scene`);
    this.battleSystem.spawnCharacter(characterInParty);
    this.showNotification(`${characterInParty.name} 已复活并重新加入战斗！`, 'success');
  }
}
```

## 修复后的行为

1. 角色从重伤状态复活
2. 系统检查角色的当前饱腹度
3. 如果饱腹度仍然≤0：
   - 重新应用饥饿BUFF效果
   - 移动速度设为0
   - 攻击力降至原值的25%
   - 生命恢复设为0
   - 魔法恢复设为0
4. 角色在战斗中的表现正确反映饥饿状态

## 测试方法

1. 招募一个角色并将其加入队伍
2. 进入战斗场景（草原/森林/洞穴）
3. 等待角色饱腹度降至0（会自动应用饥饿BUFF）
4. 让角色受到足够伤害进入重伤状态
5. 等待10秒让角色自动复活
6. 验证：
   - 角色仍然显示饥饿BUFF图标
   - 角色移动速度为0（静止不动）
   - 角色攻击力大幅降低（约为正常值的25%）
   - 角色不会自动恢复生命值和魔法值

## 相关系统

- **BuffSystem**: 管理BUFF定义和活跃BUFF实例
- **BattleSystem**: 处理战斗逻辑和角色复活
- **GameUI**: 协调UI更新和系统交互
- **checkHungerBuff()**: 根据饱腹度应用/移除饥饿BUFF

## 技术细节

饥饿BUFF的效果通过 `hungerPreBuffStats` Map 存储角色的原始属性值，当BUFF应用时：
- 保存原始的 moveSpeed, attack, hpRegen, mpRegen
- 将这些属性修改为饥饿状态的值
- 当BUFF移除时，从保存的值恢复原始属性

`checkHungerBuff()` 方法会：
1. 检查角色是否已有饥饿BUFF
2. 如果饱腹度≤0且没有BUFF：应用BUFF
3. 如果饱腹度≤0且已有BUFF但效果未应用：重新应用效果
4. 如果饱腹度>0且有BUFF：移除BUFF

## 构建状态

✅ 构建成功（webpack 5.105.0 compiled with 2 warnings in 11577 ms）
✅ 无新增TypeScript错误
✅ 修复已部署到生产构建
