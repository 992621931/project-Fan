/**
 * Property-based tests for AttributeSystem attribute correctness after equipment replacement
 * **Feature: character-equipment-system**
 * **Property 20: Attribute correctness after replacement**
 * **Validates: Requirements 7.3**
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

describe('AttributeSystem Equipment Replacement Property Tests', () => {
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
   * Property 20: Attribute correctness after replacement
   * **Validates: Requirements 7.3**
   * 
   * For any equipment replacement operation, the final character attributes SHALL equal 
   * base attributes plus bonuses from all currently equipped items (excluding the replaced item)
   */
  it('Property 20: Attribute correctness after replacement', () => {
    // Generator for equipment with affixes
    const equipmentGenerator = fc.record({
      slotType: fc.constantFrom('weapon', 'armor', 'offhand', 'accessory'),
      mainStat: fc.record({
        attribute: fc.constantFrom('attack', 'defense', 'moveSpeed', 'dodgeRate', 'critRate', 'magicPower', 'resistance'),
        value: fc.integer({ min: 5, max: 50 }),
        type: fc.constant('flat' as const)
      }),
      subStats: fc.array(
        fc.record({
          attribute: fc.constantFrom('attack', 'defense', 'moveSpeed', 'dodgeRate', 'critRate', 'magicPower', 'resistance', 'healthRegen', 'manaRegen'),
          value: fc.integer({ min: 1, max: 25 }),
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
        fc.array(equipmentGenerator, { minLength: 2, maxLength: 8 }), // Initial equipment set
        equipmentGenerator, // Replacement equipment
        (baseAttributes, initialEquipmentList, replacementEquipment) => {
          // Create a character
          const characterId = createTestCharacter(baseAttributes);

          // Update system to get baseline stats
          attributeSystem.update(0);

          // Get baseline derived stats (before any equipment)
          const baselineDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(baselineDerivedStats).not.toBeNull();

          const baselineStats = { ...baselineDerivedStats! };

          // Track equipped items by slot (only one item per slot)
          const equippedBySlot = new Map<string, {
            instanceId: string;
            itemId: string;
            bonuses: Map<string, number>;
          }>();

          // Equip initial equipment set
          for (const equipment of initialEquipmentList) {
            // Create equipment item
            const itemId = `test_initial_${equipment.slotType}_${Date.now()}_${Math.random()}`;
            const itemData = {
              id: itemId,
              name: `Initial ${equipment.slotType}`,
              description: `Initial equipment`,
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

            // Equip the item
            const equipSuccess = equipmentSystem.equipItem(
              characterId,
              instance.instanceId,
              equipment.slotType as any
            );

            if (equipSuccess) {
              // Calculate bonuses for this item
              const bonuses = new Map<string, number>();
              bonuses.set(equipment.mainStat.attribute, equipment.mainStat.value);
              for (const subStat of equipment.subStats) {
                const current = bonuses.get(subStat.attribute) || 0;
                bonuses.set(subStat.attribute, current + subStat.value);
              }

              // Store in slot map (replacing any previous item in this slot)
              equippedBySlot.set(equipment.slotType, {
                instanceId: instance.instanceId,
                itemId: itemId,
                bonuses: bonuses
              });
            }
          }

          // Update system to apply initial equipment bonuses
          attributeSystem.update(0);

          // Get stats after initial equipment
          const afterInitialEquipDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(afterInitialEquipDerivedStats).not.toBeNull();

          // Now perform the replacement operation
          // Create replacement equipment item
          const replacementItemId = `test_replacement_${replacementEquipment.slotType}_${Date.now()}_${Math.random()}`;
          const replacementItemData = {
            id: replacementItemId,
            name: `Replacement ${replacementEquipment.slotType}`,
            description: `Replacement equipment`,
            type: 'equipment' as const,
            subType: replacementEquipment.slotType,
            equipmentSlot: replacementEquipment.slotType,
            icon: 'test-icon.png',
            rarity: 1,
            stackSize: 1,
            mainStat: replacementEquipment.mainStat,
            subStats: replacementEquipment.subStats,
            canSell: true,
            sellPrice: 100,
            canBuy: true,
            buyPrice: 200,
            canCraft: false,
            craftRecipe: null,
            canUse: false
          };

          // Register and add to inventory
          itemSystem.registerItem(replacementItemData);
          itemSystem.addItem(replacementItemId, 1);

          // Get instance
          const replacementInstances = itemSystem.getAllItemInstances();
          const replacementInstance = replacementInstances.find(inst => inst.itemId === replacementItemId);
          expect(replacementInstance).toBeDefined();
          if (!replacementInstance || !replacementInstance.instanceId) return;

          // Equip the replacement item (this will replace any existing item in the slot)
          const replaceSuccess = equipmentSystem.equipItem(
            characterId,
            replacementInstance.instanceId,
            replacementEquipment.slotType as any
          );
          expect(replaceSuccess).toBe(true);

          // Calculate bonuses for replacement item
          const replacementBonuses = new Map<string, number>();
          replacementBonuses.set(replacementEquipment.mainStat.attribute, replacementEquipment.mainStat.value);
          for (const subStat of replacementEquipment.subStats) {
            const current = replacementBonuses.get(subStat.attribute) || 0;
            replacementBonuses.set(subStat.attribute, current + subStat.value);
          }

          // Update the slot map with replacement item (removing old item from this slot)
          equippedBySlot.set(replacementEquipment.slotType, {
            instanceId: replacementInstance.instanceId,
            itemId: replacementItemId,
            bonuses: replacementBonuses
          });

          // Update system to apply replacement
          attributeSystem.update(0);

          // Get final derived stats after replacement
          const finalDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(finalDerivedStats).not.toBeNull();

          // Calculate expected total bonuses from all currently equipped items
          // (including the replacement item, excluding the replaced item)
          const expectedTotalBonuses = new Map<string, number>();
          for (const { bonuses } of equippedBySlot.values()) {
            for (const [attribute, bonus] of bonuses.entries()) {
              const current = expectedTotalBonuses.get(attribute) || 0;
              expectedTotalBonuses.set(attribute, current + bonus);
            }
          }

          // Verify that final attributes equal base + bonuses from all currently equipped items
          const allAttributes: Array<keyof DerivedStatsComponent> = [
            'attack', 'defense', 'moveSpeed', 'dodgeRate', 'critRate',
            'critDamage', 'magicPower', 'resistance', 'carryWeight',
            'hitRate', 'expRate', 'healthRegen', 'manaRegen'
          ];

          for (const attr of allAttributes) {
            const baseValue = baselineStats[attr] as number;
            const finalValue = finalDerivedStats![attr] as number;
            const expectedBonus = expectedTotalBonuses.get(attr as string) || 0;
            const expectedFinalValue = baseValue + expectedBonus;

            // The final value should equal base + total expected bonus
            // (allowing for small floating point differences)
            expect(Math.abs(finalValue - expectedFinalValue)).toBeLessThan(0.01);
          }

          // Verify that the replacement item is in the slot
          const equipmentSlots = componentManager.getComponent(characterId, EquipmentSlotsComponentType);
          expect(equipmentSlots).not.toBeNull();
          expect(equipmentSlots![replacementEquipment.slotType as keyof EquipmentSlotsComponent]).toBe(
            replacementInstance.instanceId as unknown as any
          );

          // Verify that bonuses from the replaced item are NOT present
          // (unless the replacement item has the same bonuses)
          // This is implicitly verified by the exact match above, but we can add explicit checks

          // Count how many slots are occupied
          let occupiedSlots = 0;
          if (equipmentSlots!.weapon !== null) occupiedSlots++;
          if (equipmentSlots!.armor !== null) occupiedSlots++;
          if (equipmentSlots!.offhand !== null) occupiedSlots++;
          if (equipmentSlots!.accessory !== null) occupiedSlots++;

          // Verify the number of occupied slots matches our tracking
          expect(occupiedSlots).toBe(equippedBySlot.size);

          // Verify each occupied slot has the correct item
          for (const [slotType, { instanceId }] of equippedBySlot.entries()) {
            const slotValue = equipmentSlots![slotType as keyof EquipmentSlotsComponent];
            expect(slotValue).toBe(instanceId as unknown as any);
          }

          // Additional verification: Check that attributes are calculated correctly
          // by comparing with manual calculation
          for (const [attribute, expectedBonus] of expectedTotalBonuses.entries()) {
            const baseValue = baselineStats[attribute as keyof DerivedStatsComponent] as number;
            const finalValue = finalDerivedStats![attribute as keyof DerivedStatsComponent] as number;

            // Manual calculation
            const manualCalculation = baseValue + expectedBonus;

            // Verify manual calculation matches final value
            expect(Math.abs(finalValue - manualCalculation)).toBeLessThan(0.01);

            // Verify the bonus was actually applied if it's non-zero
            if (expectedBonus > 0) {
              expect(finalValue).toBeGreaterThan(baseValue);
            }
          }

          // Verify attributes without bonuses remain at baseline
          for (const attr of allAttributes) {
            const expectedBonus = expectedTotalBonuses.get(attr as string) || 0;
            if (expectedBonus === 0) {
              const baseValue = baselineStats[attr] as number;
              const finalValue = finalDerivedStats![attr] as number;
              expect(finalValue).toBe(baseValue);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Verify replacement in specific slot doesn't affect other slots
   */
  it('should not affect other slots when replacing equipment in one slot', () => {
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
          value: fc.integer({ min: 10, max: 30 })
        }),
        fc.record({
          attribute: fc.constantFrom('moveSpeed', 'dodgeRate', 'resistance'),
          value: fc.integer({ min: 5, max: 20 })
        }),
        fc.record({
          attribute: fc.constantFrom('attack', 'critRate', 'hitRate'),
          value: fc.integer({ min: 15, max: 40 })
        }),
        (baseAttributes, weaponAffix, armorAffix, replacementWeaponAffix) => {
          // Create a character
          const characterId = createTestCharacter(baseAttributes);

          // Update system to get baseline
          attributeSystem.update(0);

          const baselineDerivedStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(baselineDerivedStats).not.toBeNull();

          const baselineStats = { ...baselineDerivedStats! };

          // Create and equip weapon
          const weaponId = `test_weapon_${Date.now()}_${Math.random()}`;
          const weaponData = {
            id: weaponId,
            name: 'Test Weapon',
            description: 'Test',
            type: 'equipment' as const,
            subType: 'weapon',
            equipmentSlot: 'weapon',
            icon: 'test.png',
            rarity: 1,
            stackSize: 1,
            mainStat: {
              attribute: weaponAffix.attribute,
              value: weaponAffix.value,
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

          itemSystem.registerItem(weaponData);
          itemSystem.addItem(weaponId, 1);

          const weaponInstances = itemSystem.getAllItemInstances();
          const weaponInstance = weaponInstances.find(inst => inst.itemId === weaponId);
          expect(weaponInstance).toBeDefined();
          if (!weaponInstance || !weaponInstance.instanceId) return;

          equipmentSystem.equipItem(characterId, weaponInstance.instanceId, 'weapon');

          // Create and equip armor
          const armorId = `test_armor_${Date.now()}_${Math.random()}`;
          const armorData = {
            id: armorId,
            name: 'Test Armor',
            description: 'Test',
            type: 'equipment' as const,
            subType: 'armor',
            equipmentSlot: 'armor',
            icon: 'test.png',
            rarity: 1,
            stackSize: 1,
            mainStat: {
              attribute: armorAffix.attribute,
              value: armorAffix.value,
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

          itemSystem.registerItem(armorData);
          itemSystem.addItem(armorId, 1);

          const armorInstances = itemSystem.getAllItemInstances();
          const armorInstance = armorInstances.find(inst => inst.itemId === armorId);
          expect(armorInstance).toBeDefined();
          if (!armorInstance || !armorInstance.instanceId) return;

          equipmentSystem.equipItem(characterId, armorInstance.instanceId, 'armor');

          // Update to apply both items
          attributeSystem.update(0);

          // Get stats with both items equipped
          const statsWithBothItems = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(statsWithBothItems).not.toBeNull();

          // Now replace the weapon
          const replacementWeaponId = `test_replacement_weapon_${Date.now()}_${Math.random()}`;
          const replacementWeaponData = {
            id: replacementWeaponId,
            name: 'Replacement Weapon',
            description: 'Test',
            type: 'equipment' as const,
            subType: 'weapon',
            equipmentSlot: 'weapon',
            icon: 'test.png',
            rarity: 1,
            stackSize: 1,
            mainStat: {
              attribute: replacementWeaponAffix.attribute,
              value: replacementWeaponAffix.value,
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

          itemSystem.registerItem(replacementWeaponData);
          itemSystem.addItem(replacementWeaponId, 1);

          const replacementWeaponInstances = itemSystem.getAllItemInstances();
          const replacementWeaponInstance = replacementWeaponInstances.find(inst => inst.itemId === replacementWeaponId);
          expect(replacementWeaponInstance).toBeDefined();
          if (!replacementWeaponInstance || !replacementWeaponInstance.instanceId) return;

          equipmentSystem.equipItem(characterId, replacementWeaponInstance.instanceId, 'weapon');

          // Update to apply replacement
          attributeSystem.update(0);

          // Get final stats
          const finalStats = componentManager.getComponent(characterId, DerivedStatsComponentType);
          expect(finalStats).not.toBeNull();

          // Calculate expected final stats
          // Base + armor bonus + replacement weapon bonus
          const expectedStats = { ...baselineStats };
          
          // Add armor bonus
          const armorAttribute = armorAffix.attribute as keyof DerivedStatsComponent;
          expectedStats[armorAttribute] = (expectedStats[armorAttribute] as number) + armorAffix.value;

          // Add replacement weapon bonus
          const replacementWeaponAttribute = replacementWeaponAffix.attribute as keyof DerivedStatsComponent;
          expectedStats[replacementWeaponAttribute] = (expectedStats[replacementWeaponAttribute] as number) + replacementWeaponAffix.value;

          // Verify final stats match expected
          const allAttributes: Array<keyof DerivedStatsComponent> = [
            'attack', 'defense', 'moveSpeed', 'dodgeRate', 'critRate',
            'critDamage', 'magicPower', 'resistance', 'carryWeight',
            'hitRate', 'expRate', 'healthRegen', 'manaRegen'
          ];

          for (const attr of allAttributes) {
            const expectedValue = expectedStats[attr] as number;
            const actualValue = finalStats![attr] as number;
            expect(Math.abs(actualValue - expectedValue)).toBeLessThan(0.01);
          }

          // Verify armor is still equipped
          const equipmentSlots = componentManager.getComponent(characterId, EquipmentSlotsComponentType);
          expect(equipmentSlots).not.toBeNull();
          expect(equipmentSlots!.armor).toBe(armorInstance.instanceId as unknown as any);
          expect(equipmentSlots!.weapon).toBe(replacementWeaponInstance.instanceId as unknown as any);
        }
      ),
      { numRuns: 100 }
    );
  });
});
