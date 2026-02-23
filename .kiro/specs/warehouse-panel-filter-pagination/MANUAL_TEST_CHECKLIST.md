# Manual Testing Checklist - Warehouse Panel Filter and Pagination

## Test Environment Setup
- [ ] Build the project: `npm run build`
- [ ] Start the development server: `npm run dev`
- [ ] Open the game in a browser
- [ ] Navigate to the camp scene
- [ ] Open the warehouse panel (Item tab)

## Test 1: Filter Tab Display (Requirements 1.1-1.5)

### Test 1.1: Filter Tabs Visible
- [ ] Verify 6 filter tabs are displayed in the bottom-left corner
- [ ] Verify tabs show: 全部, 材料, 菜肴, 书, 装备, 消耗品
- [ ] Verify "全部" (All) is highlighted by default
- [ ] Verify active tab has blue background (rgba(102, 126, 234, 0.8))
- [ ] Verify inactive tabs have white background (rgba(255, 255, 255, 0.6))

### Test 1.2: Filter Tab Hover Effects
- [ ] Hover over an inactive filter tab
- [ ] Verify background changes to lighter white (rgba(255, 255, 255, 0.8))
- [ ] Move mouse away
- [ ] Verify background returns to normal (rgba(255, 255, 255, 0.6))

## Test 2: Filter Tab Interaction (Requirements 2.1-2.5)

### Test 2.1: Click Filter Tabs
- [ ] Click "材料" (Material) tab
- [ ] Verify only material items are displayed
- [ ] Verify "材料" tab is now highlighted
- [ ] Verify page resets to 1/X

### Test 2.2: Test Each Filter Type
- [ ] Click "全部" - verify all items shown
- [ ] Click "材料" - verify only materials shown
- [ ] Click "菜肴" - verify only food items shown
- [ ] Click "书" - verify only books shown
- [ ] Click "装备" - verify only equipment shown
- [ ] Click "消耗品" - verify only consumables shown

### Test 2.3: Filter Reset Behavior
- [ ] Navigate to page 3 (if available)
- [ ] Click a different filter tab
- [ ] Verify page resets to 1/X
- [ ] Verify correct items for new filter are shown

## Test 3: Item Type Filtering (Requirements 3.1-3.5, 4.1-4.3)

### Test 3.1: Material Filter
- [ ] Click "材料" filter
- [ ] Verify these items appear (if in inventory):
  - 史莱姆甜珠, 甜浆腺体, 光滑蛇皮, 双头蛇肝
  - 迷香菇, 草菇虫薄翼, 赤鬃獠牙, 赤鬃毛皮
  - 橡木材, 铜矿石, 兰香草, 苦根, 苦汁
  - 蓝芝蛛前腿, 幽蓝芝士球, 粗盐块, 盐石结晶
  - 铁矿石, 爆浆果, 尸薯, 三色眼珠
  - 火舌蛙腿, 火辣舌, 抽搐的藤芯, 跳动的胆囊
  - 夜视草

### Test 3.2: Food Filter
- [ ] Click "菜肴" filter
- [ ] Verify these items appear (if in inventory):
  - 史莱姆QQ糖, 糖腌蛇肝, 香煎菇片, 冰糖迷香菇
  - 双头蛇皮冻, 酥翼蛇皮卷, 草原套餐, 苦团
  - 窒息特饮, 清蒸蛛腿, 酱烧蛛腿, 咸妃糖
  - 脱水压缩饼, 森林套餐, 手指薯条, 胆汁拌面
  - 蛙腿刺身, 干锅眼蛙, 碳烤脆藤, 火爆双脆
  - 洞穴套餐

### Test 3.3: Book Filter
- [ ] Click "书" filter
- [ ] Verify these items appear (if in inventory):
  - 《重拳出击》技能书
  - 《激怒》技能书
  - 《简易包扎》技能书
  - 《冲锋》技能书

### Test 3.4: No Cross-Contamination
- [ ] For each filter, verify NO items from other categories appear
- [ ] Material filter should NOT show food, books, equipment, or consumables
- [ ] Food filter should NOT show materials, books, equipment, or consumables
- [ ] Etc.

## Test 4: Pagination Control Display (Requirements 5.1-5.5)

### Test 4.1: Pagination Controls Visible
- [ ] Ensure inventory has more than 12 items
- [ ] Verify pagination controls appear in bottom-right corner
- [ ] Verify "Previous" button is visible
- [ ] Verify page indicator shows "1/X" format
- [ ] Verify "Next" button is visible

### Test 4.2: Button Disabled States
- [ ] On page 1, verify "Previous" button is dark gray (disabled)
- [ ] On page 1, verify "Next" button is enabled (if multiple pages)
- [ ] Navigate to last page
- [ ] Verify "Next" button is dark gray (disabled)
- [ ] Verify "Previous" button is enabled

### Test 4.3: Page Indicator Format
- [ ] Verify page indicator shows current/total (e.g., "1/3", "2/5")
- [ ] Verify format is consistent across all pages

## Test 5: Pagination Navigation (Requirements 6.1-6.5)

### Test 5.1: Next Button Navigation
- [ ] Start on page 1
- [ ] Click "Next" button
- [ ] Verify page indicator updates to "2/X"
- [ ] Verify different items are displayed
- [ ] Verify "Previous" button is now enabled

### Test 5.2: Previous Button Navigation
- [ ] Navigate to page 2 or higher
- [ ] Click "Previous" button
- [ ] Verify page indicator decrements
- [ ] Verify previous page items are displayed

### Test 5.3: Multi-Page Navigation
- [ ] Navigate through all pages using "Next"
- [ ] Verify each page shows different items
- [ ] Navigate back through all pages using "Previous"
- [ ] Verify items match original pages

## Test 6: Items Per Page (Requirements 7.1-7.4)

### Test 6.1: Full Pages
- [ ] Ensure inventory has 25+ items
- [ ] Navigate to page 1
- [ ] Count items displayed - should be exactly 12
- [ ] Navigate to page 2
- [ ] Count items displayed - should be exactly 12

### Test 6.2: Last Page
- [ ] Navigate to the last page
- [ ] Count items displayed
- [ ] Verify count is between 1 and 12
- [ ] Verify count matches (total items % 12) or 12 if evenly divisible

### Test 6.3: Single Page
- [ ] Filter to show 12 or fewer items
- [ ] Verify all items fit on one page
- [ ] Verify page indicator shows "1/1"

## Test 7: Filter and Pagination Integration (Requirements 8.1-8.5)

### Test 7.1: Filter Recalculates Pagination
- [ ] Start with "全部" filter showing multiple pages
- [ ] Note the total page count
- [ ] Switch to "材料" filter
- [ ] Verify total page count recalculates based on filtered items
- [ ] Verify page resets to 1

### Test 7.2: Empty State
- [ ] Apply a filter with no matching items (e.g., "书" if no books in inventory)
- [ ] Verify empty state message is displayed
- [ ] Verify pagination controls are hidden
- [ ] Verify no item grid is shown

### Test 7.3: Pagination Visibility
- [ ] Filter to show 1-12 items
- [ ] Verify pagination controls are hidden (only 1 page)
- [ ] Filter to show 13+ items
- [ ] Verify pagination controls are visible

### Test 7.4: Filter + Pagination Flow
- [ ] Start with "全部" filter on page 3
- [ ] Switch to "材料" filter
- [ ] Verify page resets to 1
- [ ] Navigate to page 2 of materials
- [ ] Switch to "菜肴" filter
- [ ] Verify page resets to 1 again

## Test 8: UI Layout Preservation (Requirements 9.1-9.5)

### Test 8.1: No Overlapping
- [ ] Verify filter tabs don't overlap with item grid
- [ ] Verify pagination controls don't overlap with item grid
- [ ] Verify filter tabs and pagination don't overlap each other
- [ ] Verify all controls are within the warehouse panel bounds

### Test 8.2: Existing Functionality
- [ ] Click "Character" tab
- [ ] Verify character panel displays correctly
- [ ] Click "Item" tab
- [ ] Verify item panel with filters/pagination displays
- [ ] Click "Cooking" tab
- [ ] Verify cooking panel displays correctly

### Test 8.3: State Preservation
- [ ] In Item tab, set filter to "材料"
- [ ] Navigate to page 2
- [ ] Switch to Character tab
- [ ] Switch back to Item tab
- [ ] Verify filter is still "材料"
- [ ] Verify page is still 2

### Test 8.4: Item Grid Layout
- [ ] Verify item grid maintains 4 columns
- [ ] Verify item cards are properly sized
- [ ] Verify spacing between items is consistent
- [ ] Verify item images, names, and quantities display correctly

## Test 9: Edge Cases

### Test 9.1: Empty Inventory
- [ ] Start with empty inventory (or clear it)
- [ ] Open Item tab
- [ ] Verify empty state message is shown
- [ ] Verify no filter tabs cause errors
- [ ] Verify no pagination controls are shown

### Test 9.2: Exactly 12 Items
- [ ] Ensure inventory has exactly 12 items
- [ ] Verify all items fit on one page
- [ ] Verify pagination shows "1/1"
- [ ] Verify pagination controls are hidden

### Test 9.3: Exactly 13 Items
- [ ] Ensure inventory has exactly 13 items
- [ ] Verify page 1 shows 12 items
- [ ] Verify page 2 shows 1 item
- [ ] Verify pagination shows "1/2" then "2/2"

### Test 9.4: Rapid Filter Switching
- [ ] Rapidly click between different filter tabs
- [ ] Verify no visual glitches occur
- [ ] Verify correct items always display
- [ ] Verify page always resets to 1

### Test 9.5: Rapid Page Navigation
- [ ] Rapidly click "Next" button multiple times
- [ ] Verify page doesn't exceed total pages
- [ ] Rapidly click "Previous" button multiple times
- [ ] Verify page doesn't go below 1

## Test 10: Visual Styling

### Test 10.1: Filter Tab Styling
- [ ] Verify active tab has blue background
- [ ] Verify inactive tabs have white background
- [ ] Verify text is readable on both backgrounds
- [ ] Verify hover effects are smooth

### Test 10.2: Pagination Styling
- [ ] Verify buttons have consistent styling
- [ ] Verify disabled buttons are visually distinct (dark gray)
- [ ] Verify enabled buttons respond to hover
- [ ] Verify page indicator text is clear and readable

### Test 10.3: Responsive Behavior
- [ ] Resize browser window to smaller size
- [ ] Verify controls remain visible and functional
- [ ] Verify no layout breaks occur
- [ ] Verify text remains readable

## Test 11: Property-Based Test Verification

### Test 11.1: Run Property Tests
- [ ] Run: `npm test -- --run GameUI.property.test`
- [ ] Verify all Property 1 tests pass (Filter Exclusivity)
- [ ] Verify all Property 2 tests pass (Pagination Bounds)
- [ ] Verify all Property 3 tests pass (Items Per Page Limit)
- [ ] Verify all Property 4 tests pass (Last Page Item Count)
- [ ] Verify all Property 5 tests pass (Filter Reset on Change)
- [ ] Verify all Property 6 tests pass (Button Disable State Consistency)
- [ ] Verify all Property 7 tests pass (Empty State Visibility)
- [ ] Verify all Property 8 tests pass (Pagination Visibility)

### Test 11.2: Run Unit Tests
- [ ] Run: `npm test -- --run GameUI.test`
- [ ] Verify all existing GameUI tests still pass
- [ ] Verify no regressions in existing functionality

## Test Results Summary

### Passed Tests
- [ ] All filter tab display tests passed
- [ ] All filter interaction tests passed
- [ ] All item type filtering tests passed
- [ ] All pagination display tests passed
- [ ] All pagination navigation tests passed
- [ ] All items per page tests passed
- [ ] All integration tests passed
- [ ] All UI layout tests passed
- [ ] All edge case tests passed
- [ ] All visual styling tests passed
- [ ] All property-based tests passed
- [ ] All unit tests passed

### Failed Tests
(List any failed tests here with details)

### Issues Found
(List any bugs or issues discovered during testing)

### Notes
(Any additional observations or comments)

---

## Sign-off

Tester: ___________________
Date: ___________________
Status: [ ] PASS [ ] FAIL [ ] NEEDS REVIEW
