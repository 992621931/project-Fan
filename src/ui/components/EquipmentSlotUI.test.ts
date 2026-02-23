/**
 * Equipment Slot UI Tests - Test equipment slot rendering and interaction
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EquipmentSlotUI } from './EquipmentSlotUI';
import { UIManager } from '../UIManager';
import { EventSystem } from '../../ecs/EventSystem';
import { World } from '../../ecs/World';
import { Entity } from '../../ecs/Entity';
import { EquipmentSlotsComponent } from '../../game/components/SystemComponents';
import { ItemSystem } from '../../game/systems/ItemSystem';

describe('EquipmentSlotUI', () => {
  let equipmentSlotUI: EquipmentSlotUI;
  let uiManager: UIManager;
  let eventSystem: EventSystem;
  let world: World;
  let itemSystem: ItemSystem;
  let rootElement: HTMLElement;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="test-root"></div>';
    rootElement = document.getElementById('test-root')!;
    
    // Create instances
    eventSystem = new EventSystem();
    world = new World();
    itemSystem = new ItemSystem(world);
    uiManager = new UIManager(eventSystem, rootElement);
    equipmentSlotUI = new EquipmentSlotUI(uiManager, eventSystem, world, itemSystem);
    
    // Register the component
    uiManager.registerComponent(equipmentSlotUI);
  });

  afterEach(() => {
    uiManager.destroy();
    document.body.innerHTML = '';
  });

  describe('Equipment Slot Rendering', () => {
    it('should render all 4 equipment slots correctly', () => {
      // Create test character with equipment slots
      const character = createTestCharacter(world);
      
      equipmentSlotUI.show();
      equipmentSlotUI.setCharacter(character.id);
      
      // Check that slots container exists
      const slotsContainer = equipmentSlotUI.element.querySelector('.equipment-slots-container');
      expect(slotsContainer).toBeTruthy();
      
      // Check that all 4 slots are rendered
      const slotElements = slotsContainer?.querySelectorAll('.equipment-slot');
      expect(slotElements?.length).toBe(4);
      
      // Verify each slot type is present
      const slotTypes = Array.from(slotElements || []).map(slot => 
        (slot as HTMLElement).dataset.slot
      );
      expect(slotTypes).toContain('weapon');
      expect(slotTypes).toContain('armor');
      expect(slotTypes).toContain('offhand');
      expect(slotTypes).toContain('accessory');
    });

    it('should render slot labels correctly', () => {
      const character = createTestCharacter(world);
      
      equipmentSlotUI.show();
      equipmentSlotUI.setCharacter(character.id);
      
      const slotsContainer = equipmentSlotUI.element.querySelector('.equipment-slots-container');
      const slotLabels = slotsContainer?.querySelectorAll('.slot-label');
      const labelTexts = Array.from(slotLabels || []).map(label => label.textContent);
      
      expect(labelTexts).toContain('武器');
      expect(labelTexts).toContain('护甲');
      expect(labelTexts).toContain('副手');
      expect(labelTexts).toContain('饰品');
    });

    it('should render slot icons correctly', () => {
      const character = createTestCharacter(world);
      
      equipmentSlotUI.show();
      equipmentSlotUI.setCharacter(character.id);
      
      const slotsContainer = equipmentSlotUI.element.querySelector('.equipment-slots-container');
      const iconContainers = slotsContainer?.querySelectorAll('.slot-icon-container');
      expect(iconContainers?.length).toBe(4);
      
      // Each icon container should have content
      iconContainers?.forEach(container => {
        expect(container.textContent).toBeTruthy();
        expect(container.textContent?.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Empty State Display', () => {
    it('should display empty state for all slots when no equipment is equipped', () => {
      const character = createTestCharacter(world);
      
      equipmentSlotUI.show();
      equipmentSlotUI.setCharacter(character.id);
      
      const slotsContainer = equipmentSlotUI.element.querySelector('.equipment-slots-container');
      
      // Check that all slots show empty status
      const statusElements = slotsContainer?.querySelectorAll('.slot-status');
      const statusTexts = Array.from(statusElements || []).map(status => status.textContent);
      
      // All slots should show "空" (empty)
      statusTexts.forEach(text => {
        expect(text).toBe('空');
      });
    });

    it('should apply empty state styling to unoccupied slots', () => {
      const character = createTestCharacter(world);
      
      equipmentSlotUI.show();
      equipmentSlotUI.setCharacter(character.id);
      
      const slotsContainer = equipmentSlotUI.element.querySelector('.equipment-slots-container');
      const slotElements = slotsContainer?.querySelectorAll('.equipment-slot');
      
      slotElements?.forEach(slot => {
        const slotElement = slot as HTMLElement;
        // Empty slots should have lower opacity icons
        const iconContainer = slotElement.querySelector('.slot-icon-container') as HTMLElement;
        expect(iconContainer.style.opacity).toBe('0.3');
      });
    });

    it('should show empty state message when no character is selected', () => {
      equipmentSlotUI.show();
      
      const emptyState = equipmentSlotUI.element.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState?.textContent).toBe('请选择角色');
    });
  });

  describe('Equipped Item Display', () => {
    it('should display equipped item status correctly', () => {
      const character = createTestCharacter(world);
      
      // Equip an item to weapon slot
      const equipmentSlots = world.getComponent<EquipmentSlotsComponent>(
        character.id,
        'equipmentSlots'
      );
      if (equipmentSlots) {
        equipmentSlots.weapon = 'test-item-1' as any;
      }
      
      equipmentSlotUI.show();
      equipmentSlotUI.setCharacter(character.id);
      
      const slotsContainer = equipmentSlotUI.element.querySelector('.equipment-slots-container');
      
      // Find weapon slot
      const weaponSlot = Array.from(
        slotsContainer?.querySelectorAll('.equipment-slot') || []
      ).find(slot => (slot as HTMLElement).dataset.slot === 'weapon');
      
      expect(weaponSlot).toBeTruthy();
      
      // Check status shows equipped
      const statusElement = weaponSlot?.querySelector('.slot-status');
      expect(statusElement?.textContent).toBe('已装备');
    });

    it('should apply occupied state styling to equipped slots', () => {
      const character = createTestCharacter(world);
      
      // Equip items to multiple slots
      const equipmentSlots = world.getComponent<EquipmentSlotsComponent>(
        character.id,
        'equipmentSlots'
      );
      if (equipmentSlots) {
        equipmentSlots.weapon = 'test-weapon' as any;
        equipmentSlots.armor = 'test-armor' as any;
      }
      
      equipmentSlotUI.show();
      equipmentSlotUI.setCharacter(character.id);
      
      const slotsContainer = equipmentSlotUI.element.querySelector('.equipment-slots-container');
      
      // Find equipped slots
      const weaponSlot = Array.from(
        slotsContainer?.querySelectorAll('.equipment-slot') || []
      ).find(slot => (slot as HTMLElement).dataset.slot === 'weapon') as HTMLElement;
      
      const armorSlot = Array.from(
        slotsContainer?.querySelectorAll('.equipment-slot') || []
      ).find(slot => (slot as HTMLElement).dataset.slot === 'armor') as HTMLElement;
      
      // Equipped slots should have full opacity icons
      const weaponIcon = weaponSlot?.querySelector('.slot-icon-container') as HTMLElement;
      const armorIcon = armorSlot?.querySelector('.slot-icon-container') as HTMLElement;
      
      expect(weaponIcon?.style.opacity).toBe('1');
      expect(armorIcon?.style.opacity).toBe('1');
    });

    it('should distinguish visually between empty and occupied slots', () => {
      const character = createTestCharacter(world);
      
      // Equip only weapon
      const equipmentSlots = world.getComponent<EquipmentSlotsComponent>(
        character.id,
        'equipmentSlots'
      );
      if (equipmentSlots) {
        equipmentSlots.weapon = 'test-weapon' as any;
      }
      
      equipmentSlotUI.show();
      equipmentSlotUI.setCharacter(character.id);
      
      const slotsContainer = equipmentSlotUI.element.querySelector('.equipment-slots-container');
      const slotElements = slotsContainer?.querySelectorAll('.equipment-slot');
      
      // Find weapon slot (occupied) and armor slot (empty)
      const weaponSlot = Array.from(slotElements || []).find(
        slot => (slot as HTMLElement).dataset.slot === 'weapon'
      ) as HTMLElement;
      
      const armorSlot = Array.from(slotElements || []).find(
        slot => (slot as HTMLElement).dataset.slot === 'armor'
      ) as HTMLElement;
      
      // Weapon slot icon should be fully visible
      const weaponIcon = weaponSlot?.querySelector('.slot-icon-container') as HTMLElement;
      expect(weaponIcon?.style.opacity).toBe('1');
      
      // Armor slot icon should be dimmed
      const armorIcon = armorSlot?.querySelector('.slot-icon-container') as HTMLElement;
      expect(armorIcon?.style.opacity).toBe('0.3');
      
      // Status text should differ
      const weaponStatus = weaponSlot?.querySelector('.slot-status');
      const armorStatus = armorSlot?.querySelector('.slot-status');
      
      expect(weaponStatus?.textContent).toBe('已装备');
      expect(armorStatus?.textContent).toBe('空');
    });
  });
});

// Helper function to create test character with equipment slots
function createTestCharacter(world: World): Entity {
  const character = world.createEntity();
  
  // Add equipment slots component
  const equipmentSlots: EquipmentSlotsComponent = {
    type: 'equipmentSlots',
    weapon: null,
    armor: null,
    offhand: null,
    accessory: null
  };
  world.addComponent(character, 'equipmentSlots', equipmentSlots);
  
  return character;
}
