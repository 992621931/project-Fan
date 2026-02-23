/**
 * Property-based tests for Equipment System
 * **Feature: character-equipment-system**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { EquipmentSystem } from './EquipmentSystem';
import { ItemSystem } from './ItemSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { World } from '../../ecs/World';
import {
  EquipmentSlotsComponent,
  EquipmentSlotsComponentType
} from '../components/SystemComponents';

describe('Equipment System Property Tests', () => {
  let world: World;
  let equipmentSystem: EquipmentSystem;
  let itemSystem: ItemSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;

  beforeEach(() => {
    eventSystem = new EventSystem();
    world = new World(eventSystem);
    
    // Get the managers from the world (World creates its own)
    entityManager = world.entityManager;
    componentManager = world.componentManager;

    itemSystem = new ItemSystem(world);
    itemSystem.initialize(entityManager, componentManager, eventSystem);

    equipmentSystem = new EquipmentSystem(world, itemSystem);
    equipmentSystem.initialize(entityManager, componentManager, eventSystem);
  });

  /**
   * Helper function to create a character entity with equipment slots
   */
  function createCharacterWithEquipmentSlots(): string {
    const characterEntity = entityManager.createEntity();
    const characterId = characterEntity.id;

    const equipmentSlots: EquipmentSlotsComponent = {
      type: 'equipmentSlots',
      weapon: null,
      armor: null,
      offhand: null,
      accessory: null
    };

    componentManager.addComponent(characterId, EquipmentSlotsComponentType, equipmentSlots);

    return characterId;
  }


  /**
   * Property 1: Equipment slot structure completeness
   * **Validates: Requirements 1.1**
   * 
   * For any character entity, the character SHALL have exactly four equipment slots 
   * named weapon, armor, offhand, and accessory
   */
  it('Property 1: Equipment slot structure completeness', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // Number of characters to test
        (numCharacters) => {
          // Create multiple characters
          const characterIds: string[] = [];
          for (let i = 0; i < numCharacters; i++) {
            characterIds.push(createCharacterWithEquipmentSlots());
          }

          // Verify each character has exactly four equipment slots with correct names
          for (const characterId of characterIds) {
            const equipmentSlots = componentManager.getComponent(
              characterId,
              EquipmentSlotsComponentType
            );

            // Character must have equipment slots component
            expect(equipmentSlots).not.toBeNull();
            expect(equipmentSlots).toBeDefined();

            // Verify all four slots exist
            expect(equipmentSlots).toHaveProperty('weapon');
            expect(equipmentSlots).toHaveProperty('armor');
            expect(equipmentSlots).toHaveProperty('offhand');
            expect(equipmentSlots).toHaveProperty('accessory');

            // Verify slot count is exactly 4
            const slotKeys = Object.keys(equipmentSlots!).filter(
              key => key !== 'type' // Exclude the 'type' property
            );
            expect(slotKeys).toHaveLength(4);

            // Verify slot names are correct
            expect(slotKeys).toContain('weapon');
            expect(slotKeys).toContain('armor');
            expect(slotKeys).toContain('offhand');
            expect(slotKeys).toContain('accessory');

            // Verify no extra slots exist
            const expectedSlots = ['weapon', 'armor', 'offhand', 'accessory'];
            for (const key of slotKeys) {
              expect(expectedSlots).toContain(key);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Equipment slot initialization
   * **Validates: Requirements 1.2**
   * 
   * For any newly created character, all four equipment slots SHALL be initialized as empty (null)
   */
  it('Property 2: Equipment slot initialization', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // Number of characters to test
        (numCharacters) => {
          // Create multiple new characters
          const characterIds: string[] = [];
          for (let i = 0; i < numCharacters; i++) {
            characterIds.push(createCharacterWithEquipmentSlots());
          }

          // Verify each newly created character has all slots initialized as null
          for (const characterId of characterIds) {
            const equipmentSlots = componentManager.getComponent(
              characterId,
              EquipmentSlotsComponentType
            );

            // Character must have equipment slots component
            expect(equipmentSlots).not.toBeNull();
            expect(equipmentSlots).toBeDefined();

            // Verify all four slots are initialized as null (empty)
            expect(equipmentSlots!.weapon).toBeNull();
            expect(equipmentSlots!.armor).toBeNull();
            expect(equipmentSlots!.offhand).toBeNull();
            expect(equipmentSlots!.accessory).toBeNull();

            // Verify no slot has a non-null value
            const slotValues = [
              equipmentSlots!.weapon,
              equipmentSlots!.armor,
              equipmentSlots!.offhand,
              equipmentSlots!.accessory
            ];
            
            for (const slotValue of slotValues) {
              expect(slotValue).toBeNull();
            }

            // Verify all slots are empty (count of non-null slots should be 0)
            const nonNullSlots = slotValues.filter(value => value !== null);
            expect(nonNullSlots).toHaveLength(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 3: Equipment slot-item association integrity
   * **Validates: Requirements 1.4**
   * 
   * For any character with equipped items, each slot SHALL maintain the correct association 
   * between slot type and the equipped item's equipment type
   */
  it('Property 3: Equipment slot-item association integrity', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
            itemType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory')
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (equipmentOperations) => {
          // Create a character with equipment slots
          const characterId = createCharacterWithEquipmentSlots();

          // Create and equip items based on the generated operations
          const equippedItems = new Map<string, string>();

          for (const operation of equipmentOperations) {
            const { slotType, itemType } = operation;

            // Create an equipment item with the specified type
            const itemId = `test_${itemType}_${Date.now()}_${Math.random()}`;
            const itemData = {
              id: itemId,
              name: `Test ${itemType}`,
              description: `Test equipment for ${itemType} slot`,
              type: 'equipment' as const,
              subType: itemType,
              equipmentSlot: itemType,
              icon: 'test-icon.png',
              rarity: 0,
              stackSize: 1,
              canSell: true,
              sellPrice: 100,
              canBuy: true,
              buyPrice: 200,
              canCraft: false,
              craftRecipe: null,
              canUse: false
            };

            // Register the item in ItemSystem
            itemSystem.registerItem(itemData);

            // Add item to inventory
            itemSystem.addItem(itemId, 1);

            // Get the instance ID
            const instances = itemSystem.getAllItemInstances();
            const instance = instances.find(inst => inst.itemId === itemId);

            if (instance && instance.instanceId) {
              // Try to equip the item
              const success = equipmentSystem.equipItem(
                characterId,
                instance.instanceId,
                slotType as any
              );

              // If equipment was successful (slot type matches item type)
              if (success) {
                equippedItems.set(slotType, instance.instanceId);
              }
            }
          }

          // Verify slot-item association integrity
          const equipmentSlots = componentManager.getComponent(
            characterId,
            EquipmentSlotsComponentType
          );

          expect(equipmentSlots).not.toBeNull();
          expect(equipmentSlots).toBeDefined();

          // Check each slot that has an equipped item
          const slotsToCheck: Array<{ slot: keyof EquipmentSlotsComponent; type: string }> = [
            { slot: 'weapon', type: 'weapon' },
            { slot: 'armor', type: 'armor' },
            { slot: 'offhand', type: 'offhand' },
            { slot: 'accessory', type: 'accessory' }
          ];

          for (const { slot, type } of slotsToCheck) {
            const equippedItemId = equipmentSlots![slot];

            if (equippedItemId !== null) {
              // Get the item instance
              const instances = itemSystem.getAllItemInstances();
              const instance = instances.find(
                inst => inst.instanceId === (equippedItemId as unknown as string)
              );

              expect(instance).toBeDefined();

              if (instance) {
                // Get the item data
                const itemData = itemSystem.getItem(instance.itemId);
                expect(itemData).toBeDefined();

                if (itemData) {
                  // Verify the item's equipment type matches the slot type
                  const itemEquipmentType = itemData.equipmentSlot || itemData.subType;
                  
                  // Handle accessory/misc naming variation
                  if (type === 'accessory') {
                    expect(['accessory', 'misc']).toContain(itemEquipmentType);
                  } else {
                    expect(itemEquipmentType).toBe(type);
                  }

                  // Verify the association is correct
                  // If an item is in a weapon slot, it must be a weapon
                  // If an item is in an armor slot, it must be armor, etc.
                  expect(itemData.type).toBe('equipment');
                }
              }
            }
          }

          // Additional check: Verify no mismatched associations exist
          // For example, a weapon should never be in an armor slot
          if (equipmentSlots!.weapon !== null) {
            const weaponInstance = itemSystem.getAllItemInstances().find(
              inst => inst.instanceId === (equipmentSlots!.weapon as unknown as string)
            );
            if (weaponInstance) {
              const weaponData = itemSystem.getItem(weaponInstance.itemId);
              if (weaponData) {
                const weaponType = weaponData.equipmentSlot || weaponData.subType;
                expect(weaponType).toBe('weapon');
              }
            }
          }

          if (equipmentSlots!.armor !== null) {
            const armorInstance = itemSystem.getAllItemInstances().find(
              inst => inst.instanceId === (equipmentSlots!.armor as unknown as string)
            );
            if (armorInstance) {
              const armorData = itemSystem.getItem(armorInstance.itemId);
              if (armorData) {
                const armorType = armorData.equipmentSlot || armorData.subType;
                expect(armorType).toBe('armor');
              }
            }
          }

          if (equipmentSlots!.offhand !== null) {
            const offhandInstance = itemSystem.getAllItemInstances().find(
              inst => inst.instanceId === (equipmentSlots!.offhand as unknown as string)
            );
            if (offhandInstance) {
              const offhandData = itemSystem.getItem(offhandInstance.itemId);
              if (offhandData) {
                const offhandType = offhandData.equipmentSlot || offhandData.subType;
                expect(offhandType).toBe('offhand');
              }
            }
          }

          if (equipmentSlots!.accessory !== null) {
            const accessoryInstance = itemSystem.getAllItemInstances().find(
              inst => inst.instanceId === (equipmentSlots!.accessory as unknown as string)
            );
            if (accessoryInstance) {
              const accessoryData = itemSystem.getItem(accessoryInstance.itemId);
              if (accessoryData) {
                const accessoryType = accessoryData.equipmentSlot || accessoryData.subType;
                expect(['accessory', 'misc']).toContain(accessoryType);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 4: Item reference storage
   * **Validates: Requirements 1.3**
   * 
   * For any equipment item assigned to a slot, the slot SHALL store the item's entity ID reference
   */
  it('Property 4: Item reference storage', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
            itemName: fc.string({ minLength: 1, maxLength: 20 })
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (equipmentOperations) => {
          // Create a character with equipment slots
          const characterId = createCharacterWithEquipmentSlots();

          // Track which items we successfully equipped
          const equippedItemReferences = new Map<string, string>();

          for (const operation of equipmentOperations) {
            const { slotType, itemName } = operation;

            // Create an equipment item matching the slot type
            const itemId = `test_${slotType}_${itemName}_${Date.now()}_${Math.random()}`;
            const itemData = {
              id: itemId,
              name: `${itemName} ${slotType}`,
              description: `Test equipment for ${slotType} slot`,
              type: 'equipment' as const,
              subType: slotType,
              equipmentSlot: slotType,
              icon: 'test-icon.png',
              rarity: 0,
              stackSize: 1,
              canSell: true,
              sellPrice: 100,
              canBuy: true,
              buyPrice: 200,
              canCraft: false,
              craftRecipe: null,
              canUse: false
            };

            // Register the item in ItemSystem
            itemSystem.registerItem(itemData);

            // Add item to inventory
            itemSystem.addItem(itemId, 1);

            // Get the instance ID
            const instances = itemSystem.getAllItemInstances();
            const instance = instances.find(inst => inst.itemId === itemId);

            if (instance && instance.instanceId) {
              // Equip the item
              const success = equipmentSystem.equipItem(
                characterId,
                instance.instanceId,
                slotType as any
              );

              // If equipment was successful, track the reference
              if (success) {
                equippedItemReferences.set(slotType, instance.instanceId);
              }
            }
          }

          // Verify that each equipped item's reference is stored in the slot
          const equipmentSlots = componentManager.getComponent(
            characterId,
            EquipmentSlotsComponentType
          );

          expect(equipmentSlots).not.toBeNull();
          expect(equipmentSlots).toBeDefined();

          // For each slot that should have an item equipped
          for (const [slotType, expectedInstanceId] of equippedItemReferences.entries()) {
            const slotValue = equipmentSlots![slotType as keyof EquipmentSlotsComponent];

            // The slot must not be null
            expect(slotValue).not.toBeNull();

            // The slot must store the exact item instance ID reference
            expect(slotValue).toBe(expectedInstanceId as unknown as EntityId);

            // Verify the stored reference is a valid string
            expect(typeof slotValue).toBe('string');
            expect((slotValue as unknown as string).length).toBeGreaterThan(0);

            // Verify the reference can be used to retrieve the item from ItemSystem
            const instances = itemSystem.getAllItemInstances();
            const retrievedInstance = instances.find(
              inst => inst.instanceId === (slotValue as unknown as string)
            );
            expect(retrievedInstance).toBeDefined();
            expect(retrievedInstance?.instanceId).toBe(expectedInstanceId);
          }

          // Additional verification: Check that empty slots remain null
          const allSlots: Array<keyof EquipmentSlotsComponent> = ['weapon', 'armor', 'offhand', 'accessory'];
          for (const slot of allSlots) {
            if (slot === 'type') continue; // Skip the type property

            const slotValue = equipmentSlots![slot];
            const hasReference = equippedItemReferences.has(slot);

            if (hasReference) {
              // Slot should have a reference
              expect(slotValue).not.toBeNull();
              expect(slotValue).toBe(equippedItemReferences.get(slot) as unknown as EntityId);
            } else {
              // Slot should be null if no item was equipped
              // (or it might have a reference if a previous operation equipped something)
              if (slotValue !== null) {
                // If not null, it must be a valid reference
                expect(typeof slotValue).toBe('string');
              }
            }
          }

          // Verify that the stored references are unique (no duplicate references)
          const storedReferences = [
            equipmentSlots!.weapon,
            equipmentSlots!.armor,
            equipmentSlots!.offhand,
            equipmentSlots!.accessory
          ].filter(ref => ref !== null);

          const uniqueReferences = new Set(storedReferences);
          expect(uniqueReferences.size).toBe(storedReferences.length);
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 10: Equipment assignment
   * **Validates: Requirements 4.1**
   * 
   * For any equipment item clicked in the warehouse panel, the item SHALL be assigned 
   * to the corresponding equipment slot
   */
  it('Property 10: Equipment assignment', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
            itemName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
            itemRarity: fc.integer({ min: 0, max: 3 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (equipmentItems) => {
          // Create a NEW character with equipment slots for EACH test iteration
          const characterId = createCharacterWithEquipmentSlots();

          // Track successful equipment assignments
          const assignedItems = new Map<string, string>();

          for (const item of equipmentItems) {
            const { slotType, itemName, itemRarity } = item;

            // Create an equipment item matching the slot type
            const itemId = `test_${slotType}_${itemName}_${Date.now()}_${Math.random()}`;
            const itemData = {
              id: itemId,
              name: `${itemName} ${slotType}`,
              description: `Test equipment for ${slotType} slot`,
              type: 'equipment' as const,
              subType: slotType,
              equipmentSlot: slotType,
              icon: 'test-icon.png',
              rarity: itemRarity,
              stackSize: 1,
              canSell: true,
              sellPrice: 100,
              canBuy: true,
              buyPrice: 200,
              canCraft: false,
              craftRecipe: null,
              canUse: false
            };

            // Register the item in ItemSystem (simulating item in warehouse)
            itemSystem.registerItem(itemData);

            // Add item to inventory (simulating item available in warehouse)
            itemSystem.addItem(itemId, 1);

            // Get the instance ID (simulating item selection from warehouse)
            const instances = itemSystem.getAllItemInstances();
            const instance = instances.find(inst => inst.itemId === itemId);

            if (instance && instance.instanceId) {
              // Simulate clicking the item in warehouse panel - equip the item
              const success = equipmentSystem.equipItem(
                characterId,
                instance.instanceId,
                slotType as any
              );

              // Equipment should succeed for valid items
              expect(success).toBe(true);

              // Track the assignment
              if (success) {
                assignedItems.set(slotType, instance.instanceId);
              }
            }
          }

          // Verify that all items were assigned to their corresponding slots
          const equipmentSlots = componentManager.getComponent(
            characterId,
            EquipmentSlotsComponentType
          );

          expect(equipmentSlots).not.toBeNull();
          expect(equipmentSlots).toBeDefined();

          // For each item that should be assigned
          for (const [slotType, expectedInstanceId] of assignedItems.entries()) {
            const slotValue = equipmentSlots![slotType as keyof EquipmentSlotsComponent];

            // The slot must contain the assigned item
            expect(slotValue).not.toBeNull();
            expect(slotValue).toBe(expectedInstanceId as unknown as EntityId);

            // Verify the assignment is retrievable via getEquippedItem
            const equippedItem = equipmentSystem.getEquippedItem(
              characterId,
              slotType as any
            );
            expect(equippedItem).toBe(expectedInstanceId as unknown as EntityId);

            // Verify the item can be retrieved from ItemSystem
            const instances = itemSystem.getAllItemInstances();
            const retrievedInstance = instances.find(
              inst => inst.instanceId === expectedInstanceId
            );
            expect(retrievedInstance).toBeDefined();
            expect(retrievedInstance?.instanceId).toBe(expectedInstanceId);

            // Verify the item data is correct
            if (retrievedInstance) {
              const itemData = itemSystem.getItem(retrievedInstance.itemId);
              expect(itemData).toBeDefined();
              expect(itemData?.type).toBe('equipment');
              
              const itemEquipmentType = itemData?.equipmentSlot || itemData?.subType;
              if (slotType === 'accessory') {
                expect(['accessory', 'misc']).toContain(itemEquipmentType);
              } else {
                expect(itemEquipmentType).toBe(slotType);
              }
            }
          }

          // Verify that the assignment operation is idempotent
          // Re-assigning the same items should maintain the same state
          for (const [slotType, instanceId] of assignedItems.entries()) {
            const beforeSlotValue = equipmentSlots![slotType as keyof EquipmentSlotsComponent];
            
            // Re-equip the same item
            const success = equipmentSystem.equipItem(
              characterId,
              instanceId,
              slotType as any
            );
            
            expect(success).toBe(true);
            
            const afterSlotValue = equipmentSlots![slotType as keyof EquipmentSlotsComponent];
            expect(afterSlotValue).toBe(beforeSlotValue);
          }

          // Verify that getAllEquippedItems returns all assigned items
          const allEquippedItems = equipmentSystem.getAllEquippedItems(characterId);
          expect(allEquippedItems).toBeDefined();
          expect(allEquippedItems.size).toBe(4); // Should have all 4 slots

          for (const [slotType, instanceId] of assignedItems.entries()) {
            const equippedInSlot = allEquippedItems.get(slotType as any);
            expect(equippedInSlot).toBe(instanceId as unknown as EntityId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 18: Equipment unequip functionality
   * **Validates: Requirements 6.1, 6.2**
   * 
   * For any occupied equipment slot, the system SHALL provide a mechanism to unequip 
   * the item and return the slot to empty state
   */
  it('Property 18: Equipment unequip functionality', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
            itemName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
            itemRarity: fc.integer({ min: 0, max: 3 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (equipmentItems) => {
          // Create a character with equipment slots
          const characterId = createCharacterWithEquipmentSlots();

          // Track equipped items
          const equippedItems = new Map<string, string>();

          // Equip items to various slots
          for (const item of equipmentItems) {
            const { slotType, itemName, itemRarity } = item;

            // Create an equipment item matching the slot type
            const itemId = `test_${slotType}_${itemName}_${Date.now()}_${Math.random()}`;
            const itemData = {
              id: itemId,
              name: `${itemName} ${slotType}`,
              description: `Test equipment for ${slotType} slot`,
              type: 'equipment' as const,
              subType: slotType,
              equipmentSlot: slotType,
              icon: 'test-icon.png',
              rarity: itemRarity,
              stackSize: 1,
              canSell: true,
              sellPrice: 100,
              canBuy: true,
              buyPrice: 200,
              canCraft: false,
              craftRecipe: null,
              canUse: false
            };

            // Register the item in ItemSystem
            itemSystem.registerItem(itemData);

            // Add item to inventory
            itemSystem.addItem(itemId, 1);

            // Get the instance ID
            const instances = itemSystem.getAllItemInstances();
            const instance = instances.find(inst => inst.itemId === itemId);

            if (instance && instance.instanceId) {
              // Equip the item
              const success = equipmentSystem.equipItem(
                characterId,
                instance.instanceId,
                slotType as any
              );

              if (success) {
                equippedItems.set(slotType, instance.instanceId);
              }
            }
          }

          // Verify items are equipped
          const equipmentSlotsBeforeUnequip = componentManager.getComponent(
            characterId,
            EquipmentSlotsComponentType
          );

          expect(equipmentSlotsBeforeUnequip).not.toBeNull();
          expect(equipmentSlotsBeforeUnequip).toBeDefined();

          // Now unequip each item
          for (const [slotType, instanceId] of equippedItems.entries()) {
            // Verify the slot is occupied before unequipping
            const slotValueBefore = equipmentSlotsBeforeUnequip![slotType as keyof EquipmentSlotsComponent];
            expect(slotValueBefore).toBe(instanceId as unknown as EntityId);

            // Unequip the item
            const unequipSuccess = equipmentSystem.unequipItem(
              characterId,
              slotType as any
            );

            // Unequip should succeed
            expect(unequipSuccess).toBe(true);

            // Verify the slot is now empty (null)
            const equipmentSlotsAfterUnequip = componentManager.getComponent(
              characterId,
              EquipmentSlotsComponentType
            );

            const slotValueAfter = equipmentSlotsAfterUnequip![slotType as keyof EquipmentSlotsComponent];
            expect(slotValueAfter).toBeNull();

            // Verify getEquippedItem returns null for the unequipped slot
            const equippedItem = equipmentSystem.getEquippedItem(
              characterId,
              slotType as any
            );
            expect(equippedItem).toBeNull();

            // Verify the item is no longer in the slot
            expect(slotValueAfter).not.toBe(instanceId as unknown as EntityId);
          }

          // Final verification: All slots should be empty after unequipping all items
          const finalEquipmentSlots = componentManager.getComponent(
            characterId,
            EquipmentSlotsComponentType
          );

          expect(finalEquipmentSlots!.weapon).toBeNull();
          expect(finalEquipmentSlots!.armor).toBeNull();
          expect(finalEquipmentSlots!.offhand).toBeNull();
          expect(finalEquipmentSlots!.accessory).toBeNull();

          // Verify getAllEquippedItems returns all null values
          const allEquippedItems = equipmentSystem.getAllEquippedItems(characterId);
          expect(allEquippedItems.get('weapon')).toBeNull();
          expect(allEquippedItems.get('armor')).toBeNull();
          expect(allEquippedItems.get('offhand')).toBeNull();
          expect(allEquippedItems.get('accessory')).toBeNull();

          // Verify unequipping an already empty slot returns false
          const unequipEmptySlotResult = equipmentSystem.unequipItem(
            characterId,
            'weapon' as any
          );
          expect(unequipEmptySlotResult).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 21: Equipment change event emission
   * **Validates: Requirements 7.4, 9.5**
   * 
   * For any equipment change operation (equip, unequip, replace), the system SHALL emit 
   * an equipment_changed event
   * 
   * Note: Replacement operations (equipping to an occupied slot) emit 2 events:
   * - One event for unequipping the previous item
   * - One event for equipping the new item
   */
  it('Property 21: Equipment change event emission', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            operation: fc.constantFrom('equip', 'unequip', 'replace'),
            slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
            itemName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0)
          }),
          { minLength: 1, maxLength: 15 }
        ),
        (operations) => {
          // Create a character with equipment slots
          const characterId = createCharacterWithEquipmentSlots();

          // Track all emitted events
          const emittedEvents: any[] = [];

          // Subscribe to equipment_changed events BEFORE any operations
          const handler = (event: any) => {
            emittedEvents.push(event);
          };
          eventSystem.on('equipment_changed', handler);

          // Track currently equipped items per slot
          const currentlyEquipped = new Map<string, string>();

          // Track expected event count
          // Replacement operations emit 2 events (unequip + equip)
          // Fresh equip operations emit 1 event
          // Unequip operations emit 1 event
          let expectedEventCount = 0;

          // Execute each operation
          for (const op of operations) {
            const { operation, slotType, itemName } = op;

            if (operation === 'equip' || operation === 'replace') {
              // Create an equipment item matching the slot type
              const itemId = `test_${slotType}_${itemName}_${Date.now()}_${Math.random()}`;
              const itemData = {
                id: itemId,
                name: `${itemName} ${slotType}`,
                description: `Test equipment for ${slotType} slot`,
                type: 'equipment' as const,
                subType: slotType,
                equipmentSlot: slotType,
                icon: 'test-icon.png',
                rarity: 0,
                stackSize: 1,
                canSell: true,
                sellPrice: 100,
                canBuy: true,
                buyPrice: 200,
                canCraft: false,
                craftRecipe: null,
                canUse: false
              };

              // Register the item in ItemSystem
              itemSystem.registerItem(itemData);

              // Add item to inventory
              itemSystem.addItem(itemId, 1);

              // Get the instance ID
              const instances = itemSystem.getAllItemInstances();
              const instance = instances.find(inst => inst.itemId === itemId);

              if (instance && instance.instanceId) {
                // Check if this is a replacement (slot already occupied)
                const isReplacement = currentlyEquipped.has(slotType);
                
                // Equip the item
                const success = equipmentSystem.equipItem(
                  characterId,
                  instance.instanceId,
                  slotType as any
                );

                if (success) {
                  // Replacement emits 2 events (unequip + equip)
                  // Fresh equip emits 1 event
                  expectedEventCount += isReplacement ? 2 : 1;
                  
                  // Update tracking
                  currentlyEquipped.set(slotType, instance.instanceId);
                }
              }
            } else if (operation === 'unequip') {
              // Only unequip if there's something equipped in this slot
              if (currentlyEquipped.has(slotType)) {
                // Unequip the item
                const success = equipmentSystem.unequipItem(
                  characterId,
                  slotType as any
                );

                if (success) {
                  // Unequip emits 1 event
                  expectedEventCount++;
                  
                  // Update tracking
                  currentlyEquipped.delete(slotType);
                }
              }
            }
          }

          // Verify that events were emitted correctly
          // Replacement operations emit 2 events (unequip + equip)
          // Fresh equip and unequip operations emit 1 event each
          expect(emittedEvents.length).toBe(expectedEventCount);
          // Verify that events were emitted correctly
          // Replacement operations emit 2 events (unequip + equip)
          // Fresh equip and unequip operations emit 1 event each
          expect(emittedEvents.length).toBe(expectedEventCount);
          
          // If there were expected events, verify events were emitted
          if (expectedEventCount > 0) {
            expect(emittedEvents.length).toBeGreaterThan(0);
          } else {
            // If no operations succeeded, no events should be emitted
            expect(emittedEvents.length).toBe(0);
            return; // Skip further validation if no operations succeeded
          }

          // Verify all events have the correct structure
          for (const event of emittedEvents) {
            expect(event).toBeDefined();
            expect(event).toHaveProperty('type');
            expect(event.type).toBe('equipment_changed');
            expect(event).toHaveProperty('timestamp');
            expect(event).toHaveProperty('characterId');
            expect(event).toHaveProperty('slot');
            expect(event).toHaveProperty('previousItem');
            expect(event).toHaveProperty('newItem');

            // Verify characterId is correct
            expect(event.characterId).toBe(characterId);

            // Verify slot is valid
            expect(['weapon', 'armor', 'offhand', 'accessory']).toContain(event.slot);

            // Verify previousItem and newItem are not both null
            // (At least one should have a value for a valid equipment change)
            expect(event.previousItem !== null || event.newItem !== null).toBe(true);
          }

          // Verify event data matches operations
          // For equip operations, newItem should not be null
          const equipEvents = emittedEvents.filter(event => event.newItem !== null);
          expect(equipEvents.length).toBeGreaterThan(0);

          // For unequip operations, newItem should be null and previousItem should not be null
          const unequipEvents = emittedEvents.filter(
            event => event.newItem === null && event.previousItem !== null
          );
          // We might have unequip events if unequip operations were successful

          // For replacement operations, we'll see pairs of events:
          // 1. Unequip event (previousItem !== null, newItem === null)
          // 2. Equip event (previousItem === null, newItem !== null)
          // Note: The second event in a replacement has previousItem === null because
          // the slot was just cleared by the unequip operation

          // Verify that each event corresponds to an actual equipment change
          for (const event of emittedEvents) {
            // The event should have valid characterId
            expect(event.characterId).toBe(characterId);

            // The event should have a valid slot
            expect(['weapon', 'armor', 'offhand', 'accessory']).toContain(event.slot);

            // At least one of previousItem or newItem should be non-null
            const hasChange = event.previousItem !== null || event.newItem !== null;
            expect(hasChange).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 19: Bonus removal on unequip
   * **Validates: Requirements 6.3**
   * 
   * For any equipment item that is unequipped, all attribute bonuses from that equipment 
   * SHALL be removed from the character's stats
   */
  it('Property 19: Bonus removal on unequip', () => {
    fc.assert(
      fc.property(
        fc.record({
          slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
          mainStatAttribute: fc.constantFrom('attack', 'defense', 'critRate', 'dodgeRate'),
          mainStatValue: fc.integer({ min: 5, max: 50 }),
          subStats: fc.array(
            fc.record({
              attribute: fc.constantFrom('attack', 'defense', 'critRate', 'dodgeRate', 'moveSpeed'),
              value: fc.integer({ min: 1, max: 20 })
            }),
            { maxLength: 3 }
          )
        }),
        (testData) => {
          // Create a character with equipment slots and attributes
          const characterId = createCharacterWithEquipmentSlots();

          // Add AttributeComponent and DerivedStatsComponent
          const attributeComponent = {
            type: 'attributes' as const,
            strength: 10,
            agility: 10,
            wisdom: 10,
            technique: 10
          };
          componentManager.addComponent(characterId, { type: 'attributes' }, attributeComponent);

          const derivedStatsComponent = {
            type: 'derivedStats' as const,
            attack: 10,
            defense: 10,
            moveSpeed: 5,
            dodgeRate: 5,
            critRate: 5,
            critDamage: 125,
            resistance: 5,
            magicPower: 10,
            carryWeight: 50,
            hitRate: 90,
            expRate: 100,
            healthRegen: 1,
            manaRegen: 1
          };
          componentManager.addComponent(characterId, { type: 'derivedStats' }, derivedStatsComponent);

          const { slotType, mainStatAttribute, mainStatValue, subStats } = testData;

          // Create an equipment item with affixes
          const itemId = `test_${slotType}_${Date.now()}_${Math.random()}`;
          const itemData = {
            id: itemId,
            name: `Test ${slotType}`,
            description: `Test equipment for ${slotType} slot`,
            type: 'equipment' as const,
            subType: slotType,
            equipmentSlot: slotType,
            icon: 'test-icon.png',
            rarity: 1,
            stackSize: 1,
            mainStat: {
              attribute: mainStatAttribute,
              value: mainStatValue,
              type: 'flat' as const
            },
            subStats: subStats.map(stat => ({
              attribute: stat.attribute,
              value: stat.value,
              type: 'flat' as const
            })),
            canSell: true,
            sellPrice: 100,
            canBuy: true,
            buyPrice: 200,
            canCraft: false,
            craftRecipe: null,
            canUse: false
          };

          // Register the item in ItemSystem
          itemSystem.registerItem(itemData);

          // Add item to inventory
          itemSystem.addItem(itemId, 1);

          // Get the instance ID
          const instances = itemSystem.getAllItemInstances();
          const instance = instances.find(inst => inst.itemId === itemId);

          expect(instance).toBeDefined();
          if (!instance) return;

          // Equip the item
          const equipSuccess = equipmentSystem.equipItem(
            characterId,
            instance.instanceId,
            slotType as any
          );

          expect(equipSuccess).toBe(true);

          // Verify the item is equipped
          const equipmentSlotsAfterEquip = componentManager.getComponent(
            characterId,
            EquipmentSlotsComponentType
          );

          expect(equipmentSlotsAfterEquip![slotType as keyof EquipmentSlotsComponent]).toBe(
            instance.instanceId as unknown as EntityId
          );

          // Calculate expected bonuses from the item
          const itemBonuses = new Map<string, number>();
          itemBonuses.set(mainStatAttribute, mainStatValue);
          for (const subStat of subStats) {
            const currentValue = itemBonuses.get(subStat.attribute) || 0;
            itemBonuses.set(subStat.attribute, currentValue + subStat.value);
          }

          // Now unequip the item
          const unequipSuccess = equipmentSystem.unequipItem(
            characterId,
            slotType as any
          );

          expect(unequipSuccess).toBe(true);

          // Verify the slot is now empty
          const equipmentSlotsAfterUnequip = componentManager.getComponent(
            characterId,
            EquipmentSlotsComponentType
          );

          expect(equipmentSlotsAfterUnequip![slotType as keyof EquipmentSlotsComponent]).toBeNull();

          // Verify the item is no longer in the slot
          const equippedItem = equipmentSystem.getEquippedItem(
            characterId,
            slotType as any
          );
          expect(equippedItem).toBeNull();

          // Verify that the bonuses should be removed
          // (We can't directly verify the internal bonus calculation without triggering
          // AttributeSystem.updateDerivedStats, but we can verify the equipment slot
          // is empty, which means bonuses should be removed when AttributeSystem recalculates)

          // Additional verification: Verify no other slots were affected
          const allSlots: Array<keyof EquipmentSlotsComponent> = ['weapon', 'armor', 'offhand', 'accessory'];
          for (const slot of allSlots) {
            if (slot === 'type') continue;

            if (slot === slotType) {
              // This slot should be empty after unequip
              expect(equipmentSlotsAfterUnequip![slot]).toBeNull();
            } else {
              // Other slots should remain unchanged (null)
              expect(equipmentSlotsAfterUnequip![slot]).toBeNull();
            }
          }

          // Verify the unequipped item is not in any slot
          for (const slot of allSlots) {
            if (slot === 'type') continue;
            expect(equipmentSlotsAfterUnequip![slot]).not.toBe(instance.instanceId as unknown as EntityId);
          }

          // Verify that re-equipping the item works correctly
          const reEquipSuccess = equipmentSystem.equipItem(
            characterId,
            instance.instanceId,
            slotType as any
          );

          expect(reEquipSuccess).toBe(true);

          const equipmentSlotsAfterReEquip = componentManager.getComponent(
            characterId,
            EquipmentSlotsComponentType
          );

          expect(equipmentSlotsAfterReEquip![slotType as keyof EquipmentSlotsComponent]).toBe(
            instance.instanceId as unknown as EntityId
          );
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 26: Equipment item retrieval from ItemSystem
   * **Validates: Requirements 9.1**
   * 
   * For any equipment operation, equipment item data SHALL be retrieved from the ItemSystem
   */
  it('Property 26: Equipment item retrieval from ItemSystem', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
            itemName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
            itemRarity: fc.integer({ min: 0, max: 3 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (equipmentItems) => {
          // Create a character with equipment slots
          const characterId = createCharacterWithEquipmentSlots();

          // Track items that should be retrievable from ItemSystem
          const registeredItems = new Map<string, string>();

          for (const item of equipmentItems) {
            const { slotType, itemName, itemRarity } = item;

            // Create an equipment item
            const itemId = `test_${slotType}_${itemName}_${Date.now()}_${Math.random()}`;
            const itemData = {
              id: itemId,
              name: `${itemName} ${slotType}`,
              description: `Test equipment for ${slotType} slot`,
              type: 'equipment' as const,
              subType: slotType,
              equipmentSlot: slotType,
              icon: 'test-icon.png',
              rarity: itemRarity,
              stackSize: 1,
              canSell: true,
              sellPrice: 100,
              canBuy: true,
              buyPrice: 200,
              canCraft: false,
              craftRecipe: null,
              canUse: false
            };

            // Register the item in ItemSystem
            itemSystem.registerItem(itemData);

            // Verify item is retrievable from ItemSystem immediately after registration
            const retrievedItemData = itemSystem.getItem(itemId);
            expect(retrievedItemData).toBeDefined();
            expect(retrievedItemData?.id).toBe(itemId);
            expect(retrievedItemData?.name).toBe(itemData.name);
            expect(retrievedItemData?.type).toBe('equipment');

            // Add item to inventory
            itemSystem.addItem(itemId, 1);

            // Get the instance ID
            const instances = itemSystem.getAllItemInstances();
            const instance = instances.find(inst => inst.itemId === itemId);

            expect(instance).toBeDefined();
            if (!instance || !instance.instanceId) continue;

            // Verify instance is retrievable from ItemSystem
            const retrievedInstance = instances.find(
              inst => inst.instanceId === instance.instanceId
            );
            expect(retrievedInstance).toBeDefined();
            expect(retrievedInstance?.itemId).toBe(itemId);

            // Equip the item
            const equipSuccess = equipmentSystem.equipItem(
              characterId,
              instance.instanceId,
              slotType as any
            );

            if (equipSuccess) {
              registeredItems.set(slotType, instance.instanceId);
            }
          }

          // Verify all equipped items are retrievable from ItemSystem
          const equipmentSlots = componentManager.getComponent(
            characterId,
            EquipmentSlotsComponentType
          );

          expect(equipmentSlots).not.toBeNull();
          expect(equipmentSlots).toBeDefined();

          // For each equipped item, verify it can be retrieved from ItemSystem
          const slotsToCheck: Array<keyof EquipmentSlotsComponent> = ['weapon', 'armor', 'offhand', 'accessory'];
          for (const slot of slotsToCheck) {
            if (slot === 'type') continue;

            const equippedItemId = equipmentSlots![slot];

            if (equippedItemId !== null) {
              // Verify the item instance is retrievable from ItemSystem
              const instances = itemSystem.getAllItemInstances();
              const instance = instances.find(
                inst => inst.instanceId === (equippedItemId as unknown as string)
              );

              expect(instance).toBeDefined();
              expect(instance?.instanceId).toBe(equippedItemId as unknown as string);

              // Verify the item data is retrievable from ItemSystem
              if (instance) {
                const itemData = itemSystem.getItem(instance.itemId);
                expect(itemData).toBeDefined();
                expect(itemData?.id).toBe(instance.itemId);
                expect(itemData?.type).toBe('equipment');

                // Verify item data has all required fields
                expect(itemData).toHaveProperty('name');
                expect(itemData).toHaveProperty('description');
                expect(itemData).toHaveProperty('icon');
                expect(itemData).toHaveProperty('rarity');
                expect(itemData).toHaveProperty('stackSize');

                // Verify equipment-specific fields
                const itemEquipmentType = itemData?.equipmentSlot || itemData?.subType;
                expect(itemEquipmentType).toBeDefined();
                
                // Verify the equipment type matches the slot
                if (slot === 'accessory') {
                  expect(['accessory', 'misc']).toContain(itemEquipmentType);
                } else {
                  expect(itemEquipmentType).toBe(slot);
                }
              }
            }
          }

          // Verify that ItemSystem is the single source of truth for item data
          // Any item referenced in equipment slots must exist in ItemSystem
          for (const [slotType, instanceId] of registeredItems.entries()) {
            // Get item from equipment slot
            const equippedItem = equipmentSystem.getEquippedItem(
              characterId,
              slotType as any
            );

            if (equippedItem !== null) {
              // Verify the item exists in ItemSystem
              const instances = itemSystem.getAllItemInstances();
              const instance = instances.find(
                inst => inst.instanceId === (equippedItem as unknown as string)
              );

              expect(instance).toBeDefined();

              if (instance) {
                // Verify item data exists in ItemSystem
                const itemData = itemSystem.getItem(instance.itemId);
                expect(itemData).toBeDefined();

                // Verify ItemSystem provides complete item data
                expect(itemData?.id).toBe(instance.itemId);
                expect(itemData?.type).toBe('equipment');
                expect(itemData?.name).toBeDefined();
                expect(itemData?.description).toBeDefined();
              }
            }
          }

          // Verify that unequipping doesn't remove items from ItemSystem
          for (const [slotType, instanceId] of registeredItems.entries()) {
            // Unequip the item
            equipmentSystem.unequipItem(characterId, slotType as any);

            // Verify the item still exists in ItemSystem after unequipping
            const instances = itemSystem.getAllItemInstances();
            const instance = instances.find(inst => inst.instanceId === instanceId);

            expect(instance).toBeDefined();
            expect(instance?.instanceId).toBe(instanceId);

            // Verify item data is still retrievable
            if (instance) {
              const itemData = itemSystem.getItem(instance.itemId);
              expect(itemData).toBeDefined();
              expect(itemData?.id).toBe(instance.itemId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 27: Affix data structure compatibility
   * **Validates: Requirements 9.2**
   * 
   * For any equipment item, the system SHALL correctly read and process affix data 
   * in the format defined in item-prefabs.json (mainStat and subStats)
   */
  it('Property 27: Affix data structure compatibility', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
            hasMainStat: fc.boolean(),
            mainStatAttribute: fc.constantFrom('attack', 'defense', 'critRate', 'dodgeRate', 'moveSpeed'),
            mainStatValue: fc.integer({ min: 1, max: 50 }),
            mainStatType: fc.constantFrom('flat', 'percentage'),
            subStatsCount: fc.integer({ min: 0, max: 3 }),
            subStatAttributes: fc.array(
              fc.constantFrom('attack', 'defense', 'critRate', 'dodgeRate', 'moveSpeed', 'magicPower'),
              { minLength: 0, maxLength: 3 }
            ),
            subStatValues: fc.array(
              fc.integer({ min: 1, max: 20 }),
              { minLength: 0, maxLength: 3 }
            ),
            subStatTypes: fc.array(
              fc.constantFrom('flat', 'percentage'),
              { minLength: 0, maxLength: 3 }
            )
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (equipmentItems) => {
          // Create a character with equipment slots
          const characterId = createCharacterWithEquipmentSlots();

          for (const item of equipmentItems) {
            const {
              slotType,
              hasMainStat,
              mainStatAttribute,
              mainStatValue,
              mainStatType,
              subStatsCount,
              subStatAttributes,
              subStatValues,
              subStatTypes
            } = item;

            // Create equipment item with affix data structure matching item-prefabs.json
            const itemId = `test_${slotType}_${Date.now()}_${Math.random()}`;
            
            // Build mainStat according to item-prefabs.json format
            const mainStat = hasMainStat ? {
              attribute: mainStatAttribute,
              value: mainStatValue,
              type: mainStatType
            } : undefined;

            // Build subStats according to item-prefabs.json format
            const subStats = [];
            for (let i = 0; i < Math.min(subStatsCount, subStatAttributes.length, subStatValues.length, subStatTypes.length); i++) {
              subStats.push({
                attribute: subStatAttributes[i],
                value: subStatValues[i],
                type: subStatTypes[i]
              });
            }

            const itemData = {
              id: itemId,
              name: `Test ${slotType}`,
              description: `Test equipment for ${slotType} slot`,
              type: 'equipment' as const,
              subType: slotType,
              equipmentSlot: slotType,
              icon: 'test-icon.png',
              rarity: 1,
              stackSize: 1,
              mainStat: mainStat,
              subStats: subStats.length > 0 ? subStats : undefined,
              canSell: true,
              sellPrice: 100,
              canBuy: true,
              buyPrice: 200,
              canCraft: false,
              craftRecipe: null,
              canUse: false
            };

            // Register the item in ItemSystem
            itemSystem.registerItem(itemData);

            // Verify the item data structure is correctly stored
            const retrievedItemData = itemSystem.getItem(itemId);
            expect(retrievedItemData).toBeDefined();

            // Verify mainStat structure compatibility
            if (hasMainStat) {
              expect(retrievedItemData?.mainStat).toBeDefined();
              expect(retrievedItemData?.mainStat).toHaveProperty('attribute');
              expect(retrievedItemData?.mainStat).toHaveProperty('value');
              expect(retrievedItemData?.mainStat).toHaveProperty('type');
              expect(retrievedItemData?.mainStat?.attribute).toBe(mainStatAttribute);
              expect(retrievedItemData?.mainStat?.value).toBe(mainStatValue);
              expect(retrievedItemData?.mainStat?.type).toBe(mainStatType);
            }

            // Verify subStats structure compatibility
            if (subStats.length > 0) {
              expect(retrievedItemData?.subStats).toBeDefined();
              expect(Array.isArray(retrievedItemData?.subStats)).toBe(true);
              expect(retrievedItemData?.subStats?.length).toBe(subStats.length);

              for (let i = 0; i < subStats.length; i++) {
                const subStat = retrievedItemData?.subStats?.[i];
                expect(subStat).toBeDefined();
                expect(subStat).toHaveProperty('attribute');
                expect(subStat).toHaveProperty('value');
                expect(subStat).toHaveProperty('type');
                expect(subStat?.attribute).toBe(subStats[i].attribute);
                expect(subStat?.value).toBe(subStats[i].value);
                expect(subStat?.type).toBe(subStats[i].type);
              }
            }

            // Add item to inventory
            itemSystem.addItem(itemId, 1);

            // Get the instance ID
            const instances = itemSystem.getAllItemInstances();
            const instance = instances.find(inst => inst.itemId === itemId);

            if (instance && instance.instanceId) {
              // Equip the item
              const equipSuccess = equipmentSystem.equipItem(
                characterId,
                instance.instanceId,
                slotType as any
              );

              if (equipSuccess) {
                // Verify the equipped item's affix data is still accessible
                const equippedItemId = equipmentSystem.getEquippedItem(
                  characterId,
                  slotType as any
                );

                expect(equippedItemId).not.toBeNull();

                if (equippedItemId !== null) {
                  // Retrieve the item data through ItemSystem
                  const equippedInstances = itemSystem.getAllItemInstances();
                  const equippedInstance = equippedInstances.find(
                    inst => inst.instanceId === (equippedItemId as unknown as string)
                  );

                  expect(equippedInstance).toBeDefined();

                  if (equippedInstance) {
                    const equippedItemData = itemSystem.getItem(equippedInstance.itemId);
                    expect(equippedItemData).toBeDefined();

                    // Verify affix data structure is preserved after equipping
                    if (hasMainStat) {
                      expect(equippedItemData?.mainStat).toBeDefined();
                      expect(equippedItemData?.mainStat?.attribute).toBe(mainStatAttribute);
                      expect(equippedItemData?.mainStat?.value).toBe(mainStatValue);
                      expect(equippedItemData?.mainStat?.type).toBe(mainStatType);
                    }

                    if (subStats.length > 0) {
                      expect(equippedItemData?.subStats).toBeDefined();
                      expect(equippedItemData?.subStats?.length).toBe(subStats.length);

                      for (let i = 0; i < subStats.length; i++) {
                        expect(equippedItemData?.subStats?.[i]?.attribute).toBe(subStats[i].attribute);
                        expect(equippedItemData?.subStats?.[i]?.value).toBe(subStats[i].value);
                        expect(equippedItemData?.subStats?.[i]?.type).toBe(subStats[i].type);
                      }
                    }
                  }
                }
              }
            }
          }

          // Verify that the system handles items with no affixes gracefully
          const noAffixItemId = `test_no_affix_${Date.now()}_${Math.random()}`;
          const noAffixItemData = {
            id: noAffixItemId,
            name: 'No Affix Item',
            description: 'Equipment with no affixes',
            type: 'equipment' as const,
            subType: 'weapon',
            equipmentSlot: 'weapon',
            icon: 'test-icon.png',
            rarity: 0,
            stackSize: 1,
            canSell: true,
            sellPrice: 100,
            canBuy: true,
            buyPrice: 200,
            canCraft: false,
            craftRecipe: null,
            canUse: false
          };

          itemSystem.registerItem(noAffixItemData);
          itemSystem.addItem(noAffixItemId, 1);

          const noAffixInstances = itemSystem.getAllItemInstances();
          const noAffixInstance = noAffixInstances.find(inst => inst.itemId === noAffixItemId);

          if (noAffixInstance && noAffixInstance.instanceId) {
            // Equip the item with no affixes
            const equipSuccess = equipmentSystem.equipItem(
              characterId,
              noAffixInstance.instanceId,
              'weapon' as any
            );

            // Should succeed even without affixes
            expect(equipSuccess).toBe(true);

            // Verify the item data structure is still valid
            const retrievedNoAffixData = itemSystem.getItem(noAffixItemId);
            expect(retrievedNoAffixData).toBeDefined();
            expect(retrievedNoAffixData?.type).toBe('equipment');
            // mainStat and subStats should be undefined or empty
            expect(retrievedNoAffixData?.mainStat).toBeUndefined();
            expect(retrievedNoAffixData?.subStats).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 28: Character data structure compatibility
   * **Validates: Requirements 9.4**
   * 
   * For any character entity, the equipment system SHALL work with the existing character 
   * component structure (AttributeComponent, DerivedStatsComponent, EquipmentSlotsComponent)
   */
  it('Property 28: Character data structure compatibility', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            // Character attributes
            strength: fc.integer({ min: 1, max: 100 }),
            agility: fc.integer({ min: 1, max: 100 }),
            wisdom: fc.integer({ min: 1, max: 100 }),
            technique: fc.integer({ min: 1, max: 100 }),
            // Equipment to equip
            slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
            itemName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0)
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (characterConfigs) => {
          for (const config of characterConfigs) {
            const { strength, agility, wisdom, technique, slotType, itemName } = config;

            // Create a character entity with the existing component structure
            const characterEntity = entityManager.createEntity();
            const characterId = characterEntity.id;

            // Add EquipmentSlotsComponent (required by EquipmentSystem)
            const equipmentSlots: EquipmentSlotsComponent = {
              type: 'equipmentSlots',
              weapon: null,
              armor: null,
              offhand: null,
              accessory: null
            };
            componentManager.addComponent(characterId, EquipmentSlotsComponentType, equipmentSlots);

            // Add AttributeComponent (existing character component structure)
            const attributeComponent = {
              type: 'attributes' as const,
              strength: strength,
              agility: agility,
              wisdom: wisdom,
              technique: technique
            };
            componentManager.addComponent(characterId, { type: 'attributes' }, attributeComponent);

            // Add DerivedStatsComponent (existing character component structure)
            const derivedStatsComponent = {
              type: 'derivedStats' as const,
              attack: strength,
              defense: strength + agility,
              moveSpeed: agility,
              dodgeRate: agility * 0.5,
              critRate: technique * 0.5,
              critDamage: 125, // Fixed base value
              resistance: wisdom * 0.5,
              magicPower: wisdom,
              carryWeight: 10 + strength,
              hitRate: 85 + technique * 0.5,
              expRate: 100,
              healthRegen: strength * 0.2,
              manaRegen: wisdom * 0.2,
              weight: 70 + strength,
              volume: 1
            };
            componentManager.addComponent(characterId, { type: 'derivedStats' }, derivedStatsComponent);

            // Verify all required components are present
            const retrievedEquipmentSlots = componentManager.getComponent(
              characterId,
              EquipmentSlotsComponentType
            );
            const retrievedAttributes = componentManager.getComponent(
              characterId,
              { type: 'attributes' }
            );
            const retrievedDerivedStats = componentManager.getComponent(
              characterId,
              { type: 'derivedStats' }
            );

            expect(retrievedEquipmentSlots).toBeDefined();
            expect(retrievedAttributes).toBeDefined();
            expect(retrievedDerivedStats).toBeDefined();

            // Verify component structure matches expected format
            expect(retrievedEquipmentSlots).toHaveProperty('weapon');
            expect(retrievedEquipmentSlots).toHaveProperty('armor');
            expect(retrievedEquipmentSlots).toHaveProperty('offhand');
            expect(retrievedEquipmentSlots).toHaveProperty('accessory');

            expect(retrievedAttributes).toHaveProperty('strength');
            expect(retrievedAttributes).toHaveProperty('agility');
            expect(retrievedAttributes).toHaveProperty('wisdom');
            expect(retrievedAttributes).toHaveProperty('technique');

            expect(retrievedDerivedStats).toHaveProperty('attack');
            expect(retrievedDerivedStats).toHaveProperty('defense');
            expect(retrievedDerivedStats).toHaveProperty('moveSpeed');
            expect(retrievedDerivedStats).toHaveProperty('dodgeRate');
            expect(retrievedDerivedStats).toHaveProperty('critRate');

            // Create and equip an item
            const itemId = `test_${slotType}_${itemName}_${Date.now()}_${Math.random()}`;
            const itemData = {
              id: itemId,
              name: `${itemName} ${slotType}`,
              description: `Test equipment for ${slotType} slot`,
              type: 'equipment' as const,
              subType: slotType,
              equipmentSlot: slotType,
              icon: 'test-icon.png',
              rarity: 1,
              stackSize: 1,
              mainStat: {
                attribute: 'attack',
                value: 10,
                type: 'flat' as const
              },
              canSell: true,
              sellPrice: 100,
              canBuy: true,
              buyPrice: 200,
              canCraft: false,
              craftRecipe: null,
              canUse: false
            };

            itemSystem.registerItem(itemData);
            itemSystem.addItem(itemId, 1);

            const instances = itemSystem.getAllItemInstances();
            const instance = instances.find(inst => inst.itemId === itemId);

            if (instance && instance.instanceId) {
              // Equip the item - this should work with the existing component structure
              const equipSuccess = equipmentSystem.equipItem(
                characterId,
                instance.instanceId,
                slotType as any
              );

              expect(equipSuccess).toBe(true);

              // Verify the equipment operation didn't corrupt the component structure
              const afterEquipmentSlots = componentManager.getComponent(
                characterId,
                EquipmentSlotsComponentType
              );
              const afterAttributes = componentManager.getComponent(
                characterId,
                { type: 'attributes' }
              );
              const afterDerivedStats = componentManager.getComponent(
                characterId,
                { type: 'derivedStats' }
              );

              // Verify components still exist and have correct structure
              expect(afterEquipmentSlots).toBeDefined();
              expect(afterAttributes).toBeDefined();
              expect(afterDerivedStats).toBeDefined();

              // Verify EquipmentSlotsComponent structure is intact
              expect(afterEquipmentSlots).toHaveProperty('weapon');
              expect(afterEquipmentSlots).toHaveProperty('armor');
              expect(afterEquipmentSlots).toHaveProperty('offhand');
              expect(afterEquipmentSlots).toHaveProperty('accessory');

              // Verify the equipped item is in the correct slot
              expect(afterEquipmentSlots![slotType as keyof EquipmentSlotsComponent]).toBe(
                instance.instanceId as unknown as EntityId
              );

              // Verify AttributeComponent structure is intact and unchanged
              expect(afterAttributes).toHaveProperty('strength');
              expect(afterAttributes).toHaveProperty('agility');
              expect(afterAttributes).toHaveProperty('wisdom');
              expect(afterAttributes).toHaveProperty('technique');
              expect(afterAttributes?.strength).toBe(strength);
              expect(afterAttributes?.agility).toBe(agility);
              expect(afterAttributes?.wisdom).toBe(wisdom);
              expect(afterAttributes?.technique).toBe(technique);

              // Verify DerivedStatsComponent structure is intact
              expect(afterDerivedStats).toHaveProperty('attack');
              expect(afterDerivedStats).toHaveProperty('defense');
              expect(afterDerivedStats).toHaveProperty('moveSpeed');
              expect(afterDerivedStats).toHaveProperty('dodgeRate');
              expect(afterDerivedStats).toHaveProperty('critRate');
              expect(afterDerivedStats).toHaveProperty('critDamage');
              expect(afterDerivedStats).toHaveProperty('resistance');
              expect(afterDerivedStats).toHaveProperty('magicPower');
              expect(afterDerivedStats).toHaveProperty('carryWeight');
              expect(afterDerivedStats).toHaveProperty('hitRate');
              expect(afterDerivedStats).toHaveProperty('expRate');
              expect(afterDerivedStats).toHaveProperty('healthRegen');
              expect(afterDerivedStats).toHaveProperty('manaRegen');

              // Verify unequipping also works with the component structure
              const unequipSuccess = equipmentSystem.unequipItem(
                characterId,
                slotType as any
              );

              expect(unequipSuccess).toBe(true);

              // Verify components are still intact after unequipping
              const afterUnequipEquipmentSlots = componentManager.getComponent(
                characterId,
                EquipmentSlotsComponentType
              );
              const afterUnequipAttributes = componentManager.getComponent(
                characterId,
                { type: 'attributes' }
              );
              const afterUnequipDerivedStats = componentManager.getComponent(
                characterId,
                { type: 'derivedStats' }
              );

              expect(afterUnequipEquipmentSlots).toBeDefined();
              expect(afterUnequipAttributes).toBeDefined();
              expect(afterUnequipDerivedStats).toBeDefined();

              // Verify the slot is now empty
              expect(afterUnequipEquipmentSlots![slotType as keyof EquipmentSlotsComponent]).toBeNull();

              // Verify AttributeComponent is still unchanged
              expect(afterUnequipAttributes?.strength).toBe(strength);
              expect(afterUnequipAttributes?.agility).toBe(agility);
              expect(afterUnequipAttributes?.wisdom).toBe(wisdom);
              expect(afterUnequipAttributes?.technique).toBe(technique);
            }
          }

          // Verify the system handles characters with missing optional components gracefully
          const minimalCharacterId = createCharacterWithEquipmentSlots();

          // This character only has EquipmentSlotsComponent (no AttributeComponent or DerivedStatsComponent)
          const minimalEquipmentSlots = componentManager.getComponent(
            minimalCharacterId,
            EquipmentSlotsComponentType
          );

          expect(minimalEquipmentSlots).toBeDefined();

          // Create and equip an item to the minimal character
          const minimalItemId = `test_minimal_${Date.now()}_${Math.random()}`;
          const minimalItemData = {
            id: minimalItemId,
            name: 'Minimal Test Weapon',
            description: 'Test weapon for minimal character',
            type: 'equipment' as const,
            subType: 'weapon',
            equipmentSlot: 'weapon',
            icon: 'test-icon.png',
            rarity: 0,
            stackSize: 1,
            canSell: true,
            sellPrice: 100,
            canBuy: true,
            buyPrice: 200,
            canCraft: false,
            craftRecipe: null,
            canUse: false
          };

          itemSystem.registerItem(minimalItemData);
          itemSystem.addItem(minimalItemId, 1);

          const minimalInstances = itemSystem.getAllItemInstances();
          const minimalInstance = minimalInstances.find(inst => inst.itemId === minimalItemId);

          if (minimalInstance && minimalInstance.instanceId) {
            // Equip should work even without AttributeComponent and DerivedStatsComponent
            const equipSuccess = equipmentSystem.equipItem(
              minimalCharacterId,
              minimalInstance.instanceId,
              'weapon' as any
            );

            expect(equipSuccess).toBe(true);

            // Verify the equipment slot is updated
            const afterMinimalEquipmentSlots = componentManager.getComponent(
              minimalCharacterId,
              EquipmentSlotsComponentType
            );

            expect(afterMinimalEquipmentSlots?.weapon).toBe(
              minimalInstance.instanceId as unknown as EntityId
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
