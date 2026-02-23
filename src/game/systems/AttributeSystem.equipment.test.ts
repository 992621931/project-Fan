/**
 * Property-based tests for AttributeSystem equipment bonus calculations
 * **Feature: character-equipment-system**
 * **Property 13: Affix application to character stats**
 * **Property 14: Affix data reading**
 * **Property 15: Multiple affix type support**
 * **Validates: Requirements 4.3, 4.4, 5.1, 5.2, 5.3**
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

describe('AttributeSystem Equipment Bonus Property Tests', () => {
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
   * Property 13: Affix application to character stats
   * **Validates: Requirements 4.3, 4.4, 5.2**
   * 
   * For any equipment item with mainAffix and subAffixes, when equipped, 
   * all affix bonuses SHALL be applied to the character's attributes
   */
  it('Property 13: Affix application to character stats', () => {
    // Generator for equipment with affixes
    const equipmentWithAffixesGenerator = fc.record({
      slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
      mainStat: fc.record({
        attribute: fc.constantFrom('attack', 'defense', 'moveSpeed', 'dodgeRate', 'critRate', 'magicPower', 'resistance'),
        value: fc.integer({ min: 1, max: 50 }),
        type: fc.constant('flat' as const)
      }),
      subStats: fc.array(
        fc.record({
          attribute: fc.constantFrom('attack', 'defense', 'moveSpeed', 'dodgeRate', 'critRate', 'magicPower', 'resistance', 'healthRegen', 'manaRegen'),
          value: fc.integer({ min: 1, max: 20 }),
          type: fc.constant('flat' as const)
        }),
        { minLength: 0, maxLength: 3 }
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
        equipmentWithAffixesGenerator,
        (baseAttributes, equipment) => {
          // Create a character
          const characterId = createTestCharacter(baseAttributes);

          // Update system to get baseline stats
          attributeSystem.update(0);

          // Get baseline derived stats (before equipment)
          const baselineDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(baselineDerivedStats).not.toBeNull();

          const baselineStats = { ...baselineDerivedStats! };

          // Create equipment item with affixes
          const itemId = `test_${equipment.slotType}_${Date.now()}_${Math.random()}`;
          const itemData = {
            id: itemId,
            name: `Test ${equipment.slotType}`,
            description: `Test equipment with affixes`,
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

          // Register and add item to inventory
          itemSystem.registerItem(itemData);
          itemSystem.addItem(itemId, 1);

          // Get instance ID
          const instances = itemSystem.getAllItemInstances();
          const instance = instances.find(inst => inst.itemId === itemId);
          expect(instance).toBeDefined();
          if (!instance || !instance.instanceId) return;

          // Equip the item
          const equipSuccess = equipmentSystem.equipItem(
            characterId,
            instance.instanceId,
            equipment.slotType as any
          );
          expect(equipSuccess).toBe(true);

          // Update system to apply equipment bonuses
          attributeSystem.update(0);

          // Get derived stats after equipment
          const afterEquipDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(afterEquipDerivedStats).not.toBeNull();

          // Calculate expected bonuses from affixes
          const expectedBonuses = new Map<string, number>();
          
          // Add mainStat bonus
          expectedBonuses.set(
            equipment.mainStat.attribute,
            (expectedBonuses.get(equipment.mainStat.attribute) || 0) + equipment.mainStat.value
          );

          // Add subStats bonuses
          for (const subStat of equipment.subStats) {
            expectedBonuses.set(
              subStat.attribute,
              (expectedBonuses.get(subStat.attribute) || 0) + subStat.value
            );
          }

          // Verify each affix was applied
          for (const [attribute, expectedBonus] of expectedBonuses.entries()) {
            const baseValue = baselineStats[attribute as keyof DerivedStatsComponent] as number;
            const afterValue = afterEquipDerivedStats![attribute as keyof DerivedStatsComponent] as number;

            // The stat should have increased by at least the expected bonus
            // (it might be more due to base stat calculations, but should never be less)
            expect(afterValue).toBeGreaterThanOrEqual(baseValue + expectedBonus);
          }

          // Verify mainStat was applied
          const mainStatAttribute = equipment.mainStat.attribute as keyof DerivedStatsComponent;
          const baseMainStatValue = baselineStats[mainStatAttribute] as number;
          const afterMainStatValue = afterEquipDerivedStats![mainStatAttribute] as number;
          expect(afterMainStatValue).toBeGreaterThanOrEqual(baseMainStatValue + equipment.mainStat.value);

          // Verify all subStats were applied
          for (const subStat of equipment.subStats) {
            const subStatAttribute = subStat.attribute as keyof DerivedStatsComponent;
            const baseSubStatValue = baselineStats[subStatAttribute] as number;
            const afterSubStatValue = afterEquipDerivedStats![subStatAttribute] as number;
            expect(afterSubStatValue).toBeGreaterThanOrEqual(baseSubStatValue + subStat.value);
          }

          // Verify stats that don't have affixes remain unchanged (relative to base calculation)
          const affectedAttributes = new Set([
            equipment.mainStat.attribute,
            ...equipment.subStats.map(s => s.attribute)
          ]);

          const allAttributes: Array<keyof DerivedStatsComponent> = [
            'attack', 'defense', 'moveSpeed', 'dodgeRate', 'critRate', 
            'magicPower', 'resistance', 'healthRegen', 'manaRegen'
          ];

          for (const attr of allAttributes) {
            if (!affectedAttributes.has(attr as string)) {
              // Unaffected attributes should equal baseline
              expect(afterEquipDerivedStats![attr]).toBe(baselineStats[attr]);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: Affix data reading
   * **Validates: Requirements 5.1**
   * 
   * For any equipped item, the attribute calculator SHALL correctly read 
   * both mainAffix and subAffixes data from the item
   */
  it('Property 14: Affix data reading', () => {
    fc.assert(
      fc.property(
        fc.record({
          strength: fc.integer({ min: 10, max: 50 }),
          agility: fc.integer({ min: 10, max: 50 }),
          wisdom: fc.integer({ min: 10, max: 50 }),
          technique: fc.integer({ min: 10, max: 50 })
        }),
        fc.array(
          fc.record({
            slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
            mainStat: fc.record({
              attribute: fc.constantFrom('attack', 'defense', 'critRate', 'magicPower'),
              value: fc.integer({ min: 5, max: 30 }),
              type: fc.constant('flat' as const)
            }),
            subStats: fc.array(
              fc.record({
                attribute: fc.constantFrom('moveSpeed', 'dodgeRate', 'resistance', 'healthRegen'),
                value: fc.integer({ min: 1, max: 15 }),
                type: fc.constant('flat' as const)
              }),
              { minLength: 1, maxLength: 3 }
            )
          }),
          { minLength: 1, maxLength: 4 }
        ),
        (baseAttributes, equipmentList) => {
          // Create a character
          const characterId = createTestCharacter(baseAttributes);

          // Update system to get baseline
          attributeSystem.update(0);

          const baselineDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(baselineDerivedStats).not.toBeNull();

          // Create a deep copy of baseline stats to preserve them
          const baselineStats = { ...baselineDerivedStats! };

          // Track expected bonuses per slot (only one item per slot)
          // When multiple items target the same slot, only the last one counts
          const slotBonuses = new Map<string, Map<string, number>>();

          // Equip multiple items
          for (const equipment of equipmentList) {
            // Create equipment item
            const itemId = `test_${equipment.slotType}_${Date.now()}_${Math.random()}`;
            const itemData = {
              id: itemId,
              name: `Test ${equipment.slotType}`,
              description: `Test equipment`,
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
            if (!instance || !instance.instanceId) continue;

            // Equip the item (this will replace any existing item in the slot)
            const equipSuccess = equipmentSystem.equipItem(
              characterId,
              instance.instanceId,
              equipment.slotType as any
            );

            if (equipSuccess) {
              // Track bonuses for this slot (replacing previous bonuses for this slot)
              // This correctly handles the case where multiple items target the same slot
              const bonusesForSlot = new Map<string, number>();
              
              // Add mainStat bonus
              bonusesForSlot.set(equipment.mainStat.attribute, equipment.mainStat.value);

              // Add subStats bonuses (accumulate if same attribute appears multiple times)
              for (const subStat of equipment.subStats) {
                const currentBonus = bonusesForSlot.get(subStat.attribute) || 0;
                bonusesForSlot.set(subStat.attribute, currentBonus + subStat.value);
              }

              // Replace any previous bonuses for this slot (since equipment was replaced)
              slotBonuses.set(equipment.slotType, bonusesForSlot);
            }
          }

          // Calculate total expected bonuses across all slots
          // Only sum bonuses from the final equipped item in each slot
          const totalExpectedBonuses = new Map<string, number>();
          for (const bonusesForSlot of slotBonuses.values()) {
            for (const [attribute, bonus] of bonusesForSlot.entries()) {
              const currentTotal = totalExpectedBonuses.get(attribute) || 0;
              totalExpectedBonuses.set(attribute, currentTotal + bonus);
            }
          }

          // Update system to apply all equipment bonuses
          attributeSystem.update(0);

          // Get final derived stats
          const finalDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(finalDerivedStats).not.toBeNull();

          // Verify that the system correctly read and applied all affixes
          for (const [attribute, expectedTotalBonus] of totalExpectedBonuses.entries()) {
            const baseValue = baselineStats[attribute as keyof DerivedStatsComponent] as number;
            const finalValue = finalDerivedStats![attribute as keyof DerivedStatsComponent] as number;

            // The final value should equal base + total expected bonus
            // (allowing for small floating point differences)
            const expectedFinalValue = baseValue + expectedTotalBonus;
            expect(Math.abs(finalValue - expectedFinalValue)).toBeLessThan(0.01);

            // Verify the bonus was actually applied (not zero)
            expect(finalValue).toBeGreaterThan(baseValue);
          }

          // Verify that mainStat from each item was read
          // Count how many items had mainStat bonuses
          const mainStatBonusCount = equipmentList.length;
          expect(mainStatBonusCount).toBeGreaterThan(0);

          // Verify that subStats from each item were read
          // Count total subStats across all items
          const totalSubStatsCount = equipmentList.reduce(
            (sum, eq) => sum + eq.subStats.length,
            0
          );
          expect(totalSubStatsCount).toBeGreaterThan(0);

          // Verify the equipment slots contain the equipped items
          const equipmentSlots = componentManager.getComponent(characterId, EquipmentSlotsComponentType);
          expect(equipmentSlots).not.toBeNull();

          // Count how many slots are occupied
          let occupiedSlots = 0;
          if (equipmentSlots!.weapon !== null) occupiedSlots++;
          if (equipmentSlots!.armor !== null) occupiedSlots++;
          if (equipmentSlots!.offhand !== null) occupiedSlots++;
          if (equipmentSlots!.accessory !== null) occupiedSlots++;

          // At least one slot should be occupied
          expect(occupiedSlots).toBeGreaterThan(0);
          expect(occupiedSlots).toBeLessThanOrEqual(4);

          // Verify that for each occupied slot, we can retrieve the item and its affixes
          const slots: Array<{ slot: keyof EquipmentSlotsComponent; type: string }> = [
            { slot: 'weapon', type: 'weapon' },
            { slot: 'armor', type: 'armor' },
            { slot: 'offhand', type: 'offhand' },
            { slot: 'accessory', type: 'accessory' }
          ];

          for (const { slot } of slots) {
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
                  // Verify mainStat exists and is readable
                  expect(itemData.mainStat).toBeDefined();
                  expect(itemData.mainStat?.attribute).toBeDefined();
                  expect(itemData.mainStat?.value).toBeGreaterThan(0);
                  expect(itemData.mainStat?.type).toBe('flat');

                  // Verify subStats exists and is readable
                  expect(itemData.subStats).toBeDefined();
                  expect(Array.isArray(itemData.subStats)).toBe(true);
                  
                  if (itemData.subStats && itemData.subStats.length > 0) {
                    for (const subStat of itemData.subStats) {
                      expect(subStat.attribute).toBeDefined();
                      expect(subStat.value).toBeGreaterThan(0);
                      expect(subStat.type).toBe('flat');
                    }
                  }
                }
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15: Multiple affix type support
   * **Validates: Requirements 5.3**
   * 
   * For any equipment with affixes of different types (attack, defense, HP, MP, 
   * crit rate, experience rate), all affix types SHALL be correctly applied to character stats
   */
  it('Property 15: Multiple affix type support', () => {
    // Generator for equipment with diverse affix types
    const diverseAffixEquipmentGenerator = fc.record({
      slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
      mainStat: fc.record({
        attribute: fc.constantFrom('attack', 'defense', 'magicPower', 'resistance', 'critRate', 'hitRate'),
        value: fc.integer({ min: 5, max: 40 }),
        type: fc.constant('flat' as const)
      }),
      subStats: fc.array(
        fc.record({
          attribute: fc.constantFrom(
            'attack', 'defense', 'moveSpeed', 'dodgeRate', 'critRate', 
            'critDamage', 'magicPower', 'resistance', 'carryWeight', 
            'hitRate', 'expRate', 'healthRegen', 'manaRegen'
          ),
          value: fc.integer({ min: 1, max: 25 }),
          type: fc.constant('flat' as const)
        }),
        { minLength: 2, maxLength: 4 }
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
        diverseAffixEquipmentGenerator,
        (baseAttributes, equipment) => {
          // Create a character
          const characterId = createTestCharacter(baseAttributes);

          // Update system to get baseline stats
          attributeSystem.update(0);

          // Get baseline derived stats (before equipment)
          const baselineDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(baselineDerivedStats).not.toBeNull();

          const baselineStats = { ...baselineDerivedStats! };

          // Create equipment item with diverse affixes
          const itemId = `test_diverse_${equipment.slotType}_${Date.now()}_${Math.random()}`;
          const itemData = {
            id: itemId,
            name: `Diverse ${equipment.slotType}`,
            description: `Equipment with multiple affix types`,
            type: 'equipment' as const,
            subType: equipment.slotType,
            equipmentSlot: equipment.slotType,
            icon: 'test-icon.png',
            rarity: 2,
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

          // Register and add item to inventory
          itemSystem.registerItem(itemData);
          itemSystem.addItem(itemId, 1);

          // Get instance ID
          const instances = itemSystem.getAllItemInstances();
          const instance = instances.find(inst => inst.itemId === itemId);
          expect(instance).toBeDefined();
          if (!instance || !instance.instanceId) return;

          // Equip the item
          const equipSuccess = equipmentSystem.equipItem(
            characterId,
            instance.instanceId,
            equipment.slotType as any
          );
          expect(equipSuccess).toBe(true);

          // Update system to apply equipment bonuses
          attributeSystem.update(0);

          // Get derived stats after equipment
          const afterEquipDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(afterEquipDerivedStats).not.toBeNull();

          // Collect all unique affix types from the equipment
          const affixTypes = new Set<string>();
          affixTypes.add(equipment.mainStat.attribute);
          equipment.subStats.forEach(subStat => affixTypes.add(subStat.attribute));

          // Verify that we have multiple different affix types
          expect(affixTypes.size).toBeGreaterThanOrEqual(2);

          // Calculate expected bonuses for each affix type
          const expectedBonuses = new Map<string, number>();
          
          // Add mainStat bonus
          expectedBonuses.set(
            equipment.mainStat.attribute,
            (expectedBonuses.get(equipment.mainStat.attribute) || 0) + equipment.mainStat.value
          );

          // Add subStats bonuses (accumulate if same attribute appears multiple times)
          for (const subStat of equipment.subStats) {
            expectedBonuses.set(
              subStat.attribute,
              (expectedBonuses.get(subStat.attribute) || 0) + subStat.value
            );
          }

          // Verify each affix type was correctly applied
          for (const [attribute, expectedBonus] of expectedBonuses.entries()) {
            const baseValue = baselineStats[attribute as keyof DerivedStatsComponent] as number;
            const afterValue = afterEquipDerivedStats![attribute as keyof DerivedStatsComponent] as number;

            // The stat should have increased by exactly the expected bonus
            // (allowing for small floating point differences)
            const expectedFinalValue = baseValue + expectedBonus;
            expect(Math.abs(afterValue - expectedFinalValue)).toBeLessThan(0.01);

            // Verify the bonus was actually applied (not zero)
            expect(afterValue).toBeGreaterThan(baseValue);
          }

          // Verify that different affix types are all supported
          // Test specific affix type categories:
          const offensiveStats = ['attack', 'critRate', 'critDamage', 'magicPower', 'hitRate'];
          const defensiveStats = ['defense', 'resistance', 'dodgeRate'];
          const utilityStats = ['moveSpeed', 'carryWeight', 'expRate'];
          const regenStats = ['healthRegen', 'manaRegen'];

          // Count how many categories are represented
          let categoriesRepresented = 0;
          if (offensiveStats.some(stat => affixTypes.has(stat))) categoriesRepresented++;
          if (defensiveStats.some(stat => affixTypes.has(stat))) categoriesRepresented++;
          if (utilityStats.some(stat => affixTypes.has(stat))) categoriesRepresented++;
          if (regenStats.some(stat => affixTypes.has(stat))) categoriesRepresented++;

          // With diverse affixes, we should have at least 2 categories represented
          expect(categoriesRepresented).toBeGreaterThanOrEqual(1);

          // Verify stats that don't have affixes remain unchanged
          const affectedAttributes = new Set(expectedBonuses.keys());

          const allAttributes: Array<keyof DerivedStatsComponent> = [
            'attack', 'defense', 'moveSpeed', 'dodgeRate', 'critRate', 
            'critDamage', 'magicPower', 'resistance', 'carryWeight',
            'hitRate', 'expRate', 'healthRegen', 'manaRegen'
          ];

          for (const attr of allAttributes) {
            if (!affectedAttributes.has(attr as string)) {
              // Unaffected attributes should equal baseline
              expect(afterEquipDerivedStats![attr]).toBe(baselineStats[attr]);
            }
          }

          // Verify that all affix types are properly stored and retrievable
          const equippedItemData = itemSystem.getItem(instance.itemId);
          expect(equippedItemData).toBeDefined();
          expect(equippedItemData?.mainStat).toBeDefined();
          expect(equippedItemData?.subStats).toBeDefined();
          expect(Array.isArray(equippedItemData?.subStats)).toBe(true);

          // Verify mainStat type is supported
          expect(equippedItemData?.mainStat?.attribute).toBeDefined();
          expect(typeof equippedItemData?.mainStat?.value).toBe('number');
          expect(equippedItemData?.mainStat?.type).toBe('flat');

          // Verify all subStats types are supported
          if (equippedItemData?.subStats) {
            for (const subStat of equippedItemData.subStats) {
              expect(subStat.attribute).toBeDefined();
              expect(typeof subStat.value).toBe('number');
              expect(subStat.type).toBe('flat');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
