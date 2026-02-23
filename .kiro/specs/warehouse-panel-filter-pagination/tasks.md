# Implementation Plan: Warehouse Panel Filter and Pagination

## Overview

This implementation adds filtering and pagination functionality to the warehouse panel's item tab in GameUI.ts. The approach modifies the existing `renderItemGrid` method to support filter tabs and pagination controls while maintaining the current UI layout.

## Tasks

- [x] 1. Update item type data in items.json and item-prefabs.json
  - Update type field to "material" for all material items listed in requirements
  - Update type field to "food" for all food items listed in requirements
  - Update type field to "book" for all skill book items in item-prefabs.json
  - Verify all items have correct type classification
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 2. Refactor renderItemGrid method to support filtering and pagination
  - [x] 2.1 Add state variables for filter and pagination
    - Add currentFilter state (default: 'all')
    - Add currentPage state (default: 0)
    - Add itemsPerPage constant (12)
    - _Requirements: 1.3, 7.1_
  
  - [x] 2.2 Implement item filtering logic
    - Create filterItems function that filters inventory by type
    - Handle 'all' filter to show all items
    - Handle specific type filters (material, food, book, equipment, consumable)
    - _Requirements: 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 2.3 Write property test for filter exclusivity
    - **Property 1: Filter Exclusivity**
    - **Validates: Requirements 2.2, 3.1, 3.2, 3.3, 3.4, 3.5**
  
  - [x] 2.4 Implement pagination logic
    - Create paginateItems function to slice items by page
    - Create calculateTotalPages function
    - Update page bounds checking
    - _Requirements: 5.5, 6.1, 6.2, 7.2, 7.3, 7.4_
  
  - [x] 2.5 Write property tests for pagination
    - **Property 2: Pagination Bounds**
    - **Property 3: Items Per Page Limit**
    - **Property 4: Last Page Item Count**
    - **Validates: Requirements 5.5, 6.4, 7.1, 7.2, 7.3, 7.4**

- [x] 3. Create filter tabs UI component
  - [x] 3.1 Create filter tabs container
    - Position in bottom-left corner
    - Create 6 filter tab buttons (全部, 材料, 菜肴, 书, 装备, 消耗品)
    - Apply active/inactive styling
    - _Requirements: 1.1, 1.2, 1.4, 1.5_
  
  - [x] 3.2 Implement filter tab click handlers
    - Update currentFilter state on click
    - Reset currentPage to 0 on filter change
    - Recalculate totalPages based on filtered items
    - Re-render item grid with filtered items
    - Update active tab styling
    - _Requirements: 2.1, 2.3, 2.4, 2.5_
  
  - [x] 3.3 Write property test for filter reset
    - **Property 5: Filter Reset on Change**
    - **Validates: Requirements 2.4, 8.2**

- [x] 4. Create pagination controls UI component
  - [x] 4.1 Create pagination container
    - Position in bottom-right corner
    - Create Previous button, page indicator, Next button
    - Apply button styling with disabled states
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 4.2 Implement pagination button click handlers
    - Handle Previous button click (decrement page)
    - Handle Next button click (increment page)
    - Update page indicator display
    - Update button disabled states
    - Re-render item grid for new page
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 4.3 Write property test for button disable states
    - **Property 6: Button Disable State Consistency**
    - **Validates: Requirements 5.3, 5.4, 6.1, 6.2**

- [x] 5. Integrate filter and pagination systems
  - [x] 5.1 Update renderItemGrid to use filter and pagination
    - Apply filtering before pagination
    - Calculate totalPages from filtered items
    - Display paginated subset of filtered items
    - _Requirements: 8.1_
  
  - [x] 5.2 Handle empty state for filtered results
    - Display empty state message when no items match filter
    - Hide pagination controls when no items
    - _Requirements: 8.3, 8.4_
  
  - [x] 5.3 Write property tests for empty state and pagination visibility
    - **Property 7: Empty State Visibility**
    - **Property 8: Pagination Visibility**
    - **Validates: Requirements 8.3, 8.4, 8.5**
  
  - [x] 5.4 Preserve filter/pagination state when switching tabs
    - Store filter and page state outside renderItemGrid
    - Restore state when returning to Item tab
    - _Requirements: 9.5_

- [x] 6. Update UI layout to accommodate new controls
  - [x] 6.1 Adjust content area layout
    - Add bottom padding for filter tabs and pagination
    - Ensure item grid doesn't overlap with controls
    - Maintain existing grid styling
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [x] 6.2 Verify tab switching functionality
    - Test Character/Item/Cooking tab switching
    - Ensure filter/pagination only appear in Item tab
    - Verify existing functionality remains intact
    - _Requirements: 9.4_

- [x] 7. Checkpoint - Test complete feature
  - Test all filter tabs with various item inventories
  - Test pagination with different item counts
  - Test filter + pagination integration
  - Test empty states
  - Test tab switching
  - Verify visual styling matches design
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation modifies existing GameUI.ts code, so careful testing is required
- Item type updates in JSON files are prerequisite for filtering to work correctly
