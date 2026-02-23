/**
 * Property-based tests for Equipment Crafting System
 * **Feature: equipment-affix-system, Property 8: Equipment receives exactly one affix**
 * **Validates: Requirements 4.1**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { EquipmentCraftingSystem, EquipmentRecipe } from './EquipmentCraftingSystem';
import { World } from '../../ecs/World';
import { ItemSystem } from './ItemSystem';
import { RarityType } from '../types/RarityTypes';

describe('Equipment Crafting System Property Tests', () => {
  let world: World;
  let equipmentCraftingSystem: EquipmentCraftingSystem;
  let itemSystem: ItemSystem;

  beforeEach(() => {
    world = new World();
    equipmentCraftingSystem = new EquipmentCraftingSystem();
    world.addSystem(equipmentCraftingSystem);
    world.initialize();
    itemSystem = new ItemSystem(world);
    
    equipmentCraftingSystem.setItemSystem(itemSystem);
    
    // Mock fetch for affix definitions
    global.fetch = vi.fn((url: string) => {
      if (url.includes('affix-definitions.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            common: [
              {
                type: 'strength',
                rarity: RarityType.Common,
                displayName: '普通大力',
                minValue: 1,
                maxValue: 5,
                isPercentage: false,
                decimalPlaces: 0
              }
            ],
            rare: [
              {
                type: 'strength',
                rarity: RarityType.Rare,
                displayName: '稀有大力',
                minValue: 1,
                maxValue: 10,
                isPercentage: false,
                decimalPlaces: 0
              }
            ],
            epic: [
              {
                type: 'strength',
                rarity: RarityType.Epic,
                displayName: '神话大力',
                minValue: 1,
                maxValue: 15,
                isPercentage: false,
                decimalPlaces: 0
              }
            ],
            legendary: [
              {
                type: 'strength',
                rarity: RarityType.Legendary,
                displayName: '传说大力',
                minValue: 5,
                maxValue: 20,
                isPercentage: false,
                decimalPlaces: 0
              }
            ]
          })
        } as Response);
      }
      return Promise.reject(new Error('Not found'));
    }) as any;

    equipmentCraftingSystem.initialize();
  });

  /**
   * Helper function to reset systems between property test runs
   */
  function resetSystems(): void {
    world = new World();
    equipmentCraftingSystem = new EquipmentCraftingSystem();
    world.addSystem(equipmentCraftingSystem);
    world.initialize();
    itemSystem = new ItemSystem(world);
    equipmentCraftingSystem.setItemSystem(itemSystem);
    equipmentCraftingSystem.initialize();
  }

  /**
   * Helper function to create a test recipe
   */
  function createTestRecipe(
    id: string,
    rarity: string,
    materials: { itemId: string; amount: number }[]
  ): EquipmentRecipe {
    return {
      id,
      name: `Test ${id}`,
      rarity,
      type: ['weapon'],
      icon: 'test_icon',
      mainAttribute: 'strength',
      secondaryAttributes: ['agility'],
      description: `Test recipe ${id}`,
      materials,
      sellPrice: 100
    };
  }

  /**
   * Helper function to add materials to inventory
   */
  function addMaterialsToInventory(materials: { itemId: string; amount: number }[]): void {
    for (const material of materials) {
      // Register material as an item
      itemSystem.registerItem({
        id: material.itemId,
        name: `Material ${material.itemId}`,
        description: 'Test material',
        type: 'material',
        subType: 'basic',
        icon: 'material_icon',
        rarity: RarityType.Common,
        stackSize: 99,
        canSell: true,
        sellPrice: 10,
        canBuy: false,
        buyPrice: 0,
        canCraft: false,
        canUse: false
      });
      
      // Add to inventory
      itemSystem.addItem(material.itemId, material.amount);
    }
  }

  /**
   * Property 8: Equipment receives exactly one affix
   * For any equipment successfully crafted, the equipment must have exactly one affix assigned
   * **Validates: Requirements 4.1**
   */
  it('Property 8: Equipment receives exactly one affix', async () => {
    // Wait for affix definitions to load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generator for equipment rarity
    const rarityGenerator = fc.constantFrom('common', 'rare', 'epic', 'legendary');

    // Generator for material requirements
    const materialGenerator = fc.array(
      fc.record({
        itemId: fc.string({ minLength: 5, maxLength: 15 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
        amount: fc.integer({ min: 1, max: 5 })
      }),
      { minLength: 1, maxLength: 3 }
    );

    await fc.assert(
      fc.asyncProperty(
        rarityGenerator,
        materialGenerator,
        fc.string({ minLength: 5, maxLength: 15 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
        async (rarity, materials, recipeId) => {
          // Reset systems for each test run to avoid state pollution
          resetSystems();
          await new Promise(resolve => setTimeout(resolve, 50)); // Wait for affix definitions to load

          // Create recipe
          const recipe = createTestRecipe(recipeId, rarity, materials);
          equipmentCraftingSystem.loadRecipes({ recipes: [recipe] });

          // Add materials to inventory
          addMaterialsToInventory(materials);

          // Verify we can craft
          const canCraft = equipmentCraftingSystem.canCraft(recipeId);
          expect(canCraft).toBe(true);

          // Start crafting
          const startResult = equipmentCraftingSystem.startCrafting(recipeId);
          expect(startResult).toBe(true);

          // Verify crafting is in progress
          expect(equipmentCraftingSystem.isCrafting()).toBe(true);

          // Get the crafting session
          const craftingRecipe = equipmentCraftingSystem.getCurrentCraftingRecipe();
          expect(craftingRecipe).not.toBeNull();
          expect(craftingRecipe!.id).toBe(recipeId);

          // Force completion by manipulating the crafting system's internal state
          // Access the private currentCrafting field through type assertion
          const system = equipmentCraftingSystem as any;
          if (system.currentCrafting) {
            // Set start time to past so crafting is complete
            system.currentCrafting.startTime = Date.now() - system.currentCrafting.duration - 100;
          }

          // Update to trigger completion
          equipmentCraftingSystem.update(0);

          // Verify crafting is complete
          expect(equipmentCraftingSystem.isCrafting()).toBe(false);

          // Get all item instances (non-stackable items like equipment)
          const instances = itemSystem.getAllItemInstances();
          
          // Find the crafted equipment instance
          const craftedEquipment = instances.find(instance => instance.itemId === recipeId);
          
          // Requirement 4.1: Equipment must have exactly one affix assigned
          expect(craftedEquipment).toBeDefined();
          expect(craftedEquipment!.instanceData).toBeDefined();
          expect(craftedEquipment!.instanceData.affix).toBeDefined();

          // Verify affix structure
          const affix = craftedEquipment!.instanceData.affix;
          expect(affix.type).toBeDefined();
          expect(affix.rarity).toBeDefined();
          expect(affix.displayName).toBeDefined();
          expect(affix.value).toBeDefined();
          expect(typeof affix.isPercentage).toBe('boolean');

          // Verify affix rarity is valid
          expect([RarityType.Common, RarityType.Rare, RarityType.Epic, RarityType.Legendary]).toContain(affix.rarity);

          // Verify affix value is a number
          expect(typeof affix.value).toBe('number');
          expect(affix.value).toBeGreaterThan(0);

          // Verify there is exactly ONE affix (not an array, just a single object)
          expect(Array.isArray(affix)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000); // 60 second timeout for property-based test

  /**
   * Property 9: Affix assignment completes before equipment return
   * For any equipment crafted, when the crafting system returns the equipment, the affix must already be present
   * **Validates: Requirements 4.4**
   */
  it('Property 9: Affix assignment completes before equipment return', async () => {
    // Wait for affix definitions to load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generator for equipment rarity
    const rarityGenerator = fc.constantFrom('common', 'rare', 'epic', 'legendary');

    // Generator for material requirements
    const materialGenerator = fc.array(
      fc.record({
        itemId: fc.string({ minLength: 5, maxLength: 15 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
        amount: fc.integer({ min: 1, max: 5 })
      }),
      { minLength: 1, maxLength: 3 }
    );

    await fc.assert(
      fc.asyncProperty(
        rarityGenerator,
        materialGenerator,
        fc.string({ minLength: 5, maxLength: 15 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
        async (rarity, materials, recipeId) => {
          // Reset systems for each test run to avoid state pollution
          resetSystems();
          await new Promise(resolve => setTimeout(resolve, 50)); // Wait for affix definitions to load

          // Create recipe
          const recipe = createTestRecipe(recipeId, rarity, materials);
          equipmentCraftingSystem.loadRecipes({ recipes: [recipe] });

          // Add materials to inventory
          addMaterialsToInventory(materials);

          // Start crafting
          const startResult = equipmentCraftingSystem.startCrafting(recipeId);
          expect(startResult).toBe(true);

          // Verify crafting is in progress
          expect(equipmentCraftingSystem.isCrafting()).toBe(true);

          // Force completion by manipulating the crafting system's internal state
          const system = equipmentCraftingSystem as any;
          if (system.currentCrafting) {
            // Set start time to past so crafting is complete
            system.currentCrafting.startTime = Date.now() - system.currentCrafting.duration - 100;
          }

          // Update to trigger completion - this is when equipment is "returned"
          equipmentCraftingSystem.update(0);

          // Verify crafting is complete (equipment has been returned)
          expect(equipmentCraftingSystem.isCrafting()).toBe(false);

          // At this point, the equipment should be in inventory with affix already assigned
          // Get all item instances immediately after crafting completes
          const instances = itemSystem.getAllItemInstances();
          
          // Find the crafted equipment instance
          const craftedEquipment = instances.find(instance => instance.itemId === recipeId);
          
          // Requirement 4.4: Affix must be present when equipment is returned
          // The equipment is "returned" when isCrafting() becomes false
          // At that exact moment, the affix must already be assigned
          expect(craftedEquipment).toBeDefined();
          expect(craftedEquipment!.instanceData).toBeDefined();
          expect(craftedEquipment!.instanceData.affix).toBeDefined();

          // Verify affix is complete and valid
          const affix = craftedEquipment!.instanceData.affix;
          expect(affix.type).toBeDefined();
          expect(affix.rarity).toBeDefined();
          expect(affix.displayName).toBeDefined();
          expect(affix.value).toBeDefined();
          expect(typeof affix.isPercentage).toBe('boolean');

          // Verify affix has valid values (not undefined or null)
          expect(affix.type).not.toBeNull();
          expect(affix.rarity).not.toBeNull();
          expect(affix.displayName).not.toBeNull();
          expect(affix.value).not.toBeNull();
          expect(typeof affix.value).toBe('number');
          expect(affix.value).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000); // 60 second timeout for property-based test

  /**
   * Unit Test: Equipment creation continues when affix assignment fails
   * **Validates: Requirements 4.3**
   */
  it('should continue equipment creation when affix assignment fails', async () => {
    // Wait for affix definitions to load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create a recipe
    const recipeId = 'test_sword_error';
    const materials = [{ itemId: 'iron_ore', amount: 2 }];
    const recipe = createTestRecipe(recipeId, 'rare', materials);
    equipmentCraftingSystem.loadRecipes({ recipes: [recipe] });

    // Add materials to inventory
    addMaterialsToInventory(materials);

    // Mock the AffixSelector to throw an error
    const system = equipmentCraftingSystem as any;
    const originalAffixSelector = system.affixSelector;
    
    // Replace affixSelector with a mock that throws an error
    system.affixSelector = {
      selectAffix: vi.fn(() => {
        throw new Error('Simulated affix assignment failure');
      })
    };

    // Start crafting
    const startResult = equipmentCraftingSystem.startCrafting(recipeId);
    expect(startResult).toBe(true);

    // Verify crafting is in progress
    expect(equipmentCraftingSystem.isCrafting()).toBe(true);

    // Force completion by manipulating the crafting system's internal state
    if (system.currentCrafting) {
      system.currentCrafting.startTime = Date.now() - system.currentCrafting.duration - 100;
    }

    // Update to trigger completion - this should handle the error gracefully
    equipmentCraftingSystem.update(0);

    // Requirement 4.3: Equipment creation should continue despite affix assignment failure
    // Verify crafting is complete
    expect(equipmentCraftingSystem.isCrafting()).toBe(false);

    // Verify equipment was still created and added to inventory
    const instances = itemSystem.getAllItemInstances();
    const craftedEquipment = instances.find(instance => instance.itemId === recipeId);
    
    // Equipment should exist
    expect(craftedEquipment).toBeDefined();
    expect(craftedEquipment!.itemId).toBe(recipeId);

    // Equipment should NOT have an affix (because assignment failed)
    expect(craftedEquipment!.instanceData.affix).toBeUndefined();

    // Verify materials were consumed (crafting actually happened)
    const remainingMaterials = itemSystem.getItemQuantity('iron_ore');
    expect(remainingMaterials).toBe(0);

    // Restore original affixSelector
    system.affixSelector = originalAffixSelector;
  });

  /**
   * Unit Test: Equipment creation continues when affixSelector is null
   * **Validates: Requirements 4.3**
   */
  it('should continue equipment creation when affixSelector is not initialized', async () => {
    // Create a new system without affix definitions loaded
    const worldNoAffix = new World();
    const craftingSystemNoAffix = new EquipmentCraftingSystem();
    worldNoAffix.addSystem(craftingSystemNoAffix);
    worldNoAffix.initialize();
    const itemSystemNoAffix = new ItemSystem(worldNoAffix);
    
    craftingSystemNoAffix.setItemSystem(itemSystemNoAffix);

    // Mock fetch to fail loading affix definitions
    global.fetch = vi.fn(() => Promise.reject(new Error('Failed to load affix definitions'))) as any;

    // Initialize - this should fail to load affixes but continue
    craftingSystemNoAffix.initialize();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create a recipe
    const recipeId = 'test_sword_no_affix';
    const materials = [{ itemId: 'iron_ore', amount: 2 }];
    const recipe = createTestRecipe(recipeId, 'rare', materials);
    craftingSystemNoAffix.loadRecipes({ recipes: [recipe] });

    // Add materials to inventory
    for (const material of materials) {
      itemSystemNoAffix.registerItem({
        id: material.itemId,
        name: `Material ${material.itemId}`,
        description: 'Test material',
        type: 'material',
        subType: 'basic',
        icon: 'material_icon',
        rarity: RarityType.Common,
        stackSize: 99,
        canSell: true,
        sellPrice: 10,
        canBuy: false,
        buyPrice: 0,
        canCraft: false,
        canUse: false
      });
      itemSystemNoAffix.addItem(material.itemId, material.amount);
    }

    // Start crafting
    const startResult = craftingSystemNoAffix.startCrafting(recipeId);
    expect(startResult).toBe(true);

    // Force completion
    const system = craftingSystemNoAffix as any;
    if (system.currentCrafting) {
      system.currentCrafting.startTime = Date.now() - system.currentCrafting.duration - 100;
    }

    // Update to trigger completion
    craftingSystemNoAffix.update(0);

    // Requirement 4.3: Equipment creation should continue when affixSelector is null
    expect(craftingSystemNoAffix.isCrafting()).toBe(false);

    // Verify equipment was still created
    const instances = itemSystemNoAffix.getAllItemInstances();
    const craftedEquipment = instances.find(instance => instance.itemId === recipeId);
    
    expect(craftedEquipment).toBeDefined();
    expect(craftedEquipment!.itemId).toBe(recipeId);

    // Equipment should NOT have an affix (because affixSelector is null)
    expect(craftedEquipment!.instanceData.affix).toBeUndefined();
  });
});
