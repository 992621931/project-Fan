# Cooking UI Bug Fixes - Requirements

## Overview
Fix two critical bugs in the cooking UI that affect user experience when cooking recipes.

## User Stories

### Story 1: Recipe Selection Persistence
As a player, when I successfully cook a recipe, I want the recipe details panel to remain on the recipe I selected, so that I can continue cooking the same recipe without having to reselect it.

### Story 2: Cooking Button Error Handling
As a player, when I click the "开始烹饪" (Start Cooking) button, I want the cooking action to execute without errors, so that I can successfully create dishes.

## Acceptance Criteria

### 1.1 Recipe Selection State Persistence
- **Given** a player has selected a recipe from the recipe list
- **When** the player successfully cooks that recipe
- **Then** the recipe details panel should continue showing the same selected recipe
- **And** the ingredient quantities should update to reflect the consumed materials
- **And** the cooking button availability should update based on remaining materials

### 1.2 Recipe Selection Visual Feedback
- **Given** a recipe is selected
- **When** the cooking panel is refreshed after cooking
- **Then** the selected recipe card should maintain its visual highlight (glow effect)
- **And** other recipe cards should not be highlighted

### 2.1 Cooking Button Functionality
- **Given** a player has sufficient ingredients for a recipe
- **When** the player clicks the "开始烹饪" button
- **Then** the cooking action should execute without throwing errors
- **And** a success notification should be displayed
- **And** the ingredients should be consumed from inventory
- **And** the cooked dish should be added to inventory

### 2.2 Cooking Error Handling
- **Given** a player attempts to cook a recipe
- **When** any error occurs during the cooking process
- **Then** an appropriate error message should be displayed to the player
- **And** no ingredients should be consumed
- **And** the UI should remain in a stable state

## Technical Context

### Current Implementation Issues

**Bug #1 - Recipe Selection Reset**:
- Location: `src/ui/GameUI.ts`, `renderRecipes()` method (around line 3467)
- Issue: `selectedRecipe` is a local variable that gets reset when the method is called
- Impact: After cooking, the recipe details panel automatically switches to the first recipe (史莱姆QQ糖)

**Bug #2 - Cooking Button Error**:
- Location: `src/ui/GameUI.ts`, cooking button click handler (around line 3789)
- Issue: Potential error when clicking "开始烹饪" button (specific error message not yet identified)
- Impact: Cooking action may fail or throw errors

### Related Systems
- `CookingSystem` (`src/game/systems/CookingSystem.ts`): Handles cooking logic
- `ItemSystem`: Manages inventory and item operations
- `GameUI` (`src/ui/GameUI.ts`): Renders the cooking interface

## Out of Scope
- Adding new cooking recipes
- Modifying cooking mechanics or ingredient requirements
- UI redesign or layout changes
- Performance optimizations

## Success Metrics
- Recipe selection persists after cooking (100% of the time)
- No errors occur when clicking the cooking button (0% error rate)
- Ingredient quantities update correctly after cooking
- User can cook multiple dishes of the same recipe without reselecting
