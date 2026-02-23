/**
 * Property-based tests for AttributeSystem immediate recalculation on equipment change
 * **Feature: character-equipment-system**
 * **Property 16: Immediate attribute recalculation on equipment change**
 * **Validates: Requirements 5.4, 6.4, 7.2**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AttributeSystem } from './AttributeSystem';
import { EquipmentSystem } from './EquipmentSystem';
import { ItemSystem } from './ItemSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { World } from '../../ecs/World';
import {
  AttributeComponent,
  AttributeComponentType,
  DerivedStatsComponent,
  DerivedStatsComponentType,
  HealthComponent,
  HealthComponentType,
  ManaComponent,
  ManaComponentType,
  LevelComponent,
  LevelComponentType,
  JobComponent,
  JobComponentType,
  CharacterInfoComponent,
  CharacterInfoComponentType
} from '../components/CharacterComponents';
import {
  EquipmentSlotsComponent,
  EquipmentSlotsComponentType
} from '../components/SystemComponents';
import { JobType, CharacterStatus } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

describe('AttributeSystem Immediate Recalculation Property Tests', () => {
  let world: World;
  let attributeSystem: AttributeSystem;
  let equipmentSystem: EquipmentSystem;
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

    equipmentSystem = new EquipmentSystem(world, itemSystem);
    equipmentSystem.initialize(entityManager, componentManager, eventSystem);

    attributeSystem = new AttributeSystem();
    attributeSystem.initialize(entityManager, componentManager, eventSystem);
    attributeSystem.setItemSystem(itemSystem);
  });

  /**
   * Helper function to create a test character with all required components
   */
  function createTestCharacter(attributes: { strength: number; agility: number; wisdom: number; technique: number }): string {
    const characterEntity = entityManager.createEntity();
    const characterId = characterEntity.id;

    const attributeComponent: AttributeComponent = {
      type: 'attribute',
      ...attributes
    };

    const derivedStats: DerivedStatsComponent = {
      type: 'derivedStats',
      attack: 0,
      defense: 0,
      moveSpeed: 0,
      dodgeRate: 0,
      critRate: 0,
      critDamage: 0,
      resistance: 0,
      magicPower: 0,
      carryWeight: 0,
      hitRate: 0,
      expRate: 0,
      healthRegen: 0,
      manaRegen: 0,
      weight: 70,
      volume: 1
    };

    const health: HealthComponent = {
      type: 'health',
      current: 100,
      maximum: 100
    };

    const mana: ManaComponent = {
      type: 'mana',
      current: 50,
      maximum: 50
    };

    const level: LevelComponent = {
      type: 'level',
      level: 1,
      experience: 0,
      experienceToNext: 100
    };

    const job: JobComponent = {
      type: 'job',
      currentJob: JobType.Warrior,
      availableJobs: [JobType.Warrior],
      jobExperience: new Map([[JobType.Warrior, 0]])
    };

    const characterInfo: CharacterInfoComponent = {
      type: 'characterInfo',
      title: 'Test',
      name: 'Character',
      isSpecial: false,
      rarity: RarityType.Common,
      status: CharacterStatus.Available
    };

    const equipmentSlots: EquipmentSlotsComponent = {
      type: 'equipmentSlots',
      weapon: null,
      armor: null,
      offhand: null,
      accessory: null
    };

    componentManager.addComponent(characterId, AttributeComponentType, attributeComponent);
    componentManager.addComponent(characterId, DerivedStatsComponentType, derivedStats);
    componentManager.addComponent(characterId, HealthComponentType, health);
    componentManager.addComponent(characterId, ManaComponentType, mana);
    componentManager.addComponent(characterId, LevelComponentType, level);
    componentManager.addComponent(characterId, JobComponentType, job);
    componentManager.addComponent(characterId, CharacterInfoComponentType, characterInfo);
    componentManager.addComponent(characterId, EquipmentSlotsComponentType, equipmentSlots);

    return characterId;
  }

  /**
   * Property 16: Immediate attribute recalculation on equipment change
   * **Validates: Requirements 5.4, 6.4, 7.2**
   * 
   * For any equipment change operation (equip, unequip, or replace), 
   * character attributes SHALL be recalculated immediately within the same operation
   */
  it('Property 16: Immediate attribute recalculation on equipment change', () => {
    // Generator for equipment with affixes
    const equipmentGenerator = fc.record({
      slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
      mainStat: fc.record({
        attribute: fc.constantFrom('attack', 'defense', 'moveSpeed', 'critRate', 'magicPower'),
        value: fc.integer({ min: 5, max: 50 }),
        type: fc.constant('flat' as const)
      }),
      subStats: fc.array(
        fc.record({
          attribute: fc.constantFrom('dodgeRate', 'resistance', 'healthRegen', 'manaRegen'),
          value: fc.integer({ min: 1, max: 20 }),
          type: fc.constant('flat' as const)
        }),
        { minLength: 0, maxLength: 2 }
      )
    });

    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 10, max: 50 }),
          agility: fc.integer({ min: 10, max: 50 }),
          wisdom: fc.integer({ min: 10, max: 50 }),
          technique: fc.integer({ min: 10, max: 50 })
        }),
        equipmentGenerator,
        equipmentGenerator, // Second equipment for replacement test
        (baseAttributes, equipment1, equipment2) => {
          // Create a character
          const characterId = createTestCharacter(baseAttributes);

          // Update system to get baseline stats
          attributeSystem.update(0);

          // Get baseline derived stats (before equipment)
          const baselineDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(baselineDerivedStats).not.toBeNull();

          const baselineStats = { ...baselineDerivedStats! };

          // TEST 1: Immediate recalculation on EQUIP
          // Create first equipment item
          const itemId1 = `test_equip_${equipment1.slotType}_${Date.now()}_${Math.random()}`;
          const itemData1 = {
            id: itemId1,
            name: `Test ${equipment1.slotType} 1`,
            description: `Test equipment for immediate recalculation`,
            type: 'equipment' as const,
            subType: equipment1.slotType,
            equipmentSlot: equipment1.slotType,
            icon: 'test-icon.png',
            rarity: 1,
            stackSize: 1,
            mainStat: equipment1.mainStat,
            subStats: equipment1.subStats,
            canSell: true,
            sellPrice: 100,
            canBuy: true,
            buyPrice: 200,
            canCraft: false,
            craftRecipe: null,
            canUse: false
          };

          // Register and add to inventory
          itemSystem.registerItem(itemData1);
          itemSystem.addItem(itemId1, 1);

          // Get instance
          const instances1 = itemSystem.getAllItemInstances();
          const instance1 = instances1.find(inst => inst.itemId === itemId1);
          expect(instance1).toBeDefined();
          if (!instance1 || !instance1.instanceId) return;

          // Equip the item (this should trigger immediate recalculation via event)
          const equipSuccess = equipmentSystem.equipItem(
            characterId,
            instance1.instanceId,
            equipment1.slotType as any
          );
          expect(equipSuccess).toBe(true);

          // CRITICAL: Do NOT call attributeSystem.update() here
          // The recalculation should happen immediately via the equipment_changed event
          // Get derived stats IMMEDIATELY after equip (without calling update)
          const afterEquipDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(afterEquipDerivedStats).not.toBeNull();

          // Calculate expected bonuses from equipment1
          const expectedBonuses1 = new Map<string, number>();
          expectedBonuses1.set(equipment1.mainStat.attribute, equipment1.mainStat.value);
          for (const subStat of equipment1.subStats) {
            const current = expectedBonuses1.get(subStat.attribute) || 0;
            expectedBonuses1.set(subStat.attribute, current + subStat.value);
          }

          // Verify that stats were recalculated IMMEDIATELY (without calling update)
          for (const [attribute, expectedBonus] of expectedBonuses1.entries()) {
            const baseValue = baselineStats[attribute as keyof DerivedStatsComponent] as number;
            const afterValue = afterEquipDerivedStats![attribute as keyof DerivedStatsComponent] as number;

            // The stat should have increased by the expected bonus IMMEDIATELY
            const expectedFinalValue = baseValue + expectedBonus;
            expect(Math.abs(afterValue - expectedFinalValue)).toBeLessThan(0.01);
            expect(afterValue).toBeGreaterThan(baseValue);
          }

          // TEST 2: Immediate recalculation on REPLACE
          // Create second equipment item for the SAME slot
          const itemId2 = `test_replace_${equipment2.slotType}_${Date.now()}_${Math.random()}`;
          const itemData2 = {
            id: itemId2,
            name: `Test ${equipment2.slotType} 2`,
            description: `Test equipment for replacement`,
            type: 'equipment' as const,
            subType: equipment1.slotType, // Use same slot as equipment1 to test replacement
            equipmentSlot: equipment1.slotType,
            icon: 'test-icon.png',
            rarity: 1,
            stackSize: 1,
            mainStat: equipment2.mainStat,
            subStats: equipment2.subStats,
            canSell: true,
            sellPrice: 100,
            canBuy: true,
            buyPrice: 200,
            canCraft: false,
            craftRecipe: null,
            canUse: false
          };

          // Register and add to inventory
          itemSystem.registerItem(itemData2);
          itemSystem.addItem(itemId2, 1);

          // Get instance
          const instances2 = itemSystem.getAllItemInstances();
          const instance2 = instances2.find(inst => inst.itemId === itemId2);
          expect(instance2).toBeDefined();
          if (!instance2 || !instance2.instanceId) return;

          // Replace equipment (equip to same slot)
          const replaceSuccess = equipmentSystem.equipItem(
            characterId,
            instance2.instanceId,
            equipment1.slotType as any // Same slot as equipment1
          );
          expect(replaceSuccess).toBe(true);

          // CRITICAL: Do NOT call attributeSystem.update() here
          // Get derived stats IMMEDIATELY after replace (without calling update)
          const afterReplaceDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(afterReplaceDerivedStats).not.toBeNull();

          // Calculate expected bonuses from equipment2 (equipment1 should be removed)
          const expectedBonuses2 = new Map<string, number>();
          expectedBonuses2.set(equipment2.mainStat.attribute, equipment2.mainStat.value);
          for (const subStat of equipment2.subStats) {
            const current = expectedBonuses2.get(subStat.attribute) || 0;
            expectedBonuses2.set(subStat.attribute, current + subStat.value);
          }

          // Verify that stats were recalculated IMMEDIATELY after replacement
          for (const [attribute, expectedBonus] of expectedBonuses2.entries()) {
            const baseValue = baselineStats[attribute as keyof DerivedStatsComponent] as number;
            const afterValue = afterReplaceDerivedStats![attribute as keyof DerivedStatsComponent] as number;

            // The stat should equal base + equipment2 bonuses (equipment1 removed)
            const expectedFinalValue = baseValue + expectedBonus;
            expect(Math.abs(afterValue - expectedFinalValue)).toBeLessThan(0.01);
          }

          // Verify that equipment1 bonuses were removed
          // Check attributes that were in equipment1 but not in equipment2
          for (const [attribute, bonus1] of expectedBonuses1.entries()) {
            if (!expectedBonuses2.has(attribute)) {
              // This attribute was in equipment1 but not equipment2
              // It should be back to baseline
              const baseValue = baselineStats[attribute as keyof DerivedStatsComponent] as number;
              const afterValue = afterReplaceDerivedStats![attribute as keyof DerivedStatsComponent] as number;
              expect(afterValue).toBe(baseValue);
            }
          }

          // TEST 3: Immediate recalculation on UNEQUIP
          // Unequip the item
          const unequipSuccess = equipmentSystem.unequipItem(
            characterId,
            equipment1.slotType as any
          );
          expect(unequipSuccess).toBe(true);

          // CRITICAL: Do NOT call attributeSystem.update() here
          // Get derived stats IMMEDIATELY after unequip (without calling update)
          const afterUnequipDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(afterUnequipDerivedStats).not.toBeNull();

          // Verify that stats were recalculated IMMEDIATELY and returned to baseline
          const allAttributes: Array<keyof DerivedStatsComponent> = [
            'attack', 'defense', 'moveSpeed', 'dodgeRate', 'critRate',
            'critDamage', 'magicPower', 'resistance', 'carryWeight',
            'hitRate', 'expRate', 'healthRegen', 'manaRegen'
          ];

          for (const attr of allAttributes) {
            const baseValue = baselineStats[attr] as number;
            const afterValue = afterUnequipDerivedStats![attr] as number;

            // After unequip, all stats should return to baseline IMMEDIATELY
            expect(afterValue).toBe(baseValue);
          }

          // VERIFICATION: The key property being tested is that recalculation happens
          // IMMEDIATELY within the equipment operation, NOT on the next update() call
          // We verified this by:
          // 1. NOT calling attributeSystem.update() after equipment changes
          // 2. Checking stats immediately after equipItem/unequipItem calls
          // 3. Confirming stats reflect the equipment changes without explicit update
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Verify recalculation happens via event system, not polling
   */
  it('should recalculate via event system without explicit update call', () => {
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 10, max: 50 }),
          agility: fc.integer({ min: 10, max: 50 }),
          wisdom: fc.integer({ min: 10, max: 50 }),
          technique: fc.integer({ min: 10, max: 50 })
        }),
        fc.record({
          attribute: fc.constantFrom('attack', 'defense', 'magicPower'),
          value: fc.integer({ min: 10, max: 40 })
        }),
        (baseAttributes, affix) => {
          // Create a character
          const characterId = createTestCharacter(baseAttributes);

          // Initial update to establish baseline
          attributeSystem.update(0);

          const baselineDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(baselineDerivedStats).not.toBeNull();

          const baselineValue = baselineDerivedStats![affix.attribute as keyof DerivedStatsComponent] as number;

          // Create equipment
          const itemId = `test_event_${Date.now()}_${Math.random()}`;
          const itemData = {
            id: itemId,
            name: `Test Weapon`,
            description: `Test`,
            type: 'equipment' as const,
            subType: 'weapon',
            equipmentSlot: 'weapon',
            icon: 'test.png',
            rarity: 1,
            stackSize: 1,
            mainStat: {
              attribute: affix.attribute,
              value: affix.value,
              type: 'flat' as const
            },
            subStats: [],
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
          expect(instance).toBeDefined();
          if (!instance || !instance.instanceId) return;

          // Equip WITHOUT calling update
          equipmentSystem.equipItem(characterId, instance.instanceId, 'weapon');

          // Check stats IMMEDIATELY (no update call)
          const afterEquipDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(afterEquipDerivedStats).not.toBeNull();

          const afterValue = afterEquipDerivedStats![affix.attribute as keyof DerivedStatsComponent] as number;

          // Stats should be updated via event system
          expect(afterValue).toBe(baselineValue + affix.value);

          // Unequip WITHOUT calling update
          equipmentSystem.unequipItem(characterId, 'weapon');

          // Check stats IMMEDIATELY (no update call)
          const afterUnequipDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(afterUnequipDerivedStats).not.toBeNull();

          const finalValue = afterUnequipDerivedStats![affix.attribute as keyof DerivedStatsComponent] as number;

          // Stats should be back to baseline via event system
          expect(finalValue).toBe(baselineValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17: Base attribute preservation
   * **Validates: Requirements 5.5**
   * 
   * For any character, equipping or unequipping items SHALL NOT modify the character's 
   * base attributes, only the derived stats with equipment bonuses
   */
  it('Property 17: Base attribute preservation', () => {
    // Generator for base attributes
    const baseAttributesGenerator = fc.record({
      strength: fc.integer({ min: 5, max: 100 }),
      agility: fc.integer({ min: 5, max: 100 }),
      wisdom: fc.integer({ min: 5, max: 100 }),
      technique: fc.integer({ min: 5, max: 100 })
    });

    // Generator for equipment with various affixes
    const equipmentGenerator = fc.record({
      slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
      mainStat: fc.record({
        attribute: fc.constantFrom('attack', 'defense', 'moveSpeed', 'critRate', 'magicPower', 'resistance'),
        value: fc.integer({ min: 10, max: 100 }),
        type: fc.constant('flat' as const)
      }),
      subStats: fc.array(
        fc.record({
          attribute: fc.constantFrom('dodgeRate', 'resistance', 'healthRegen', 'manaRegen', 'hitRate', 'carryWeight'),
          value: fc.integer({ min: 5, max: 50 }),
          type: fc.constant('flat' as const)
        }),
        { minLength: 0, maxLength: 3 }
      )
    });

    fc.assert(
      fc.property(
        baseAttributesGenerator,
        fc.array(equipmentGenerator, { minLength: 1, maxLength: 10 }),
        (baseAttributes, equipmentList) => {
          // Create a character with specific base attributes
          const characterId = createTestCharacter(baseAttributes);

          // Update system to establish baseline
          attributeSystem.update(0);

          // Capture the initial base attributes
          const initialAttributes = componentManager.getComponent(characterId, AttributeComponentType);
          expect(initialAttributes).not.toBeNull();

          const initialStrength = initialAttributes!.strength;
          const initialAgility = initialAttributes!.agility;
          const initialWisdom = initialAttributes!.wisdom;
          const initialTechnique = initialAttributes!.technique;

          // Verify initial base attributes match what we set
          expect(initialStrength).toBe(baseAttributes.strength);
          expect(initialAgility).toBe(baseAttributes.agility);
          expect(initialWisdom).toBe(baseAttributes.wisdom);
          expect(initialTechnique).toBe(baseAttributes.technique);

          // Perform multiple equipment operations
          const equippedItems: Array<{ instanceId: string; slotType: string }> = [];

          for (const equipment of equipmentList) {
            // Create equipment item
            const itemId = `test_preserve_${equipment.slotType}_${Date.now()}_${Math.random()}`;
            const itemData = {
              id: itemId,
              name: `Test ${equipment.slotType}`,
              description: `Test equipment for base attribute preservation`,
              type: 'equipment' as const,
              subType: equipment.slotType,
              equipmentSlot: equipment.slotType,
              icon: 'test-icon.png',
              rarity: 1,
              stackSize: 1,
              mainStat: equipment.mainStat,
              subStats: equipment.subStats,
              canSell: true,
              sellPrice: 100,
              canBuy: true,
              buyPrice: 200,
              canCraft: false,
              craftRecipe: null,
              canUse: false
            };

            // Register and add to inventory
            itemSystem.registerItem(itemData);
            itemSystem.addItem(itemId, 1);

            // Get instance
            const instances = itemSystem.getAllItemInstances();
            const instance = instances.find(inst => inst.itemId === itemId);
            
            if (instance && instance.instanceId) {
              // Equip the item
              const equipSuccess = equipmentSystem.equipItem(
                characterId,
                instance.instanceId,
                equipment.slotType as any
              );

              if (equipSuccess) {
                equippedItems.push({
                  instanceId: instance.instanceId,
                  slotType: equipment.slotType
                });

                // CRITICAL CHECK: Verify base attributes remain unchanged after equipping
                const attributesAfterEquip = componentManager.getComponent(characterId, AttributeComponentType);
                expect(attributesAfterEquip).not.toBeNull();

                expect(attributesAfterEquip!.strength).toBe(initialStrength);
                expect(attributesAfterEquip!.agility).toBe(initialAgility);
                expect(attributesAfterEquip!.wisdom).toBe(initialWisdom);
                expect(attributesAfterEquip!.technique).toBe(initialTechnique);

                // Verify that derived stats DID change (to confirm equipment is working)
                const derivedStatsAfterEquip = componentManager.getComponent(characterId, DerivedStatsComponentType);
                expect(derivedStatsAfterEquip).not.toBeNull();
                
                // At least one derived stat should be affected by equipment
                // (We can't predict which one without knowing the affix, but we can verify
                // that the system is calculating bonuses by checking the equipment is in the slot)
                const equipmentSlots = componentManager.getComponent(characterId, EquipmentSlotsComponentType);
                expect(equipmentSlots).not.toBeNull();
                expect(equipmentSlots![equipment.slotType as keyof EquipmentSlotsComponent]).toBe(
                  instance.instanceId as unknown as EntityId
                );
              }
            }
          }

          // Verify base attributes are still unchanged after all equipment operations
          const attributesAfterAllEquips = componentManager.getComponent(characterId, AttributeComponentType);
          expect(attributesAfterAllEquips).not.toBeNull();

          expect(attributesAfterAllEquips!.strength).toBe(initialStrength);
          expect(attributesAfterAllEquips!.agility).toBe(initialAgility);
          expect(attributesAfterAllEquips!.wisdom).toBe(initialWisdom);
          expect(attributesAfterAllEquips!.technique).toBe(initialTechnique);

          // Now unequip all items
          for (const { slotType } of equippedItems) {
            const unequipSuccess = equipmentSystem.unequipItem(
              characterId,
              slotType as any
            );

            if (unequipSuccess) {
              // CRITICAL CHECK: Verify base attributes remain unchanged after unequipping
              const attributesAfterUnequip = componentManager.getComponent(characterId, AttributeComponentType);
              expect(attributesAfterUnequip).not.toBeNull();

              expect(attributesAfterUnequip!.strength).toBe(initialStrength);
              expect(attributesAfterUnequip!.agility).toBe(initialAgility);
              expect(attributesAfterUnequip!.wisdom).toBe(initialWisdom);
              expect(attributesAfterUnequip!.technique).toBe(initialTechnique);
            }
          }

          // Final verification: Base attributes are still unchanged after all operations
          const finalAttributes = componentManager.getComponent(characterId, AttributeComponentType);
          expect(finalAttributes).not.toBeNull();

          expect(finalAttributes!.strength).toBe(initialStrength);
          expect(finalAttributes!.agility).toBe(initialAgility);
          expect(finalAttributes!.wisdom).toBe(initialWisdom);
          expect(finalAttributes!.technique).toBe(initialTechnique);

          // Additional check: Verify base attributes are exactly what we started with
          expect(finalAttributes!.strength).toBe(baseAttributes.strength);
          expect(finalAttributes!.agility).toBe(baseAttributes.agility);
          expect(finalAttributes!.wisdom).toBe(baseAttributes.wisdom);
          expect(finalAttributes!.technique).toBe(baseAttributes.technique);

          // Verify that the AttributeComponent type property is preserved
          expect(finalAttributes!.type).toBe('attribute');

          // Verify no unexpected properties were added to base attributes
          const attributeKeys = Object.keys(finalAttributes!).filter(key => key !== 'type');
          expect(attributeKeys).toHaveLength(4);
          expect(attributeKeys).toContain('strength');
          expect(attributeKeys).toContain('agility');
          expect(attributeKeys).toContain('wisdom');
          expect(attributeKeys).toContain('technique');
        }
      ),
      { numRuns: 100 }
    );
  });
});
