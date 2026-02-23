# 烹饪系统修复说明

## 问题描述

当满足所需物品时，烹饪系统无法正常工作，出现错误：
```
[ItemSystem] Item not found: bitter_ball
```

## 问题根源

烹饪系统的工作流程：
1. 验证玩家是否拥有所需原材料（通过 `ItemSystem.hasItem()`）
2. 消耗原材料（通过 `ItemSystem.removeItem()`）
3. 创建料理物品（通过 `ItemSystem.addItem(recipe.id, 1)`）

问题出在第3步：
- `cooking-recipes.json` 中定义了21个烹饪配方
- 但 `items.json` 中只定义了7个料理物品
- 缺少14个料理物品的定义
- 当烹饪系统尝试创建料理时，`ItemSystem` 找不到对应的物品定义，导致失败

## 修复内容

### 1. 添加缺失的料理物品（14个）

在 `src/game/data/items.json` 中添加了以下料理物品：

1. `bitter_ball` - 苦团
2. `suffocating_special_drink` - 窒息特饮
3. `steamed_spider_leg` - 清蒸蛛腿
4. `braised_spider_leg` - 酱烧蛛腿
5. `salty_concubine_candy` - 咸妃糖
6. `dehydrated_compressed_biscuit` - 脱水压缩饼
7. `forest_set_meal` - 森林套餐
8. `finger_fries` - 手指薯条
9. `bile_noodles` - 胆汁拌面
10. `frog_leg_sashimi` - 蛙腿刺身
11. `dry_pot_eye_frog` - 干锅眼蛙
12. `charcoal_grilled_crispy_vine` - 碳烤脆藤
13. `explosive_double_crispy` - 火爆双脆
14. `cave_set_meal` - 洞穴套餐

### 2. 添加缺失的原材料（14个）

在 `src/game/data/items.json` 中添加了以下原材料：

1. `bitter_root` - 苦根
2. `salt_stone_crystal` - 盐石结晶
3. `blue_spider_front_leg` - 蓝蛛前腿
4. `bitter_juice` - 苦汁
5. `coarse_salt_block` - 粗盐块
6. `blue_cheese_ball` - 蓝奶酪球
7. `burst_fruit` - 爆裂果
8. `corpse_potato` - 尸薯
9. `beating_gallbladder` - 跳动的胆囊
10. `fire_tongue_frog_leg` - 火舌蛙腿
11. `three_color_eyeball` - 三色眼珠
12. `twitching_vine_core` - 抽动藤芯
13. `spicy_tongue` - 辣舌
14. `night_vision_grass` - 夜视草

## 物品属性说明

所有添加的物品都包含以下属性：
- `id`: 物品唯一标识符
- `name`: 物品名称（中文）
- `description`: 物品描述
- `type`: 物品类型（"food" 或 "material"）
- `subTypes`: 子类型数组（原材料为 ["ingredient"]）
- `rarity`: 稀有度（0=普通, 1=稀有, 2=神话）
- `stackSize`: 堆叠上限（料理99，原材料999）
- `baseValue`: 基础价值
- `canSell`: 是否可出售
- `sellPrice`: 出售价格
- `canBuy`: 是否可购买
- `buyPrice`: 购买价格
- `canUse`: 是否可使用
- `icon`: 图标路径

## 验证

修复后，所有21个烹饪配方都可以正常工作：
- ✓ 所有料理物品都已定义
- ✓ 所有原材料都已定义
- ✓ 烹饪系统可以正常创建料理

## 测试

可以使用 `test-cooking-fix.html` 进行测试：
1. 打开文件
2. 点击"测试烹饪苦团"按钮测试单个配方
3. 点击"测试所有配方"按钮测试所有21个配方

## 相关文件

- `src/game/data/items.json` - 物品数据（已修改）
- `src/game/data/cooking-recipes.json` - 烹饪配方（未修改）
- `src/game/systems/CookingSystem.ts` - 烹饪系统（未修改）
- `src/game/systems/ItemSystem.ts` - 物品系统（未修改）
- `test-cooking-fix.html` - 测试页面（新增）
