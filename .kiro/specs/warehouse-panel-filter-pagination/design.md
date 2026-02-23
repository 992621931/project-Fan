# Design Document: Warehouse Panel Filter and Pagination

## Overview

This design adds filtering and pagination functionality to the warehouse panel's item tab. The implementation will modify the existing `renderItemGrid` method in `GameUI.ts` to support:
- Filter tabs for item type categories (All, Material, Food, Book, Equipment, Consumable)
- Pagination controls (Previous, Page Indicator, Next)
- Integration between filtering and pagination
- Updates to item type data in `items.json`

The design maintains the existing UI layout and styling while adding new controls in the bottom corners of the item view.

## Architecture

### Component Structure

```
Warehouse Panel (Item Tab)
├── Tab Container (existing)
│   ├── Character Tab
│   ├── Item Tab (active)
│   └── Cooking Tab
├── Content Area
│   ├── Item Grid Container (12 items max)
│   ├── Filter Tabs Container (bottom-left)
│   │   ├── All Filter
│   │   ├── Material Filter
│   │   ├── Food Filter
│   │   ├── Book Filter
│   │   ├── Equipment Filter
│   │   └── Consumable Filter
│   └── Pagination Container (bottom-right)
│       ├── Previous Button
│       ├── Page Indicator (current/total)
│       └── Next Button
```

### State Management

The item tab will maintain the following state:
- `currentFilter`: string - Currently active filter type ('all', 'material', 'food', 'book', 'equipment', 'consumable')
- `currentPage`: number - Current page index (0-based)
- `itemsPerPage`: number - Fixed at 12 items per page
- `filteredItems`: array - Items matching the current filter
- `totalPages`: number - Calculated from filteredItems.length / itemsPerPage

## Components and Interfaces

### Filter Tab Component

Each filter tab is a button element with:
- Text label (Chinese)
- Active/inactive styling
- Click handler to update filter state

```typescript
interface FilterTab {
  type: 'all' | 'material' | 'food' | 'book' | 'equipment' | 'consumable';
  label: string;
  isActive: boolean;
}

const filterTabs: FilterTab[] = [
  { type: 'all', label: '全部', isActive: true },
  { type: 'material', label: '材料', isActive: false },
  { type: 'food', label: '菜肴', isActive: false },
  { type: 'book', label: '书', isActive: false },
  { type: 'equipment', label: '装备', isActive: false },
  { type: 'consumable', label: '消耗品', isActive: false }
];
```

### Pagination Component

Pagination controls consist of three elements:
- Previous button: Navigates to previous page, disabled on first page
- Page indicator: Shows "current/total" format
- Next button: Navigates to next page, disabled on last page

```typescript
interface PaginationState {
  currentPage: number;  // 0-based index
  totalPages: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
}
```

### Item Filtering Logic

```typescript
function filterItems(items: InventorySlot[], filterType: string): InventorySlot[] {
  if (filterType === 'all') {
    return items;
  }
  
  return items.filter(slot => {
    const itemData = itemSystem.getItem(slot.itemId);
    return itemData && itemData.type === filterType;
  });
}
```

### Pagination Logic

```typescript
function paginateItems(items: InventorySlot[], page: number, itemsPerPage: number): InventorySlot[] {
  const startIndex = page * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return items.slice(startIndex, endIndex);
}

function calculateTotalPages(itemCount: number, itemsPerPage: number): number {
  return Math.ceil(itemCount / itemsPerPage);
}
```

## Data Models

### Item Data Structure (items.json)

Each item in `items.json` has a `type` field that must be one of:
- `"material"` - Raw materials and ingredients
- `"food"` - Consumable food items
- `"book"` - Skill books
- `"equipment"` - Weapons, armor, accessories
- `"consumable"` - Potions and other consumables

Example:
```json
{
  "id": "slime_sweet_pearl",
  "name": "史莱姆甜珠",
  "type": "material",
  "rarity": 0,
  "stackSize": 999
}
```

### Item Type Mappings

The following items need their `type` field updated in `items.json`:

**Materials (type: "material"):**
- 史莱姆甜珠 (slime_sweet_pearl)
- 甜浆腺体 (sweet_syrup_gland)
- 光滑蛇皮 (smooth_snake_skin)
- 双头蛇肝 (two_headed_snake_liver)
- 迷香菇 (mystic_mushroom)
- 草菇虫薄翼 (grass_mushroom_worm_thin_wing)
- 赤鬃獠牙 (red_mane_fang)
- 赤鬃毛皮 (red_mane_fur)
- 橡木材 (oak_wood)
- 铜矿石 (copper_ore)
- 兰香草 (lavender)
- 苦根 (bitter_root)
- 苦汁 (bitter_juice)
- 蓝芝蛛前腿 (blue_spider_front_leg)
- 幽蓝芝士球 (blue_cheese_ball)
- 粗盐块 (coarse_salt_block)
- 盐石结晶 (salt_stone_crystal)
- 胡克腿骨 (hook_leg_bone) - Not found in items.json, may need to be added
- 胡克弯牙 (hook_curved_fang) - Not found in items.json, may need to be added
- 桦木材 (birch_wood) - Not found in items.json, may need to be added
- 铁矿石 (iron_ore)
- 爆浆果 (burst_fruit)
- 尸薯 (corpse_potato)
- 三色眼珠 (three_color_eyeball)
- 火舌蛙腿 (fire_tongue_frog_leg)
- 火辣舌 (spicy_tongue)
- 抽搐的藤芯 (twitching_vine_core)
- 跳动的胆囊 (beating_gallbladder)
- 幽灵蜥蜴皮 (ghost_lizard_skin) - Not found in items.json, may need to be added
- 幽灵蜥蜴吸盘 (ghost_lizard_sucker) - Not found in items.json, may need to be added
- 蓝昙木材 (blue_tan_wood) - Not found in items.json, may need to be added
- 黄珀矿石 (amber_ore) - Not found in items.json, may need to be added
- 夜视草 (night_vision_grass)

**Books (type: "book"):**
- Note: Skill books are not in items.json, they are in item-prefabs.json
- 《重拳出击》技能书 (skill_book_heavy_punch)
- 《激怒》技能书 (skill_book_enrage)
- 《简易包扎》技能书 (skill_book_simple_bandage)
- 《冲锋》技能书 (skill_book_charge)

**Food (type: "food"):**
- 史莱姆QQ糖 (slime_qq_candy)
- 糖腌蛇肝 (sugar_pickled_snake_liver)
- 香煎菇片 (fried_mushroom_slices)
- 冰糖迷香菇 (candied_mystic_mushroom)
- 双头蛇皮冻 (two_headed_snake_skin_jelly)
- 酥翼蛇皮卷 (crispy_wing_snake_skin_roll)
- 草原套餐 (grassland_set_meal)
- 苦团 (bitter_ball)
- 窒息特饮 (suffocating_special_drink)
- 清蒸蛛腿 (steamed_spider_leg)
- 酱烧蛛腿 (braised_spider_leg)
- 咸妃糖 (salty_concubine_candy)
- 脱水压缩饼 (dehydrated_compressed_biscuit)
- 森林套餐 (forest_set_meal)
- 手指薯条 (finger_fries)
- 胆汁拌面 (bile_noodles)
- 蛙腿刺身 (frog_leg_sashimi)
- 干锅眼蛙 (dry_pot_eye_frog)
- 碳烤脆藤 (charcoal_grilled_crispy_vine)
- 火爆双脆 (explosive_double_crispy)
- 洞穴套餐 (cave_set_meal)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Filter Exclusivity
*For any* item in the filtered results, the item's type must match the active filter type (or any type if filter is "all")
**Validates: Requirements 2.2, 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 2: Pagination Bounds
*For any* page number displayed, it must be within the valid range [1, totalPages] inclusive
**Validates: Requirements 5.5, 6.4**

### Property 3: Items Per Page Limit
*For any* page except the last page, the number of displayed items must equal 12
**Validates: Requirements 7.1, 7.2, 7.3**

### Property 4: Last Page Item Count
*For any* last page with items, the number of displayed items must be greater than 0 and less than or equal to 12
**Validates: Requirements 7.4**

### Property 5: Filter Reset on Change
*For any* filter change operation, the current page must be reset to 1
**Validates: Requirements 2.4, 8.2**

### Property 6: Button Disable State Consistency
*For any* pagination state, the previous button is disabled if and only if current page is 1, and the next button is disabled if and only if current page equals total pages
**Validates: Requirements 5.3, 5.4, 6.1, 6.2**

### Property 7: Empty State Visibility
*For any* filter with zero matching items, the empty state message must be displayed and pagination controls must be hidden
**Validates: Requirements 8.3, 8.4**

### Property 8: Pagination Visibility
*For any* filter with matching items, pagination controls are visible if and only if total pages is greater than 1
**Validates: Requirements 8.5**

## Error Handling

### Invalid Filter Type
- If an invalid filter type is provided, default to "all" filter
- Log warning to console

### Invalid Page Number
- If page number is less than 0, set to 0
- If page number exceeds total pages, set to last valid page
- Log warning to console

### Missing Item Data
- If item data cannot be retrieved from ItemSystem, skip that item in rendering
- Log error to console with item ID

### Empty Inventory
- Display empty state message
- Hide pagination controls
- Clear action panel

## Testing Strategy

### Unit Tests
- Test filter button click handlers
- Test pagination button click handlers
- Test page indicator format
- Test empty state rendering
- Test filter and pagination state preservation when switching tabs

### Property-Based Tests
- Generate random item inventories and verify filtering correctness (Property 1)
- Generate random page numbers and verify bounds (Property 2)
- Generate random item sets and verify items per page (Properties 3, 4)
- Generate random filter changes and verify page reset (Property 5)
- Generate random pagination states and verify button states (Property 6)
- Generate random empty filters and verify UI state (Properties 7, 8)

### Integration Tests
- Test complete user flow: open item tab → select filter → navigate pages
- Test filter switching with pagination
- Test tab switching preserves filter/pagination state
- Test with real item data from items.json

### Manual Testing
- Verify visual styling matches design
- Verify responsive behavior with different item counts
- Verify Chinese text displays correctly
- Verify button hover states
- Verify smooth transitions between pages
