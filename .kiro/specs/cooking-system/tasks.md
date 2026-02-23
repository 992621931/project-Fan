# Implementation Plan: Cooking System

## Overview

This implementation plan breaks down the Cooking System feature into discrete coding tasks. The system will be built incrementally, starting with core data structures and logic, then adding the UI layer, and finally integrating with existing systems. Each task builds on previous work to ensure continuous validation.

## Tasks

- [x] 1. Create cooking recipe data structure and JSON configuration
  - Create `src/game/data/cooking-recipes.json` with the seven initial recipes
  - Define recipe structure matching the design (id, name, rarity, icon, description, sellPrice, ingredients)
  - Ensure all ingredient itemIds reference existing items in the item database
  - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 1.1 Write unit tests for recipe data validation
  - Test that all seven recipes load correctly
  - Test that all required fields are present
  - Test that ingredient references are valid
  - _Requirements: 5.2, 5.3, 5.4_

- [x] 2. Implement CookingSystem core logic
  - [x] 2.1 Create CookingSystem class extending System
    - Define CookingRecipe, CookingIngredient, CookingValidation, and CookingResult interfaces
    - Implement recipe storage using Map<string, CookingRecipe>
    - Add required components (InventoryComponentType)
    - _Requirements: 5.1, 5.2_

  - [x] 2.2 Implement recipe loading from JSON
    - Create `loadRecipes(recipesData: any): void` method
    - Parse JSON and populate recipes Map
    - Validate recipe structure during loading
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 2.3 Write property test for recipe structure validation
    - **Property 7: Recipe Structure Validation**
    - **Validates: Requirements 5.2, 5.3**

  - [x] 2.4 Write property test for item reference validation
    - **Property 8: Item Reference Validation**
    - **Validates: Requirements 5.4**

  - [x] 2.5 Implement recipe query methods
    - Create `getAllRecipes(): CookingRecipe[]` method
    - Create `getRecipe(recipeId: string): CookingRecipe | undefined` method
    - Handle invalid recipe IDs gracefully
    - _Requirements: 2.1_

  - [x] 2.6 Implement ingredient validation logic
    - Create `validateCooking(playerId: EntityId, recipeId: string): CookingValidation` method
    - Create private `hasIngredients(inventory: InventoryComponent, ingredients: CookingIngredient[]): boolean` method
    - Check player inventory for each required ingredient
    - Return list of missing ingredients
    - _Requirements: 3.3, 4.1, 4.2_

  - [x] 2.7 Write property test for ingredient availability indication
    - **Property 3: Ingredient Availability Indication**
    - **Validates: Requirements 3.3**

  - [x] 2.8 Implement cooking execution logic
    - Create `cook(playerId: EntityId, recipeId: string): CookingResult` method
    - Create private `consumeIngredients(inventory: InventoryComponent, ingredients: CookingIngredient[]): boolean` method
    - Create private `createDish(playerId: EntityId, recipe: CookingRecipe): void` method
    - Validate ingredients before consuming
    - Atomically consume ingredients and create dish
    - Handle full inventory error case
    - Emit 'cooking:started' and 'cooking:completed' events
    - _Requirements: 4.3, 4.4, 7.1, 7.2_

  - [x] 2.9 Write property test for cooking transaction atomicity
    - **Property 5: Cooking Transaction Atomicity**
    - **Validates: Requirements 4.3, 4.4**

  - [x] 2.10 Write property test for dish creation with property preservation
    - **Property 9: Dish Creation with Property Preservation**
    - **Validates: Requirements 7.1, 7.2**

  - [x] 2.11 Write property test for event emission
    - **Property 10: Event Emission on Cooking**
    - **Validates: Requirements 8.3**

  - [x] 2.12 Write unit tests for error handling
    - Test invalid recipe ID handling
    - Test insufficient ingredients handling
    - Test full inventory handling
    - Test invalid item references handling
    - _Requirements: 4.2_

- [x] 3. Checkpoint - Ensure CookingSystem tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement CookingPanel UI component
  - [x] 4.1 Create CookingPanel class extending BaseUIComponent
    - Set up basic panel structure with header and close button
    - Create three main sections: recipe grid, details panel, and cooking button area
    - Initialize component references (recipeGrid, detailsPanel)
    - Add to warehouse panel as a new tab
    - _Requirements: 1.1, 1.2_

  - [x] 4.2 Implement recipe grid rendering
    - Create `renderRecipeGrid(): void` method
    - Query CookingSystem for all recipes
    - Render each recipe as a card with name, rarity indicator, and icon
    - Apply rarity-based color styling
    - Add click handlers for recipe selection
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 4.3 Write property test for recipe card rendering completeness
    - **Property 1: Recipe Card Rendering Completeness**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 4.4 Write property test for recipe selection updates
    - **Property 2: Recipe Selection Updates Details Panel**
    - **Validates: Requirements 2.3, 3.1, 3.2**

  - [x] 4.5 Implement recipe details panel rendering
    - Create `renderRecipeDetails(): void` method
    - Display selected recipe's name, rarity, icon, description, and sell price
    - Create `renderIngredients(recipe: CookingRecipe): void` method
    - List all required ingredients with quantities
    - Show availability indicators (green checkmark if sufficient, red X if insufficient)
    - Display "开始烹饪" button
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.6 Implement cooking button logic
    - Create `handleCookingClick(): void` method
    - Query CookingSystem to validate ingredients
    - Enable button only when all ingredients are available
    - Disable and gray out button when ingredients are insufficient
    - Call CookingSystem.cook() when button is clicked
    - Display success/error notifications
    - Refresh UI after cooking
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.7 Write property test for cooking button state
    - **Property 4: Cooking Button State Based on Ingredients**
    - **Validates: Requirements 4.1, 4.2**

  - [x] 4.8 Write property test for UI reflects inventory state
    - **Property 6: UI Reflects Inventory State**
    - **Validates: Requirements 4.5**

  - [x] 4.9 Implement helper methods for UI styling
    - Create `getRarityColor(rarity: RarityType): string` method
    - Create `getRarityName(rarity: RarityType): string` method
    - Ensure visual consistency with CraftingPanel
    - _Requirements: 8.1, 8.2_

  - [x] 4.10 Write unit tests for CookingPanel rendering
    - Test recipe grid renders with mock recipes
    - Test details panel shows correct information
    - Test button state changes based on ingredients
    - Test UI updates after cooking
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 4.5_

- [x] 5. Checkpoint - Ensure CookingPanel tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integrate CookingPanel with warehouse panel
  - [x] 6.1 Add cooking tab to warehouse panel
    - Modify warehouse panel to include "烹饪" tab
    - Wire up tab click handler to show/hide CookingPanel
    - Ensure only one tab's content is visible at a time
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 6.2 Write property test for tab switching behavior
    - **Property (from 1.3)**: Tab switching hides other content
    - Test that clicking cooking tab shows cooking UI and hides other tabs
    - _Requirements: 1.3_

  - [x] 6.3 Register CookingSystem with World
    - Add CookingSystem to the game's system registry
    - Ensure CookingSystem initializes with recipe data
    - Load cooking recipes from JSON file during initialization
    - _Requirements: 5.1_

  - [x] 6.4 Set up event listeners
    - Listen for 'inventory:updated' events to refresh UI
    - Listen for 'cooking:completed' events to show notifications
    - Ensure CookingPanel re-renders when inventory changes
    - _Requirements: 4.5_

  - [x] 6.5 Write integration tests
    - Test CookingPanel communicates correctly with CookingSystem
    - Test CookingSystem modifies InventoryComponent correctly
    - Test created dishes are compatible with ShopSystem
    - Test recipe data loads from JSON file
    - _Requirements: 7.3_

- [x] 7. Create dish items in item database
  - [x] 7.1 Add seven dish items to items.json
    - Create item entries for all seven cooked dishes
    - Set itemType to 'food' or 'consumable'
    - Include name, description, rarity, icon, and sellPrice
    - Ensure item IDs match recipe result references
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2_

  - [x] 7.2 Write unit tests for dish item compatibility
    - Test that dishes can be added to inventory
    - Test that dishes can be sold in shop
    - Test that dish properties match recipe definitions
    - _Requirements: 7.2, 7.3_

- [x] 8. Final checkpoint - End-to-end validation
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all seven recipes are accessible and functional
  - Verify cooking consumes ingredients and creates dishes correctly
  - Verify UI updates reflect inventory changes
  - Verify visual consistency with existing panels

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows the existing CraftingSystem architecture for consistency
- TypeScript is used throughout, matching the existing codebase
