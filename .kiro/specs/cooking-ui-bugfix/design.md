# Cooking UI Bug Fixes - Design

## Overview
This design addresses two critical bugs in the cooking UI by implementing proper state management for recipe selection and ensuring robust error handling for the cooking action.

## Architecture

### State Management
The cooking UI currently lacks proper state management for the selected recipe. We will introduce an instance variable to track the currently selected recipe across method calls.

### Component Structure
```
GameUI
├── renderCookingPanel() - Main cooking panel container
├── renderRecipes() - Recipe grid rendering
├── renderRecipeDetailsInActionPanel() - Recipe details display
└── selectedRecipeId: string | null - NEW: Instance variable for selected recipe
```

## Detailed Design

### Fix 1: Recipe Selection Persistence

#### Problem Analysis
The `selectedRecipe` variable in `renderRecipes()` is declared as a local variable:
```typescript
let selectedRecipe: any = null;
```

This means:
1. Every time `renderRecipes()` is called, `selectedRecipe` is reset to `null`
2. After cooking, `renderRecipeDetailsInActionPanel()` is called with the current recipe
3. However, if the cooking panel is re-rendered, the selection is lost
4. The default behavior shows the first recipe

#### Solution
1. Add an instance variable to `GameUI` class to store the selected recipe ID
2. Update recipe selection logic to use this instance variable
3. When rendering recipes, check if a recipe is already selected and maintain its highlight
4. When cooking completes, keep the same recipe selected

#### Implementation Details

**Step 1: Add instance variable**
```typescript
private selectedRecipeId: string | null = null;
```

**Step 2: Update renderRecipes() method**
- Remove local `selectedRecipe` variable
- Use `this.selectedRecipeId` to track selection
- When a recipe card is clicked, update `this.selectedRecipeId`
- Apply highlight to the card matching `this.selectedRecipeId`

**Step 3: Update cooking button handler**
- After successful cooking, do NOT change `this.selectedRecipeId`
- Call `this.renderRecipeDetailsInActionPanel()` with the same recipe
- This will refresh ingredient quantities without changing selection

**Step 4: Maintain visual highlight**
- When rendering recipe cards, check if `recipe.id === this.selectedRecipeId`
- Apply the glow effect to the selected card
- Remove glow from other cards

### Fix 2: Cooking Button Error Handling

#### Problem Analysis
The cooking button click handler needs investigation to identify the specific error. Potential issues:
1. `this.playerEntity` might be null or undefined
2. `this.cookingSystem` might not be initialized
3. Recipe ID might be invalid
4. ItemSystem might not be properly connected

#### Solution
1. Add comprehensive null checks before cooking
2. Add try-catch block around cooking operation
3. Provide detailed error messages for debugging
4. Ensure all systems are properly initialized

#### Implementation Details

**Step 1: Add validation before cooking**
```typescript
if (!this.playerEntity) {
  this.showNotification('玩家未初始化', 'error');
  return;
}

if (!this.cookingSystem) {
  this.showNotification('烹饪系统未初始化', 'error');
  return;
}

if (!recipe || !recipe.id) {
  this.showNotification('配方无效', 'error');
  return;
}
```

**Step 2: Wrap cooking in try-catch**
```typescript
try {
  const result = this.cookingSystem.cook(this.playerEntity.id, recipe.id);
  if (result.success) {
    this.showNotification(`成功烹饪 ${recipe.name}！`, 'success');
    // Refresh details without changing selection
    this.renderRecipeDetailsInActionPanel(recipe);
  } else {
    this.showNotification(result.message, 'error');
  }
} catch (error) {
  console.error('[GameUI] Cooking error:', error);
  this.showNotification('烹饪时发生错误', 'error');
}
```

**Step 3: Add logging for debugging**
- Log recipe ID before cooking
- Log cooking result
- Log any errors with full stack trace

## Data Flow

### Before Fix
```
User clicks recipe → selectedRecipe (local) = recipe
User clicks cook → Cook succeeds → renderRecipeDetailsInActionPanel(recipe)
Panel refreshes → renderRecipes() called → selectedRecipe reset to null → First recipe shown
```

### After Fix
```
User clicks recipe → this.selectedRecipeId = recipe.id
User clicks cook → Cook succeeds → renderRecipeDetailsInActionPanel(recipe)
Panel refreshes → renderRecipes() called → Uses this.selectedRecipeId → Same recipe shown
```

## Edge Cases

### Edge Case 1: Recipe No Longer Available
- **Scenario**: Selected recipe is removed from the system
- **Handling**: Check if `this.selectedRecipeId` exists in recipes list, if not, select first recipe

### Edge Case 2: Insufficient Ingredients After Partial Cooking
- **Scenario**: Player cooks multiple times and runs out of ingredients
- **Handling**: Cooking button becomes disabled, ingredient list shows missing items

### Edge Case 3: Inventory Full
- **Scenario**: Player's inventory is full when trying to cook
- **Handling**: CookingSystem returns error, ingredients are not consumed, error message shown

### Edge Case 4: System Not Initialized
- **Scenario**: CookingSystem or ItemSystem is null
- **Handling**: Show error message, prevent cooking action

## Testing Strategy

### Unit Tests
Not required for this bugfix - these are UI state management issues that are better tested manually.

### Manual Testing Checklist
1. Select a recipe from the list
2. Verify recipe details show in action panel
3. Click "开始烹饪" button
4. Verify success notification appears
5. Verify recipe details panel still shows the same recipe
6. Verify ingredient quantities are updated
7. Verify cooking button state updates (enabled/disabled)
8. Verify selected recipe card maintains glow effect
9. Cook the same recipe multiple times
10. Verify selection persists across all cooking actions

### Error Testing
1. Test with insufficient ingredients
2. Test with full inventory
3. Test with invalid recipe ID
4. Test with null playerEntity

## Correctness Properties

### Property 1: Recipe Selection Persistence
**Validates: Requirements 1.1, 1.2**

**Property**: After a successful cooking operation, the selected recipe ID should remain unchanged.

**Formal Statement**:
```
∀ recipe_id, state_before, state_after:
  state_before.selectedRecipeId = recipe_id ∧
  cook(recipe_id) = success
  ⟹ state_after.selectedRecipeId = recipe_id
```

**Test Strategy**: Manual verification
- Select recipe A
- Cook recipe A successfully
- Verify selectedRecipeId still equals recipe A's ID
- Verify UI shows recipe A's details

### Property 2: Cooking Operation Safety
**Validates: Requirements 2.1, 2.2**

**Property**: The cooking operation should never throw unhandled exceptions and should always leave the system in a valid state.

**Formal Statement**:
```
∀ recipe_id, player_id:
  try {
    result = cook(player_id, recipe_id)
    result ∈ {success, error_with_message}
  } catch {
    error_logged ∧ user_notified
  }
  ⟹ system_state_valid
```

**Test Strategy**: Manual verification with error injection
- Test cooking with valid inputs → should succeed
- Test cooking with null player → should show error message
- Test cooking with invalid recipe → should show error message
- Test cooking with insufficient ingredients → should show error message
- Verify no console errors in any case

### Property 3: Ingredient Consistency
**Validates: Requirements 2.1**

**Property**: After successful cooking, ingredient quantities should decrease by exactly the recipe requirements.

**Formal Statement**:
```
∀ recipe, ingredient ∈ recipe.ingredients:
  quantity_before = getItemQuantity(ingredient.itemId)
  cook(recipe.id) = success
  quantity_after = getItemQuantity(ingredient.itemId)
  ⟹ quantity_after = quantity_before - ingredient.quantity
```

**Test Strategy**: Manual verification
- Record ingredient quantities before cooking
- Cook recipe
- Verify each ingredient decreased by exact amount
- Verify dish was added to inventory

## Implementation Plan

### Phase 1: Add State Management (30 minutes)
1. Add `selectedRecipeId` instance variable
2. Update `renderRecipes()` to use instance variable
3. Update recipe click handlers to set instance variable
4. Update visual highlight logic

### Phase 2: Fix Cooking Button (20 minutes)
1. Add null checks and validation
2. Add try-catch error handling
3. Add logging for debugging
4. Test error scenarios

### Phase 3: Testing (20 minutes)
1. Manual testing of recipe selection persistence
2. Manual testing of cooking button functionality
3. Error scenario testing
4. Edge case testing

**Total Estimated Time**: 70 minutes

## Dependencies
- No external dependencies
- No changes to CookingSystem or ItemSystem required
- Only changes to GameUI.ts

## Rollback Plan
If issues arise, the changes can be easily reverted as they are isolated to the GameUI class and do not affect the underlying game systems.
