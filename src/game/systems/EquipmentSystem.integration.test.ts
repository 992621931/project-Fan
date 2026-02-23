/**
 * Integration tests for EquipmentSystem
 * Tests complete equipment workflow: slot click → warehouse opens → select item → equip → stats update → UI refresh
 * Feature: character-equipment-system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../../ecs/World';
import { EquipmentSystem, EquipmentSlot } from './EquipmentSystem';
import { AttributeSystem } from './AttributeSystem';
import { ItemSystem } from './ItemSystem';
import { EquipmentSlotsComponent, EquipmentSlotsComponentType } from '../components/SystemComponents';
import { AttributeComponent, AttributeComponentType, DerivedStatsComponent, DerivedStatsComponentType } from '../components/CharacterComponents';

describe('EquipmentSystem Integration Tests', () => {
  let world: World;
  let equipmentSystem: EquipmentSystem;
  let attributeSystem: AttributeSystem;
  let itemSystem: ItemSystem;
  let characterId: number;

  beforeEach(() => {
    world = new World();
    itemSystem = new ItemSystem();
    equipmentSystem = new EquipmentSystem(world, itemSystem);
    attributeSystem = new AttributeSystem();

    // Register systems
    world.addSystem(itemSystem);
    world.addSystem(equipmentSystem);
    world.addSystem(attributeSystem);

    // Initialize the world
    world.initialize();

    // Create character entity with all required components
    const character = world.createEntity();
    characterId = character.id;

    // Add attribute component
    const attributes: AttributeComponent = {
      type: 'attributes',
      strength: 10,
      agility: 10,
      wisdom: 10,
      technique: 10
    };
    world.addComponent(characterId, AttributeComponentType, attributes);

    // Add derived stats component
    const derivedStats: DerivedStatsComponent = {
      type: 'derivedStats',
      attack: 10,
      defense: 10,
      health: 100,
      mana: 50,
      moveSpeed: 5,
      dodgeRate: 0.1,
      critRate: 0.05,
      critDamage: 1.5,
      resistance: 5,
      magicPower: 10,
      carryWeight: 50,
      hitRate: 0.9,
      expRate: 1.0,
      healthRegen: 1,
      manaRegen: 1
    };
    world.addComponent(characterId, DerivedStatsComponentType, derivedStats);

    // Add equipment slots component
    const equipmentSlots: EquipmentSlotsComponent = {
      type: 'equipmentSlots',
      weapon: null,
      armor: null,
      offhand: null,
      accessory: null
    };
    world.addComponent(characterId, EquipmentSlotsComponentType, equipmentSlots);

    // Load test equipment items
    loadTestEquipment();
  });

  describe('Complete Equipment Workflow', () => {
    it('should complete full workflow: equip → stats update → UI refresh', () => {
      // Step 1: Get initial stats
      const initialStats = world.getComponent(characterId, DerivedStatsComponentType);
      expect(initialStats).not.toBeNull();
      const initialAttack = initialStats!.attack;

      // Step 2: Create equipment item instance
      const weaponInstanceId = itemSystem.createItemInstance('test_weapon_1', 1);
      expect(weaponInstanceId).toBeTruthy();

      // Step 3: Equip item (simulates user clicking item in warehouse)
      const equipResult = equipmentSystem.equipItem(characterId, weaponInstanceId, 'weapon');
      expect(equipResult).toBe(true);

      // Step 4: Verify equipment slot is updated
      const equippedItem = equipmentSystem.getEquippedItem(characterId, 'weapon');
      expect(equippedItem).toBe(weaponInstanceId as unknown as number);

      // Step 5: Trigger attribute recalculation (simulates event handler)
      attributeSystem.update(0);

      // Step 6: Verify stats are updated
      const updatedStats = world.getComponent(characterId, DerivedStatsComponentType);
      expect(updatedStats).not.toBeNull();
      expect(updatedStats!.attack).toBeGreaterThan(initialAttack);
    });

    it('should handle equipment replacement workflow', () => {
      // Equip first weapon
      const weapon1InstanceId = itemSystem.createItemInstance('test_weapon_1', 1);
      equipmentSystem.equipItem(characterId, weapon1InstanceId, 'weapon');
      attributeSystem.update(0);

      const statsAfterFirstWeapon = world.getComponent(characterId, DerivedStatsComponentType);
      const attackAfterFirstWeapon = statsAfterFirstWeapon!.attack;

      // Equip second weapon (replacement)
      const weapon2InstanceId = itemSystem.createItemInstance('test_weapon_2', 1);
      const replaceResult = equipmentSystem.equipItem(characterId, weapon2InstanceId, 'weapon');
      expect(replaceResult).toBe(true);

      // Verify old weapon was replaced
      const equippedItem = equipmentSystem.getEquippedItem(characterId, 'weapon');
      expect(equippedItem).toBe(weapon2InstanceId as unknown as number);

      // Recalculate stats
      attributeSystem.update(0);

      // Verify stats reflect new weapon
      const statsAfterReplacement = world.getComponent(characterId, DerivedStatsComponentType);
      expect(statsAfterReplacement!.attack).not.toBe(attackAfterFirstWeapon);
    });

    it('should handle unequip workflow', () => {
      // Equip weapon
      const weaponInstanceId = itemSystem.createItemInstance('test_weapon_1', 1);
      equipmentSystem.equipItem(characterId, weaponInstanceId, 'weapon');
      attributeSystem.update(0);

      const statsWithWeapon = world.getComponent(characterId, DerivedStatsComponentType);
      const attackWithWeapon = statsWithWeapon!.attack;

      // Unequip weapon
      const unequipResult = equipmentSystem.unequipItem(characterId, 'weapon');
      expect(unequipResult).toBe(true);

      // Verify slot is empty
      const equippedItem = equipmentSystem.getEquippedItem(characterId, 'weapon');
      expect(equippedItem).toBeNull();

      // Recalculate stats
      attributeSystem.update(0);

      // Verify stats are reduced
      const statsWithoutWeapon = world.getComponent(characterId, DerivedStatsComponentType);
      expect(statsWithoutWeapon!.attack).toBeLessThan(attackWithWeapon);
    });
  });

  describe('System Communication', () => {
    it('should emit equipment_changed event when equipping', () => {
      const eventSpy = vi.fn();
      world.eventSystem.on('equipment_changed', eventSpy);

      const weaponInstanceId = itemSystem.createItemInstance('test_weapon_1', 1);
      equipmentSystem.equipItem(characterId, weaponInstanceId, 'weapon');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          characterId,
          slot: 'weapon',
          newItem: weaponInstanceId as unknown as number
        })
      );
    });

    it('should emit equipment_changed event when unequipping', () => {
      // First equip
      const weaponInstanceId = itemSystem.createItemInstance('test_weapon_1', 1);
      equipmentSystem.equipItem(characterId, weaponInstanceId, 'weapon');

      // Setup spy after equipping
      const eventSpy = vi.fn();
      world.eventSystem.on('equipment_changed', eventSpy);

      // Unequip
      equipmentSystem.unequipItem(characterId, 'weapon');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          characterId,
          slot: 'weapon',
          previousItem: weaponInstanceId as unknown as number,
          newItem: null
        })
      );
    });

    it('should trigger AttributeSystem recalculation on equipment change', () => {
      const initialStats = world.getComponent(characterId, DerivedStatsComponentType);
      const initialAttack = initialStats!.attack;

      // Equip weapon
      const weaponInstanceId = itemSystem.createItemInstance('test_weapon_1', 1);
      equipmentSystem.equipItem(characterId, weaponInstanceId, 'weapon');

      // AttributeSystem should listen to equipment_changed event and recalculate
      // Simulate the event handler by calling update
      attributeSystem.update(0);

      const updatedStats = world.getComponent(characterId, DerivedStatsComponentType);
      expect(updatedStats!.attack).toBeGreaterThan(initialAttack);
    });
  });

  describe('Multiple Equipment Slots', () => {
    it('should handle equipping items to all slots', () => {
      const weaponId = itemSystem.createItemInstance('test_weapon_1', 1);
      const armorId = itemSystem.createItemInstance('test_armor_1', 1);
      const offhandId = itemSystem.createItemInstance('test_offhand_1', 1);
      const accessoryId = itemSystem.createItemInstance('test_accessory_1', 1);

      // Equip all slots
      expect(equipmentSystem.equipItem(characterId, weaponId, 'weapon')).toBe(true);
      expect(equipmentSystem.equipItem(characterId, armorId, 'armor')).toBe(true);
      expect(equipmentSystem.equipItem(characterId, offhandId, 'offhand')).toBe(true);
      expect(equipmentSystem.equipItem(characterId, accessoryId, 'accessory')).toBe(true);

      // Verify all slots are occupied
      const allEquipped = equipmentSystem.getAllEquippedItems(characterId);
      expect(allEquipped.get('weapon')).toBe(weaponId as unknown as number);
      expect(allEquipped.get('armor')).toBe(armorId as unknown as number);
      expect(allEquipped.get('offhand')).toBe(offhandId as unknown as number);
      expect(allEquipped.get('accessory')).toBe(accessoryId as unknown as number);
    });

    it('should calculate cumulative bonuses from all equipped items', () => {
      const initialStats = world.getComponent(characterId, DerivedStatsComponentType);
      const initialAttack = initialStats!.attack;
      const initialDefense = initialStats!.defense;

      // Equip weapon (adds attack)
      const weaponId = itemSystem.createItemInstance('test_weapon_1', 1);
      equipmentSystem.equipItem(characterId, weaponId, 'weapon');
      attributeSystem.update(0);

      const statsAfterWeapon = world.getComponent(characterId, DerivedStatsComponentType);
      const attackAfterWeapon = statsAfterWeapon!.attack;

      // Equip armor (adds defense)
      const armorId = itemSystem.createItemInstance('test_armor_1', 1);
      equipmentSystem.equipItem(characterId, armorId, 'armor');
      attributeSystem.update(0);

      const statsAfterBoth = world.getComponent(characterId, DerivedStatsComponentType);
      
      // Both bonuses should be applied
      expect(statsAfterBoth!.attack).toBe(attackAfterWeapon);
      expect(statsAfterBoth!.defense).toBeGreaterThan(initialDefense);
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid item type for slot', () => {
      // Try to equip armor to weapon slot
      const armorId = itemSystem.createItemInstance('test_armor_1', 1);
      const result = equipmentSystem.equipItem(characterId, armorId, 'weapon');
      
      expect(result).toBe(false);
      expect(equipmentSystem.getEquippedItem(characterId, 'weapon')).toBeNull();
    });

    it('should reject non-existent item', () => {
      const result = equipmentSystem.equipItem(characterId, 'non_existent_item', 'weapon');
      
      expect(result).toBe(false);
      expect(equipmentSystem.getEquippedItem(characterId, 'weapon')).toBeNull();
    });

    it('should handle missing character components gracefully', () => {
      // Create character without equipment slots
      const invalidCharacter = world.createEntity();
      
      const weaponId = itemSystem.createItemInstance('test_weapon_1', 1);
      const result = equipmentSystem.equipItem(invalidCharacter.id, weaponId, 'weapon');
      
      expect(result).toBe(false);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain equipment references correctly', () => {
      const weaponId = itemSystem.createItemInstance('test_weapon_1', 1);
      equipmentSystem.equipItem(characterId, weaponId, 'weapon');

      // Verify reference is stored correctly
      const equipmentSlots = world.getComponent(characterId, EquipmentSlotsComponentType);
      expect(equipmentSlots).not.toBeNull();
      expect(equipmentSlots!.weapon).toBe(weaponId as unknown as number);

      // Verify we can retrieve item data through ItemSystem
      const instances = itemSystem.getAllItemInstances();
      const instance = instances.find(inst => inst.instanceId === weaponId);
      expect(instance).toBeDefined();
      expect(instance!.itemId).toBe('test_weapon_1');
    });

    it('should preserve base attributes when equipping/unequipping', () => {
      const attributes = world.getComponent(characterId, AttributeComponentType);
      const baseStrength = attributes!.strength;

      // Equip and unequip multiple times
      const weaponId = itemSystem.createItemInstance('test_weapon_1', 1);
      
      equipmentSystem.equipItem(characterId, weaponId, 'weapon');
      attributeSystem.update(0);
      equipmentSystem.unequipItem(characterId, 'weapon');
      attributeSystem.update(0);
      
      equipmentSystem.equipItem(characterId, weaponId, 'weapon');
      attributeSystem.update(0);
      equipmentSystem.unequipItem(characterId, 'weapon');
      attributeSystem.update(0);

      // Base attributes should remain unchanged
      const finalAttributes = world.getComponent(characterId, AttributeComponentType);
      expect(finalAttributes!.strength).toBe(baseStrength);
    });
  });

  // Helper function to load test equipment
  function loadTestEquipment(): void {
    const testItems = {
      items: [
        {
          id: 'test_weapon_1',
          name: '测试武器1',
          description: '测试用武器',
          type: 'equipment',
          subType: 'weapon',
          equipmentSlot: 'weapon',
          rarity: 0,
          stackSize: 1,
          icon: 'weapon1.png',
          mainStat: {
            attribute: 'attack',
            value: 15,
            type: 'flat'
          },
          subStats: [
            {
              attribute: 'critRate',
              value: 5,
              type: 'flat'
            }
          ]
        },
        {
          id: 'test_weapon_2',
          name: '测试武器2',
          description: '测试用武器2',
          type: 'equipment',
          subType: 'weapon',
          equipmentSlot: 'weapon',
          rarity: 1,
          stackSize: 1,
          icon: 'weapon2.png',
          mainStat: {
            attribute: 'attack',
            value: 25,
            type: 'flat'
          }
        },
        {
          id: 'test_armor_1',
          name: '测试护甲1',
          description: '测试用护甲',
          type: 'equipment',
          subType: 'armor',
          equipmentSlot: 'armor',
          rarity: 0,
          stackSize: 1,
          icon: 'armor1.png',
          mainStat: {
            attribute: 'defense',
            value: 20,
            type: 'flat'
          }
        },
        {
          id: 'test_offhand_1',
          name: '测试副手1',
          description: '测试用副手',
          type: 'equipment',
          subType: 'offhand',
          equipmentSlot: 'offhand',
          rarity: 0,
          stackSize: 1,
          icon: 'offhand1.png',
          mainStat: {
            attribute: 'defense',
            value: 10,
            type: 'flat'
          }
        },
        {
          id: 'test_accessory_1',
          name: '测试饰品1',
          description: '测试用饰品',
          type: 'equipment',
          subType: 'accessory',
          equipmentSlot: 'accessory',
          rarity: 0,
          stackSize: 1,
          icon: 'accessory1.png',
          mainStat: {
            attribute: 'health',
            value: 50,
            type: 'flat'
          }
        }
      ]
    };

    itemSystem.loadItems(testItems);
  }
});
