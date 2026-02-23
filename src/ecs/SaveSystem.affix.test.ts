/**
 * Property-based tests for SaveSystem affix serialization
 * **Feature: equipment-affix-system, Property 12: Affix serialization round-trip**
 * **Validates: Requirements 6.1, 6.2, 6.4**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { World } from './World';
import { SaveSystem } from './SaveSystem';
import { Entity } from './Entity';
import { Component, createComponentType } from './Component';
import { RarityType } from '../game/types/RarityTypes';
import { AffixType, AppliedAffix } from '../game/types/AffixTypes';
import { EquipmentComponent, ItemComponent, AttributeModifier, EquipmentRequirement } from '../game/components/ItemComponents';
import { EquipmentSlot, ItemType } from '../game/types/GameTypes';

// Create component types
const ItemComponentType = createComponentType<ItemComponent>('item');
const EquipmentComponentType = createComponentType<EquipmentComponent>('equipment');

describe('SaveSystem Affix Serialization Property Tests', () => {
  beforeEach(() => {
    Entity.resetIdCounter();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  /**
   * Property 12: Affix serialization round-trip
   * For any equipment with an affix, serializing then deserializing the equipment 
   * must produce an equivalent affix (same type, rarity, and value)
   * **Validates: Requirements 6.1, 6.2, 6.4**
   */
  describe('Property 12: Affix serialization round-trip', () => {
    // Generator for AppliedAffix
    const appliedAffixGenerator = fc.record({
      type: fc.constantFrom(
        AffixType.Strength,
        AffixType.Agility,
        AffixType.Wisdom,
        AffixType.Skill,
        AffixType.Attack,
        AffixType.Defense,
        AffixType.CritRate,
        AffixType.CritDamage,
        AffixType.DodgeRate,
        AffixType.MoveSpeed,
        AffixType.MagicPower,
        AffixType.CarryWeight,
        AffixType.Resistance,
        AffixType.ExperienceRate,
        AffixType.HPRegen,
        AffixType.MPRegen,
        AffixType.BodyWeight,
        AffixType.BodySize
      ),
      rarity: fc.constantFrom(
        RarityType.Common,
        RarityType.Rare,
        RarityType.Epic,
        RarityType.Legendary
      ),
      displayName: fc.string({ minLength: 1, maxLength: 20 }),
      value: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
      isPercentage: fc.boolean()
    });

    // Generator for AttributeModifier
    const attributeModifierGenerator = fc.record({
      attribute: fc.constantFrom('strength', 'agility', 'attack', 'defense'),
      value: fc.integer({ min: 1, max: 50 }),
      type: fc.constantFrom('flat' as const, 'percentage' as const)
    });

    // Generator for EquipmentRequirement
    const equipmentRequirementGenerator = fc.record({
      type: fc.constantFrom('level' as const, 'attribute' as const),
      value: fc.oneof(fc.integer({ min: 1, max: 50 }), fc.constant('strength')),
      minimum: fc.integer({ min: 1, max: 50 })
    });

    it('**Validates: Requirements 6.1, 6.2, 6.4** - Affix data persists through save/load cycle', () => {
      fc.assert(
        fc.property(
          appliedAffixGenerator,
          fc.array(attributeModifierGenerator, { minLength: 0, maxLength: 3 }),
          fc.array(equipmentRequirementGenerator, { minLength: 0, maxLength: 2 }),
          fc.integer({ min: 50, max: 100 }),
          (affix, modifiers, requirements, durability) => {
            // Create world with equipment entity
            const world = new World();
            const entity = world.createEntity();

            // Create item component
            const itemComponent: ItemComponent = {
              type: 'item' as const,
              id: `item_${entity.id}`,
              name: 'Test Equipment',
              description: 'Test equipment with affix',
              rarity: affix.rarity,
              itemType: ItemType.Equipment,
              stackSize: 1,
              value: 100,
              quality: 50
            };
            world.addComponent(entity.id, ItemComponentType, itemComponent);

            // Create equipment component with affix
            const equipmentComponent: EquipmentComponent = {
              type: 'equipment' as const,
              slot: EquipmentSlot.Weapon,
              attributeModifiers: modifiers,
              requirements: requirements,
              durability: durability,
              maxDurability: 100,
              affix: affix
            };
            world.addComponent(entity.id, EquipmentComponentType, equipmentComponent);

            // Serialize the world
            const serialized = SaveSystem.serialize(world);

            // Deserialize to a new world
            const restoredWorld = SaveSystem.deserialize(serialized);

            // Verify entity exists
            const restoredEntity = restoredWorld.getEntity(entity.id);
            expect(restoredEntity).not.toBeNull();

            // Get the restored equipment component
            const restoredEquipment = restoredWorld.getComponent(
              entity.id,
              EquipmentComponentType
            );

            // Verify equipment component exists
            expect(restoredEquipment).not.toBeNull();

            // Verify affix exists
            expect(restoredEquipment?.affix).toBeDefined();

            if (restoredEquipment?.affix) {
              // Verify affix type matches
              expect(restoredEquipment.affix.type).toBe(affix.type);

              // Verify affix rarity matches
              expect(restoredEquipment.affix.rarity).toBe(affix.rarity);

              // Verify affix display name matches
              expect(restoredEquipment.affix.displayName).toBe(affix.displayName);

              // Verify affix value matches (with floating point tolerance)
              expect(restoredEquipment.affix.value).toBeCloseTo(affix.value, 5);

              // Verify isPercentage flag matches
              expect(restoredEquipment.affix.isPercentage).toBe(affix.isPercentage);
            }

            // Verify other equipment properties are preserved
            expect(restoredEquipment?.slot).toBe(equipmentComponent.slot);
            expect(restoredEquipment?.durability).toBe(equipmentComponent.durability);
            expect(restoredEquipment?.maxDurability).toBe(equipmentComponent.maxDurability);
            expect(restoredEquipment?.attributeModifiers.length).toBe(modifiers.length);
            expect(restoredEquipment?.requirements.length).toBe(requirements.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('**Validates: Requirements 6.1, 6.2, 6.4** - Multiple equipment items with different affixes', () => {
      fc.assert(
        fc.property(
          fc.array(appliedAffixGenerator, { minLength: 1, maxLength: 5 }),
          (affixes) => {
            // Create world with multiple equipment entities
            const world = new World();
            const entities: Entity[] = [];

            for (let i = 0; i < affixes.length; i++) {
              const entity = world.createEntity();
              entities.push(entity);

              // Create item component
              const itemComponent: ItemComponent = {
                type: 'item' as const,
                id: `item_${entity.id}`,
                name: `Test Equipment ${i}`,
                description: `Test equipment ${i} with affix`,
                rarity: affixes[i].rarity,
                itemType: ItemType.Equipment,
                stackSize: 1,
                value: 100,
                quality: 50
              };
              world.addComponent(entity.id, ItemComponentType, itemComponent);

              // Create equipment component with affix
              const equipmentComponent: EquipmentComponent = {
                type: 'equipment' as const,
                slot: EquipmentSlot.Weapon,
                attributeModifiers: [],
                requirements: [],
                durability: 100,
                maxDurability: 100,
                affix: affixes[i]
              };
              world.addComponent(entity.id, EquipmentComponentType, equipmentComponent);
            }

            // Serialize the world
            const serialized = SaveSystem.serialize(world);

            // Deserialize to a new world
            const restoredWorld = SaveSystem.deserialize(serialized);

            // Verify all equipment items and their affixes
            for (let i = 0; i < entities.length; i++) {
              const entity = entities[i];
              const originalAffix = affixes[i];

              const restoredEquipment = restoredWorld.getComponent(
                entity.id,
                EquipmentComponentType
              );

              expect(restoredEquipment).not.toBeNull();
              expect(restoredEquipment?.affix).toBeDefined();

              if (restoredEquipment?.affix) {
                expect(restoredEquipment.affix.type).toBe(originalAffix.type);
                expect(restoredEquipment.affix.rarity).toBe(originalAffix.rarity);
                expect(restoredEquipment.affix.displayName).toBe(originalAffix.displayName);
                expect(restoredEquipment.affix.value).toBeCloseTo(originalAffix.value, 5);
                expect(restoredEquipment.affix.isPercentage).toBe(originalAffix.isPercentage);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('**Validates: Requirements 6.1, 6.2, 6.4** - Equipment without affix remains without affix', () => {
      fc.assert(
        fc.property(
          fc.array(attributeModifierGenerator, { minLength: 0, maxLength: 3 }),
          (modifiers) => {
            // Create world with equipment entity without affix
            const world = new World();
            const entity = world.createEntity();

            // Create item component
            const itemComponent: ItemComponent = {
              type: 'item' as const,
              id: `item_${entity.id}`,
              name: 'Test Equipment',
              description: 'Test equipment without affix',
              rarity: RarityType.Common,
              itemType: ItemType.Equipment,
              stackSize: 1,
              value: 100,
              quality: 50
            };
            world.addComponent(entity.id, ItemComponentType, itemComponent);

            // Create equipment component WITHOUT affix
            const equipmentComponent: EquipmentComponent = {
              type: 'equipment' as const,
              slot: EquipmentSlot.Weapon,
              attributeModifiers: modifiers,
              requirements: [],
              durability: 100,
              maxDurability: 100
              // No affix field
            };
            world.addComponent(entity.id, EquipmentComponentType, equipmentComponent);

            // Serialize the world
            const serialized = SaveSystem.serialize(world);

            // Deserialize to a new world
            const restoredWorld = SaveSystem.deserialize(serialized);

            // Get the restored equipment component
            const restoredEquipment = restoredWorld.getComponent(
              entity.id,
              EquipmentComponentType
            );

            // Verify equipment component exists
            expect(restoredEquipment).not.toBeNull();

            // Verify affix is undefined or null (not present)
            expect(restoredEquipment?.affix).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('**Validates: Requirements 6.1, 6.2, 6.4** - LocalStorage round-trip preserves affixes', () => {
      fc.assert(
        fc.property(
          appliedAffixGenerator,
          fc.boolean(),
          (affix, useCompression) => {
            // Create world with equipment entity
            const world = new World();
            const entity = world.createEntity();

            // Create item component
            const itemComponent: ItemComponent = {
              type: 'item' as const,
              id: `item_${entity.id}`,
              name: 'Test Equipment',
              description: 'Test equipment with affix',
              rarity: affix.rarity,
              itemType: ItemType.Equipment,
              stackSize: 1,
              value: 100,
              quality: 50
            };
            world.addComponent(entity.id, ItemComponentType, itemComponent);

            // Create equipment component with affix
            const equipmentComponent: EquipmentComponent = {
              type: 'equipment' as const,
              slot: EquipmentSlot.Weapon,
              attributeModifiers: [],
              requirements: [],
              durability: 100,
              maxDurability: 100,
              affix: affix
            };
            world.addComponent(entity.id, EquipmentComponentType, equipmentComponent);

            // Save to localStorage
            const saveKey = `affix_test_${Date.now()}_${Math.random()}`;
            const saveSuccess = SaveSystem.saveToLocalStorage(world, saveKey, {
              compress: useCompression
            });
            expect(saveSuccess).toBe(true);

            // Load from localStorage
            const restoredWorld = SaveSystem.loadFromLocalStorage(saveKey);
            expect(restoredWorld).not.toBeNull();

            if (restoredWorld) {
              // Get the restored equipment component
              const restoredEquipment = restoredWorld.getComponent(
                entity.id,
                EquipmentComponentType
              );

              // Verify affix is preserved
              expect(restoredEquipment?.affix).toBeDefined();

              if (restoredEquipment?.affix) {
                expect(restoredEquipment.affix.type).toBe(affix.type);
                expect(restoredEquipment.affix.rarity).toBe(affix.rarity);
                expect(restoredEquipment.affix.displayName).toBe(affix.displayName);
                expect(restoredEquipment.affix.value).toBeCloseTo(affix.value, 5);
                expect(restoredEquipment.affix.isPercentage).toBe(affix.isPercentage);
              }
            }

            // Clean up
            SaveSystem.deleteSave(saveKey);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Unit tests for invalid affix data handling
   * **Validates: Requirement 6.3**
   */
  describe('Invalid Affix Data Handling', () => {
    it('should load equipment without affix when save data is corrupted (missing required fields)', () => {
      // Create world with equipment entity
      const world = new World();
      const entity = world.createEntity();

      // Create item component
      const itemComponent: ItemComponent = {
        type: 'item' as const,
        id: `item_${entity.id}`,
        name: 'Test Equipment',
        description: 'Test equipment with corrupted affix',
        rarity: RarityType.Rare,
        itemType: ItemType.Equipment,
        stackSize: 1,
        value: 100,
        quality: 50
      };
      world.addComponent(entity.id, ItemComponentType, itemComponent);

      // Create equipment component with valid affix
      const validAffix: AppliedAffix = {
        type: AffixType.Strength,
        rarity: RarityType.Rare,
        displayName: 'Rare Strength',
        value: 10,
        isPercentage: false
      };
      const equipmentComponent: EquipmentComponent = {
        type: 'equipment' as const,
        slot: EquipmentSlot.Weapon,
        attributeModifiers: [],
        requirements: [],
        durability: 100,
        maxDurability: 100,
        affix: validAffix
      };
      world.addComponent(entity.id, EquipmentComponentType, equipmentComponent);

      // Serialize the world
      const serialized = SaveSystem.serialize(world);

      // Corrupt the affix data by removing required fields
      const corruptedSerialized = JSON.parse(JSON.stringify(serialized));
      const equipmentEntity = corruptedSerialized.entities.find((e: any) => 
        e.components.some((c: any) => c.type === 'equipment')
      );
      const equipmentComp = equipmentEntity.components.find((c: any) => c.type === 'equipment');
      
      // Remove required field 'type' to corrupt the affix
      delete equipmentComp.data.affix.type;

      // Deserialize with corrupted data
      const restoredWorld = SaveSystem.deserialize(corruptedSerialized);

      // Verify entity exists
      const restoredEntity = restoredWorld.getEntity(entity.id);
      expect(restoredEntity).not.toBeNull();

      // Get the restored equipment component
      const restoredEquipment = restoredWorld.getComponent(
        entity.id,
        EquipmentComponentType
      );

      // Verify equipment component exists
      expect(restoredEquipment).not.toBeNull();

      // Verify equipment loads without affix (affix should be undefined)
      expect(restoredEquipment?.affix).toBeUndefined();

      // Verify other equipment properties are preserved
      expect(restoredEquipment?.slot).toBe(equipmentComponent.slot);
      expect(restoredEquipment?.durability).toBe(equipmentComponent.durability);
      expect(restoredEquipment?.maxDurability).toBe(equipmentComponent.maxDurability);
    });

    it('should load equipment without affix when save data has invalid rarity value', () => {
      // Create world with equipment entity
      const world = new World();
      const entity = world.createEntity();

      // Create item component
      const itemComponent: ItemComponent = {
        type: 'item' as const,
        id: `item_${entity.id}`,
        name: 'Test Equipment',
        description: 'Test equipment with invalid rarity',
        rarity: RarityType.Epic,
        itemType: ItemType.Equipment,
        stackSize: 1,
        value: 100,
        quality: 50
      };
      world.addComponent(entity.id, ItemComponentType, itemComponent);

      // Create equipment component with valid affix
      const validAffix: AppliedAffix = {
        type: AffixType.Attack,
        rarity: RarityType.Epic,
        displayName: 'Epic Attack',
        value: 15,
        isPercentage: false
      };
      const equipmentComponent: EquipmentComponent = {
        type: 'equipment' as const,
        slot: EquipmentSlot.Armor,
        attributeModifiers: [],
        requirements: [],
        durability: 100,
        maxDurability: 100,
        affix: validAffix
      };
      world.addComponent(entity.id, EquipmentComponentType, equipmentComponent);

      // Serialize the world
      const serialized = SaveSystem.serialize(world);

      // Corrupt the affix data with invalid rarity
      const corruptedSerialized = JSON.parse(JSON.stringify(serialized));
      const equipmentEntity = corruptedSerialized.entities.find((e: any) => 
        e.components.some((c: any) => c.type === 'equipment')
      );
      const equipmentComp = equipmentEntity.components.find((c: any) => c.type === 'equipment');
      
      // Set invalid rarity value (outside 0-3 range)
      equipmentComp.data.affix.rarity = 999;

      // Deserialize with corrupted data
      const restoredWorld = SaveSystem.deserialize(corruptedSerialized);

      // Get the restored equipment component
      const restoredEquipment = restoredWorld.getComponent(
        entity.id,
        EquipmentComponentType
      );

      // Verify equipment component exists
      expect(restoredEquipment).not.toBeNull();

      // Verify equipment loads without affix
      expect(restoredEquipment?.affix).toBeUndefined();
    });

    it('should load equipment without affix when save data has invalid value (NaN or Infinity)', () => {
      // Create world with equipment entity
      const world = new World();
      const entity = world.createEntity();

      // Create item component
      const itemComponent: ItemComponent = {
        type: 'item' as const,
        id: `item_${entity.id}`,
        name: 'Test Equipment',
        description: 'Test equipment with invalid value',
        rarity: RarityType.Legendary,
        itemType: ItemType.Equipment,
        stackSize: 1,
        value: 100,
        quality: 50
      };
      world.addComponent(entity.id, ItemComponentType, itemComponent);

      // Create equipment component with valid affix
      const validAffix: AppliedAffix = {
        type: AffixType.CritRate,
        rarity: RarityType.Legendary,
        displayName: 'Legendary Crit Rate',
        value: 16,
        isPercentage: true
      };
      const equipmentComponent: EquipmentComponent = {
        type: 'equipment' as const,
        slot: EquipmentSlot.Accessory,
        attributeModifiers: [],
        requirements: [],
        durability: 100,
        maxDurability: 100,
        affix: validAffix
      };
      world.addComponent(entity.id, EquipmentComponentType, equipmentComponent);

      // Serialize the world
      const serialized = SaveSystem.serialize(world);

      // Corrupt the affix data with invalid value
      const corruptedSerialized = JSON.parse(JSON.stringify(serialized));
      const equipmentEntity = corruptedSerialized.entities.find((e: any) => 
        e.components.some((c: any) => c.type === 'equipment')
      );
      const equipmentComp = equipmentEntity.components.find((c: any) => c.type === 'equipment');
      
      // Set invalid value (Infinity)
      equipmentComp.data.affix.value = Infinity;

      // Deserialize with corrupted data
      const restoredWorld = SaveSystem.deserialize(corruptedSerialized);

      // Get the restored equipment component
      const restoredEquipment = restoredWorld.getComponent(
        entity.id,
        EquipmentComponentType
      );

      // Verify equipment component exists
      expect(restoredEquipment).not.toBeNull();

      // Verify equipment loads without affix
      expect(restoredEquipment?.affix).toBeUndefined();
    });

    it('should load equipment without affix when affix data is null', () => {
      // Create world with equipment entity
      const world = new World();
      const entity = world.createEntity();

      // Create item component
      const itemComponent: ItemComponent = {
        type: 'item' as const,
        id: `item_${entity.id}`,
        name: 'Test Equipment',
        description: 'Test equipment with null affix',
        rarity: RarityType.Common,
        itemType: ItemType.Equipment,
        stackSize: 1,
        value: 100,
        quality: 50
      };
      world.addComponent(entity.id, ItemComponentType, itemComponent);

      // Create equipment component with valid affix
      const validAffix: AppliedAffix = {
        type: AffixType.Defense,
        rarity: RarityType.Common,
        displayName: 'Common Defense',
        value: 3,
        isPercentage: false
      };
      const equipmentComponent: EquipmentComponent = {
        type: 'equipment' as const,
        slot: EquipmentSlot.Armor,
        attributeModifiers: [],
        requirements: [],
        durability: 100,
        maxDurability: 100,
        affix: validAffix
      };
      world.addComponent(entity.id, EquipmentComponentType, equipmentComponent);

      // Serialize the world
      const serialized = SaveSystem.serialize(world);

      // Corrupt the affix data by setting it to null
      const corruptedSerialized = JSON.parse(JSON.stringify(serialized));
      const equipmentEntity = corruptedSerialized.entities.find((e: any) => 
        e.components.some((c: any) => c.type === 'equipment')
      );
      const equipmentComp = equipmentEntity.components.find((c: any) => c.type === 'equipment');
      
      // Set affix to null
      equipmentComp.data.affix = null;

      // Deserialize with corrupted data
      const restoredWorld = SaveSystem.deserialize(corruptedSerialized);

      // Get the restored equipment component
      const restoredEquipment = restoredWorld.getComponent(
        entity.id,
        EquipmentComponentType
      );

      // Verify equipment component exists
      expect(restoredEquipment).not.toBeNull();

      // Verify equipment loads without affix (null is acceptable as "no affix")
      expect(restoredEquipment?.affix == null).toBe(true);
    });

    it('should load equipment without affix when affix type field has wrong data type', () => {
      // Create world with equipment entity
      const world = new World();
      const entity = world.createEntity();

      // Create item component
      const itemComponent: ItemComponent = {
        type: 'item' as const,
        id: `item_${entity.id}`,
        name: 'Test Equipment',
        description: 'Test equipment with wrong type data',
        rarity: RarityType.Rare,
        itemType: ItemType.Equipment,
        stackSize: 1,
        value: 100,
        quality: 50
      };
      world.addComponent(entity.id, ItemComponentType, itemComponent);

      // Create equipment component with valid affix
      const validAffix: AppliedAffix = {
        type: AffixType.MagicPower,
        rarity: RarityType.Rare,
        displayName: 'Rare Magic Power',
        value: 8,
        isPercentage: false
      };
      const equipmentComponent: EquipmentComponent = {
        type: 'equipment' as const,
        slot: EquipmentSlot.Weapon,
        attributeModifiers: [],
        requirements: [],
        durability: 100,
        maxDurability: 100,
        affix: validAffix
      };
      world.addComponent(entity.id, EquipmentComponentType, equipmentComponent);

      // Serialize the world
      const serialized = SaveSystem.serialize(world);

      // Corrupt the affix data with wrong type
      const corruptedSerialized = JSON.parse(JSON.stringify(serialized));
      const equipmentEntity = corruptedSerialized.entities.find((e: any) => 
        e.components.some((c: any) => c.type === 'equipment')
      );
      const equipmentComp = equipmentEntity.components.find((c: any) => c.type === 'equipment');
      
      // Set type to a number instead of string
      equipmentComp.data.affix.type = 12345;

      // Deserialize with corrupted data
      const restoredWorld = SaveSystem.deserialize(corruptedSerialized);

      // Get the restored equipment component
      const restoredEquipment = restoredWorld.getComponent(
        entity.id,
        EquipmentComponentType
      );

      // Verify equipment component exists
      expect(restoredEquipment).not.toBeNull();

      // Verify equipment loads without affix
      expect(restoredEquipment?.affix).toBeUndefined();
    });
  });
});
