# Cooking UI Bug Fixes - Implementation Tasks

## Task List

### 1. Add Recipe Selection State Management
- [ ] 1.1 Add `selectedRecipeId` instance variable to GameUI class
  - Add `private selectedRecipeId: string | null = null;` to GameUI class properties
  - Initialize to null

- [ ] 1.2 Update `renderRecipes()` method to use instance variable
  - Remove local `selectedRecipe` variable declaration
  - Replace all references to `selectedRecipe` with `this.selectedRecipeId`
  - Update recipe click handler to set `this.selectedRecipeId = recipe.id`
  - Update visual highlight logic to check `recipe.id === this.selectedRecipeId`

- [ ] 1.3 Maintain visual highlight for selected recipe
  - When rendering recipe cards, apply glow effect if `recipe.id === this.selectedRecipeId`
  - Ensure glow effect is removed from non-selected cards
  - Update the initial selection to set `this.selectedRecipeId = recipes[0].id`

- [ ] 1.4 Update cooking button handler to preserve selection
  - After successful cooking, keep `this.selectedRecipeId` unchanged
  - Call `renderRecipeDetailsInActionPanel()` with the same recipe object
  - Verify ingredient quantities update correctly

### 2. Fix Cooking Button Error Handling
- [ ] 2.1 Add validation checks before cooking
  - Add null check for `this.playerEntity`
  - Add null check for `this.cookingSystem`
  - Add validation for recipe object and recipe.id
  - Show appropriate error messages for each validation failure

- [ ] 2.2 Add try-catch error handling
  - Wrap cooking operation in try-catch block
  - Log errors to console with full context
  - Show user-friendly error notification
  - Ensure UI remains stable after errors

- [ ] 2.3 Add debugging logs
  - Log recipe ID before cooking
  - Log cooking result (success/failure)
  - Log ingredient quantities before and after cooking
  - Log any errors with stack trace

### 3. Testing and Verification
- [ ] 3.1 Test recipe selection persistence
  - Select a recipe from the list
  - Cook the recipe successfully
  - Verify the same recipe remains selected
  - Verify ingredient quantities update
  - Verify cooking button state updates

- [ ] 3.2 Test cooking button functionality
  - Test cooking with sufficient ingredients
  - Test cooking with insufficient ingredients
  - Test cooking with full inventory
  - Verify appropriate messages for each scenario

- [ ] 3.3 Test edge cases
  - Cook the same recipe multiple times in a row
  - Switch between recipes and cook different ones
  - Test with various recipe rarities
  - Verify visual highlights persist correctly

- [ ] 3.4 Verify error handling
  - Check console for any unhandled errors
  - Verify error messages are user-friendly
  - Verify UI remains stable after errors
  - Test all validation paths

## Task Dependencies
- Task 1.1 must be completed before 1.2
- Task 1.2 must be completed before 1.3 and 1.4
- Task 2.1 must be completed before 2.2
- All implementation tasks (1.x and 2.x) must be completed before testing tasks (3.x)

## Estimated Time
- Task 1: 30 minutes
- Task 2: 20 minutes
- Task 3: 20 minutes
- **Total**: 70 minutes

## Success Criteria
- ✅ Recipe selection persists after cooking
- ✅ No errors when clicking cooking button
- ✅ Ingredient quantities update correctly
- ✅ Visual highlights work correctly
- ✅ Error messages are clear and helpful
- ✅ UI remains stable in all scenarios
