/**
 * Integration tests for CookingSystem
 * Tests integration with InventoryComponent, ItemSystem, and ShopSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../ecs/World';
import { CookingSystem } from './CookingSystem';
import { ShopSystem } from './ShopSystem';
import { InventoryComponent, InventoryComponentType } from '../components/SystemComponents';
import { ItemComponent, ItemComponentType } from '../components/ItemComponents';
import { RarityType } from '../types/RarityTypes';

describe('CookingSystem Integration Tests', () => {
  let world: World;
  let cookingSystem: CookingSystem;
  let shopSystem: ShopSystem;
  let playerId: number;

  beforeEach(() => {
    world = new World();
    cookingSystem = new CookingSystem();
    shopSystem = new ShopSystem();

    // Register systems - this will initialize them with the World's managers
    world.addSystem(cookingSystem);
    world.addSystem(shopSystem);

    // Initialize the world (this calls initialize on all systems)
    world.initialize();

    // Create player entity
    const player = world.createEntity();
    playerId = player.id;

    // Add inventory component
    const inventory: InventoryComponent = {
      type: 'inventory',
      slots: Array(20).fill(null).map(() => ({ item: null, quantity: 0 }))
    };
    world.addComponent(playerId, InventoryComponentType, inventory);

    // Load test recipes
    const testRecipes = {
      recipes: [
        {
          id: 'test_dish_1',
          name: '测试菜肴1',
          rarity: 0,
          icon: 'test.png',
          description: '测试用菜肴',
          sellPrice: 100,
          ingredients: [
            { itemId: 'ingredient_1', quantity: 2 },
            { itemId: 'ingredient_2', quantity: 1 }
          ]
        },
        {
          id: 'test_dish_2',
          name: '测试菜肴2',
          rarity: 1,
          icon: 'test2.png',
          description: '测试用菜肴2',
          sellPrice: 200,
          ingredients: [
            { itemId: 'ingredient_1', quantity: 3 }
          ]
        }
      ]
    };

    cookingSystem.loadRecipes(testRecipes);
  });

  describe('CookingPanel communicates correctly with CookingSystem', () => {
    it('should get all recipes from CookingSystem', () => {
      const recipes = cookingSystem.getAllRecipes();
      expect(recipes).toHaveLength(2);
      expect(recipes[0].id).toBe('test_dish_1');
      expect(recipes[1].id).toBe('test_dish_2');
    });

    it('should validate cooking with CookingSystem', () => {
      // Without ingredients
      const validation1 = cookingSystem.validateCooking(playerId, 'test_dish_1');
      expect(validation1.canCook).toBe(false);
      expect(validation1.missingIngredients).toHaveLength(2);

      // Add ingredients
      addIngredientToInventory(playerId, 'ingredient_1', 2);
      addIngredientToInventory(playerId, 'ingredient_2', 1);

      // With ingredients
      const validation2 = cookingSystem.validateCooking(playerId, 'test_dish_1');
      expect(validation2.canCook).toBe(true);
      expect(validation2.missingIngredients).toHaveLength(0);
    });

    it('should cook dish through CookingSystem', () => {
      // Add ingredients
      addIngredientToInventory(playerId, 'ingredient_1', 2);
      addIngredientToInventory(playerId, 'ingredient_2', 1);

      // Cook
      const result = cookingSystem.cook(playerId, 'test_dish_1');
      expect(result.success).toBe(true);
      expect(result.dishId).toBe('test_dish_1');

      // Verify dish was created
      const inventory = world.getComponent(playerId, InventoryComponentType);
      expect(inventory).not.toBeNull();
      
      const dishSlot = inventory!.slots.find(slot => {
        if (slot.item) {
          const item = world.getComponent(slot.item, ItemComponentType);
          return item?.id === 'test_dish_1';
        }
        return false;
      });

      expect(dishSlot).toBeDefined();
      expect(dishSlot!.quantity).toBe(1);
    });
  });

  describe('CookingSystem modifies InventoryComponent correctly', () => {
    it('should consume ingredients from inventory', () => {
      // Add ingredients
      addIngredientToInventory(playerId, 'ingredient_1', 5);
      addIngredientToInventory(playerId, 'ingredient_2', 3);

      // Get initial counts
      const initialCount1 = getIngredientCount(playerId, 'ingredient_1');
      const initialCount2 = getIngredientCount(playerId, 'ingredient_2');

      expect(initialCount1).toBe(5);
      expect(initialCount2).toBe(3);

      // Cook
      const result = cookingSystem.cook(playerId, 'test_dish_1');
      expect(result.success).toBe(true);

      // Verify ingredients were consumed
      const finalCount1 = getIngredientCount(playerId, 'ingredient_1');
      const finalCount2 = getIngredientCount(playerId, 'ingredient_2');

      expect(finalCount1).toBe(3); // 5 - 2
      expect(finalCount2).toBe(2); // 3 - 1
    });

    it('should add dish to inventory', () => {
      // Add ingredients
      addIngredientToInventory(playerId, 'ingredient_1', 2);
      addIngredientToInventory(playerId, 'ingredient_2', 1);

      // Verify no dish initially
      const initialDishCount = getIngredientCount(playerId, 'test_dish_1');
      expect(initialDishCount).toBe(0);

      // Cook
      const result = cookingSystem.cook(playerId, 'test_dish_1');
      expect(result.success).toBe(true);

      // Verify dish was added
      const finalDishCount = getIngredientCount(playerId, 'test_dish_1');
      expect(finalDishCount).toBe(1);
    });

    it('should not consume ingredients if inventory is full', () => {
      // Add ingredients first
      addIngredientToInventory(playerId, 'ingredient_1', 2);
      addIngredientToInventory(playerId, 'ingredient_2', 1);

      // Fill remaining inventory slots
      const inventory = world.getComponent(playerId, InventoryComponentType);
      expect(inventory).not.toBeNull();

      for (let i = 0; i < inventory!.slots.length; i++) {
        if (inventory!.slots[i].item === null) {
          const itemEntity = world.createEntity();
          const item: ItemComponent = {
            type: 'item',
            id: `filler_${i}`,
            name: `Filler ${i}`,
            description: 'Filler item',
            rarity: 0,
            itemType: 'material',
            stackSize: 1,
            value: 1,
            quality: 100
          };
          world.addComponent(itemEntity.id, ItemComponentType, item);
          inventory!.slots[i].item = itemEntity.id;
          inventory!.slots[i].quantity = 1;
        }
      }

      // Try to cook (should fail due to full inventory)
      const result = cookingSystem.cook(playerId, 'test_dish_1');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Inventory full');

      // Verify ingredients were not consumed
      const finalCount1 = getIngredientCount(playerId, 'ingredient_1');
      const finalCount2 = getIngredientCount(playerId, 'ingredient_2');
      expect(finalCount1).toBe(2);
      expect(finalCount2).toBe(1);
    });
  });

  describe('Created dishes are compatible with ShopSystem', () => {
    it('should be able to sell cooked dishes', () => {
      // Add ingredients and cook
      addIngredientToInventory(playerId, 'ingredient_1', 2);
      addIngredientToInventory(playerId, 'ingredient_2', 1);

      const cookResult = cookingSystem.cook(playerId, 'test_dish_1');
      expect(cookResult.success).toBe(true);

      // Find the dish in inventory
      const inventory = world.getComponent(playerId, InventoryComponentType);
      expect(inventory).not.toBeNull();

      const dishSlot = inventory!.slots.find(slot => {
        if (slot.item) {
          const item = world.getComponent(slot.item, ItemComponentType);
          return item?.id === 'test_dish_1';
        }
        return false;
      });

      expect(dishSlot).toBeDefined();
      expect(dishSlot!.item).not.toBeNull();

      // Verify dish has sell price
      const dishItem = world.getComponent(dishSlot!.item!, ItemComponentType);
      expect(dishItem).not.toBeNull();
      expect(dishItem!.value).toBe(100);
    });

    it('should preserve dish properties for shop compatibility', () => {
      // Add ingredients and cook
      addIngredientToInventory(playerId, 'ingredient_1', 2);
      addIngredientToInventory(playerId, 'ingredient_2', 1);

      const cookResult = cookingSystem.cook(playerId, 'test_dish_1');
      expect(cookResult.success).toBe(true);

      // Find the dish
      const inventory = world.getComponent(playerId, InventoryComponentType);
      const dishSlot = inventory!.slots.find(slot => {
        if (slot.item) {
          const item = world.getComponent(slot.item, ItemComponentType);
          return item?.id === 'test_dish_1';
        }
        return false;
      });

      const dishItem = world.getComponent(dishSlot!.item!, ItemComponentType);
      expect(dishItem).not.toBeNull();

      // Verify all required properties for shop system
      expect(dishItem!.id).toBe('test_dish_1');
      expect(dishItem!.name).toBe('测试菜肴1');
      expect(dishItem!.description).toBe('测试用菜肴');
      expect(dishItem!.rarity).toBe(0);
      expect(dishItem!.value).toBe(100);
      expect(dishItem!.itemType).toBe('food');
    });
  });

  describe('Recipe data loads from JSON file', () => {
    it('should load recipes with correct structure', () => {
      const recipes = cookingSystem.getAllRecipes();
      
      recipes.forEach(recipe => {
        expect(recipe).toHaveProperty('id');
        expect(recipe).toHaveProperty('name');
        expect(recipe).toHaveProperty('rarity');
        expect(recipe).toHaveProperty('icon');
        expect(recipe).toHaveProperty('description');
        expect(recipe).toHaveProperty('sellPrice');
        expect(recipe).toHaveProperty('ingredients');
        expect(Array.isArray(recipe.ingredients)).toBe(true);
        
        recipe.ingredients.forEach(ingredient => {
          expect(ingredient).toHaveProperty('itemId');
          expect(ingredient).toHaveProperty('quantity');
          expect(typeof ingredient.itemId).toBe('string');
          expect(typeof ingredient.quantity).toBe('number');
        });
      });
    });

    it('should handle invalid recipe data gracefully', () => {
      const invalidRecipes = {
        recipes: [
          {
            id: 'invalid_dish',
            // Missing required fields
          }
        ]
      };

      // Should not throw
      expect(() => cookingSystem.loadRecipes(invalidRecipes)).not.toThrow();

      // Invalid recipe should not be loaded
      const recipe = cookingSystem.getRecipe('invalid_dish');
      expect(recipe).toBeUndefined();
    });
  });

  // Helper functions
  function addIngredientToInventory(playerId: number, itemId: string, quantity: number): void {
    const inventory = world.getComponent(playerId, InventoryComponentType);
    if (!inventory) return;

    // Find empty slot
    const emptySlot = inventory.slots.find(slot => slot.item === null);
    if (!emptySlot) return;

    // Create ingredient entity
    const ingredientEntity = world.createEntity();
    const ingredient: ItemComponent = {
      type: 'item',
      id: itemId,
      name: itemId,
      description: 'Test ingredient',
      rarity: 0,
      itemType: 'material',
      stackSize: 99,
      value: 10,
      quality: 100
    };

    world.addComponent(ingredientEntity.id, ItemComponentType, ingredient);

    // Add to inventory
    emptySlot.item = ingredientEntity.id;
    emptySlot.quantity = quantity;
  }

  function getIngredientCount(playerId: number, itemId: string): number {
    const inventory = world.getComponent(playerId, InventoryComponentType);
    if (!inventory) return 0;

    let count = 0;
    for (const slot of inventory.slots) {
      if (slot.item) {
        const item = world.getComponent(slot.item, ItemComponentType);
        if (item && item.id === itemId) {
          count += slot.quantity;
        }
      }
    }

    return count;
  }
});
