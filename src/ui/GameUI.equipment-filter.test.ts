/**
 * Unit tests for warehouse panel equipment filtering
 * Feature: character-equipment-system
 * Tests equipment slot filtering functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameUI } from './GameUI';
import { EventSystem } from '../ecs/EventSystem';
import { World } from '../ecs/World';

describe('GameUI - Equipment Filtering', () => {
  let gameUI: GameUI;
  let world: World;
  let eventSystem: EventSystem;
  let rootElement: HTMLElement;

  beforeEach(() => {
    // Create test environment
    rootElement = document.createElement('div');
    rootElement.id = 'game-root';
    document.body.appendChild(rootElement);

    world = new World();
    eventSystem = new EventSystem();
    gameUI = new GameUI(eventSystem, world, rootElement);
  });

  describe('filterItemsByEquipmentSlot', () => {
    it('should filter items by weapon slot', () => {
      // Access private method through any cast for testing
      const filterMethod = (gameUI as any).filterItemsByEquipmentSlot.bind(gameUI);
      const itemSystem = (gameUI as any).itemSystem;

      // Create mock inventory slots
      const mockSlots = [
        { itemId: 'weapon1', quantity: 1, instanceId: 'inst1' },
        { itemId: 'armor1', quantity: 1, instanceId: 'inst2' },
        { itemId: 'weapon2', quantity: 1, instanceId: 'inst3' },
        { itemId: 'offhand1', quantity: 1, instanceId: 'inst4' }
      ];

      // Mock getItem to return appropriate item data
      const originalGetItem = itemSystem.getItem.bind(itemSystem);
      itemSystem.getItem = (itemId: string) => {
        if (itemId === 'weapon1' || itemId === 'weapon2') {
          return { type: 'equipment', equipmentSlot: 'weapon', name: itemId };
        } else if (itemId === 'armor1') {
          return { type: 'equipment', equipmentSlot: 'armor', name: itemId };
        } else if (itemId === 'offhand1') {
          return { type: 'equipment', equipmentSlot: 'offhand', name: itemId };
        }
        return originalGetItem(itemId);
      };

      // Filter by weapon slot
      const filtered = filterMethod(mockSlots, 'weapon');

      // Should only return weapon items
      expect(filtered.length).toBe(2);
      expect(filtered[0].itemId).toBe('weapon1');
      expect(filtered[1].itemId).toBe('weapon2');
    });

    it('should filter items by armor slot', () => {
      const filterMethod = (gameUI as any).filterItemsByEquipmentSlot.bind(gameUI);
      const itemSystem = (gameUI as any).itemSystem;

      const mockSlots = [
        { itemId: 'weapon1', quantity: 1, instanceId: 'inst1' },
        { itemId: 'armor1', quantity: 1, instanceId: 'inst2' },
        { itemId: 'armor2', quantity: 1, instanceId: 'inst3' }
      ];

      itemSystem.getItem = (itemId: string) => {
        if (itemId === 'weapon1') {
          return { type: 'equipment', equipmentSlot: 'weapon', name: itemId };
        } else if (itemId === 'armor1' || itemId === 'armor2') {
          return { type: 'equipment', equipmentSlot: 'armor', name: itemId };
        }
        return null;
      };

      const filtered = filterMethod(mockSlots, 'armor');

      expect(filtered.length).toBe(2);
      expect(filtered[0].itemId).toBe('armor1');
      expect(filtered[1].itemId).toBe('armor2');
    });

    it('should handle accessory and misc as equivalent', () => {
      const filterMethod = (gameUI as any).filterItemsByEquipmentSlot.bind(gameUI);
      const itemSystem = (gameUI as any).itemSystem;

      const mockSlots = [
        { itemId: 'misc1', quantity: 1, instanceId: 'inst1' },
        { itemId: 'accessory1', quantity: 1, instanceId: 'inst2' },
        { itemId: 'weapon1', quantity: 1, instanceId: 'inst3' }
      ];

      itemSystem.getItem = (itemId: string) => {
        if (itemId === 'misc1') {
          return { type: 'equipment', equipmentSlot: 'misc', name: itemId };
        } else if (itemId === 'accessory1') {
          return { type: 'equipment', equipmentSlot: 'accessory', name: itemId };
        } else if (itemId === 'weapon1') {
          return { type: 'equipment', equipmentSlot: 'weapon', name: itemId };
        }
        return null;
      };

      // Filter by accessory should return both misc and accessory items
      const filtered = filterMethod(mockSlots, 'accessory');

      expect(filtered.length).toBe(2);
      expect(filtered.map((s: any) => s.itemId)).toContain('misc1');
      expect(filtered.map((s: any) => s.itemId)).toContain('accessory1');
    });

    it('should filter out non-equipment items', () => {
      const filterMethod = (gameUI as any).filterItemsByEquipmentSlot.bind(gameUI);
      const itemSystem = (gameUI as any).itemSystem;

      const mockSlots = [
        { itemId: 'weapon1', quantity: 1, instanceId: 'inst1' },
        { itemId: 'material1', quantity: 5, instanceId: 'inst2' },
        { itemId: 'food1', quantity: 3, instanceId: 'inst3' }
      ];

      itemSystem.getItem = (itemId: string) => {
        if (itemId === 'weapon1') {
          return { type: 'equipment', equipmentSlot: 'weapon', name: itemId };
        } else if (itemId === 'material1') {
          return { type: 'material', name: itemId };
        } else if (itemId === 'food1') {
          return { type: 'food', name: itemId };
        }
        return null;
      };

      const filtered = filterMethod(mockSlots, 'weapon');

      // Should only return equipment items
      expect(filtered.length).toBe(1);
      expect(filtered[0].itemId).toBe('weapon1');
    });

    it('should return empty array when no items match', () => {
      const filterMethod = (gameUI as any).filterItemsByEquipmentSlot.bind(gameUI);
      const itemSystem = (gameUI as any).itemSystem;

      const mockSlots = [
        { itemId: 'armor1', quantity: 1, instanceId: 'inst1' },
        { itemId: 'armor2', quantity: 1, instanceId: 'inst2' }
      ];

      itemSystem.getItem = (itemId: string) => {
        return { type: 'equipment', equipmentSlot: 'armor', name: itemId };
      };

      const filtered = filterMethod(mockSlots, 'weapon');

      expect(filtered.length).toBe(0);
    });
  });
});
