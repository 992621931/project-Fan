# 需求文档

## 简介

为游戏添加两个新的主动技能（旋风飞斧、能量箭矢）及其对应的技能书物品。旋风飞斧生成环绕角色公转并自转的飞斧投射物，能量箭矢发射可在场景边缘反弹并增加伤害的箭矢投射物。两个技能书物品允许角色通过使用技能书来学习对应的主动技能。

## 术语表

- **BattleSystem**：战斗系统，负责战斗场景中的角色移动、投射物生成、碰撞检测和伤害计算
- **SkillSystem**：技能系统，负责技能的学习、使用和冷却管理
- **环绕投射物（Orbit Projectile）**：围绕施法者公转的投射物，使用 `spawn_orbit` 效果类型
- **线性投射物（Linear Projectile）**：沿直线方向移动的投射物，使用 `spawn_projectile` 效果类型
- **非穿透型投射物**：碰到敌人后造成伤害并立即消失的投射物（`hitOnce: true`）
- **拖尾效果（Trail Effect）**：投射物移动时在身后留下的视觉残影效果
- **技能书（Skill Book）**：一种消耗品物品，使用后可让角色学习对应的主动技能
- **active-skills.json**：存储主动技能数据定义的 JSON 文件
- **items.json**：存储物品数据定义的 JSON 文件
- **item-prefabs.json**：存储物品预制体数据定义的 JSON 文件

## 需求

### 需求 1：旋风飞斧技能数据

**用户故事：** 作为游戏开发者，我希望在主动技能库中添加旋风飞斧技能的数据定义，以便战斗系统能够识别和使用该技能。

#### 验收标准

1. THE active-skills.json SHALL 包含一个 id 为 "whirlwind_axe" 的主动技能条目，名称为"旋风飞斧"，图标为 "images/zhudongjineng_xuanfengfeifu.png"，描述为"用3个旋转的飞斧攻击敌人，伤害受攻击力影响"
2. THE 旋风飞斧技能 SHALL 定义一个 `spawn_orbit` 类型的效果，生成 3 个环绕投射物
3. THE 旋风飞斧技能效果 SHALL 配置为非穿透型（`hitOnce: true`），使飞斧碰到敌人后造成伤害然后消失
4. THE 旋风飞斧技能效果 SHALL 配置伤害公式为：基础伤害 5 + 施法者攻击力 × 50%（`damage.base: 5, damage.attackMultiplier: 0.5`）
5. THE 旋风飞斧技能效果 SHALL 使用 "images/texiao_futou.png" 作为飞斧环绕投射物的图片
6. THE 旋风飞斧技能效果 SHALL 配置生命周期为 6000 毫秒（6秒）

### 需求 2：旋风飞斧投射物视觉效果

**用户故事：** 作为玩家，我希望旋风飞斧的飞斧在围绕角色公转的同时也进行自转，并带有红色拖尾效果，以获得良好的视觉体验。

#### 验收标准

1. WHEN 旋风飞斧技能被施放时，THE BattleSystem SHALL 生成 3 个飞斧环绕投射物，均匀分布在施法者周围（角度间隔 120°）
2. WHEN 飞斧环绕投射物存在时，THE BattleSystem SHALL 使飞斧在围绕角色公转的同时进行自转
3. WHEN 飞斧环绕投射物移动时，THE BattleSystem SHALL 为飞斧渲染红色的拖尾效果

### 需求 3：能量箭矢技能数据

**用户故事：** 作为游戏开发者，我希望在主动技能库中添加能量箭矢技能的数据定义，以便战斗系统能够识别和使用该技能。

#### 验收标准

1. THE active-skills.json SHALL 包含一个 id 为 "energy_arrow" 的主动技能条目，名称为"能量箭矢"，图标为 "images/zhudongjineng_nengliangjianshi.png"，描述为"射出一支能量箭矢造成伤害，箭矢碰到场景边缘会反弹并增加伤害，伤害受攻击力影响"
2. THE 能量箭矢技能 SHALL 定义一个 `spawn_projectile` 类型的效果
3. THE 能量箭矢技能效果 SHALL 配置为非穿透型（非 piercing），使箭矢碰到敌人后造成伤害然后消失
4. THE 能量箭矢技能效果 SHALL 配置伤害公式为：基础伤害 5 + 施法者攻击力 × 100%（`damage.base: 5, damage.attackMultiplier: 1.0`）
5. THE 能量箭矢技能效果 SHALL 使用 "images/toushewu_jianshi.png" 作为箭矢投射物的图片
6. THE 能量箭矢技能效果 SHALL 配置生命周期为 6000 毫秒（6秒）
7. THE 能量箭矢技能效果 SHALL 配置移动速度为每秒 600 像素

### 需求 4：能量箭矢反弹与方向机制

**用户故事：** 作为玩家，我希望能量箭矢在碰到场景边缘时能够反弹并增加伤害，箭矢朝向始终跟移动方向一致，并带有蓝色拖尾效果。

#### 验收标准

1. WHEN 能量箭矢投射物被发射时，THE BattleSystem SHALL 朝随机方向发射该投射物
2. WHEN 能量箭矢投射物碰到场景边缘时，THE BattleSystem SHALL 使投射物朝随机方向反弹，而非简单的镜面反射
3. WHEN 能量箭矢投射物每次反弹后，THE BattleSystem SHALL 将投射物的伤害增加 5 点
4. WHILE 能量箭矢投射物在移动中，THE BattleSystem SHALL 使投射物的朝向（旋转角度）始终与移动方向保持一致
5. WHEN 能量箭矢投射物移动时，THE BattleSystem SHALL 为投射物渲染蓝色的拖尾效果

### 需求 5：技能书物品数据

**用户故事：** 作为游戏开发者，我希望在物品库中添加旋风飞斧和能量箭矢的技能书物品，以便玩家可以通过使用技能书来学习这些技能。

#### 验收标准

1. THE items.json 和 item-prefabs.json SHALL 包含一个 id 为 "skill_book_whirlwind_axe" 的技能书物品，名称为"《旋风飞斧》技能书"，类型为书籍（`type: "book", subType: "skill_book"`），稀有度为普通（`rarity: 0`），图标为 "images/wupin_jinengshu.png"，价值为 1000 金币，`skillId` 指向 "whirlwind_axe"
2. THE items.json 和 item-prefabs.json SHALL 包含一个 id 为 "skill_book_energy_arrow" 的技能书物品，名称为"《能量箭矢》技能书"，类型为书籍（`type: "book", subType: "skill_book"`），稀有度为普通（`rarity: 0`），图标为 "images/wupin_jinengshu.png"，价值为 1000 金币，`skillId` 指向 "energy_arrow"
3. WHEN 玩家对角色使用《旋风飞斧》技能书时，THE 系统 SHALL 使该角色学习主动技能"旋风飞斧"，并从背包中移除一本技能书
4. WHEN 玩家对角色使用《能量箭矢》技能书时，THE 系统 SHALL 使该角色学习主动技能"能量箭矢"，并从背包中移除一本技能书

### 需求 6：环绕投射物自转与拖尾支持

**用户故事：** 作为游戏开发者，我希望 BattleSystem 的环绕投射物机制支持自转和拖尾效果，以便旋风飞斧等技能能够实现丰富的视觉表现。

#### 验收标准

1. WHEN 环绕投射物配置了自转参数时，THE BattleSystem SHALL 使投射物在公转的同时以指定速度进行自转
2. WHEN 环绕投射物配置了拖尾效果时，THE BattleSystem SHALL 在投射物移动路径上渲染指定颜色的拖尾粒子

### 需求 7：线性投射物反弹机制

**用户故事：** 作为游戏开发者，我希望 BattleSystem 的线性投射物机制支持场景边缘反弹和反弹伤害增加，以便能量箭矢等技能能够实现反弹玩法。

#### 验收标准

1. WHEN 线性投射物配置了反弹参数且碰到场景边缘时，THE BattleSystem SHALL 使投射物朝随机方向反弹而非被销毁
2. WHEN 线性投射物每次反弹时，THE BattleSystem SHALL 将投射物的当前伤害增加配置中指定的数值
3. WHEN 线性投射物反弹后，THE BattleSystem SHALL 重置已命中目标列表，使投射物可以再次命中之前命中过的敌人
