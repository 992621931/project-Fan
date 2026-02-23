# 烹饪UI改进 - 材料图标网格显示

## 改进内容

在烹饪面板的"所需材料"区域内，以网格形式显示材料图标卡片。

## 视觉效果

### 布局方式
- 网格布局（Grid）
- 自适应列数（最小80px宽度）
- 卡片式设计，每个材料一张卡片

### 卡片结构
```
┌─────────────┐
│ [✓]    状态 │  ← 右上角状态指示器
│             │
│   [图标]    │  ← 64x64px 图标
│   10/3      │  ← 右下角数量标签
│             │
│  材料名称   │  ← 底部名称
└─────────────┘
```

## 功能特性

### 1. 网格容器
- 自适应网格布局
- 最小列宽：80px
- 间距：12px
- 半透明背景和边框
- 位于红框标注的"所需材料"区域内

### 2. 材料卡片
- **边框颜色**：
  - 绿色：材料充足
  - 红色：材料不足
- **悬停效果**：上浮 + 阴影
- **响应式**：自动调整列数

### 3. 图标显示
- 尺寸：64x64px
- 圆角：8px
- 深色背景
- 图片自适应（object-fit: contain）
- 加载失败显示 📦

### 4. 数量标签
- 位置：图标右下角
- 格式：`拥有/需要`（例如：10/3）
- 颜色：
  - 绿色背景：材料充足
  - 红色背景：材料不足
- 字体：10px 粗体

### 5. 状态指示器
- 位置：卡片右上角
- 尺寸：20x20px 圆形
- 符号：✓（充足）或 ✗（不足）
- 颜色：绿色或红色
- 带阴影效果

### 6. 材料名称
- 位置：图标下方
- 居中对齐
- 最多显示2行
- 超出显示省略号
- 字体：11px

## 技术实现

### 修改文件
- `src/ui/components/CookingPanel.ts` - `renderIngredients()` 方法

### 核心代码

```typescript
// 创建网格容器
const ingredientsGrid = this.createElement_div('ingredients-grid');
ingredientsGrid.style.cssText = `
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 2px solid rgba(255, 255, 255, 0.1);
`;

// 为每个材料创建卡片
recipe.ingredients.forEach(ingredient => {
  const itemData = itemSystem?.getItem(ingredient.itemId);
  const isMissing = validation.missingIngredients.some(mi => mi.itemId === ingredient.itemId);
  const currentQuantity = itemSystem?.getItemQuantity(ingredient.itemId) || 0;

  // 材料卡片
  const ingredientCard = this.createElement_div('ingredient-card');
  ingredientCard.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 2px solid ${isMissing ? 'rgba(231, 76, 60, 0.5)' : 'rgba(46, 204, 113, 0.5)'};
    transition: all 0.2s ease;
    cursor: pointer;
    position: relative;
  `;

  // 图标容器（64x64px）
  const iconContainer = this.createElement_div('ingredient-icon');
  // ... 图标加载逻辑

  // 数量标签（在图标上）
  const quantityBadge = this.createElement_div('quantity-badge', `${currentQuantity}/${ingredient.quantity}`);
  quantityBadge.style.cssText = `
    position: absolute;
    bottom: 2px;
    right: 2px;
    background: ${isMissing ? 'rgba(231, 76, 60, 0.9)' : 'rgba(46, 204, 113, 0.9)'};
    color: #ffffff;
    font-size: 10px;
    font-weight: bold;
    padding: 2px 4px;
    border-radius: 4px;
  `;

  // 状态指示器（在卡片上）
  const statusIndicator = this.createElement_div('status-indicator', isMissing ? '✗' : '✓');
  statusIndicator.style.cssText = `
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: ${isMissing ? '#e74c3c' : '#2ecc71'};
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 12px;
  `;

  // 材料名称
  const itemName = this.createElement_div('item-name', itemData?.name || ingredient.itemId);
  itemName.style.cssText = `
    color: #ffffff;
    font-size: 11px;
    text-align: center;
    line-height: 1.2;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  `;

  // 组装卡片
  ingredientCard.appendChild(statusIndicator);
  ingredientCard.appendChild(iconContainer);
  ingredientCard.appendChild(itemName);
  ingredientsGrid.appendChild(ingredientCard);
});
```

## 用户体验提升

### 1. 视觉清晰
- 网格布局一目了然
- 图标大而清晰（64x64px）
- 颜色编码（红/绿）快速识别状态

### 2. 信息密度
- 在有限空间内展示更多材料
- 图标 + 数量 + 状态三重信息
- 紧凑但不拥挤

### 3. 交互反馈
- 悬停时卡片上浮
- 视觉反馈明确
- 鼠标指针变化

### 4. 响应式设计
- 自动调整列数
- 适应不同屏幕尺寸
- 保持视觉一致性

## 测试

使用 `test-cooking-ui.html` 进行测试：

### 测试场景

1. **材料充足**
   - 点击"添加测试材料"
   - 打开烹饪面板
   - 查看绿色边框的材料卡片

2. **材料不足**
   - 点击"添加部分材料"
   - 打开烹饪面板
   - 查看红色边框的材料卡片

3. **混合状态**
   - 部分材料充足，部分不足
   - 观察不同颜色的边框和标签

4. **悬停效果**
   - 鼠标悬停在材料卡片上
   - 观察上浮和阴影效果

## 对比

### 之前（列表式）
```
[图标] 材料名称          [✓]
      需要: 3
```
- 垂直列表
- 占用空间大
- 一次只能看到少量材料

### 之后（网格式）
```
[图标]  [图标]  [图标]
名称    名称    名称

[图标]  [图标]  [图标]
名称    名称    名称
```
- 网格布局
- 空间利用率高
- 一次可以看到更多材料
- 视觉更整洁

## 兼容性

- 向后兼容：如果物品没有图标，显示默认图标 📦
- 不影响现有功能：材料验证、烹饪逻辑保持不变
- 性能优化：仅在渲染时加载图标

## 未来改进建议

1. **图标缓存**
   - 缓存已加载的图标
   - 减少重复加载

2. **拖拽功能**
   - 从背包拖拽材料到卡片
   - 快速添加材料

3. **详细信息提示**
   - 悬停显示材料详细信息
   - 包括描述、获取方式等

4. **稀有度显示**
   - 根据材料稀有度显示不同边框颜色
   - 与物品系统集成

5. **动画效果**
   - 材料添加时的动画
   - 数量变化时的过渡效果

6. **快捷操作**
   - 点击卡片查看材料详情
   - 右键菜单快速操作
