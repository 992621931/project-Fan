/**
 * Property-based tests for Cooking System
 * Tests universal correctness properties across all possible inputs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CookingSystem, CookingRecipe, CookingIngredient } from './CookingSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { InventoryComponent, InventoryComponentType } from '../components/SystemComponents';
import { ItemComponent, ItemComponentType } from '../components/ItemComponents';
import { RarityType } from '../types/RarityTypes';

describe('Cooking System Property Tests', () => {
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

  /**
   * Arbitraries for property-based testing
   */
  const recipeIdArb = fc.stringMatching(/^[a-z_]+$/);
  const recipeNameArb = fc.string({ minLength: 1, maxLength: 50 });
  const rarityArb = fc.integer({ min: 0, max: 2 }) as fc.Arbitrary<RarityType>;
  const iconArb = fc.stringMatching(/^images\/[a-z_]+\.png$/);
  const descriptionArb = fc.string({ minLength: 1, maxLength: 200 });
  const sellPriceArb = fc.integer({ min: 1, max: 10000 });
  
  const ingredientArb = fc.record({
    itemId: fc.stringMatching(/^[a-z_]+$/),
    quantity: fc.integer({ min: 1, max: 10 })
  });

  const recipeArb = fc.record({
    id: recipeIdArb,
    name: recipeNameArb,
    rarity: rarityArb,
    icon: iconArb,
    description: descriptionArb,
    sellPrice: sellPriceArb,
    ingredients: fc.array(ingredientArb, { minLength: 1, maxLength: 5 })
  });

  // Feature: cooking-system, Property 7: Recipe Structure Validation
  // Validates: Requirements 5.2, 5.3
  describe('Property 7: Recipe Structure Validation', () => {
    it('should accept recipes with all required properties', () => {
      fc.assert(
        fc.property(recipeArb, (recipeData) => {
          const recipesData = { recipes: [recipeData] };
          cookingSystem.loadRecipes(recipesData);
          
          const loadedRecipe = cookingSystem.getRecipe(recipeData.id);
          
          // Recipe should be loaded if it has all required properties
          expect(loadedRecipe).toBeDefined();
          expect(loadedRecipe?.id).toBe(recipeData.id);
          expect(loadedRecipe?.name).toBe(recipeData.name);
          expect(loadedRecipe?.rarity).toBe(recipeData.rarity);
          expect(loadedRecipe?.icon).toBe(recipeData.icon);
          expect(loadedRecipe?.description).toBe(recipeData.description);
          expect(loadedRecipe?.sellPrice).toBe(recipeData.sellPrice);
          expect(loadedRecipe?.ingredients).toHaveLength(recipeData.ingredients.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject recipes missing required properties', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.record({ name: recipeNameArb }), // Missing id
            fc.record({ id: recipeIdArb }), // Missing name
            fc.record({ id: recipeIdArb, name: recipeNameArb }), // Missing rarity
            fc.record({ id: recipeIdArb, name: recipeNameArb, rarity: rarityArb }) // Missing ingredients
          ),
          (invalidRecipeData) => {
            const recipesData = { recipes: [invalidRecipeData] };
            cookingSystem.loadRecipes(recipesData);
            
            // Invalid recipe should not be loaded
            const loadedRecipe = cookingSystem.getRecipe((invalidRecipeData as any).id);
            expect(loadedRecipe).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate ingredient structure', () => {
      fc.assert(
        fc.property(
          recipeIdArb,
          recipeNameArb,
          fc.array(
            fc.oneof(
              fc.record({ itemId: fc.string() }), // Missing quantity
              fc.record({ quantity: fc.integer() }), // Missing itemId
              fc.record({ itemId: fc.constant(null), quantity: fc.integer() }) // Invalid itemId
            ),
            { minLength: 1, maxLength: 3 }
          ),
          (id, name, invalidIngredients) => {
            const invalidRecipeData = {
              id,
              name,
              rarity: 0,
              icon: 'images/test.png',
              description: 'Test',
              sellPrice: 100,
              ingredients: invalidIngredients
            };
            
            const recipesData = { recipes: [invalidRecipeData] };
            cookingSystem.loadRecipes(recipesData);
            
            // Recipe with invalid ingredients should not be loaded
            const loadedRecipe = cookingSystem.getRecipe(id);
            expect(loadedRecipe).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: cooking-system, Property 8: Item Reference Validation
  // Validates: Requirements 5.4
  describe('Property 8: Item Reference Validation', () => {
    it('should handle recipes with non-existent item references', () => {
      fc.assert(
        fc.property(
          recipeArb,
          (recipeData) => {
            // Load recipe
            const recipesData = { recipes: [recipeData] };
            cookingSystem.loadRecipes(recipesData);
            
            // Create player without the required items
            const playerId = createTestPlayer();
            
            // Validation should indicate missing ingredients
            const validation = cookingSystem.validateCooking(playerId, recipeData.id);
            expect(validation.canCook).toBe(false);
            expect(validation.missingIngredients.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate cooking only when all referenced items exist in inventory', () => {
      fc.assert(
        fc.property(
          recipeArb,
          (recipeData) => {
            // Load recipe
            const recipesData = { recipes: [recipeData] };
            cookingSystem.loadRecipes(recipesData);
            
            // Create player and add all required items
            const playerId = createTestPlayer();
            for (const ingredient of recipeData.ingredients) {
              addItemToInventory(playerId, ingredient.itemId, ingredient.quantity);
            }
            
            // Validation should pass
            const validation = cookingSystem.validateCooking(playerId, recipeData.id);
            expect(validation.canCook).toBe(true);
            expect(validation.missingIngredients).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: cooking-system, Property 3: Ingredient Availability Indication
  // Validates: Requirements 3.3
  describe('Property 3: Ingredient Availability Indication', () => {
    it('should correctly indicate missing ingredients', () => {
      fc.assert(
        fc.property(
          recipeArb,
          fc.array(fc.integer({ min: 0, max: 10 })),
          (recipeData, quantities) => {
            // Load recipe
            const recipesData = { recipes: [recipeData] };
            cookingSystem.loadRecipes(recipesData);
            
            // Create player and add partial ingredients
            const playerId = createTestPlayer();
            const ingredientCount = Math.min(recipeData.ingredients.length, quantities.length);
            
            for (let i = 0; i < ingredientCount; i++) {
              const ingredient = recipeData.ingredients[i];
              const quantity = quantities[i];
              if (quantity > 0) {
                addItemToInventory(playerId, ingredient.itemId, quantity);
              }
            }
            
            // Validate
            const validation = cookingSystem.validateCooking(playerId, recipeData.id);
            
            // Check that missing ingredients are correctly identified
            for (const ingredient of recipeData.ingredients) {
              const inventory = componentManager.getComponent(playerId, InventoryComponentType);
              let totalQuantity = 0;
              
              if (inventory) {
                for (const slot of inventory.slots) {
                  if (slot.item) {
                    const item = componentManager.getComponent(slot.item, ItemComponentType);
                    if (item && item.id === ingredient.itemId) {
                      totalQuantity += slot.quantity;
                    }
                  }
                }
              }
              
              const isMissing = totalQuantity < ingredient.quantity;
              const isInMissingList = validation.missingIngredients.some(
                mi => mi.itemId === ingredient.itemId
              );
              
              expect(isInMissingList).toBe(isMissing);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: cooking-system, Property 5: Cooking Transaction Atomicity
  // Validates: Requirements 4.3, 4.4
  describe('Property 5: Cooking Transaction Atomicity', () => {
    it('should atomically consume ingredients and create dish', () => {
      fc.assert(
        fc.property(
          recipeArb,
          (recipeData) => {
            // Load recipe
            const recipesData = { recipes: [recipeData] };
            cookingSystem.loadRecipes(recipesData);
            
            // Aggregate duplicate ingredient IDs in the recipe
            const aggregatedIngredients = new Map<string, number>();
            for (const ingredient of recipeData.ingredients) {
              const current = aggregatedIngredients.get(ingredient.itemId) || 0;
              aggregatedIngredients.set(ingredient.itemId, current + ingredient.quantity);
            }
            
            // Create player and add exact ingredients (aggregated)
            const playerId = createTestPlayer();
            for (const [itemId, quantity] of aggregatedIngredients.entries()) {
              addItemToInventory(playerId, itemId, quantity);
            }
            
            // Get initial inventory state
            const inventory = componentManager.getComponent(playerId, InventoryComponentType);
            const initialIngredientCounts = new Map<string, number>();
            
            if (inventory) {
              for (const slot of inventory.slots) {
                if (slot.item) {
                  const item = componentManager.getComponent(slot.item, ItemComponentType);
                  if (item) {
                    const current = initialIngredientCounts.get(item.id) || 0;
                    initialIngredientCounts.set(item.id, current + slot.quantity);
                  }
                }
              }
            }
            
            // Perform cooking
            const result = cookingSystem.cook(playerId, recipeData.id);
            
            // Get final inventory state
            const finalIngredientCounts = new Map<string, number>();
            const dishCount = { count: 0 };
            
            if (inventory) {
              for (const slot of inventory.slots) {
                if (slot.item) {
                  const item = componentManager.getComponent(slot.item, ItemComponentType);
                  if (item) {
                    if (item.id === recipeData.id) {
                      dishCount.count += slot.quantity;
                    } else {
                      const current = finalIngredientCounts.get(item.id) || 0;
                      finalIngredientCounts.set(item.id, current + slot.quantity);
                    }
                  }
                }
              }
            }
            
            if (result.success) {
              // Verify ingredients were consumed (using aggregated quantities)
              for (const [itemId, totalQuantity] of aggregatedIngredients.entries()) {
                const initialCount = initialIngredientCounts.get(itemId) || 0;
                const finalCount = finalIngredientCounts.get(itemId) || 0;
                expect(finalCount).toBe(initialCount - totalQuantity);
              }
              
              // Verify exactly one dish was created
              expect(dishCount.count).toBe(1);
            } else {
              // If cooking failed, ingredients should not be consumed
              for (const [itemId] of aggregatedIngredients.entries()) {
                const initialCount = initialIngredientCounts.get(itemId) || 0;
                const finalCount = finalIngredientCounts.get(itemId) || 0;
                expect(finalCount).toBe(initialCount);
              }
              
              // No dish should be created
              expect(dishCount.count).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not partially consume ingredients on failure', () => {
      fc.assert(
        fc.property(
          recipeArb,
          (recipeData) => {
            // Load recipe
            const recipesData = { recipes: [recipeData] };
            cookingSystem.loadRecipes(recipesData);
            
            // Aggregate duplicate ingredient IDs in the recipe
            const aggregatedIngredients = new Map<string, number>();
            for (const ingredient of recipeData.ingredients) {
              const current = aggregatedIngredients.get(ingredient.itemId) || 0;
              aggregatedIngredients.set(ingredient.itemId, current + ingredient.quantity);
            }
            
            // Create player with full inventory (no space for dish)
            const playerId = createTestPlayer(5);
            const inventory = componentManager.getComponent(playerId, InventoryComponentType);
            
            // Fill all slots except what's needed for ingredients
            if (inventory) {
              // Add ingredients (aggregated)
              let slotIndex = 0;
              for (const [itemId, quantity] of aggregatedIngredients.entries()) {
                if (slotIndex < inventory.slots.length) {
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
                  inventory.slots[slotIndex].item = itemEntity.id;
                  inventory.slots[slotIndex].quantity = quantity;
                  slotIndex++;
                }
              }
              
              // Fill remaining slots with dummy items
              for (let i = slotIndex; i < inventory.slots.length; i++) {
                const dummyEntity = entityManager.createEntity();
                const dummyItem: ItemComponent = {
                  type: 'item',
                  id: 'dummy_item',
                  name: 'Dummy',
                  description: 'Filler',
                  rarity: RarityType.Common,
                  itemType: 'material',
                  stackSize: 1,
                  value: 1,
                  quality: 50
                };
                componentManager.addComponent(dummyEntity.id, ItemComponentType, dummyItem);
                inventory.slots[i].item = dummyEntity.id;
                inventory.slots[i].quantity = 1;
              }
            }
            
            // Get initial ingredient counts
            const initialCounts = new Map<string, number>();
            if (inventory) {
              for (const slot of inventory.slots) {
                if (slot.item) {
                  const item = componentManager.getComponent(slot.item, ItemComponentType);
                  if (item) {
                    const current = initialCounts.get(item.id) || 0;
                    initialCounts.set(item.id, current + slot.quantity);
                  }
                }
              }
            }
            
            // Try to cook (should fail due to full inventory)
            const result = cookingSystem.cook(playerId, recipeData.id);
            
            // Get final ingredient counts
            const finalCounts = new Map<string, number>();
            if (inventory) {
              for (const slot of inventory.slots) {
                if (slot.item) {
                  const item = componentManager.getComponent(slot.item, ItemComponentType);
                  if (item) {
                    const current = finalCounts.get(item.id) || 0;
                    finalCounts.set(item.id, current + slot.quantity);
                  }
                }
              }
            }
            
            // If cooking failed, all ingredients should remain unchanged
            if (!result.success) {
              for (const [itemId] of aggregatedIngredients.entries()) {
                const initialCount = initialCounts.get(itemId) || 0;
                const finalCount = finalCounts.get(itemId) || 0;
                expect(finalCount).toBe(initialCount);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: cooking-system, Property 9: Dish Creation with Property Preservation
  // Validates: Requirements 7.1, 7.2
  describe('Property 9: Dish Creation with Property Preservation', () => {
    it('should create dish with all recipe properties preserved', () => {
      fc.assert(
        fc.property(
          recipeArb,
          (recipeData) => {
            // Load recipe
            const recipesData = { recipes: [recipeData] };
            cookingSystem.loadRecipes(recipesData);
            
            // Create player and add ingredients
            const playerId = createTestPlayer();
            for (const ingredient of recipeData.ingredients) {
              addItemToInventory(playerId, ingredient.itemId, ingredient.quantity);
            }
            
            // Perform cooking
            const result = cookingSystem.cook(playerId, recipeData.id);
            
            if (result.success) {
              // Find the created dish in inventory
              const inventory = componentManager.getComponent(playerId, InventoryComponentType);
              expect(inventory).toBeDefined();
              
              let dishFound = false;
              if (inventory) {
                for (const slot of inventory.slots) {
                  if (slot.item) {
                    const item = componentManager.getComponent(slot.item, ItemComponentType);
                    if (item && item.id === recipeData.id) {
                      dishFound = true;
                      
                      // Verify all properties are preserved
                      expect(item.name).toBe(recipeData.name);
                      expect(item.description).toBe(recipeData.description);
                      expect(item.rarity).toBe(recipeData.rarity);
                      expect(item.value).toBe(recipeData.sellPrice);
                      expect(item.itemType).toBe('food');
                      expect(slot.quantity).toBe(1);
                      break;
                    }
                  }
                }
              }
              
              expect(dishFound).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create dish as consumable item compatible with inventory system', () => {
      fc.assert(
        fc.property(
          recipeArb,
          (recipeData) => {
            // Load recipe
            const recipesData = { recipes: [recipeData] };
            cookingSystem.loadRecipes(recipesData);
            
            // Create player and add ingredients
            const playerId = createTestPlayer();
            for (const ingredient of recipeData.ingredients) {
              addItemToInventory(playerId, ingredient.itemId, ingredient.quantity);
            }
            
            // Perform cooking
            const result = cookingSystem.cook(playerId, recipeData.id);
            
            if (result.success) {
              const inventory = componentManager.getComponent(playerId, InventoryComponentType);
              
              if (inventory) {
                // Verify dish is in a valid inventory slot
                const dishSlot = inventory.slots.find(slot => {
                  if (slot.item) {
                    const item = componentManager.getComponent(slot.item, ItemComponentType);
                    return item && item.id === recipeData.id;
                  }
                  return false;
                });
                
                expect(dishSlot).toBeDefined();
                expect(dishSlot?.item).not.toBeNull();
                expect(dishSlot?.quantity).toBeGreaterThan(0);
                
                // Verify the dish entity has ItemComponent
                if (dishSlot?.item) {
                  const dishItem = componentManager.getComponent(dishSlot.item, ItemComponentType);
                  expect(dishItem).toBeDefined();
                  expect(dishItem?.type).toBe('item');
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: cooking-system, Property 10: Event Emission on Cooking
  // Validates: Requirements 8.3
  describe('Property 10: Event Emission on Cooking', () => {
    it('should emit cooking:started and cooking:completed events on successful cooking', () => {
      fc.assert(
        fc.property(
          recipeArb,
          (recipeData) => {
            // Load recipe
            const recipesData = { recipes: [recipeData] };
            cookingSystem.loadRecipes(recipesData);
            
            // Create player and add ingredients
            const playerId = createTestPlayer();
            for (const ingredient of recipeData.ingredients) {
              addItemToInventory(playerId, ingredient.itemId, ingredient.quantity);
            }
            
            // Track emitted events
            const emittedEvents: any[] = [];
            const handler1 = (event: any) => {
              emittedEvents.push({ type: 'cooking:started', event });
            };
            const handler2 = (event: any) => {
              emittedEvents.push({ type: 'cooking:completed', event });
            };
            
            eventSystem.subscribe('cooking:started', handler1);
            eventSystem.subscribe('cooking:completed', handler2);
            
            // Perform cooking
            const result = cookingSystem.cook(playerId, recipeData.id);
            
            // Cleanup subscriptions
            eventSystem.unsubscribe('cooking:started', handler1);
            eventSystem.unsubscribe('cooking:completed', handler2);
            
            if (result.success) {
              // Verify cooking:started event was emitted
              const startedEvent = emittedEvents.find(e => e.type === 'cooking:started');
              expect(startedEvent).toBeDefined();
              expect(startedEvent?.event.playerId).toBe(playerId);
              expect(startedEvent?.event.recipeId).toBe(recipeData.id);
              
              // Verify cooking:completed event was emitted
              const completedEvent = emittedEvents.find(e => e.type === 'cooking:completed');
              expect(completedEvent).toBeDefined();
              expect(completedEvent?.event.playerId).toBe(playerId);
              expect(completedEvent?.event.recipeId).toBe(recipeData.id);
              expect(completedEvent?.event.dishId).toBe(recipeData.id);
              
              // Verify events were emitted in correct order
              const startedIndex = emittedEvents.findIndex(e => e.type === 'cooking:started');
              const completedIndex = emittedEvents.findIndex(e => e.type === 'cooking:completed');
              expect(startedIndex).toBeLessThan(completedIndex);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should emit inventory:updated event after dish creation', () => {
      fc.assert(
        fc.property(
          recipeArb,
          (recipeData) => {
            // Load recipe
            const recipesData = { recipes: [recipeData] };
            cookingSystem.loadRecipes(recipesData);
            
            // Create player and add ingredients
            const playerId = createTestPlayer();
            for (const ingredient of recipeData.ingredients) {
              addItemToInventory(playerId, ingredient.itemId, ingredient.quantity);
            }
            
            // Track inventory:updated events
            let inventoryUpdatedCount = 0;
            const handler = (event: any) => {
              if (event.playerId === playerId) {
                inventoryUpdatedCount++;
              }
            };
            
            eventSystem.subscribe('inventory:updated', handler);
            
            // Perform cooking
            const result = cookingSystem.cook(playerId, recipeData.id);
            
            // Cleanup subscription
            eventSystem.unsubscribe('inventory:updated', handler);
            
            if (result.success) {
              // Verify inventory:updated event was emitted at least once
              expect(inventoryUpdatedCount).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not emit cooking:completed event on failure', () => {
      fc.assert(
        fc.property(
          recipeArb,
          (recipeData) => {
            // Load recipe
            const recipesData = { recipes: [recipeData] };
            cookingSystem.loadRecipes(recipesData);
            
            // Create player WITHOUT ingredients
            const playerId = createTestPlayer();
            
            // Track events
            let completedEventEmitted = false;
            const handler = (event: any) => {
              if (event.playerId === playerId && event.recipeId === recipeData.id) {
                completedEventEmitted = true;
              }
            };
            
            eventSystem.subscribe('cooking:completed', handler);
            
            // Try to cook (should fail)
            const result = cookingSystem.cook(playerId, recipeData.id);
            
            // Cleanup subscription
            eventSystem.unsubscribe('cooking:completed', handler);
            
            // Verify no completed event was emitted on failure
            if (!result.success) {
              expect(completedEventEmitted).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
