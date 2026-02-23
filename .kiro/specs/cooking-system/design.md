# Design Document: Cooking System

## Overview

The Cooking System extends the game's crafting mechanics with a specialized cooking interface integrated into the warehouse panel. Players can transform raw ingredients collected during exploration into valuable cooked dishes through a recipe-based system. The design follows the existing CraftingSystem architecture, reusing established patterns for recipe management, ingredient validation, and item creation while providing a cooking-specific user interface.

The system consists of three main components:
1. **CookingSystem** - Core logic for recipe management, ingredient validation, and dish creation
2. **CookingPanel** - UI component for displaying recipes and handling user interactions
3. **Recipe Data** - JSON configuration defining the seven initial cooking recipes

## Architecture

### System Integration

The Cooking System integrates with existing game systems:

```
┌─────────────────────────────────────────────────────────────┐
│                      Warehouse Panel                         │
│  ┌──────────┬──────────┬──────────┬──────────┐             │
│  │ Inventory│ Crafting │ Cooking  │  Other   │             │
│  │   Tab    │   Tab    │   Tab    │   Tabs   │             │
│  └──────────┴──────────┴──────────┴──────────┘             │
│                           │                                  │
│                           ▼                                  │
│                  ┌─────────────────┐                        │
│                  │  CookingPanel   │                        │
│                  └────────┬────────┘                        │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
                  ┌─────────────────┐
                  │ CookingSystem   │
                  └────────┬────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                   │
        ▼                  ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Inventory   │  │  Item        │  │  Event       │
│  System      │  │  Database    │  │  System      │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Data Flow

1. **Recipe Loading**: CookingSystem loads recipes from `cooking-recipes.json` at initialization
2. **Recipe Display**: CookingPanel queries CookingSystem for available recipes and renders them
3. **Ingredient Validation**: When a recipe is selected, CookingSystem checks player inventory for required ingredients
4. **Cooking Execution**: When player clicks "开始烹饪", CookingSystem validates ingredients, consumes them, and creates the dish
5. **Inventory Update**: Created dish is added to player inventory, triggering UI refresh

## Components and Interfaces

### CookingSystem

The CookingSystem extends the base System class and manages cooking logic.

```typescript
export interface CookingRecipe {
  id: string;
  name: string;
  rarity: RarityType;
  icon: string;
  description: string;
  sellPrice: number;
  ingredients: CookingIngredient[];
}

export interface CookingIngredient {
  itemId: string;
  quantity: number;
}

export interface CookingValidation {
  canCook: boolean;
  missingIngredients: CookingIngredient[];
}

export class CookingSystem extends System {
  public readonly name = 'CookingSystem';
  public readonly requiredComponents: ComponentType<any>[] = [
    InventoryComponentType
  ];

  private recipes: Map<string, CookingRecipe> = new Map();

  // Load recipes from JSON configuration
  public loadRecipes(recipesData: any): void;

  // Get all available cooking recipes
  public getAllRecipes(): CookingRecipe[];

  // Get a specific recipe by ID
  public getRecipe(recipeId: string): CookingRecipe | undefined;

  // Validate if player can cook a recipe
  public validateCooking(playerId: EntityId, recipeId: string): CookingValidation;

  // Execute cooking - consume ingredients and create dish
  public cook(playerId: EntityId, recipeId: string): CookingResult;

  // Check if player has required ingredients
  private hasIngredients(inventory: InventoryComponent, ingredients: CookingIngredient[]): boolean;

  // Consume ingredients from inventory
  private consumeIngredients(inventory: InventoryComponent, ingredients: CookingIngredient[]): boolean;

  // Create dish item and add to inventory
  private createDish(playerId: EntityId, recipe: CookingRecipe): void;
}
```

### CookingPanel

The CookingPanel extends BaseUIComponent and provides the cooking interface.

```typescript
export class CookingPanel extends BaseUIComponent {
  private world: World;
  private cookingSystem: CookingSystem;
  private recipeGrid!: HTMLDivElement;
  private detailsPanel!: HTMLDivElement;
  private selectedRecipe: CookingRecipe | null = null;

  constructor(uiManager: UIManager, eventSystem: EventSystem, world: World, cookingSystem: CookingSystem);

  // Render the complete cooking interface
  public render(): void;

  // Render recipe cards in grid layout
  private renderRecipeGrid(): void;

  // Render selected recipe details
  private renderRecipeDetails(): void;

  // Render ingredient list with availability indicators
  private renderIngredients(recipe: CookingRecipe): void;

  // Handle recipe card click
  private handleRecipeSelect(recipe: CookingRecipe): void;

  // Handle cooking button click
  private handleCookingClick(): void;

  // Get rarity color for UI styling
  private getRarityColor(rarity: RarityType): string;

  // Get rarity display name
  private getRarityName(rarity: RarityType): string;
}
```

### Recipe Data Structure

Cooking recipes are stored in `src/game/data/cooking-recipes.json`:

```json
{
  "recipes": [
    {
      "id": "slime_qq_candy",
      "name": "史莱姆QQ糖",
      "rarity": 0,
      "icon": "images/wupin_caiyao_shilaimuQQtang.png",
      "description": "酸酸甜甜，QQ弹弹",
      "sellPrice": 150,
      "ingredients": [
        {
          "itemId": "slime_sweet_pearl",
          "quantity": 3
        }
      ]
    }
  ]
}
```

## Data Models

### CookingRecipe

Represents a cooking recipe with all necessary information:

- `id`: Unique identifier (kebab-case)
- `name`: Display name (Chinese)
- `rarity`: RarityType enum (0=Common, 1=Rare, 2=Mythic)
- `icon`: Path to icon image
- `description`: Flavor text describing the dish
- `sellPrice`: Gold value when sold
- `ingredients`: Array of required ingredients with quantities

### CookingIngredient

Represents an ingredient requirement:

- `itemId`: Reference to item in item database
- `quantity`: Number of items required

### CookingValidation

Result of ingredient validation:

- `canCook`: Boolean indicating if cooking is possible
- `missingIngredients`: Array of ingredients player doesn't have

### CookingResult

Result of cooking operation:

- `success`: Boolean indicating if cooking succeeded
- `dishId`: ID of created dish (if successful)
- `message`: User-facing message describing result

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Recipe Card Rendering Completeness

*For any* set of cooking recipes, when the cooking interface is displayed, all recipes should be rendered as cards in the grid, and each card should display the dish name, rarity indicator, and icon image.

**Validates: Requirements 2.1, 2.2**

### Property 2: Recipe Selection Updates Details Panel

*For any* recipe card in the grid, when clicked, the card should be highlighted and the details panel should update to show that recipe's complete information including name, rarity, icon, description, sell price, and all required ingredients with quantities.

**Validates: Requirements 2.3, 3.1, 3.2**

### Property 3: Ingredient Availability Indication

*For any* recipe with ingredients, the details panel should correctly indicate for each ingredient whether the player has sufficient quantity in inventory.

**Validates: Requirements 3.3**

### Property 4: Cooking Button State Based on Ingredients

*For any* recipe, the "开始烹饪" button should be enabled if and only if the player has all required ingredients in sufficient quantities, otherwise it should be disabled and displayed in a grayed-out state.

**Validates: Requirements 4.1, 4.2**

### Property 5: Cooking Transaction Atomicity

*For any* recipe with sufficient ingredients, when the cooking button is clicked, the system should atomically consume the required ingredient quantities from inventory and create exactly one instance of the resulting dish in the player's inventory.

**Validates: Requirements 4.3, 4.4**

### Property 6: UI Reflects Inventory State

*For any* cooking action that modifies inventory (consuming ingredients or adding dishes), the UI should update to reflect the new inventory state.

**Validates: Requirements 4.5**

### Property 7: Recipe Structure Validation

*For any* recipe loaded from JSON, it should have all required properties (id, name, rarity, icon, description, sellPrice, ingredients), and each ingredient should have an itemId and quantity.

**Validates: Requirements 5.2, 5.3**

### Property 8: Item Reference Validation

*For any* recipe, all ingredient itemIds should reference items that exist in the game's item database.

**Validates: Requirements 5.4**

### Property 9: Dish Creation with Property Preservation

*For any* dish created through cooking, it should be added to inventory as a consumable item with all properties (name, rarity, icon, description, sellPrice) preserved from the recipe.

**Validates: Requirements 7.1, 7.2**

### Property 10: Event Emission on Cooking

*For any* cooking action, the system should emit appropriate events that can be consumed by other systems (e.g., 'cooking:started', 'cooking:completed').

**Validates: Requirements 8.3**

## Error Handling

### Invalid Recipe ID

When a recipe ID is requested that doesn't exist:
- `getRecipe()` returns `undefined`
- `validateCooking()` returns `{ canCook: false, missingIngredients: [] }`
- `cook()` returns `{ success: false, message: "Recipe not found" }`

### Insufficient Ingredients

When player attempts to cook without sufficient ingredients:
- `validateCooking()` returns `{ canCook: false, missingIngredients: [...] }`
- Cooking button is disabled in UI
- If `cook()` is called anyway, it returns `{ success: false, message: "Insufficient ingredients" }`

### Full Inventory

When player's inventory is full and cannot accept the cooked dish:
- Ingredients are not consumed
- `cook()` returns `{ success: false, message: "Inventory full" }`
- User is notified via UI notification

### Invalid Item References

When a recipe references an item that doesn't exist in the item database:
- Recipe loading logs a warning
- Recipe is marked as invalid and not displayed in UI
- Attempting to cook returns error

### Concurrent Cooking Attempts

The system does not support concurrent cooking (no crafting time):
- Cooking is instantaneous
- No need to handle concurrent operations

## Testing Strategy

### Dual Testing Approach

The Cooking System will be validated through both unit tests and property-based tests:

**Unit Tests** focus on:
- Specific recipe examples (e.g., testing the seven initial recipes)
- Edge cases (empty inventory, full inventory, invalid recipe IDs)
- Error conditions (missing items, invalid data)
- UI component rendering with specific data
- Integration points with InventorySystem and ItemDatabase

**Property-Based Tests** focus on:
- Universal properties across all possible recipes and inventory states
- Recipe validation with randomly generated recipes
- Ingredient consumption with random quantities
- UI state consistency with random user interactions
- Data structure validation with random JSON inputs

Together, these approaches provide comprehensive coverage: unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across the input space.

### Property-Based Testing Configuration

- **Library**: fast-check (TypeScript property-based testing library)
- **Iterations**: Minimum 100 iterations per property test
- **Test Tags**: Each property test must include a comment tag referencing the design property
  - Format: `// Feature: cooking-system, Property {number}: {property_text}`
- **Implementation**: Each correctness property must be implemented by a single property-based test

### Test Organization

```
src/game/systems/
  CookingSystem.ts
  CookingSystem.test.ts           # Unit tests
  CookingSystem.property.test.ts  # Property-based tests

src/ui/components/
  CookingPanel.ts
  CookingPanel.test.ts            # Unit tests
  CookingPanel.property.test.ts   # Property-based tests
```

### Example Property Test Structure

```typescript
// Feature: cooking-system, Property 5: Cooking Transaction Atomicity
it('should atomically consume ingredients and create dish', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        itemId: fc.string(),
        quantity: fc.integer({ min: 1, max: 10 })
      })),
      (ingredients) => {
        // Test that cooking either fully succeeds or fully fails
        // No partial consumption of ingredients
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

Integration tests will verify:
- CookingPanel correctly communicates with CookingSystem
- CookingSystem correctly modifies InventoryComponent
- Created dishes are compatible with ShopSystem (can be sold)
- Created dishes are compatible with existing item management
- Recipe data loads correctly from JSON file
- UI updates correctly when inventory changes

### Manual Testing Checklist

- [ ] Cooking tab appears in warehouse panel
- [ ] All seven recipes display correctly
- [ ] Recipe cards show correct rarity colors
- [ ] Clicking recipe shows details panel
- [ ] Ingredient availability indicators are accurate
- [ ] Cooking button enables/disables correctly
- [ ] Cooking consumes correct ingredient quantities
- [ ] Cooked dishes appear in inventory
- [ ] Cooked dishes can be sold in shop
- [ ] UI updates after cooking
- [ ] Visual consistency with crafting panel
