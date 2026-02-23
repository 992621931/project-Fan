/**
 * Game UI Tests - Test main UI controller functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameUI } from './GameUI';
import { EventSystem } from '../ecs/EventSystem';
import { World } from '../ecs/World';

describe('GameUI', () => {
  let gameUI: GameUI;
  let eventSystem: EventSystem;
  let world: World;
  let rootElement: HTMLElement;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="test-root"></div>';
    rootElement = document.getElementById('test-root')!;
    
    // Create instances
    eventSystem = new EventSystem();
    world = new World();
    gameUI = new GameUI(eventSystem, world, rootElement);
  });

  afterEach(() => {
    gameUI.destroy();
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    it('should initialize all UI components', () => {
      // Check if main HUD is created
      const mainHUD = document.getElementById('main-hud');
      expect(mainHUD).toBeTruthy();
      
      // Check if menu bar is created
      const menuBar = document.getElementById('menu-bar');
      expect(menuBar).toBeTruthy();
      
      // Check if currency display is created
      const currencyDisplay = document.getElementById('currency-display');
      expect(currencyDisplay).toBeTruthy();
    });

    it('should create all menu buttons', () => {
      const expectedButtons = [
        'character-btn',
        'inventory-btn', 
        'craft-btn',
        'shop-btn',
        'farm-btn',
        'explore-btn',
        'collection-btn',
        'settings-btn'
      ];

      expectedButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        expect(button).toBeTruthy();
        expect(button?.className).toContain('menu-button');
      });
    });

    it('should setup currency display elements', () => {
      const goldAmount = document.getElementById('gold-amount');
      const crystalAmount = document.getElementById('crystal-amount');
      const reputationAmount = document.getElementById('reputation-amount');
      
      expect(goldAmount).toBeTruthy();
      expect(crystalAmount).toBeTruthy();
      expect(reputationAmount).toBeTruthy();
    });
  });

  describe('Panel Management', () => {
    it('should show and hide panels correctly', () => {
      // Test showing character panel
      gameUI.showPanel('character');
      expect(gameUI.isVisible('character-panel')).toBe(true);
      
      // Test hiding panel
      gameUI.hidePanel('character-panel');
      expect(gameUI.isVisible('character-panel')).toBe(false);
    });

    it('should hide all panels when showing a new one', () => {
      // Show multiple panels
      gameUI.showPanel('character');
      gameUI.showPanel('inventory');
      
      // Only inventory should be visible
      expect(gameUI.isVisible('character-panel')).toBe(false);
      expect(gameUI.isVisible('inventory-panel')).toBe(true);
    });

    it('should hide all panels with hideAllPanels', () => {
      gameUI.showPanel('character');
      gameUI.showPanel('inventory');
      
      gameUI.hideAllPanels();
      
      expect(gameUI.isVisible('character-panel')).toBe(false);
      expect(gameUI.isVisible('inventory-panel')).toBe(false);
    });
  });

  describe('Menu Button Interactions', () => {
    it('should open character panel when character button is clicked', () => {
      const characterBtn = document.getElementById('character-btn') as HTMLButtonElement;
      expect(characterBtn).toBeTruthy();
      
      characterBtn.click();
      expect(gameUI.isVisible('character-panel')).toBe(true);
    });

    it('should open inventory panel when inventory button is clicked', () => {
      const inventoryBtn = document.getElementById('inventory-btn') as HTMLButtonElement;
      expect(inventoryBtn).toBeTruthy();
      
      inventoryBtn.click();
      expect(gameUI.isVisible('inventory-panel')).toBe(true);
    });

    it('should open crafting panel when craft button is clicked', () => {
      const craftBtn = document.getElementById('craft-btn') as HTMLButtonElement;
      expect(craftBtn).toBeTruthy();
      
      craftBtn.click();
      expect(gameUI.isVisible('crafting-panel')).toBe(true);
    });

    it('should open farming panel when farm button is clicked', () => {
      const farmBtn = document.getElementById('farm-btn') as HTMLButtonElement;
      expect(farmBtn).toBeTruthy();
      
      farmBtn.click();
      expect(gameUI.isVisible('farming-panel')).toBe(true);
    });

    it('should open exploration panel when explore button is clicked', () => {
      const exploreBtn = document.getElementById('explore-btn') as HTMLButtonElement;
      expect(exploreBtn).toBeTruthy();
      
      exploreBtn.click();
      expect(gameUI.isVisible('exploration-panel')).toBe(true);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should open character panel with C key', () => {
      const event = new KeyboardEvent('keydown', { key: 'c' });
      document.dispatchEvent(event);
      
      expect(gameUI.isVisible('character-panel')).toBe(true);
    });

    it('should open inventory panel with I key', () => {
      const event = new KeyboardEvent('keydown', { key: 'i' });
      document.dispatchEvent(event);
      
      expect(gameUI.isVisible('inventory-panel')).toBe(true);
    });

    it('should open crafting panel with K key', () => {
      const event = new KeyboardEvent('keydown', { key: 'k' });
      document.dispatchEvent(event);
      
      expect(gameUI.isVisible('crafting-panel')).toBe(true);
    });

    it('should open exploration panel with E key', () => {
      const event = new KeyboardEvent('keydown', { key: 'e' });
      document.dispatchEvent(event);
      
      expect(gameUI.isVisible('exploration-panel')).toBe(true);
    });

    it('should open farming panel with F key', () => {
      const event = new KeyboardEvent('keydown', { key: 'f' });
      document.dispatchEvent(event);
      
      expect(gameUI.isVisible('farming-panel')).toBe(true);
    });

    it('should close all panels with Escape key', () => {
      gameUI.showPanel('character');
      gameUI.showPanel('inventory');
      
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);
      
      expect(gameUI.isVisible('character-panel')).toBe(false);
      expect(gameUI.isVisible('inventory-panel')).toBe(false);
    });

    it('should not trigger shortcuts when typing in input fields', () => {
      // Create an input field and focus it
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      
      // Simulate keydown on the input
      const event = new KeyboardEvent('keydown', { key: 'c', bubbles: true });
      Object.defineProperty(event, 'target', { value: input });
      document.dispatchEvent(event);
      
      // Panel should not open
      expect(gameUI.isVisible('character-panel')).toBe(false);
      
      document.body.removeChild(input);
    });
  });

  describe('Event System Integration', () => {
    it('should respond to ui:show events', () => {
      eventSystem.emit('ui:show', { panel: 'character' });
      expect(gameUI.isVisible('character-panel')).toBe(true);
    });

    it('should respond to ui:hide events', () => {
      gameUI.showPanel('character');
      eventSystem.emit('ui:hide', { panel: 'character-panel' });
      expect(gameUI.isVisible('character-panel')).toBe(false);
    });

    it('should respond to ui:notification events', () => {
      const showNotificationSpy = vi.spyOn(gameUI, 'showNotification');
      
      eventSystem.emit('ui:notification', { 
        message: 'Test notification', 
        type: 'success' 
      });
      
      expect(showNotificationSpy).toHaveBeenCalledWith('Test notification', 'success', undefined);
    });

    it('should respond to currency:changed events', () => {
      const updateCurrencySpy = vi.spyOn(gameUI, 'updateCurrencyDisplay');
      
      eventSystem.emit('currency:changed', {});
      
      expect(updateCurrencySpy).toHaveBeenCalled();
    });
  });

  describe('Player Entity Management', () => {
    it('should set player entity and update currency display', () => {
      const playerEntity = world.createEntity();
      const updateCurrencySpy = vi.spyOn(gameUI, 'updateCurrencyDisplay');
      
      gameUI.setPlayerEntity(playerEntity);
      
      expect(updateCurrencySpy).toHaveBeenCalled();
    });

    it('should update currency display with placeholder values', () => {
      const playerEntity = world.createEntity();
      gameUI.setPlayerEntity(playerEntity);
      
      gameUI.updateCurrencyDisplay();
      
      const goldAmount = document.getElementById('gold-amount');
      const crystalAmount = document.getElementById('crystal-amount');
      const reputationAmount = document.getElementById('reputation-amount');
      
      expect(goldAmount?.textContent).toBe('1,234');
      expect(crystalAmount?.textContent).toBe('56');
      expect(reputationAmount?.textContent).toBe('789');
    });
  });

  describe('Notifications', () => {
    it('should show notifications with correct parameters', () => {
      // Mock the UIManager's showNotification method
      const uiManager = (gameUI as any).uiManager;
      const showNotificationSpy = vi.spyOn(uiManager, 'showNotification');
      
      gameUI.showNotification('Test message', 'warning', 5000);
      
      expect(showNotificationSpy).toHaveBeenCalledWith('Test message', 'warning', 5000);
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should adapt menu buttons for mobile', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      // Create new GameUI instance for mobile
      const mobileGameUI = new GameUI(eventSystem, world, rootElement);
      
      const menuButtons = document.querySelectorAll('.menu-button');
      expect(menuButtons.length).toBeGreaterThan(0);
      
      // Check if mobile styles are applied (this would be in CSS)
      const menuBar = document.getElementById('menu-bar');
      expect(menuBar).toBeTruthy();
      
      mobileGameUI.destroy();
    });
  });

  describe('Button Hover Effects', () => {
    it('should apply hover effects to menu buttons', () => {
      const characterBtn = document.getElementById('character-btn') as HTMLButtonElement;
      expect(characterBtn).toBeTruthy();
      
      // Simulate mouseenter
      const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
      characterBtn.dispatchEvent(mouseEnterEvent);
      
      // Check if hover styles are applied
      expect(characterBtn.style.backgroundColor).toContain('rgba(102, 126, 234, 0.8)');
      expect(characterBtn.style.transform).toBe('translateY(-2px)');
      
      // Simulate mouseleave
      const mouseLeaveEvent = new MouseEvent('mouseleave', { bubbles: true });
      characterBtn.dispatchEvent(mouseLeaveEvent);
      
      // Check if hover styles are removed
      expect(characterBtn.style.backgroundColor).toContain('rgba(45, 45, 45, 0.9)');
      expect(characterBtn.style.transform).toBe('translateY(0)');
    });
  });

  describe('Cleanup', () => {
    it('should properly cleanup all resources', () => {
      const mainHUD = document.getElementById('main-hud');
      const menuBar = document.getElementById('menu-bar');
      
      expect(mainHUD).toBeTruthy();
      expect(menuBar).toBeTruthy();
      
      gameUI.destroy();
      
      const mainHUDAfter = document.getElementById('main-hud');
      const menuBarAfter = document.getElementById('menu-bar');
      
      expect(mainHUDAfter).toBeFalsy();
      expect(menuBarAfter).toBeFalsy();
    });
  });

  describe('Error Handling - Grid Layout', () => {
    describe('Container Width Edge Cases', () => {
      it('should handle container width of 0 and return default 4 columns', () => {
        const columns = (gameUI as any).calculateGridColumns(0);
        expect(columns).toBe(4);
      });

      it('should handle negative container width and return default 4 columns', () => {
        const columns = (gameUI as any).calculateGridColumns(-100);
        expect(columns).toBe(4);
      });

      it('should log warning when container width is invalid', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn');
        
        (gameUI as any).calculateGridColumns(0);
        expect(consoleWarnSpy).toHaveBeenCalledWith('Container width is invalid or zero, using default 4 columns');
        
        (gameUI as any).calculateGridColumns(-50);
        expect(consoleWarnSpy).toHaveBeenCalledWith('Container width is invalid or zero, using default 4 columns');
        
        consoleWarnSpy.mockRestore();
      });
    });

    describe('Item Array Edge Cases', () => {
      it('should handle empty item array', () => {
        const emptyArray: any[] = [];
        const filtered = (gameUI as any).filterItems(emptyArray, 'all');
        expect(filtered).toEqual([]);
        expect(filtered.length).toBe(0);
      });

      it('should handle pagination with empty array', () => {
        const emptyArray: any[] = [];
        const paginated = (gameUI as any).paginateItems(emptyArray, 0, 12);
        expect(paginated).toEqual([]);
        expect(paginated.length).toBe(0);
      });

      it('should calculate total pages as 1 when item array is empty', () => {
        const totalPages = (gameUI as any).calculateTotalPages(0, 12);
        expect(totalPages).toBe(1);
      });

      it('should handle null-like values in filterItems gracefully', () => {
        // filterItems expects an array, but we test defensive behavior
        // If null/undefined is passed, it should throw or handle gracefully
        expect(() => {
          (gameUI as any).filterItems(null as any, 'all');
        }).toThrow();
      });

      it('should handle null-like values in paginateItems gracefully', () => {
        // paginateItems expects an array, but we test defensive behavior
        // If null/undefined is passed, it should throw or handle gracefully
        expect(() => {
          (gameUI as any).paginateItems(null as any, 0, 12);
        }).toThrow();
      });

      it('should handle undefined values in filterItems gracefully', () => {
        expect(() => {
          (gameUI as any).filterItems(undefined as any, 'all');
        }).toThrow();
      });

      it('should handle undefined values in paginateItems gracefully', () => {
        expect(() => {
          (gameUI as any).paginateItems(undefined as any, 0, 12);
        }).toThrow();
      });
    });
  });
});