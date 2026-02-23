# Requirements Document: Cooking System

## Introduction

The Cooking System enables players to transform raw ingredients from their inventory into valuable cooked dishes through a recipe-based crafting interface. This system extends the existing warehouse panel with a dedicated cooking tab, providing players with an additional method to create consumable items and generate value from collected materials.

## Glossary

- **Cooking_System**: The subsystem responsible for managing cooking recipes, ingredient validation, and dish creation
- **Warehouse_Panel**: The existing UI panel in the camp scene that displays player inventory and related functions
- **Recipe**: A data structure defining the ingredients required and the resulting dish produced
- **Recipe_Card**: A UI element displaying basic recipe information in grid format
- **Details_Panel**: The right-side UI panel showing comprehensive recipe information
- **Ingredient**: A consumable item component required for cooking recipes
- **Dish**: A consumable item created through the cooking process
- **Rarity**: An enumerated type indicating item value (Common=0, Rare=1, Mythic=2)

## Requirements

### Requirement 1: Cooking Tab Integration

**User Story:** As a player, I want to access cooking functionality from the warehouse panel, so that I can easily find and use the cooking system.

#### Acceptance Criteria

1. WHEN the player opens the warehouse panel in the camp scene, THE Warehouse_Panel SHALL display a "烹饪" (Cooking) tab alongside existing tabs
2. WHEN the player clicks the cooking tab, THE Cooking_System SHALL display the cooking interface with recipe cards in grid layout
3. WHEN the cooking tab is active, THE Warehouse_Panel SHALL hide other tab contents and show only cooking-related UI

### Requirement 2: Recipe Card Display

**User Story:** As a player, I want to see available recipes in a grid layout, so that I can browse cooking options efficiently.

#### Acceptance Criteria

1. WHEN the cooking interface is displayed, THE Cooking_System SHALL render all available recipes as cards in a grid layout
2. FOR EACH recipe card, THE Cooking_System SHALL display the dish name, rarity indicator, and icon image
3. WHEN a recipe card is clicked, THE Cooking_System SHALL highlight the selected card and update the details panel
4. THE Cooking_System SHALL maintain visual consistency with existing crafting panel card layouts

### Requirement 3: Recipe Details Display

**User Story:** As a player, I want to see detailed information about a selected recipe, so that I can understand what ingredients I need and what I will create.

#### Acceptance Criteria

1. WHEN a recipe is selected, THE Details_Panel SHALL display the dish name, rarity, icon, description text, and sell price
2. WHEN a recipe is selected, THE Details_Panel SHALL list all required ingredients with their quantities
3. FOR EACH required ingredient, THE Details_Panel SHALL indicate whether the player has sufficient quantity in inventory
4. WHEN a recipe is selected, THE Details_Panel SHALL display a "开始烹饪" (Start Cooking) button

### Requirement 4: Cooking Execution

**User Story:** As a player, I want to cook dishes when I have the required ingredients, so that I can create valuable food items.

#### Acceptance Criteria

1. WHEN the player has all required ingredients in sufficient quantities, THE Cooking_System SHALL enable the "开始烹饪" button
2. WHEN the player lacks any required ingredient, THE Cooking_System SHALL disable the "开始烹饪" button and display it in a grayed-out state
3. WHEN the player clicks the enabled "开始烹饪" button, THE Cooking_System SHALL consume the required ingredient quantities from inventory
4. WHEN ingredients are consumed, THE Cooking_System SHALL create one instance of the resulting dish and add it to the player's inventory
5. WHEN a dish is created, THE Cooking_System SHALL update the UI to reflect the new inventory state

### Requirement 5: Recipe Data Management

**User Story:** As a developer, I want cooking recipes stored in a structured data format, so that recipes can be easily maintained and extended.

#### Acceptance Criteria

1. THE Cooking_System SHALL load recipe data from a JSON configuration file
2. THE Cooking_System SHALL support recipes with the following properties: id, name, rarity, icon path, description, sell price, and ingredient list
3. FOR EACH ingredient in a recipe, THE Cooking_System SHALL store the item id and required quantity
4. THE Cooking_System SHALL validate that all referenced items exist in the game's item database

### Requirement 6: Initial Recipe Set

**User Story:** As a player, I want access to seven cooking recipes, so that I have diverse cooking options from common to mythic rarity.

#### Acceptance Criteria

1. THE Cooking_System SHALL include the recipe "史莱姆QQ糖" (Slime QQ Candy) with rarity Common, requiring 3x 史莱姆甜珠, selling for 150, with icon images/wupin_caiyao_shilaimuQQtang.png
2. THE Cooking_System SHALL include the recipe "糖腌蛇肝" (Sugar Pickled Snake Liver) with rarity Rare, requiring 2x 史莱姆甜珠 and 1x 双头蛇肝, selling for 400, with icon images/wupin_caiyao_tangyanshegan.png
3. THE Cooking_System SHALL include the recipe "香煎菇片" (Fried Mushroom Slices) with rarity Common, requiring 3x 迷香菇, selling for 150, with icon images/wupin_caiyao_xiangjiangupian.png
4. THE Cooking_System SHALL include the recipe "冰糖迷香菇" (Candied Mystic Mushroom) with rarity Rare, requiring 2x 迷香菇 and 1x 甜浆腺体, selling for 400, with icon images/wupin_caiyao_bingtangmixianggu.png
5. THE Cooking_System SHALL include the recipe "双头蛇皮冻" (Two-Headed Snake Skin Jelly) with rarity Common, requiring 3x 光滑蛇皮, selling for 150, with icon images/wupin_caiyao_shuangtoushepidong.png
6. THE Cooking_System SHALL include the recipe "酥翼蛇皮卷" (Crispy Wing Snake Skin Roll) with rarity Rare, requiring 2x 光滑蛇皮 and 1x 草菇虫薄翼, selling for 400, with icon images/wupin_caiyao_suyishepijuan.png
7. THE Cooking_System SHALL include the recipe "草原套餐" (Grassland Set Meal) with rarity Mythic, requiring 2x 甜浆腺体, 2x 双头蛇肝, 2x 草菇虫薄翼, and 2x 兰香草, selling for 1200, with icon images/wupin_caiyao_caoyuantaocan.png

### Requirement 7: Dish Item Creation

**User Story:** As a player, I want cooked dishes to be usable consumable items, so that I can use or sell them like other items.

#### Acceptance Criteria

1. WHEN a dish is created through cooking, THE Cooking_System SHALL add it as a consumable item to the player's inventory
2. FOR EACH cooked dish, THE Cooking_System SHALL preserve the dish's properties including name, rarity, icon, description, and sell price
3. THE Cooking_System SHALL ensure cooked dishes are compatible with existing inventory, shop, and item management systems

### Requirement 8: UI Consistency

**User Story:** As a player, I want the cooking interface to feel familiar, so that I can use it without learning new interaction patterns.

#### Acceptance Criteria

1. THE Cooking_System SHALL follow the same visual design patterns as the existing CraftingPanel component
2. THE Cooking_System SHALL use consistent button styles, card layouts, and panel structures with other warehouse tabs
3. THE Cooking_System SHALL respond to user interactions with the same feedback patterns as existing crafting systems
