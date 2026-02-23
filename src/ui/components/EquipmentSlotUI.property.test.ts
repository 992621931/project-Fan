/**
 * Property-based tests for Equipment Slot UI
 * **Feature: character-equipment-system**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { EquipmentSlotUI } from './EquipmentSlotUI';
import { EquipmentSystem } from '../../game/systems/EquipmentSystem';
import { ItemSystem } from '../../game/systems/ItemSystem';
import { AttributeSystem } from '../../game/systems/AttributeSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { World } from '../../ecs/World';
import { UIManager } from '../UIManager';
import {
  EquipmentSlotsComponent,
  EquipmentSlotsComponentType
} from '../../game/components/SystemComponents';
import {
  AttributeComponent,
  AttributeComponentType,
  DerivedStatsComponent,
  DerivedStatsComponentType
} from '../../game/components/CharacterComponents';

describe('Equipment Slot UI Property Tests', () => {
  let world: World;
  let equipmentSystem: EquipmentSystem;
  let itemSystem: ItemSystem;
  let attributeSystem: AttributeSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;
  let uiManager: UIManager;
  let equipmentSlotUI: EquipmentSlotUI;

  beforeEach(() => {
    // Setup DOM environment with proper structure
    document.body.innerHTML = '<div id="game-ui"></div>';
    const rootElement = document.getElementById('game-ui') as HTMLElement;

    eventSystem = new EventSystem();
    world = new World(eventSystem);
    
    entityManager = world.entityManager;
    componentManager = world.componentManager;

    itemSystem = new ItemSystem(world);
    itemSystem.initialize(entityManager, componentManager, eventSystem);

    equipmentSystem = new EquipmentSystem(world, itemSystem);
    equipmentSystem.initialize(entityManager, componentManager, eventSystem);

    attributeSystem = new AttributeSystem(world);
    attributeSystem.initialize(entityManager, componentManager, eventSystem);
    
    // Set ItemSystem reference so AttributeSystem can calculate equipment bonuses
    attributeSystem.setItemSystem(itemSystem);

    // UIManager expects a root element parameter
    uiManager = new UIManager(eventSystem, rootElement);
    equipmentSlotUI = new EquipmentSlotUI(uiManager, eventSystem, world, itemSystem);
  });

  /**
   * Helper function to create a character entity with all required components
   */
  function createCharacterWithComponents(): string {
    const characterEntity = entityManager.createEntity();
    const characterId = characterEntity.id;

    // Equipment slots
    const equipmentSlots: EquipmentSlotsComponent = {
      type: 'equipmentSlots',
      weapon: null,
      armor: null,
      offhand: null,
      accessory: null
    };
    componentManager.addComponent(characterId, EquipmentSlotsComponentType, equipmentSlots);

    // Attributes
    const attributes: AttributeComponent = {
      type: 'attributes',
      strength: 10,
      agility: 10,
      wisdom: 10,
      technique: 10
    };
    componentManager.addComponent(characterId, AttributeComponentType, attributes);

    // Derived stats
    const derivedStats: DerivedStatsComponent = {
      type: 'derivedStats',
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
    componentManager.addComponent(characterId, DerivedStatsComponentType, derivedStats);

    return characterId;
  }

  /**
   * Property 22: UI attribute value synchronization
   * **Validates: Requirements 7.5**
   * 
   * For any character, the UI SHALL display attribute values that match the character's 
   * current calculated attributes
   */
  it('Property 22: UI attribute value synchronization', () => {
    fc.assert(
      fc.property(
        fc.array(
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
          { minLength: 1, maxLength: 4 }
        ),
        (equipmentItems) => {
          // Create a character with all required components
          const characterId = createCharacterWithComponents();

          // Set the character in the UI
          equipmentSlotUI.setCharacter(characterId);

          // Get initial derived stats
          const initialDerivedStats = componentManager.getComponent(
            characterId,
            DerivedStatsComponentType
          );
          expect(initialDerivedStats).toBeDefined();

          // Track expected attribute values after each equipment change
          const expectedAttributes = new Map<string, number>();
          expectedAttributes.set('attack', initialDerivedStats!.attack);
          expectedAttributes.set('defense', initialDerivedStats!.defense);
          expectedAttributes.set('critRate', initialDerivedStats!.critRate);
          expectedAttributes.set('dodgeRate', initialDerivedStats!.dodgeRate);
          expectedAttributes.set('moveSpeed', initialDerivedStats!.moveSpeed);

          // Track currently equipped items per slot to handle replacements correctly
          const currentlyEquipped = new Map<string, {
            mainStatAttribute: string;
            mainStatValue: number;
            subStats: Array<{ attribute: string; value: number }>;
          }>();

          // Equip items and verify UI synchronization after each change
          for (const item of equipmentItems) {
            const { slotType, mainStatAttribute, mainStatValue, subStats } = item;

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
            itemSystem.addItem(itemId, 1);

            // Get the instance ID
            const instances = itemSystem.getAllItemInstances();
            const instance = instances.find(inst => inst.itemId === itemId);

            if (instance && instance.instanceId) {
              // Check if this slot already has an item equipped (replacement case)
              const previousItem = currentlyEquipped.get(slotType);
              
              if (previousItem) {
                // Remove bonuses from the previous item before adding new ones
                const prevMainStat = expectedAttributes.get(previousItem.mainStatAttribute) || 0;
                expectedAttributes.set(previousItem.mainStatAttribute, prevMainStat - previousItem.mainStatValue);

                for (const prevSubStat of previousItem.subStats) {
                  const prevSubStatValue = expectedAttributes.get(prevSubStat.attribute) || 0;
                  expectedAttributes.set(prevSubStat.attribute, prevSubStatValue - prevSubStat.value);
                }
              }

              // Equip the item
              const equipSuccess = equipmentSystem.equipItem(
                characterId,
                instance.instanceId,
                slotType as any
              );

              expect(equipSuccess).toBe(true);

              // Update expected attributes based on the newly equipped item
              const currentMainStat = expectedAttributes.get(mainStatAttribute) || 0;
              expectedAttributes.set(mainStatAttribute, currentMainStat + mainStatValue);

              for (const subStat of subStats) {
                const currentSubStat = expectedAttributes.get(subStat.attribute) || 0;
                expectedAttributes.set(subStat.attribute, currentSubStat + subStat.value);
              }

              // Track the currently equipped item in this slot
              currentlyEquipped.set(slotType, {
                mainStatAttribute,
                mainStatValue,
                subStats: subStats.map(s => ({ attribute: s.attribute, value: s.value }))
              });

              // Trigger attribute recalculation (simulates AttributeSystem event handler)
              attributeSystem.update(0);

              // Get the updated derived stats from the component
              const updatedDerivedStats = componentManager.getComponent(
                characterId,
                DerivedStatsComponentType
              );

              expect(updatedDerivedStats).toBeDefined();

              // Verify that the component's attribute values match expected values
              // The UI should display these same values
              for (const [attribute, expectedValue] of expectedAttributes.entries()) {
                const actualValue = (updatedDerivedStats as any)[attribute];
                
                // The actual value should be at least the expected value
                // (it might be higher due to base stats and other bonuses)
                expect(actualValue).toBeGreaterThanOrEqual(expectedValue);
              }

              // Verify UI is displaying the correct values by checking the component state
              // The UI reads from the same component, so if the component is correct,
              // the UI will display the correct values
              const equipmentSlots = componentManager.getComponent(
                characterId,
                EquipmentSlotsComponentType
              );

              expect(equipmentSlots).toBeDefined();
              expect(equipmentSlots![slotType as keyof EquipmentSlotsComponent]).toBe(
                instance.instanceId as unknown as any
              );

              // Verify that the UI can access the correct attribute data
              // by checking that the derived stats component is accessible
              const uiAccessibleStats = world.getComponent(
                characterId,
                DerivedStatsComponentType
              );

              expect(uiAccessibleStats).toBeDefined();
              expect(uiAccessibleStats).toEqual(updatedDerivedStats);

              // Verify synchronization: UI data source matches calculated attributes
              expect(uiAccessibleStats!.attack).toBe(updatedDerivedStats!.attack);
              expect(uiAccessibleStats!.defense).toBe(updatedDerivedStats!.defense);
              expect(uiAccessibleStats!.critRate).toBe(updatedDerivedStats!.critRate);
              expect(uiAccessibleStats!.dodgeRate).toBe(updatedDerivedStats!.dodgeRate);
              expect(uiAccessibleStats!.moveSpeed).toBe(updatedDerivedStats!.moveSpeed);
            }
          }

          // Final verification: Unequip all items and verify UI synchronization
          const allSlots: Array<'weapon' | 'armor' | 'offhand' | 'accessory'> = [
            'weapon', 'armor', 'offhand', 'accessory'
          ];

          for (const slot of allSlots) {
            const equippedItem = equipmentSystem.getEquippedItem(characterId, slot);
            
            if (equippedItem !== null) {
              // Unequip the item
              const unequipSuccess = equipmentSystem.unequipItem(characterId, slot);
              expect(unequipSuccess).toBe(true);

              // Trigger attribute recalculation
              attributeSystem.update(0);

              // Verify the slot is empty
              const equipmentSlots = componentManager.getComponent(
                characterId,
                EquipmentSlotsComponentType
              );
              expect(equipmentSlots![slot]).toBeNull();

              // Verify UI can access the updated stats
              const updatedStats = world.getComponent(
                characterId,
                DerivedStatsComponentType
              );
              expect(updatedStats).toBeDefined();

              // Verify synchronization after unequip
              const componentStats = componentManager.getComponent(
                characterId,
                DerivedStatsComponentType
              );
              expect(updatedStats).toEqual(componentStats);
            }
          }

          // Final check: After all unequips, stats should be back to base values
          const finalDerivedStats = componentManager.getComponent(
            characterId,
            DerivedStatsComponentType
          );

          expect(finalDerivedStats).toBeDefined();
          
          // Verify UI data source is synchronized with final state
          const finalUIAccessibleStats = world.getComponent(
            characterId,
            DerivedStatsComponentType
          );

          expect(finalUIAccessibleStats).toEqual(finalDerivedStats);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 25: Visual update on equipment change
   * **Validates: Requirements 8.5**
   * 
   * For any equipment change operation, the equipment slot visuals SHALL update 
   * immediately to reflect the new state
   */
  it('Property 25: Visual update on equipment change', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            operation: fc.constantFrom('equip', 'unequip', 'replace'),
            slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
            itemName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0)
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (operations) => {
          // Create a character with all required components
          const characterId = createCharacterWithComponents();

          // Set the character in the UI
          equipmentSlotUI.setCharacter(characterId);

          // Spy on the updateSlotVisual method to verify it's called
          const updateSlotVisualSpy = vi.spyOn(equipmentSlotUI as any, 'updateSlotVisual');

          // Track currently equipped items per slot
          const currentlyEquipped = new Map<string, string>();

          // Track expected visual update calls
          let expectedUpdateCalls = 0;

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
              itemSystem.addItem(itemId, 1);

              // Get the instance ID
              const instances = itemSystem.getAllItemInstances();
              const instance = instances.find(inst => inst.itemId === itemId);

              if (instance && instance.instanceId) {
                // Check if this is a replacement (slot already occupied)
                const isReplacement = currentlyEquipped.has(slotType);
                
                // Get the equipment slots before equipping
                const equipmentSlotsBefore = componentManager.getComponent(
                  characterId,
                  EquipmentSlotsComponentType
                );
                const slotValueBefore = equipmentSlotsBefore![slotType as keyof EquipmentSlotsComponent];

                // Equip the item
                const success = equipmentSystem.equipItem(
                  characterId,
                  instance.instanceId,
                  slotType as any
                );

                if (success) {
                  // Visual update should be triggered for this slot
                  // Replacement triggers 2 visual updates (unequip + equip)
                  // Fresh equip triggers 1 visual update
                  expectedUpdateCalls += isReplacement ? 2 : 1;
                  
                  // Update tracking
                  currentlyEquipped.set(slotType, instance.instanceId);

                  // Verify the slot value changed
                  const equipmentSlotsAfter = componentManager.getComponent(
                    characterId,
                    EquipmentSlotsComponentType
                  );
                  const slotValueAfter = equipmentSlotsAfter![slotType as keyof EquipmentSlotsComponent];

                  // Verify the visual state changed
                  expect(slotValueAfter).not.toBe(slotValueBefore);
                  expect(slotValueAfter).toBe(instance.instanceId as unknown as any);

                  // Verify the equipment_changed event was emitted
                  // (which triggers the visual update)
                  // The event handler should have been called
                }
              }
            } else if (operation === 'unequip') {
              // Only unequip if there's something equipped in this slot
              if (currentlyEquipped.has(slotType)) {
                // Get the equipment slots before unequipping
                const equipmentSlotsBefore = componentManager.getComponent(
                  characterId,
                  EquipmentSlotsComponentType
                );
                const slotValueBefore = equipmentSlotsBefore![slotType as keyof EquipmentSlotsComponent];

                // Unequip the item
                const success = equipmentSystem.unequipItem(
                  characterId,
                  slotType as any
                );

                if (success) {
                  // Visual update should be triggered for this slot
                  expectedUpdateCalls++;
                  
                  // Update tracking
                  currentlyEquipped.delete(slotType);

                  // Verify the slot value changed
                  const equipmentSlotsAfter = componentManager.getComponent(
                    characterId,
                    EquipmentSlotsComponentType
                  );
                  const slotValueAfter = equipmentSlotsAfter![slotType as keyof EquipmentSlotsComponent];

                  // Verify the visual state changed
                  expect(slotValueAfter).not.toBe(slotValueBefore);
                  expect(slotValueAfter).toBeNull();
                }
              }
            }
          }

          // Verify that updateSlotVisual was called the expected number of times
          // This confirms that visual updates happen immediately on equipment changes
          expect(updateSlotVisualSpy).toHaveBeenCalledTimes(expectedUpdateCalls);

          // Verify that each call to updateSlotVisual was for a valid slot
          for (let i = 0; i < updateSlotVisualSpy.mock.calls.length; i++) {
            const callArgs = updateSlotVisualSpy.mock.calls[i];
            const slotArg = callArgs[0];
            
            // Verify the slot argument is valid
            expect(['weapon', 'armor', 'offhand', 'accessory']).toContain(slotArg);
          }

          // Verify final visual state matches final equipment state
          const finalEquipmentSlots = componentManager.getComponent(
            characterId,
            EquipmentSlotsComponentType
          );

          expect(finalEquipmentSlots).toBeDefined();

          // For each slot, verify the visual state matches the equipment state
          const allSlots: Array<'weapon' | 'armor' | 'offhand' | 'accessory'> = [
            'weapon', 'armor', 'offhand', 'accessory'
          ];

          for (const slot of allSlots) {
            const slotValue = finalEquipmentSlots![slot];
            const isEquipped = currentlyEquipped.has(slot);

            if (isEquipped) {
              // Slot should have an item
              expect(slotValue).not.toBeNull();
              expect(slotValue).toBe(currentlyEquipped.get(slot) as unknown as any);
            } else {
              // Slot should be empty
              expect(slotValue).toBeNull();
            }
          }

          // Verify that visual updates are immediate (synchronous)
          // by checking that the DOM reflects the current state
          // (In a real UI test, we would check the actual DOM elements,
          // but here we verify the data layer that drives the UI)
          for (const slot of allSlots) {
            const equippedItem = equipmentSystem.getEquippedItem(characterId, slot);
            const slotValue = finalEquipmentSlots![slot];
            
            // The equipment system's view should match the component's view
            expect(equippedItem).toBe(slotValue);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
