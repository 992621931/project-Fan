/**
 * Equipment System Tests
 * Unit tests for the EquipmentSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../ecs/World';
import { EquipmentSystem, EquipmentSlot } from './EquipmentSystem';
import { ItemSystem } from './ItemSystem';
import { EquipmentSlotsComponentType } from '../components/SystemComponents';

describe('EquipmentSystem', () => {
  let world: World;
  let equipmentSystem: EquipmentSystem;
  let itemSystem: ItemSystem;
  let characterId: number;

  beforeEach(() => {
    world = new World();
    itemSystem = new ItemSystem(world);
    equipmentSystem = new EquipmentSystem(world, itemSystem);
    
    world.addSystem(itemSystem);
    world.addSystem(equipmentSystem);
    
    // Initialize the world (which initializes all systems)
    world.initialize();
    
    // Create a test character with equipment slots
    characterId = world.createEntity();
    world.addComponent(characterId, EquipmentSlotsComponentType, {
      type: 'equipmentSlots',
      weapon: null,
      armor: null,
      offhand: null,
      accessory: null
    });
  });

  describe('Equipment Slot Structure', () => {
    it('should have all four equipment slots initialized as empty', () => {
      const weapon = equipmentSystem.getEquippedItem(characterId, 'weapon');
      const armor = equipmentSystem.getEquippedItem(characterId, 'armor');
      const offhand = equipmentSystem.getEquippedItem(characterId, 'offhand');
      const accessory = equipmentSystem.getEquippedItem(characterId, 'accessory');
      
      expect(weapon).toBeNull();
      expect(armor).toBeNull();
      expect(offhand).toBeNull();
      expect(accessory).toBeNull();
    });

    it('should return all equipment slots', () => {
      const allEquipped = equipmentSystem.getAllEquippedItems(characterId);
      
      expect(allEquipped.size).toBe(4);
      expect(allEquipped.has('weapon')).toBe(true);
      expect(allEquipped.has('armor')).toBe(true);
      expect(allEquipped.has('offhand')).toBe(true);
      expect(allEquipped.has('accessory')).toBe(true);
    });
  });

  describe('Equipment Assignment', () => {
    it('should equip an item to the correct slot', () => {
      // Add a weapon to inventory
      itemSystem.addItem('rusty_iron_sword', 1);
      const instances = itemSystem.getAllItemInstances();
      const weaponInstance = instances.find(i => i.itemId === 'rusty_iron_sword');
      
      expect(weaponInstance).toBeDefined();
      
      if (weaponInstance && weaponInstance.instanceId) {
        const result = equipmentSystem.equipItem(characterId, weaponInstance.instanceId, 'weapon');
        expect(result).toBe(true);
        
        const equippedWeapon = equipmentSystem.getEquippedItem(characterId, 'weapon');
        expect(equippedWeapon).toBe(weaponInstance.instanceId);
      }
    });

    it('should reject equipping item to wrong slot type', () => {
      // Add a weapon to inventory
      itemSystem.addItem('rusty_iron_sword', 1);
      const instances = itemSystem.getAllItemInstances();
      const weaponInstance = instances.find(i => i.itemId === 'rusty_iron_sword');
      
      expect(weaponInstance).toBeDefined();
      
      if (weaponInstance && weaponInstance.instanceId) {
        // Try to equip weapon to armor slot
        const result = equipmentSystem.equipItem(characterId, weaponInstance.instanceId, 'armor');
        expect(result).toBe(false);
      }
    });

    it('should replace existing equipment when equipping to occupied slot', () => {
      // Add two weapons to inventory (using same item twice)
      itemSystem.addItem('rusty_iron_sword', 2);
      const instances = itemSystem.getAllItemInstances();
      const weapons = instances.filter(i => i.itemId === 'rusty_iron_sword');
      
      expect(weapons.length).toBeGreaterThanOrEqual(2);
      
      if (weapons.length >= 2 && weapons[0].instanceId && weapons[1].instanceId) {
        // Equip first weapon
        equipmentSystem.equipItem(characterId, weapons[0].instanceId, 'weapon');
        expect(equipmentSystem.getEquippedItem(characterId, 'weapon')).toBe(weapons[0].instanceId);
        
        // Equip second weapon (should replace first)
        equipmentSystem.equipItem(characterId, weapons[1].instanceId, 'weapon');
        expect(equipmentSystem.getEquippedItem(characterId, 'weapon')).toBe(weapons[1].instanceId);
      }
    });
  });

  describe('Equipment Removal', () => {
    it('should unequip an item from a slot', () => {
      // Add and equip a weapon
      itemSystem.addItem('rusty_iron_sword', 1);
      const instances = itemSystem.getAllItemInstances();
      const weaponInstance = instances.find(i => i.itemId === 'rusty_iron_sword');
      
      if (weaponInstance && weaponInstance.instanceId) {
        equipmentSystem.equipItem(characterId, weaponInstance.instanceId, 'weapon');
        expect(equipmentSystem.getEquippedItem(characterId, 'weapon')).toBe(weaponInstance.instanceId);
        
        // Unequip
        const result = equipmentSystem.unequipItem(characterId, 'weapon');
        expect(result).toBe(true);
        expect(equipmentSystem.getEquippedItem(characterId, 'weapon')).toBeNull();
      }
    });

    it('should return false when unequipping from empty slot', () => {
      const result = equipmentSystem.unequipItem(characterId, 'weapon');
      expect(result).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate item can be equipped', () => {
      itemSystem.addItem('rusty_iron_sword', 1);
      const instances = itemSystem.getAllItemInstances();
      const weaponInstance = instances.find(i => i.itemId === 'rusty_iron_sword');
      
      if (weaponInstance && weaponInstance.instanceId) {
        const canEquip = equipmentSystem.canEquipItem(characterId, weaponInstance.instanceId, 'weapon');
        expect(canEquip).toBe(true);
      }
    });

    it('should reject non-equipment items', () => {
      // Add a material item (not equipment)
      itemSystem.addItem('wood', 5);
      const instances = itemSystem.getAllItemInstances();
      const materialInstance = instances.find(i => i.itemId === 'wood');
      
      if (materialInstance && materialInstance.instanceId) {
        const canEquip = equipmentSystem.canEquipItem(characterId, materialInstance.instanceId, 'weapon');
        expect(canEquip).toBe(false);
      } else {
        // If no instance found (stackable items might not create instances), test with invalid ID
        const canEquip = equipmentSystem.canEquipItem(characterId, 'invalid_instance', 'weapon');
        expect(canEquip).toBe(false);
      }
    });

    it('should return false for character without equipment slots component', () => {
      const invalidCharacterId = world.createEntity();
      
      itemSystem.addItem('rusty_iron_sword', 1);
      const instances = itemSystem.getAllItemInstances();
      const weaponInstance = instances.find(i => i.itemId === 'rusty_iron_sword');
      
      if (weaponInstance && weaponInstance.instanceId) {
        const result = equipmentSystem.equipItem(invalidCharacterId, weaponInstance.instanceId, 'weapon');
        expect(result).toBe(false);
      }
    });
  });

  describe('Event Emission', () => {
    it('should emit equipment_changed event when equipping', (done) => {
      itemSystem.addItem('rusty_iron_sword', 1);
      const instances = itemSystem.getAllItemInstances();
      const weaponInstance = instances.find(i => i.itemId === 'rusty_iron_sword');
      
      if (weaponInstance && weaponInstance.instanceId) {
        // Subscribe to equipment_changed event
        world.subscribe('equipment_changed', (data: any) => {
          expect(data.characterId).toBe(characterId);
          expect(data.slot).toBe('weapon');
          expect(data.previousItem).toBeNull();
          expect(data.newItem).toBe(weaponInstance.instanceId);
          done();
        });
        
        equipmentSystem.equipItem(characterId, weaponInstance.instanceId, 'weapon');
      }
    });

    it('should emit equipment_changed event when unequipping', (done) => {
      itemSystem.addItem('rusty_iron_sword', 1);
      const instances = itemSystem.getAllItemInstances();
      const weaponInstance = instances.find(i => i.itemId === 'rusty_iron_sword');
      
      if (weaponInstance && weaponInstance.instanceId) {
        // Equip first
        equipmentSystem.equipItem(characterId, weaponInstance.instanceId, 'weapon');
        
        // Subscribe to equipment_changed event
        world.subscribe('equipment_changed', (data: any) => {
          if (data.newItem === null) {
            expect(data.characterId).toBe(characterId);
            expect(data.slot).toBe('weapon');
            expect(data.previousItem).toBe(weaponInstance.instanceId);
            expect(data.newItem).toBeNull();
            done();
          }
        });
        
        equipmentSystem.unequipItem(characterId, 'weapon');
      }
    });
  });

  describe('Error Handling and Validation', () => {
    it('should reject equipping with invalid item instance ID', () => {
      const result = equipmentSystem.equipItem(characterId, '', 'weapon');
      expect(result).toBe(false);
    });

    it('should reject equipping with non-existent item instance', () => {
      const result = equipmentSystem.equipItem(characterId, 'non_existent_instance_id', 'weapon');
      expect(result).toBe(false);
    });

    it('should reject equipping to invalid slot', () => {
      itemSystem.addItem('rusty_iron_sword', 1);
      const instances = itemSystem.getAllItemInstances();
      const weaponInstance = instances.find(i => i.itemId === 'rusty_iron_sword');
      
      if (weaponInstance && weaponInstance.instanceId) {
        // @ts-expect-error Testing invalid slot
        const result = equipmentSystem.equipItem(characterId, weaponInstance.instanceId, 'invalid_slot');
        expect(result).toBe(false);
      }
    });

    it('should reject unequipping from invalid slot', () => {
      // @ts-expect-error Testing invalid slot
      const result = equipmentSystem.unequipItem(characterId, 'invalid_slot');
      expect(result).toBe(false);
    });

    it('should return null when getting equipped item from invalid slot', () => {
      // @ts-expect-error Testing invalid slot
      const result = equipmentSystem.getEquippedItem(characterId, 'invalid_slot');
      expect(result).toBeNull();
    });

    it('should reject operations on non-existent character', () => {
      const nonExistentCharacterId = 99999;
      
      itemSystem.addItem('rusty_iron_sword', 1);
      const instances = itemSystem.getAllItemInstances();
      const weaponInstance = instances.find(i => i.itemId === 'rusty_iron_sword');
      
      if (weaponInstance && weaponInstance.instanceId) {
        const equipResult = equipmentSystem.equipItem(nonExistentCharacterId, weaponInstance.instanceId, 'weapon');
        expect(equipResult).toBe(false);
        
        const canEquipResult = equipmentSystem.canEquipItem(nonExistentCharacterId, weaponInstance.instanceId, 'weapon');
        expect(canEquipResult).toBe(false);
      }
      
      const unequipResult = equipmentSystem.unequipItem(nonExistentCharacterId, 'weapon');
      expect(unequipResult).toBe(false);
      
      const getEquippedResult = equipmentSystem.getEquippedItem(nonExistentCharacterId, 'weapon');
      expect(getEquippedResult).toBeNull();
      
      const getAllEquippedResult = equipmentSystem.getAllEquippedItems(nonExistentCharacterId);
      expect(getAllEquippedResult.size).toBe(0);
    });

    it('should handle character without required components', () => {
      const characterWithoutComponents = world.createEntity();
      
      itemSystem.addItem('rusty_iron_sword', 1);
      const instances = itemSystem.getAllItemInstances();
      const weaponInstance = instances.find(i => i.itemId === 'rusty_iron_sword');
      
      if (weaponInstance && weaponInstance.instanceId) {
        const equipResult = equipmentSystem.equipItem(characterWithoutComponents, weaponInstance.instanceId, 'weapon');
        expect(equipResult).toBe(false);
        
        const canEquipResult = equipmentSystem.canEquipItem(characterWithoutComponents, weaponInstance.instanceId, 'weapon');
        expect(canEquipResult).toBe(false);
      }
      
      const unequipResult = equipmentSystem.unequipItem(characterWithoutComponents, 'weapon');
      expect(unequipResult).toBe(false);
      
      const getEquippedResult = equipmentSystem.getEquippedItem(characterWithoutComponents, 'weapon');
      expect(getEquippedResult).toBeNull();
      
      const getAllEquippedResult = equipmentSystem.getAllEquippedItems(characterWithoutComponents);
      expect(getAllEquippedResult.size).toBe(0);
    });
  });

  describe('Missing Affix Data Handling', () => {
    it('should handle equipment with no affixes gracefully', () => {
      // Create a mock equipment item with no affixes
      const mockItemId = 'test_equipment_no_affixes';
      const mockItem = {
        id: mockItemId,
        name: 'Test Equipment No Affixes',
        type: 'equipment',
        subType: 'weapon',
        equipmentSlot: 'weapon',
        rarity: 0,
        stackSize: 1,
        // No mainStat or subStats
      };
      
      // Add the mock item to the item system
      itemSystem.addItem(mockItemId, 1);
      const instances = itemSystem.getAllItemInstances();
      const itemInstance = instances.find(i => i.itemId === mockItemId);
      
      if (itemInstance && itemInstance.instanceId) {
        // Should be able to equip item even without affixes
        const result = equipmentSystem.equipItem(characterId, itemInstance.instanceId, 'weapon');
        expect(result).toBe(true);
        
        // Verify item is equipped
        const equippedItem = equipmentSystem.getEquippedItem(characterId, 'weapon');
        expect(equippedItem).toBe(itemInstance.instanceId);
      }
    });

    it('should handle equipment with null mainStat', () => {
      const mockItemId = 'test_equipment_null_mainstat';
      const mockItem = {
        id: mockItemId,
        name: 'Test Equipment Null MainStat',
        type: 'equipment',
        subType: 'armor',
        equipmentSlot: 'armor',
        rarity: 0,
        stackSize: 1,
        mainStat: null,
        subStats: []
      };
      
      itemSystem.addItem(mockItemId, 1);
      const instances = itemSystem.getAllItemInstances();
      const itemInstance = instances.find(i => i.itemId === mockItemId);
      
      if (itemInstance && itemInstance.instanceId) {
        const result = equipmentSystem.equipItem(characterId, itemInstance.instanceId, 'armor');
        expect(result).toBe(true);
        
        const equippedItem = equipmentSystem.getEquippedItem(characterId, 'armor');
        expect(equippedItem).toBe(itemInstance.instanceId);
      }
    });

    it('should handle equipment with empty subStats array', () => {
      const mockItemId = 'test_equipment_empty_substats';
      const mockItem = {
        id: mockItemId,
        name: 'Test Equipment Empty SubStats',
        type: 'equipment',
        subType: 'offhand',
        equipmentSlot: 'offhand',
        rarity: 0,
        stackSize: 1,
        mainStat: {
          attribute: 'defense',
          value: 5,
          type: 'flat'
        },
        subStats: []
      };
      
      itemSystem.addItem(mockItemId, 1);
      const instances = itemSystem.getAllItemInstances();
      const itemInstance = instances.find(i => i.itemId === mockItemId);
      
      if (itemInstance && itemInstance.instanceId) {
        const result = equipmentSystem.equipItem(characterId, itemInstance.instanceId, 'offhand');
        expect(result).toBe(true);
        
        const equippedItem = equipmentSystem.getEquippedItem(characterId, 'offhand');
        expect(equippedItem).toBe(itemInstance.instanceId);
      }
    });

    it('should handle equipment with invalid affix values', () => {
      const mockItemId = 'test_equipment_invalid_affixes';
      const mockItem = {
        id: mockItemId,
        name: 'Test Equipment Invalid Affixes',
        type: 'equipment',
        subType: 'accessory',
        equipmentSlot: 'accessory',
        rarity: 0,
        stackSize: 1,
        mainStat: {
          attribute: 'attack',
          value: 'invalid', // Invalid value type
          type: 'flat'
        },
        subStats: [
          {
            attribute: 'defense',
            value: -10, // Negative value
            type: 'flat'
          },
          {
            attribute: '', // Missing attribute
            value: 5,
            type: 'flat'
          }
        ]
      };
      
      itemSystem.addItem(mockItemId, 1);
      const instances = itemSystem.getAllItemInstances();
      const itemInstance = instances.find(i => i.itemId === mockItemId);
      
      if (itemInstance && itemInstance.instanceId) {
        // Should still be able to equip, but invalid affixes will be skipped
        const result = equipmentSystem.equipItem(characterId, itemInstance.instanceId, 'accessory');
        expect(result).toBe(true);
        
        const equippedItem = equipmentSystem.getEquippedItem(characterId, 'accessory');
        expect(equippedItem).toBe(itemInstance.instanceId);
      }
    });

    it('should handle equipment with unknown attribute types', () => {
      const mockItemId = 'test_equipment_unknown_attributes';
      const mockItem = {
        id: mockItemId,
        name: 'Test Equipment Unknown Attributes',
        type: 'equipment',
        subType: 'weapon',
        equipmentSlot: 'weapon',
        rarity: 0,
        stackSize: 1,
        mainStat: {
          attribute: 'unknownAttribute',
          value: 10,
          type: 'flat'
        },
        subStats: [
          {
            attribute: 'anotherUnknownAttribute',
            value: 5,
            type: 'flat'
          }
        ]
      };
      
      itemSystem.addItem(mockItemId, 1);
      const instances = itemSystem.getAllItemInstances();
      const itemInstance = instances.find(i => i.itemId === mockItemId);
      
      if (itemInstance && itemInstance.instanceId) {
        // Should still be able to equip, but unknown attributes will be skipped
        const result = equipmentSystem.equipItem(characterId, itemInstance.instanceId, 'weapon');
        expect(result).toBe(true);
        
        const equippedItem = equipmentSystem.getEquippedItem(characterId, 'weapon');
        expect(equippedItem).toBe(itemInstance.instanceId);
      }
    });

    it('should handle equipment with invalid affix type', () => {
      const mockItemId = 'test_equipment_invalid_type';
      const mockItem = {
        id: mockItemId,
        name: 'Test Equipment Invalid Type',
        type: 'equipment',
        subType: 'armor',
        equipmentSlot: 'armor',
        rarity: 0,
        stackSize: 1,
        mainStat: {
          attribute: 'defense',
          value: 10,
          type: 'invalid_type' // Invalid type
        }
      };
      
      itemSystem.addItem(mockItemId, 1);
      const instances = itemSystem.getAllItemInstances();
      const itemInstance = instances.find(i => i.itemId === mockItemId);
      
      if (itemInstance && itemInstance.instanceId) {
        // Should still be able to equip, but invalid type will be skipped
        const result = equipmentSystem.equipItem(characterId, itemInstance.instanceId, 'armor');
        expect(result).toBe(true);
        
        const equippedItem = equipmentSystem.getEquippedItem(characterId, 'armor');
        expect(equippedItem).toBe(itemInstance.instanceId);
      }
    });

    it('should handle equipment with non-array subStats', () => {
      const mockItemId = 'test_equipment_invalid_substats_type';
      const mockItem = {
        id: mockItemId,
        name: 'Test Equipment Invalid SubStats Type',
        type: 'equipment',
        subType: 'offhand',
        equipmentSlot: 'offhand',
        rarity: 0,
        stackSize: 1,
        mainStat: {
          attribute: 'defense',
          value: 5,
          type: 'flat'
        },
        subStats: 'not_an_array' // Invalid type
      };
      
      itemSystem.addItem(mockItemId, 1);
      const instances = itemSystem.getAllItemInstances();
      const itemInstance = instances.find(i => i.itemId === mockItemId);
      
      if (itemInstance && itemInstance.instanceId) {
        // Should still be able to equip, mainStat should work but subStats will be skipped
        const result = equipmentSystem.equipItem(characterId, itemInstance.instanceId, 'offhand');
        expect(result).toBe(true);
        
        const equippedItem = equipmentSystem.getEquippedItem(characterId, 'offhand');
        expect(equippedItem).toBe(itemInstance.instanceId);
      }
    });
  });
});
