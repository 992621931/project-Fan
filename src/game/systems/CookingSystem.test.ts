/**
 * Unit tests for Cooking System
 * Tests specific examples and edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CookingSystem } from './CookingSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { InventoryComponent, InventoryComponentType } from '../components/SystemComponents';
import { ItemComponent, ItemComponentType } from '../components/ItemComponents';
import { RarityType } from '../types/RarityTypes';

describe('Cooking System Unit Tests', () => {
  let cookingSystem: CookingSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;

  beforeEach(() => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    
    cookingSystem = new CookingSystem();
    cookingSystem.initialize(entityManager, componentManager, eventSystem);
  });

  /**
   * Helper: Create test player with inventory
   */
  function createTestPlayer(inventorySize: number = 20): string {
    const playerEntity = entityManager.createEntity();
    const playerId = playerEntity.id;

    const inventory: InventoryComponent = {
      type: 'inventory',
      slots: Array.from({ length: inventorySize }, () => ({
        item: null,
        quantity: 0,
        locked: false
      })),
      capacity: inventorySize
    };

    componentManager.addComponent(playerId, InventoryComponentType, inventory);
    return playerId;
  }

  /**
   * Helper: Add item to player inventory
   */
  function addItemToInventory(playerId: string, itemId: string, quantity: number): void {
    const inventory = componentManager.getComponent(playerId, InventoryComponentType);
    if (!inventory) return;

    const itemEntity = entityManager.createEntity();
    const item: ItemComponent = {
      type: 'item',
      id: itemId,
      name: itemId,
      description: 'Test item',
      rarity: RarityType.Common,
      itemType: 'material',
      stackSize: 99,
      value: 10,
      quality: 50
    };

    componentManager.addComponent(itemEntity.id, ItemComponentType, item);

    const emptySlot = inventory.slots.find(slot => slot.item === null);
    if (emptySlot) {
      emptySlot.item = itemEntity.id;
      emptySlot.quantity = quantity;
    }
  }

  describe('Error Handling', () => {
    it('should handle invalid recipe ID gracefully', () => {
      const playerId = createTestPlayer();
      
      // Try to validate non-existent recipe
      const validation = cookingSystem.validateCooking(playerId, 'non_existent_recipe');
      expect(validation.canCook).toBe(false);
      expect(validation.missingIngredients).toEqual([]);
      
      // Try to cook non-existent recipe
      const result = cookingSystem.cook(playerId, 'non_existent_recipe');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Recipe not found');
    });

    it('should handle insufficient ingredients', () => {
      // Load a test recipe
      const recipeData = {
        recipes: [{
          id: 'test_recipe',
          name: 'Test Recipe',
          rarity: 0,
          icon: 'images/test.png',
          description: 'Test',
          sellPrice: 100,
          ingredients: [
            { itemId: 'ingredient_a', quantity: 3 },
            { itemId: 'ingredient_b', quantity: 2 }
          ]
        }]
      };
      cookingSystem.loadRecipes(recipeData);
      
      const playerId = createTestPlayer();
      
      // Add only partial ingredients
      addItemToInventory(playerId, 'ingredient_a', 2); // Need 3
      addItemToInventory(playerId, 'ingredient_b', 2); // Have enough
      
      // Validation should fail
      const validation = cookingSystem.validateCooking(playerId, 'test_recipe');
      expect(validation.canCook).toBe(false);
      expect(validation.missingIngredients).toHaveLength(1);
      expect(validation.missingIngredients[0].itemId).toBe('ingredient_a');
      
      // Cooking should fail
      const result = cookingSystem.cook(playerId, 'test_recipe');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Insufficient ingredients');
    });

    it('should handle full inventory', () => {
      // Load a test recipe
      const recipeData = {
        recipes: [{
          id: 'test_recipe',
          name: 'Test Recipe',
          rarity: 0,
          icon: 'images/test.png',
          description: 'Test',
          sellPrice: 100,
          ingredients: [
            { itemId: 'ingredient_a', quantity: 1 }
          ]
        }]
      };
      cookingSystem.loadRecipes(recipeData);
      
      // Create player with small inventory
      const playerId = createTestPlayer(2);
      const inventory = componentManager.getComponent(playerId, InventoryComponentType);
      
      // Fill inventory completely
      if (inventory) {
        // Add ingredient in first slot
        const itemEntity1 = entityManager.createEntity();
        const item1: ItemComponent = {
          type: 'item',
          id: 'ingredient_a',
          name: 'Ingredient A',
          description: 'Test',
          rarity: RarityType.Common,
          itemType: 'material',
          stackSize: 99,
          value: 10,
          quality: 50
        };
        componentManager.addComponent(itemEntity1.id, ItemComponentType, item1);
        inventory.slots[0].item = itemEntity1.id;
        inventory.slots[0].quantity = 1;
        
        // Fill second slot with dummy item
        const itemEntity2 = entityManager.createEntity();
        const item2: ItemComponent = {
          type: 'item',
          id: 'dummy_item',
          name: 'Dummy',
          description: 'Test',
          rarity: RarityType.Common,
          itemType: 'material',
          stackSize: 1,
          value: 1,
          quality: 50
        };
        componentManager.addComponent(itemEntity2.id, ItemComponentType, item2);
        inventory.slots[1].item = itemEntity2.id;
        inventory.slots[1].quantity = 1;
      }
      
      // Try to cook (should fail due to full inventory)
      const result = cookingSystem.cook(playerId, 'test_recipe');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Inventory full');
      
      // Verify ingredients were not consumed
      if (inventory) {
        const ingredientSlot = inventory.slots.find(slot => {
          if (slot.item) {
            const item = componentManager.getComponent(slot.item, ItemComponentType);
            return item && item.id === 'ingredient_a';
          }
          return false;
        });
        expect(ingredientSlot?.quantity).toBe(1); // Still has the ingredient
      }
    });

    it('should handle invalid item references in recipes', () => {
      // Load recipe with invalid ingredient structure
      const invalidRecipeData = {
        recipes: [{
          id: 'invalid_recipe',
          name: 'Invalid Recipe',
          rarity: 0,
          icon: 'images/test.png',
          description: 'Test',
          sellPrice: 100,
          ingredients: [
            { itemId: null, quantity: 1 } // Invalid itemId
          ]
        }]
      };
      
      cookingSystem.loadRecipes(invalidRecipeData);
      
      // Recipe should not be loaded
      const recipe = cookingSystem.getRecipe('invalid_recipe');
      expect(recipe).toBeUndefined();
    });

    it('should handle missing player inventory', () => {
      // Load a test recipe
      const recipeData = {
        recipes: [{
          id: 'test_recipe',
          name: 'Test Recipe',
          rarity: 0,
          icon: 'images/test.png',
          description: 'Test',
          sellPrice: 100,
          ingredients: [
            { itemId: 'ingredient_a', quantity: 1 }
          ]
        }]
      };
      cookingSystem.loadRecipes(recipeData);
      
      // Create player entity without inventory component
      const playerEntity = entityManager.createEntity();
      const playerId = playerEntity.id;
      
      // Validation should fail
      const validation = cookingSystem.validateCooking(playerId, 'test_recipe');
      expect(validation.canCook).toBe(false);
      
      // Cooking should fail
      const result = cookingSystem.cook(playerId, 'test_recipe');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Player inventory not found');
    });
  });

  describe('Recipe Loading', () => {
    it('should load valid recipes from JSON', () => {
      const recipeData = {
        recipes: [
          {
            id: 'recipe_1',
            name: 'Recipe 1',
            rarity: 0,
            icon: 'images/recipe1.png',
            description: 'First recipe',
            sellPrice: 100,
            ingredients: [{ itemId: 'item_a', quantity: 1 }]
          },
          {
            id: 'recipe_2',
            name: 'Recipe 2',
            rarity: 1,
            icon: 'images/recipe2.png',
            description: 'Second recipe',
            sellPrice: 200,
            ingredients: [{ itemId: 'item_b', quantity: 2 }]
          }
        ]
      };
      
      cookingSystem.loadRecipes(recipeData);
      
      const allRecipes = cookingSystem.getAllRecipes();
      expect(allRecipes).toHaveLength(2);
      
      const recipe1 = cookingSystem.getRecipe('recipe_1');
      expect(recipe1).toBeDefined();
      expect(recipe1?.name).toBe('Recipe 1');
      
      const recipe2 = cookingSystem.getRecipe('recipe_2');
      expect(recipe2).toBeDefined();
      expect(recipe2?.name).toBe('Recipe 2');
    });

    it('should skip invalid recipes during loading', () => {
      const recipeData = {
        recipes: [
          {
            id: 'valid_recipe',
            name: 'Valid Recipe',
            rarity: 0,
            icon: 'images/valid.png',
            description: 'Valid',
            sellPrice: 100,
            ingredients: [{ itemId: 'item_a', quantity: 1 }]
          },
          {
            id: 'invalid_recipe',
            // Missing required fields
            name: 'Invalid Recipe'
          }
        ]
      };
      
      cookingSystem.loadRecipes(recipeData);
      
      const allRecipes = cookingSystem.getAllRecipes();
      expect(allRecipes).toHaveLength(1);
      expect(allRecipes[0].id).toBe('valid_recipe');
      
      const invalidRecipe = cookingSystem.getRecipe('invalid_recipe');
      expect(invalidRecipe).toBeUndefined();
    });
  });

  describe('Recipe Query', () => {
    beforeEach(() => {
      const recipeData = {
        recipes: [
          {
            id: 'recipe_a',
            name: 'Recipe A',
            rarity: 0,
            icon: 'images/a.png',
            description: 'Recipe A',
            sellPrice: 100,
            ingredients: [{ itemId: 'item_a', quantity: 1 }]
          },
          {
            id: 'recipe_b',
            name: 'Recipe B',
            rarity: 1,
            icon: 'images/b.png',
            description: 'Recipe B',
            sellPrice: 200,
            ingredients: [{ itemId: 'item_b', quantity: 2 }]
          }
        ]
      };
      cookingSystem.loadRecipes(recipeData);
    });

    it('should get all recipes', () => {
      const allRecipes = cookingSystem.getAllRecipes();
      expect(allRecipes).toHaveLength(2);
    });

    it('should get specific recipe by ID', () => {
      const recipe = cookingSystem.getRecipe('recipe_a');
      expect(recipe).toBeDefined();
      expect(recipe?.id).toBe('recipe_a');
      expect(recipe?.name).toBe('Recipe A');
    });

    it('should return undefined for non-existent recipe', () => {
      const recipe = cookingSystem.getRecipe('non_existent');
      expect(recipe).toBeUndefined();
    });
  });

  describe('Dish Item Compatibility', () => {
    /**
     * Tests for Requirements 7.2, 7.3
     * Verify that cooked dishes are compatible with inventory and shop systems
     */

    beforeEach(() => {
      // Load the seven actual cooking recipes
      const recipeData = {
        recipes: [
          {
            id: 'slime_qq_candy',
            name: '史莱姆QQ糖',
            rarity: 0,
            icon: 'images/wupin_caiyao_shilaimuQQtang.png',
            description: '酸酸甜甜，QQ弹弹',
            sellPrice: 150,
            ingredients: [{ itemId: 'slime_sweet_pearl', quantity: 3 }]
          },
          {
            id: 'sugar_pickled_snake_liver',
            name: '糖腌蛇肝',
            rarity: 1,
            icon: 'images/wupin_caiyao_tangyanshegan.png',
            description: '甜中带腥，别有一番风味',
            sellPrice: 400,
            ingredients: [
              { itemId: 'slime_sweet_pearl', quantity: 2 },
              { itemId: 'two_headed_snake_liver', quantity: 1 }
            ]
          },
          {
            id: 'fried_mushroom_slices',
            name: '香煎菇片',
            rarity: 0,
            icon: 'images/wupin_caiyao_xiangjiangupian.png',
            description: '简单的煎制，保留了蘑菇的原汁原味',
            sellPrice: 150,
            ingredients: [{ itemId: 'mystic_mushroom', quantity: 3 }]
          },
          {
            id: 'candied_mystic_mushroom',
            name: '冰糖迷香菇',
            rarity: 1,
            icon: 'images/wupin_caiyao_bingtangmixianggu.png',
            description: '甜蜜的糖浆包裹着香菇，口感独特',
            sellPrice: 400,
            ingredients: [
              { itemId: 'mystic_mushroom', quantity: 2 },
              { itemId: 'sweet_syrup_gland', quantity: 1 }
            ]
          },
          {
            id: 'two_headed_snake_skin_jelly',
            name: '双头蛇皮冻',
            rarity: 0,
            icon: 'images/wupin_caiyao_shuangtoushepidong.png',
            description: 'Q弹爽滑，冰冰凉凉',
            sellPrice: 150,
            ingredients: [{ itemId: 'smooth_snake_skin', quantity: 3 }]
          },
          {
            id: 'crispy_wing_snake_skin_roll',
            name: '酥翼蛇皮卷',
            rarity: 1,
            icon: 'images/wupin_caiyao_suyishepijuan.png',
            description: '外酥里嫩，层次分明',
            sellPrice: 400,
            ingredients: [
              { itemId: 'smooth_snake_skin', quantity: 2 },
              { itemId: 'grass_mushroom_worm_thin_wing', quantity: 1 }
            ]
          },
          {
            id: 'grassland_set_meal',
            name: '草原套餐',
            rarity: 2,
            icon: 'images/wupin_caiyao_caoyuantaocan.png',
            description: '草原上的珍馐美馔，集合了多种食材的精华',
            sellPrice: 1200,
            ingredients: [
              { itemId: 'sweet_syrup_gland', quantity: 2 },
              { itemId: 'two_headed_snake_liver', quantity: 2 },
              { itemId: 'grass_mushroom_worm_thin_wing', quantity: 2 },
              { itemId: 'lavender', quantity: 2 }
            ]
          }
        ]
      };
      cookingSystem.loadRecipes(recipeData);
    });

    it('should create dishes that can be added to inventory', () => {
      // Test each of the seven dishes
      const dishRecipes = [
        'slime_qq_candy',
        'sugar_pickled_snake_liver',
        'fried_mushroom_slices',
        'candied_mystic_mushroom',
        'two_headed_snake_skin_jelly',
        'crispy_wing_snake_skin_roll',
        'grassland_set_meal'
      ];

      for (const recipeId of dishRecipes) {
        const playerId = createTestPlayer();
        const recipe = cookingSystem.getRecipe(recipeId);
        expect(recipe).toBeDefined();

        // Add required ingredients
        if (recipe) {
          for (const ingredient of recipe.ingredients) {
            addItemToInventory(playerId, ingredient.itemId, ingredient.quantity);
          }

          // Cook the dish
          const result = cookingSystem.cook(playerId, recipeId);
          expect(result.success).toBe(true);
          expect(result.dishId).toBe(recipeId);

          // Verify dish is in inventory
          const inventory = componentManager.getComponent(playerId, InventoryComponentType);
          expect(inventory).toBeDefined();

          if (inventory) {
            const dishSlot = inventory.slots.find(slot => {
              if (slot.item) {
                const item = componentManager.getComponent(slot.item, ItemComponentType);
                return item && item.id === recipeId;
              }
              return false;
            });

            expect(dishSlot).toBeDefined();
            expect(dishSlot?.quantity).toBe(1);
          }
        }
      }
    });

    it('should create dishes with properties matching recipe definitions', () => {
      const testCases = [
        {
          recipeId: 'slime_qq_candy',
          expectedName: '史莱姆QQ糖',
          expectedRarity: RarityType.Common,
          expectedSellPrice: 150,
          expectedDescription: '酸酸甜甜，QQ弹弹'
        },
        {
          recipeId: 'sugar_pickled_snake_liver',
          expectedName: '糖腌蛇肝',
          expectedRarity: RarityType.Rare,
          expectedSellPrice: 400,
          expectedDescription: '甜中带腥，别有一番风味'
        },
        {
          recipeId: 'grassland_set_meal',
          expectedName: '草原套餐',
          expectedRarity: RarityType.Epic,
          expectedSellPrice: 1200,
          expectedDescription: '草原上的珍馐美馔，集合了多种食材的精华'
        }
      ];

      for (const testCase of testCases) {
        const playerId = createTestPlayer();
        const recipe = cookingSystem.getRecipe(testCase.recipeId);
        expect(recipe).toBeDefined();

        if (recipe) {
          // Add required ingredients
          for (const ingredient of recipe.ingredients) {
            addItemToInventory(playerId, ingredient.itemId, ingredient.quantity);
          }

          // Cook the dish
          const result = cookingSystem.cook(playerId, testCase.recipeId);
          expect(result.success).toBe(true);

          // Get the created dish from inventory
          const inventory = componentManager.getComponent(playerId, InventoryComponentType);
          if (inventory) {
            const dishSlot = inventory.slots.find(slot => {
              if (slot.item) {
                const item = componentManager.getComponent(slot.item, ItemComponentType);
                return item && item.id === testCase.recipeId;
              }
              return false;
            });

            expect(dishSlot).toBeDefined();
            if (dishSlot && dishSlot.item) {
              const dishItem = componentManager.getComponent(dishSlot.item, ItemComponentType);
              expect(dishItem).toBeDefined();

              // Verify all properties match recipe
              expect(dishItem?.name).toBe(testCase.expectedName);
              expect(dishItem?.rarity).toBe(testCase.expectedRarity);
              expect(dishItem?.value).toBe(testCase.expectedSellPrice);
              expect(dishItem?.description).toBe(testCase.expectedDescription);
              expect(dishItem?.itemType).toBe('food');
              expect(dishItem?.stackSize).toBe(99);
            }
          }
        }
      }
    });

    it('should create dishes that are compatible with shop system (sellable)', () => {
      // Test that dishes have the correct properties for selling
      const playerId = createTestPlayer();
      const recipe = cookingSystem.getRecipe('slime_qq_candy');
      expect(recipe).toBeDefined();

      if (recipe) {
        // Add ingredients
        addItemToInventory(playerId, 'slime_sweet_pearl', 3);

        // Cook the dish
        const result = cookingSystem.cook(playerId, 'slime_qq_candy');
        expect(result.success).toBe(true);

        // Get the dish from inventory
        const inventory = componentManager.getComponent(playerId, InventoryComponentType);
        if (inventory) {
          const dishSlot = inventory.slots.find(slot => {
            if (slot.item) {
              const item = componentManager.getComponent(slot.item, ItemComponentType);
              return item && item.id === 'slime_qq_candy';
            }
            return false;
          });

          expect(dishSlot).toBeDefined();
          if (dishSlot && dishSlot.item) {
            const dishItem = componentManager.getComponent(dishSlot.item, ItemComponentType);
            expect(dishItem).toBeDefined();

            // Verify dish has sellable properties
            expect(dishItem?.value).toBeGreaterThan(0);
            expect(dishItem?.itemType).toBe('food');
            expect(dishItem?.rarity).toBeDefined();
            
            // Dishes should be stackable for shop inventory
            expect(dishItem?.stackSize).toBeGreaterThan(1);
          }
        }
      }
    });

    it('should create all seven dishes with correct rarity distribution', () => {
      const rarityCount = {
        [RarityType.Common]: 0,
        [RarityType.Rare]: 0,
        [RarityType.Epic]: 0
      };

      const allRecipes = cookingSystem.getAllRecipes();
      expect(allRecipes).toHaveLength(7);

      for (const recipe of allRecipes) {
        rarityCount[recipe.rarity]++;
      }

      // Verify rarity distribution matches requirements
      // 3 Common, 3 Rare, 1 Epic (Mythic in requirements)
      expect(rarityCount[RarityType.Common]).toBe(3);
      expect(rarityCount[RarityType.Rare]).toBe(3);
      expect(rarityCount[RarityType.Epic]).toBe(1);
    });

    it('should create dishes with correct sell prices', () => {
      const expectedPrices = {
        'slime_qq_candy': 150,
        'sugar_pickled_snake_liver': 400,
        'fried_mushroom_slices': 150,
        'candied_mystic_mushroom': 400,
        'two_headed_snake_skin_jelly': 150,
        'crispy_wing_snake_skin_roll': 400,
        'grassland_set_meal': 1200
      };

      for (const [recipeId, expectedPrice] of Object.entries(expectedPrices)) {
        const recipe = cookingSystem.getRecipe(recipeId);
        expect(recipe).toBeDefined();
        expect(recipe?.sellPrice).toBe(expectedPrice);
      }
    });
  });
});
