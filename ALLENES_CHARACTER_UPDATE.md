# Allenes 异界角色属性更新

## 更新内容

根据用户要求，修改了 Allenes 异界角色的初始属性和生成逻辑。

## 修改的属性

### 基本信息
- **角色名称**: Allenes（保持不变）
- **角色称号**: 从称号库中随机获得（之前是固定的"异界旅者"）
- **头像图片**: `images/touxiang_yijie_Allenes`（保持不变）

### 初始状态
- **初始当前魔法值**: 0（之前是 maxMana）
- **初始当前饱腹度**: 0（之前是 maxHunger）

### 固定属性值
以下属性不再根据基础属性计算，而是使用固定值：

| 属性 | 新值 | 说明 |
|------|------|------|
| 攻击力 | 10 | 固定值 |
| 防御力 | 5 | 固定值 |
| 移动速度 | 50 | 固定值 |
| 闪避率 | 8% | 固定值 |
| 暴击率 | 8% | 固定值 |
| 暴击伤害 | 170% | 固定值 |
| 魔法抗性 | 1 | 固定值 |
| 魔法强度 | 0 | 固定值 |
| 负重 | 50 | 固定值 |
| 体积 | 100 | 固定值（新增） |
| 经验率 | 100% | 固定值 |
| 生命回复 | 1 | 固定值 |
| 魔法回复 | 0 | 固定值 |
| 体重 | 42 | 固定值（之前是 70） |

### 技能配置
- **初始被动技能**: 从被动技能库中随机获得（之前是空）
- **初始主动技能**: 伏魔斩（保持不变）

## 代码修改

### 1. `src/ui/GameUI.ts` - `createOtherworldCharacter` 方法

#### 随机称号生成
```typescript
// Get random title from NPCSystem's title pool
const titlePool = ['勇敢的', '胆小的', '好色的', '冷酷的', ...];
const randomTitle = titlePool[Math.floor(Math.random() * titlePool.length)];
```

#### 随机被动技能生成
```typescript
// Get random passive skill from NPCSystem
const passiveSkills = this.npcSystem.getPassiveSkills();
const randomPassiveSkill = passiveSkills.length > 0 
  ? passiveSkills[Math.floor(Math.random() * passiveSkills.length)].id 
  : undefined;
```

#### 固定属性值
```typescript
const npcData: NPCData = {
  // ...
  title: randomTitle, // Random title
  currentMP: 0, // Initial current MP = 0
  currentHunger: 0, // Initial current hunger = 0
  passiveSkill: randomPassiveSkill, // Random passive skill
  // Fixed secondary attributes
  attack: 10,
  defense: 5,
  moveSpeed: 50,
  dodgeRate: 8,
  critRate: 8,
  critDamage: 170,
  resistance: 1,
  magicPower: 0,
  carryWeight: 50,
  expRate: 100,
  hpRegen: 1,
  mpRegen: 0,
  weight: 42,
  volume: 100,
  // ...
};
```

#### 饱腹度 BUFF 应用
```typescript
// Apply hunger BUFF since character starts with 0 hunger
this.checkHungerBuff(characterId, 0);
```

### 2. `src/game/systems/NPCSystem.ts` - 新增方法

添加了 `getPassiveSkills()` 方法以支持获取所有被动技能：

```typescript
/**
 * Get all passive skills
 */
public getPassiveSkills(): any[] {
  return this.passiveSkills;
}
```

## 称号库

从以下称号中随机选择：

```
勇敢的、胆小的、好色的、冷酷的、目光呆滞的、口齿不清的、莽撞的、谨慎的、
乐观的、结巴的、凶猛的、暴脾气的、温柔的、迟钝的、敏感的、沉默的、嘴臭的、
脚臭的、喋喋不休的、乐于助人的、好为人师的、自信满满的、魅力四射的、
受欢迎的、人见人爱的、社恐的、眼神躲闪的、色眯眯的、勤快的、懒惰的、
贪吃的、瘸腿的、近视的、爱笑的、爱哭的、无口的、傲娇的、冷漠的、纯洁的、
低情商的、高情商的、热情洋溢的、自私的、慷慨的、色盲的、流口水的、
双下巴的、秃头的、恐高的、贤惠的、大大方方的、抠抠搜搜的、大大咧咧的、
娘娘闷闷儿的、大嗓门的、自来熟的、没礼貌的、客气的、高效的、没眼力见的、
欲求不满的
```

## 被动技能库

从 `passive-skills.json` 中随机选择一个被动技能，包括但不限于：
- 自幼习武（攻击力+15%）
- 皮糙肉厚（防御力+5）
- 身强体壮（最大生命值+15%）
- 等等...

## 游戏影响

### 初始状态
- **魔法值为 0**：角色无法立即使用需要魔法的技能
- **饱腹度为 0**：角色会立即受到饥饿 BUFF 影响
  - 移动速度降为 0
  - 攻击力降为原值的 25%
  - 生命回复和魔法回复降为 0

### 饥饿 BUFF 效果
由于初始饱腹度为 0，角色创建后会立即应用饥饿 BUFF：
```typescript
this.checkHungerBuff(characterId, 0);
```

玩家需要立即给角色喂食以恢复正常状态。

### 随机性
每次创建 Allenes 角色时：
- 称号会不同（从 62 个称号中随机）
- 被动技能会不同（从被动技能库中随机）

这增加了角色的多样性和可玩性。

## 示例

### 示例 1
```
🌟 Allenes (勇敢的)
- 被动技能: 自幼习武
- 主动技能: 伏魔斩
- 当前魔法: 0/100
- 当前饱腹度: 0/100 ⚠️ 饥饿状态
```

### 示例 2
```
🌟 Allenes (贪吃的)
- 被动技能: 皮糙肉厚
- 主动技能: 伏魔斩
- 当前魔法: 0/100
- 当前饱腹度: 0/100 ⚠️ 饥饿状态
```

## 测试建议

1. **创建角色**：使用开发者功能创建多个 Allenes 角色
2. **验证称号**：确认每次创建的称号都不同
3. **验证被动技能**：确认每次创建的被动技能都不同
4. **验证初始状态**：确认魔法值和饱腹度都为 0
5. **验证饥饿 BUFF**：确认角色创建后立即受到饥饿影响
6. **喂食测试**：给角色喂食，验证饥饿 BUFF 解除
7. **属性验证**：确认所有固定属性值正确

## 文件修改清单

- ✅ `src/ui/GameUI.ts` - 修改 `createOtherworldCharacter` 方法
- ✅ `src/game/systems/NPCSystem.ts` - 添加 `getPassiveSkills()` 方法
- ✅ `ALLENES_CHARACTER_UPDATE.md` - 本文档

## 注意事项

1. **饥饿状态**：角色创建后立即处于饥饿状态，需要及时喂食
2. **魔法值**：角色无法立即使用魔法技能，需要等待魔法回复或使用魔法药水
3. **随机性**：每次创建的角色称号和被动技能都不同
4. **固定属性**：所有次级属性都是固定值，不受基础属性影响

## 总结

Allenes 角色现在具有：
- ✅ 随机称号（从 62 个选项中）
- ✅ 随机被动技能（从被动技能库中）
- ✅ 固定的次级属性值
- ✅ 初始魔法值为 0
- ✅ 初始饱腹度为 0（饥饿状态）
- ✅ 固定主动技能：伏魔斩

这使得每个 Allenes 角色都有独特的称号和被动技能，增加了游戏的趣味性和可玩性！
