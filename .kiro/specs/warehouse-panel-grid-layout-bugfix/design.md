# 设计文档 - 仓库面板网格布局 Bug 修复

## 概述

本设计文档描述了如何修复仓库面板物品网格布局与分页逻辑不一致的问题。核心解决方案是将 CSS Grid 的 `auto-fill` 改为固定列数，并动态计算每页应显示的物品数量，使其与实际网格布局保持一致。

## 架构

### 当前实现问题

当前实现存在以下问题：

1. **CSS Grid 使用 `auto-fill`**: `grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))` 导致列数根据容器宽度动态变化
2. **固定分页大小**: `itemsPerPage = 12` 是硬编码的常量，不随网格列数变化
3. **不一致性**: 如果容器宽度只能容纳 4 列，那么 3 行只能显示 12 个物品，但如果有 13 个物品，第 13 个会被分到下一页

### 解决方案架构

```
┌─────────────────────────────────────────┐
│         Warehouse Panel                 │
│  ┌───────────────────────────────────┐  │
│  │   Container Width Detection       │  │
│  └───────────────┬───────────────────┘  │
│                  │                       │
│                  ▼                       │
│  ┌───────────────────────────────────┐  │
│  │   Calculate Grid Columns          │  │
│  │   (based on width & item size)    │  │
│  └───────────────┬───────────────────┘  │
│                  │                       │
│                  ▼                       │
│  ┌───────────────────────────────────┐  │
│  │   Calculate Items Per Page        │  │
│  │   (columns × target rows)         │  │
│  └───────────────┬───────────────────┘  │
│                  │                       │
│                  ▼                       │
│  ┌───────────────────────────────────┐  │
│  │   Apply Pagination Logic          │  │
│  │   (slice items by calculated size)│  │
│  └───────────────┬───────────────────┘  │
│                  │                       │
│                  ▼                       │
│  ┌───────────────────────────────────┐  │
│  │   Render Grid with Fixed Columns  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## 组件和接口

### 1. 网格列数计算

**方法**: `calculateGridColumns(containerWidth: number): number`

**输入**:
- `containerWidth`: 容器的可用宽度（像素）

**输出**:
- 网格应该使用的列数（整数）

**算法**:
```typescript
function calculateGridColumns(containerWidth: number): number {
  const itemMinWidth = 120; // 物品卡片最小宽度
  const gap = 12; // 网格间距
  
  // 计算可以容纳的列数
  // 公式: (containerWidth + gap) / (itemMinWidth + gap)
  const columns = Math.floor((containerWidth + gap) / (itemMinWidth + gap));
  
  // 确保至少 1 列，最多 8 列
  return Math.max(1, Math.min(columns, 8));
}
```

### 2. 每页物品数量计算

**方法**: `calculateItemsPerPage(columns: number): number`

**输入**:
- `columns`: 网格列数

**输出**:
- 每页应显示的物品数量

**算法**:
```typescript
function calculateItemsPerPage(columns: number): number {
  const targetRows = 3; // 目标行数（可调整）
  return columns * targetRows;
}
```

**设计决策**: 使用 3 行作为目标，因为：
- 3 行在大多数屏幕上不需要滚动
- 提供足够的内容密度
- 与原始的 12 个物品（假设 4 列）保持相似的体验

### 3. 网格渲染更新

**修改**: `renderItemGrid` 方法

**关键变更**:
1. 在渲染前计算容器宽度
2. 基于容器宽度计算列数
3. 基于列数计算每页物品数量
4. 使用固定列数的 CSS Grid 而不是 `auto-fill`

**CSS 变更**:
```typescript
// 旧的 CSS
grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));

// 新的 CSS
grid-template-columns: repeat(${columns}, 1fr);
```

### 4. 响应式更新

**方法**: `setupResizeObserver()`

**功能**: 监听容器大小变化并触发重新计算

**实现**:
```typescript
private setupResizeObserver(container: HTMLElement): void {
  const resizeObserver = new ResizeObserver(
    debounce((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newColumns = this.calculateGridColumns(newWidth);
        
        // 仅在列数改变时重新渲染
        if (newColumns !== this.currentColumns) {
          this.currentColumns = newColumns;
          this.reRenderItemGrid();
        }
      }
    }, 150) // 150ms 防抖
  );
  
  resizeObserver.observe(container);
}
```

### 5. 防抖工具函数

**函数**: `debounce(func: Function, wait: number): Function`

**功能**: 防止频繁触发的事件导致性能问题

**实现**:
```typescript
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = window.setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}
```

## 数据模型

### GameUI 类新增属性

```typescript
export class GameUI {
  // 现有属性...
  private currentFilter: string = 'all';
  private currentPage: number = 0;
  
  // 移除固定的 itemsPerPage
  // private readonly itemsPerPage: number = 12; // ❌ 删除
  
  // 新增动态属性
  private currentColumns: number = 4; // 当前网格列数，默认 4
  private currentItemsPerPage: number = 12; // 当前每页物品数量，动态计算
  private resizeObserver: ResizeObserver | null = null; // 响应式观察器
}
```

### 计算流程

```
Container Width → Calculate Columns → Calculate Items Per Page → Pagination
     ↓                    ↓                      ↓                    ↓
   800px                 6                     18                 Page 1: 0-17
                                                                  Page 2: 18-35
```

## 正确性属性

*属性是一种特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*


### 属性 1: 列数计算正确性

*对于任意* 容器宽度，计算出的列数应该满足以下条件：
1. 列数在 [1, 8] 范围内
2. 列数是能够容纳在容器宽度内的最大值
3. 计算公式考虑了物品最小宽度（120px）和间距（12px）
4. 满足不等式：`columns * (120 + 12) - 12 <= containerWidth < (columns + 1) * (120 + 12) - 12`（当 columns < 8 时）

**验证: 需求 1.1, 3.1, 3.2, 3.3, 3.4**

### 属性 2: 每页物品数量计算

*对于任意* 列数，每页物品数量应该等于列数乘以目标行数（3 行）。

**验证: 需求 1.2**

### 属性 3: 分页使用动态计算的容量

*对于任意* 物品列表和计算出的每页物品数量，分页后的每一页（除最后一页外）应该包含恰好等于每页物品数量的物品。

**验证: 需求 1.3, 2.3**

### 属性 4: 列数改变触发容量更新

*对于任意* 初始列数和新列数，当列数改变时，每页物品数量应该根据新列数重新计算。

**验证: 需求 1.4, 6.2**

### 属性 5: 分页保持物品完整性

*对于任意* 物品列表和每页物品数量，分页后所有页面的物品总和应该等于原始物品列表，且没有重复或遗漏。

**验证: 需求 2.2, 2.4**

### 属性 6: 总页数计算正确性

*对于任意* 物品数量和每页物品数量，总页数应该等于 `Math.ceil(物品数量 / 每页物品数量)`，且至少为 1。

**验证: 需求 4.1**

### 属性 7: 页码自动调整

*对于任意* 当前页码和新的总页数，如果当前页码超出范围（>= 总页数），则应该自动调整为最后一页（总页数 - 1）。

**验证: 需求 4.3, 6.4**

### 属性 8: 筛选重置分页

*对于任意* 筛选类型切换，当前页码应该重置为 0，且分页应该基于筛选后的物品数量重新计算。

**验证: 需求 5.1, 5.2**

### 属性 9: 筛选状态保持

*对于任意* 响应式更新（列数改变），当前的筛选类型应该保持不变。

**验证: 需求 6.3**

### 属性 10: 防抖函数行为

*对于任意* 连续的函数调用序列，防抖函数应该只在最后一次调用后的等待时间过后执行一次。

**验证: 需求 7.1**

### 属性 11: 条件渲染

*对于任意* 列数更新，只有当新列数与当前列数不同时，才应该触发重新渲染。

**验证: 需求 7.3**

## 错误处理

### 1. 容器宽度为 0 或负数

**场景**: 容器尚未渲染或被隐藏

**处理**: 
- 使用默认列数（4 列）
- 记录警告日志
- 不触发重新渲染

### 2. 计算出的列数为 0

**场景**: 容器宽度极小（< 120px）

**处理**:
- 强制使用最小列数（1 列）
- 允许水平滚动

### 3. 物品数组为空

**场景**: 没有物品或筛选结果为空

**处理**:
- 显示空状态 UI
- 隐藏分页控件
- 总页数设为 1

### 4. ResizeObserver 不支持

**场景**: 旧浏览器不支持 ResizeObserver API

**处理**:
- 降级到 window.resize 事件
- 使用防抖避免性能问题
- 记录警告日志

### 5. 页码超出范围

**场景**: 筛选或容量改变导致总页数减少

**处理**:
- 自动调整到最后一页
- 保持用户体验流畅
- 不显示错误信息

## 测试策略

### 单元测试

单元测试用于验证特定示例、边界条件和错误处理：

1. **列数计算边界条件**:
   - 容器宽度 = 0
   - 容器宽度 = 120（恰好 1 列）
   - 容器宽度 = 132（1 列 + 间距）
   - 容器宽度 = 1200（多列）
   - 容器宽度极大（测试上限 8 列）

2. **分页边界条件**:
   - 0 个物品
   - 1 个物品
   - 恰好 1 页（12 个物品，假设 4 列）
   - 恰好 2 页（24 个物品）
   - 不完整的最后一页（25 个物品）

3. **筛选功能**:
   - 筛选结果为空
   - 筛选结果为 1 个物品
   - 筛选后切换回"全部"

4. **错误处理**:
   - 容器宽度为负数
   - 物品数组为 null 或 undefined
   - 无效的筛选类型

### 属性测试

属性测试用于验证通用属性在所有输入下都成立：

1. **列数计算属性**（属性 1）:
   - 生成随机容器宽度（0-2000px）
   - 验证列数在 [1, 8] 范围内
   - 验证列数是最大可容纳值

2. **每页物品数量属性**（属性 2）:
   - 生成随机列数（1-8）
   - 验证每页物品数量 = 列数 × 3

3. **分页完整性属性**（属性 5）:
   - 生成随机物品列表（0-100 个物品）
   - 生成随机每页物品数量（1-20）
   - 验证所有页面的物品总和等于原始列表
   - 验证没有重复物品

4. **总页数计算属性**（属性 6）:
   - 生成随机物品数量（0-100）
   - 生成随机每页物品数量（1-20）
   - 验证总页数 = Math.ceil(物品数量 / 每页物品数量)

5. **页码调整属性**（属性 7）:
   - 生成随机当前页码（0-20）
   - 生成随机新总页数（1-10）
   - 验证调整后的页码在 [0, 总页数-1] 范围内

6. **防抖函数属性**（属性 10）:
   - 生成随机调用序列（时间间隔和调用次数）
   - 验证只在最后一次调用后执行一次

### 测试配置

- **属性测试迭代次数**: 每个属性测试至少运行 100 次
- **测试框架**: Vitest + fast-check（TypeScript 的属性测试库）
- **标签格式**: `Feature: warehouse-panel-grid-layout-bugfix, Property {number}: {property_text}`

### 集成测试

1. **完整渲染流程**:
   - 创建仓库面板
   - 添加物品
   - 验证网格布局和分页
   - 切换筛选
   - 验证分页更新

2. **响应式行为**:
   - 模拟容器大小改变
   - 验证列数和分页更新
   - 验证筛选状态保持

3. **用户交互**:
   - 点击分页按钮
   - 切换筛选标签
   - 验证 UI 状态更新
