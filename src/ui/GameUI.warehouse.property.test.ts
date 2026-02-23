/**
 * Property-based tests for Warehouse Panel Filtering
 * **Feature: character-equipment-system**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ItemSystem } from '../game/systems/ItemSystem';
import { EntityManager } from '../ecs/EntityManager';
import { ComponentManager } from '../ecs/ComponentManager';
import { EventSystem } from '../ecs/EventSystem';
import { World } from '../ecs/World';

describe('Warehouse Panel Filtering Property Tests', () => {
  let world: World;
  let itemSystem: ItemSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;

  beforeEach(() => {
    eventSystem = new EventSystem();
    world = new World(eventSystem);
    
    entityManager = world.entityManager;
    componentManager = world.componentManager;

    itemSystem = new ItemSystem(world);
    itemSystem.initialize(entityManager, componentManager, eventSystem);
  });

  /**
   * Helper function to simulate warehouse filtering by equipment slot
   * This mimics the filterItemsByEquipmentSlot method from GameUI
   */
  function filterItemsByEquipmentSlot(items: any[], equipmentSlot: string): any[] {
    const slotToChinese: Record<string, string> = {
      weapon: '武器',
      armor: '护甲',
      offhand: '副手',
      accessory: '杂项'
    };
    const chineseName = slotToChinese[equipmentSlot];

    return items.filter(slot => {
      const itemData = itemSystem.getItem(slot.itemId);
      if (!itemData || itemData.type !== 'equipment') {
        return false;
      }
      
      const itemSlot = itemData.equipmentSlot || itemData.subType;
      
      if (Array.isArray(itemSlot)) {
        if (chineseName && itemSlot.includes(chineseName)) return true;
        if (equipmentSlot === 'accessory' && (itemSlot.includes('杂项') || itemSlot.includes('饰品') || itemSlot.includes('misc'))) return true;
        return itemSlot.includes(equipmentSlot);
      }
      
      if (equipmentSlot === 'accessory') {
        return itemSlot === 'accessory' || itemSlot === 'misc' || itemSlot === '杂项' || itemSlot === '饰品';
      }
      
      return itemSlot === equipmentSlot || itemSlot === chineseName;
    });
  }

  /**
   * Property 8: Warehouse filtering by equipment type
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   * 
   * For any equipment slot type (weapon, armor, offhand, accessory), when that slot is clicked,
   * the warehouse panel SHALL display only items where equipmentType matches the slot type
   */
  it('Property 8: Warehouse filtering by equipment type', () => {
    fc.assert(
      fc.property(
        // Generate a slot type to filter by
        fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
        // Generate a collection of equipment items with various types
        fc.array(
          fc.record({
            itemType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory', 'misc'),
            itemName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
            itemRarity: fc.integer({ min: 0, max: 3 })
          }),
          { minLength: 5, maxLength: 30 }
        ),
        (slotTypeFilter, equipmentItems) => {
          // Clear inventory before each test iteration
          itemSystem.clearInventory();

          // Create and register equipment items in the warehouse (inventory)
          const createdItems: Array<{ itemId: string; slotType: string; instanceId: string }> = [];

          for (const item of equipmentItems) {
            const { itemType, itemName, itemRarity } = item;

            // Create an equipment item
            const itemId = `test_${itemType}_${itemName}_${Date.now()}_${Math.random()}`;
            const itemData = {
              id: itemId,
              name: `${itemName} ${itemType}`,
              description: `Test equipment for ${itemType} slot`,
              type: 'equipment' as const,
              subType: itemType,
              equipmentSlot: itemType,
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

            // Add item to inventory (warehouse)
            itemSystem.addItem(itemId, 1);

            // Get the instance ID
            const instances = itemSystem.getAllItemInstances();
            const instance = instances.find(inst => inst.itemId === itemId);

            if (instance && instance.instanceId) {
              createdItems.push({
                itemId,
                slotType: itemType,
                instanceId: instance.instanceId
              });
            }
          }

          // Get the current inventory (simulating warehouse panel data source)
          const warehouseInventory = itemSystem.getInventory();

          // Apply the equipment slot filter (simulating slot click)
          const filteredItems = filterItemsByEquipmentSlot(warehouseInventory, slotTypeFilter);

          // REQUIREMENT 3.1, 3.2, 3.3, 3.4: Verify that filtered items match the slot type
          for (const filteredSlot of filteredItems) {
            const itemData = itemSystem.getItem(filteredSlot.itemId);
            
            // All filtered items must be equipment type
            expect(itemData).toBeDefined();
            expect(itemData?.type).toBe('equipment');

            // Get the item's equipment slot
            const itemEquipmentSlot = itemData?.equipmentSlot || itemData?.subType;

            // Verify the item matches the filter
            if (slotTypeFilter === 'weapon') {
              // REQUIREMENT 3.1: When weapon slot is clicked, only weapon items should be displayed
              expect(itemEquipmentSlot).toBe('weapon');
            } else if (slotTypeFilter === 'armor') {
              // REQUIREMENT 3.2: When armor slot is clicked, only armor items should be displayed
              expect(itemEquipmentSlot).toBe('armor');
            } else if (slotTypeFilter === 'offhand') {
              // REQUIREMENT 3.3: When offhand slot is clicked, only offhand items should be displayed
              expect(itemEquipmentSlot).toBe('offhand');
            } else if (slotTypeFilter === 'accessory') {
              // REQUIREMENT 3.4: When accessory slot is clicked, only accessory/misc items should be displayed
              expect(['accessory', 'misc']).toContain(itemEquipmentSlot);
            }
          }

          // Verify that NO items of other types are included in the filtered results
          const expectedCount = createdItems.filter(item => {
            if (slotTypeFilter === 'accessory') {
              return item.slotType === 'accessory' || item.slotType === 'misc';
            }
            return item.slotType === slotTypeFilter;
          }).length;

          expect(filteredItems.length).toBe(expectedCount);

          // Verify that all items of the matching type ARE included
          for (const createdItem of createdItems) {
            const shouldBeIncluded = 
              (slotTypeFilter === 'accessory' && (createdItem.slotType === 'accessory' || createdItem.slotType === 'misc')) ||
              (slotTypeFilter !== 'accessory' && createdItem.slotType === slotTypeFilter);

            const isIncluded = filteredItems.some(slot => slot.itemId === createdItem.itemId);

            if (shouldBeIncluded) {
              expect(isIncluded).toBe(true);
            } else {
              expect(isIncluded).toBe(false);
            }
          }

          // Verify that non-equipment items are never included
          // Add a non-equipment item to test exclusion
          const nonEquipmentItemId = `test_material_${Date.now()}_${Math.random()}`;
          const nonEquipmentData = {
            id: nonEquipmentItemId,
            name: 'Test Material',
            description: 'A test material item',
            type: 'material' as const,
            icon: 'test-icon.png',
            rarity: 0,
            stackSize: 99,
            canSell: true,
            sellPrice: 10,
            canBuy: true,
            buyPrice: 20,
            canCraft: false,
            craftRecipe: null,
            canUse: false
          };

          itemSystem.registerItem(nonEquipmentData);
          itemSystem.addItem(nonEquipmentItemId, 1);

          // Re-filter with the non-equipment item in inventory
          const warehouseWithMaterial = itemSystem.getInventory();
          const filteredWithMaterial = filterItemsByEquipmentSlot(warehouseWithMaterial, slotTypeFilter);

          // Verify the material item is NOT included in filtered results
          const materialIncluded = filteredWithMaterial.some(slot => slot.itemId === nonEquipmentItemId);
          expect(materialIncluded).toBe(false);

          // Verify the count hasn't changed (material was excluded)
          expect(filteredWithMaterial.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9: Warehouse item source
   * **Validates: Requirements 3.5**
   * 
   * For any warehouse panel display, all displayed items SHALL be retrieved from the ItemSystem inventory
   */
  it('Property 9: Warehouse item source', () => {
    fc.assert(
      fc.property(
        // Generate a collection of items (both equipment and non-equipment)
        fc.array(
          fc.record({
            itemType: fc.constantFrom('equipment', 'material', 'consumable', 'quest'),
            equipmentSlot: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
            itemName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
            itemRarity: fc.integer({ min: 0, max: 3 }),
            quantity: fc.integer({ min: 1, max: 10 })
          }),
          { minLength: 5, maxLength: 30 }
        ),
        (items) => {
          // Clear inventory before each test iteration
          itemSystem.clearInventory();

          // Track all items added to ItemSystem inventory
          const itemsInInventory = new Map<string, { itemId: string; quantity: number; instanceIds: string[] }>();

          // Add items to ItemSystem inventory
          for (const item of items) {
            const { itemType, equipmentSlot, itemName, itemRarity, quantity } = item;

            // Create item data based on type
            const itemId = `test_${itemType}_${itemName}_${Date.now()}_${Math.random()}`;
            
            let itemData: any;
            if (itemType === 'equipment') {
              itemData = {
                id: itemId,
                name: `${itemName} ${equipmentSlot}`,
                description: `Test ${itemType} item`,
                type: 'equipment' as const,
                subType: equipmentSlot,
                equipmentSlot: equipmentSlot,
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
            } else {
              itemData = {
                id: itemId,
                name: `${itemName} ${itemType}`,
                description: `Test ${itemType} item`,
                type: itemType as any,
                icon: 'test-icon.png',
                rarity: itemRarity,
                stackSize: itemType === 'equipment' ? 1 : 99,
                canSell: true,
                sellPrice: 50,
                canBuy: true,
                buyPrice: 100,
                canCraft: false,
                craftRecipe: null,
                canUse: itemType === 'consumable'
              };
            }

            // Register the item in ItemSystem
            itemSystem.registerItem(itemData);

            // Add item to inventory
            const addQuantity = itemType === 'equipment' ? 1 : quantity;
            itemSystem.addItem(itemId, addQuantity);

            // Track the item
            const instances = itemSystem.getAllItemInstances().filter(inst => inst.itemId === itemId);
            const instanceIds = instances.map(inst => inst.instanceId);
            
            itemsInInventory.set(itemId, {
              itemId,
              quantity: addQuantity,
              instanceIds
            });
          }

          // REQUIREMENT 3.5: Get warehouse inventory from ItemSystem
          const warehouseInventory = itemSystem.getInventory();

          // Verify that ALL items in warehouse come from ItemSystem inventory
          for (const warehouseSlot of warehouseInventory) {
            // Each warehouse slot must have a valid itemId
            expect(warehouseSlot.itemId).toBeDefined();
            expect(typeof warehouseSlot.itemId).toBe('string');
            expect(warehouseSlot.itemId.length).toBeGreaterThan(0);

            // The itemId must exist in ItemSystem
            const itemData = itemSystem.getItem(warehouseSlot.itemId);
            expect(itemData).toBeDefined();
            expect(itemData?.id).toBe(warehouseSlot.itemId);

            // The warehouse slot quantity must be valid
            expect(warehouseSlot.quantity).toBeDefined();
            expect(warehouseSlot.quantity).toBeGreaterThan(0);

            // For equipment items (non-stackable), verify instanceId
            if (itemData?.type === 'equipment') {
              // Equipment items must have instanceId
              expect(warehouseSlot.instanceId).toBeDefined();
              expect(typeof warehouseSlot.instanceId).toBe('string');
              expect(warehouseSlot.instanceId.length).toBeGreaterThan(0);

              // The instanceId must exist in ItemSystem's item instances
              const allInstances = itemSystem.getAllItemInstances();
              const matchingInstance = allInstances.find(inst => inst.instanceId === warehouseSlot.instanceId);
              expect(matchingInstance).toBeDefined();
              expect(matchingInstance?.itemId).toBe(warehouseSlot.itemId);
              expect(matchingInstance?.quantity).toBe(warehouseSlot.quantity);
            } else {
              // Non-equipment items (stackable) may not have instanceId
              // They are tracked by itemId and quantity only
              // Verify the item exists in inventory
              const inventorySlot = itemSystem.getInventory().find(slot => slot.itemId === warehouseSlot.itemId);
              expect(inventorySlot).toBeDefined();
              expect(inventorySlot?.quantity).toBe(warehouseSlot.quantity);
            }
          }

          // Verify that the warehouse contains exactly the items from ItemSystem inventory
          // No more, no less
          const inventoryItemIds = new Set(Array.from(itemsInInventory.keys()));
          const warehouseItemIds = new Set(warehouseInventory.map(slot => slot.itemId));

          // All items in warehouse must be in ItemSystem inventory
          for (const warehouseItemId of warehouseItemIds) {
            expect(inventoryItemIds.has(warehouseItemId)).toBe(true);
          }

          // All items in ItemSystem inventory must be in warehouse
          for (const inventoryItemId of inventoryItemIds) {
            expect(warehouseItemIds.has(inventoryItemId)).toBe(true);
          }

          // Verify warehouse item count matches ItemSystem inventory count
          expect(warehouseInventory.length).toBe(itemsInInventory.size);

          // Verify that warehouse items are NOT from any other source
          // Create an item that is NOT added to ItemSystem inventory
          const externalItemId = `external_item_${Date.now()}_${Math.random()}`;
          const externalItemData = {
            id: externalItemId,
            name: 'External Item',
            description: 'This item is not in ItemSystem inventory',
            type: 'material' as const,
            icon: 'test-icon.png',
            rarity: 0,
            stackSize: 99,
            canSell: true,
            sellPrice: 10,
            canBuy: true,
            buyPrice: 20,
            canCraft: false,
            craftRecipe: null,
            canUse: false
          };

          // Register the item but DO NOT add it to inventory
          itemSystem.registerItem(externalItemData);

          // Re-fetch warehouse inventory
          const warehouseAfterExternal = itemSystem.getInventory();

          // Verify the external item is NOT in warehouse (because it's not in inventory)
          const externalItemInWarehouse = warehouseAfterExternal.some(slot => slot.itemId === externalItemId);
          expect(externalItemInWarehouse).toBe(false);

          // Verify warehouse count hasn't changed
          expect(warehouseAfterExternal.length).toBe(itemsInInventory.size);

          // Verify that removing an item from ItemSystem inventory removes it from warehouse
          if (itemsInInventory.size > 0) {
            const firstItemId = Array.from(itemsInInventory.keys())[0];
            const firstItemData = itemsInInventory.get(firstItemId);

            if (firstItemData) {
              const itemData = itemSystem.getItem(firstItemId);
              const isEquipment = itemData?.type === 'equipment';
              
              // For equipment, we need to track the specific instance ID we're removing
              const instanceIdToRemove = isEquipment ? firstItemData.instanceIds[0] : undefined;
              
              // Remove the item from inventory
              itemSystem.removeItem(instanceIdToRemove || firstItemId, firstItemData.quantity);

              // Re-fetch warehouse inventory
              const warehouseAfterRemoval = itemSystem.getInventory();

              // Verify the removed item is no longer in warehouse
              if (isEquipment) {
                // For equipment, check that the specific instance is gone
                const removedItemInWarehouse = warehouseAfterRemoval.some(slot => slot.instanceId === instanceIdToRemove);
                expect(removedItemInWarehouse).toBe(false);
              } else {
                // For non-equipment, check that the item ID is gone (since we removed all quantity)
                const removedItemInWarehouse = warehouseAfterRemoval.some(slot => slot.itemId === firstItemId);
                expect(removedItemInWarehouse).toBe(false);
              }

              // Verify warehouse count decreased by 1
              expect(warehouseAfterRemoval.length).toBe(itemsInInventory.size - 1);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
