/**
 * Equipment System - Equipped Status Tests
 * Tests for equipment "equipped" status tracking to prevent multiple characters from equipping the same item
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../ecs/World';
import { EquipmentSystem } from './EquipmentSystem';
import { ItemSystem } from './ItemSystem';
import { EntityId } from '../../ecs/Entity';
import { EquipmentSlotsComponent, EquipmentSlotsComponentType } from '../components/SystemComponents';

describe('EquipmentSystem - Equipped Status', () => {
  let world: World;
  let equipmentSystem: EquipmentSystem;
  let itemSystem: ItemSystem;
  let character1Id: EntityId;
  let character2Id: EntityId;

  beforeEach(() => {
    world = new World();
    itemSystem = new ItemSystem(world);
    equipmentSystem = new EquipmentSystem(world, itemSystem);
    
    world.addSystem(itemSystem);
    world.addSystem(equipmentSystem);
    world.initialize();

    // Create two test characters with equipment slots
    const character1 = world.entityManager.createEntity();
    character1.addComponent(EquipmentSlotsComponentType, {
      weapon: null,
      armor: null,
      offhand: null,
      accessory: null
    } as EquipmentSlotsComponent);
    character1Id = character1.id;

    const character2 = world.entityManager.createEntity();
    character2.addComponent(EquipmentSlotsComponentType, {
      weapon: null,
      armor: null,
      offhand: null,
      accessory: null
    } as EquipmentSlotsComponent);
    character2Id = character2.id;

    // Add a test weapon to inventory
    itemSystem.addItem('rusty_iron_sword', 1);
  });

  describe('Equipment Status Tracking', () => {
    it('should track when an item is equipped', () => {
      const weaponInstances = itemSystem.getItemInstances('rusty_iron_sword');
      const weaponInstance = weaponInstances[0];

      if (weaponInstance && weaponInstance.instanceId) {
        // Equip weapon to character 1
        const success = equipmentSystem.equipItem(character1Id, weaponInstance.instanceId, 'weapon');
        expect(success).toBe(true);

        // Check if item is marked as equipped
        expect(equipmentSystem.isItemEquipped(weaponInstance.instanceId)).toBe(true);
        expect(equipmentSystem.getEquippedByCharacter(weaponInstance.instanceId)).toBe(character1Id);
      }
    });

    it('should prevent another character from equipping an already equipped item', () => {
      const weaponInstances = itemSystem.getItemInstances('rusty_iron_sword');
      const weaponInstance = weaponInstances[0];

      if (weaponInstance && weaponInstance.instanceId) {
        // Equip weapon to character 1
        equipmentSystem.equipItem(character1Id, weaponInstance.instanceId, 'weapon');

        // Try to equip the same weapon to character 2
        const canEquip = equipmentSystem.canEquipItem(character2Id, weaponInstance.instanceId, 'weapon');
        expect(canEquip).toBe(false);

        const success = equipmentSystem.equipItem(character2Id, weaponInstance.instanceId, 'weapon');
        expect(success).toBe(false);

        // Verify weapon is still equipped by character 1
        expect(equipmentSystem.getEquippedByCharacter(weaponInstance.instanceId)).toBe(character1Id);
      }
    });

    it('should allow re-equipping to the same character', () => {
      const weaponInstances = itemSystem.getItemInstances('rusty_iron_sword');
      const weaponInstance = weaponInstances[0];

      if (weaponInstance && weaponInstance.instanceId) {
        // Equip weapon to character 1
        equipmentSystem.equipItem(character1Id, weaponInstance.instanceId, 'weapon');

        // Unequip the weapon
        equipmentSystem.unequipItem(character1Id, 'weapon');

        // Re-equip to the same character should work
        const canEquip = equipmentSystem.canEquipItem(character1Id, weaponInstance.instanceId, 'weapon');
        expect(canEquip).toBe(true);

        const success = equipmentSystem.equipItem(character1Id, weaponInstance.instanceId, 'weapon');
        expect(success).toBe(true);
      }
    });

    it('should clear equipped status when item is unequipped', () => {
      const weaponInstances = itemSystem.getItemInstances('rusty_iron_sword');
      const weaponInstance = weaponInstances[0];

      if (weaponInstance && weaponInstance.instanceId) {
        // Equip weapon to character 1
        equipmentSystem.equipItem(character1Id, weaponInstance.instanceId, 'weapon');
        expect(equipmentSystem.isItemEquipped(weaponInstance.instanceId)).toBe(true);

        // Unequip the weapon
        equipmentSystem.unequipItem(character1Id, 'weapon');

        // Check if item is no longer marked as equipped
        expect(equipmentSystem.isItemEquipped(weaponInstance.instanceId)).toBe(false);
        expect(equipmentSystem.getEquippedByCharacter(weaponInstance.instanceId)).toBeUndefined();
      }
    });

    it('should allow another character to equip after first character unequips', () => {
      const weaponInstances = itemSystem.getItemInstances('rusty_iron_sword');
      const weaponInstance = weaponInstances[0];

      if (weaponInstance && weaponInstance.instanceId) {
        // Equip weapon to character 1
        equipmentSystem.equipItem(character1Id, weaponInstance.instanceId, 'weapon');

        // Unequip from character 1
        equipmentSystem.unequipItem(character1Id, 'weapon');

        // Now character 2 should be able to equip it
        const canEquip = equipmentSystem.canEquipItem(character2Id, weaponInstance.instanceId, 'weapon');
        expect(canEquip).toBe(true);

        const success = equipmentSystem.equipItem(character2Id, weaponInstance.instanceId, 'weapon');
        expect(success).toBe(true);

        // Verify weapon is now equipped by character 2
        expect(equipmentSystem.getEquippedByCharacter(weaponInstance.instanceId)).toBe(character2Id);
      }
    });

    it('should handle replacing equipment correctly', () => {
      // Add two weapons
      itemSystem.addItem('rusty_iron_sword', 1);
      const weaponInstances = itemSystem.getItemInstances('rusty_iron_sword');
      
      if (weaponInstances.length >= 2) {
        const weapon1 = weaponInstances[0];
        const weapon2 = weaponInstances[1];

        if (weapon1.instanceId && weapon2.instanceId) {
          // Equip first weapon to character 1
          equipmentSystem.equipItem(character1Id, weapon1.instanceId, 'weapon');
          expect(equipmentSystem.isItemEquipped(weapon1.instanceId)).toBe(true);

          // Equip second weapon to character 1 (should replace first)
          equipmentSystem.equipItem(character1Id, weapon2.instanceId, 'weapon');

          // First weapon should no longer be equipped
          expect(equipmentSystem.isItemEquipped(weapon1.instanceId)).toBe(false);
          expect(equipmentSystem.getEquippedByCharacter(weapon1.instanceId)).toBeUndefined();

          // Second weapon should be equipped
          expect(equipmentSystem.isItemEquipped(weapon2.instanceId)).toBe(true);
          expect(equipmentSystem.getEquippedByCharacter(weapon2.instanceId)).toBe(character1Id);

          // Now character 2 should be able to equip the first weapon
          const canEquip = equipmentSystem.canEquipItem(character2Id, weapon1.instanceId, 'weapon');
          expect(canEquip).toBe(true);
        }
      }
    });
  });
});
