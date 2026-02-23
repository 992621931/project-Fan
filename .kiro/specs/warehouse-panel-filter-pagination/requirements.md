# Requirements Document

## Introduction

This document specifies the requirements for adding filtering and pagination functionality to the warehouse panel's item tab. The feature will allow users to filter items by type using tab buttons and navigate through paginated results.

## Glossary

- **Warehouse_Panel**: The UI panel in the camp scene that displays characters, items, and cooking interface
- **Item_Tab**: The tab within the Warehouse_Panel that displays the player's inventory items
- **Filter_Tab**: A clickable button that filters items by a specific type
- **Item_Type**: A category classification for items (material, food, book, equipment, consumable)
- **Pagination_Control**: UI elements that allow navigation between pages of items
- **Current_Page**: The currently displayed page number in the pagination system
- **Total_Pages**: The total number of pages available based on filtered items
- **Items_Per_Page**: The maximum number of items displayed on a single page (12 items)

## Requirements

### Requirement 1: Filter Tab Display

**User Story:** As a player, I want to see filter tabs in the item view, so that I can quickly access different categories of items.

#### Acceptance Criteria

1. WHEN the Item_Tab is active, THE Warehouse_Panel SHALL display filter tabs in the bottom-left corner
2. THE Warehouse_Panel SHALL display exactly 6 filter tabs: 全部 (All), 材料 (Material), 菜肴 (Food), 书 (Book), 装备 (Equipment), 消耗品 (Consumable)
3. WHEN the Item_Tab is first opened, THE Warehouse_Panel SHALL set "全部" (All) as the active filter
4. WHEN a Filter_Tab is active, THE Warehouse_Panel SHALL display it with a highlighted visual style (rgba(102, 126, 234, 0.8) background)
5. WHEN a Filter_Tab is inactive, THE Warehouse_Panel SHALL display it with a dimmed visual style (rgba(255, 255, 255, 0.6) background)

### Requirement 2: Filter Tab Interaction

**User Story:** As a player, I want to click on filter tabs, so that I can view items of a specific type.

#### Acceptance Criteria

1. WHEN a user clicks a Filter_Tab, THE Warehouse_Panel SHALL update the active filter to that tab
2. WHEN a user clicks a Filter_Tab, THE Warehouse_Panel SHALL display only items matching the selected type
3. WHEN the "全部" (All) filter is active, THE Warehouse_Panel SHALL display all items regardless of type
4. WHEN a Filter_Tab is clicked, THE Warehouse_Panel SHALL reset the Current_Page to page 1
5. WHEN a Filter_Tab changes, THE Warehouse_Panel SHALL recalculate Total_Pages based on filtered items

### Requirement 3: Item Type Filtering

**User Story:** As a player, I want items to be correctly categorized, so that filters show the right items.

#### Acceptance Criteria

1. WHEN filtering by "材料" (Material), THE Warehouse_Panel SHALL display only items with type "material"
2. WHEN filtering by "菜肴" (Food), THE Warehouse_Panel SHALL display only items with type "food"
3. WHEN filtering by "书" (Book), THE Warehouse_Panel SHALL display only items with type "book"
4. WHEN filtering by "装备" (Equipment), THE Warehouse_Panel SHALL display only items with type "equipment"
5. WHEN filtering by "消耗品" (Consumable), THE Warehouse_Panel SHALL display only items with type "consumable"

### Requirement 4: Item Data Type Updates

**User Story:** As a developer, I want item types in items.json to be correctly classified, so that filtering works accurately.

#### Acceptance Criteria

1. THE items.json file SHALL set type to "material" for the following items: 史莱姆甜珠, 甜浆腺体, 光滑蛇皮, 双头蛇肝, 迷香菇, 草菇虫薄翼, 赤鬃獠牙, 赤鬃毛皮, 橡木材, 铜矿石, 兰香草, 苦根, 苦汁, 蓝芝蛛前腿, 幽蓝芝士球, 粗盐块, 盐石结晶, 胡克腿骨, 胡克弯牙, 桦木材, 铁矿石, 爆浆果, 尸薯, 三色眼珠, 火舌蛙腿, 火辣舌, 抽搐的藤芯, 跳动的胆囊, 幽灵蜥蜴皮, 幽灵蜥蜴吸盘, 蓝昙木材, 黄珀矿石, 夜视草
2. THE items.json file SHALL set type to "book" for the following items: 《重拳出击》技能书, 《激怒》技能书, 《简易包扎》技能书, 《冲锋》技能书
3. THE items.json file SHALL set type to "food" for the following items: 史莱姆QQ糖, 糖腌蛇肝, 香煎菇片, 冰糖迷香菇, 双头蛇皮冻, 酥翼蛇皮卷, 草原套餐, 苦团, 窒息特饮, 清蒸蛛腿, 酱烧蛛腿, 咸妃糖, 脱水压缩饼, 森林套餐, 手指薯条, 胆汁拌面, 蛙腿刺身, 干锅眼蛙, 碳烤脆藤, 火爆双脆, 洞穴套餐

### Requirement 5: Pagination Control Display

**User Story:** As a player, I want to see pagination controls, so that I can navigate through multiple pages of items.

#### Acceptance Criteria

1. WHEN the Item_Tab is active, THE Warehouse_Panel SHALL display pagination controls in the bottom-right corner
2. THE Warehouse_Panel SHALL display a "Previous" button, a page indicator, and a "Next" button
3. WHEN on the first page, THE Warehouse_Panel SHALL disable the "Previous" button with dark gray color
4. WHEN on the last page, THE Warehouse_Panel SHALL disable the "Next" button with dark gray color
5. THE Warehouse_Panel SHALL display the page indicator in the format "current/total" (e.g., "1/1", "3/8")

### Requirement 6: Pagination Navigation

**User Story:** As a player, I want to click pagination buttons, so that I can view different pages of items.

#### Acceptance Criteria

1. WHEN a user clicks the "Next" button and not on the last page, THE Warehouse_Panel SHALL navigate to the next page
2. WHEN a user clicks the "Previous" button and not on the first page, THE Warehouse_Panel SHALL navigate to the previous page
3. WHEN navigating to a new page, THE Warehouse_Panel SHALL display items for that page
4. WHEN navigating to a new page, THE Warehouse_Panel SHALL update the page indicator
5. WHEN navigating to a new page, THE Warehouse_Panel SHALL update button disabled states

### Requirement 7: Items Per Page

**User Story:** As a player, I want to see a consistent number of items per page, so that the interface is predictable.

#### Acceptance Criteria

1. THE Warehouse_Panel SHALL display a maximum of 12 items per page
2. WHEN the total filtered items is less than or equal to 12, THE Warehouse_Panel SHALL display all items on a single page
3. WHEN the total filtered items exceeds 12, THE Warehouse_Panel SHALL split items across multiple pages
4. WHEN on the last page with fewer than 12 items, THE Warehouse_Panel SHALL display only the remaining items

### Requirement 8: Filter and Pagination Integration

**User Story:** As a player, I want filters and pagination to work together, so that I can browse filtered results across pages.

#### Acceptance Criteria

1. WHEN a filter is applied, THE Warehouse_Panel SHALL recalculate pagination based on filtered items
2. WHEN switching filters, THE Warehouse_Panel SHALL reset to page 1
3. WHEN no items match the current filter, THE Warehouse_Panel SHALL display an empty state message
4. WHEN no items match the current filter, THE Warehouse_Panel SHALL hide pagination controls
5. WHEN items match the current filter, THE Warehouse_Panel SHALL show pagination controls if Total_Pages > 1

### Requirement 9: UI Layout Preservation

**User Story:** As a player, I want the new controls to fit naturally in the interface, so that the UI remains clean and usable.

#### Acceptance Criteria

1. THE Warehouse_Panel SHALL position filter tabs in the bottom-left corner without overlapping item grid
2. THE Warehouse_Panel SHALL position pagination controls in the bottom-right corner without overlapping item grid
3. THE Warehouse_Panel SHALL maintain existing item grid layout and styling
4. THE Warehouse_Panel SHALL maintain existing tab switching functionality for Character, Item, and Cooking tabs
5. WHEN switching between Character/Item/Cooking tabs, THE Warehouse_Panel SHALL preserve filter and pagination state for the Item_Tab
