/**
 * UI Manager Tests - Test core UI functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UIManager, UIComponent } from './UIManager';
import { EventSystem } from '../ecs/EventSystem';

// Mock UI Component for testing
class MockUIComponent implements UIComponent {
  public id: string;
  public element: HTMLElement;
  public visible: boolean = false;

  constructor(id: string) {
    this.id = id;
    this.element = document.createElement('div');
    this.element.id = id;
  }

  render(): void {
    this.element.textContent = `Rendered ${this.id}`;
  }

  show(): void {
    this.visible = true;
    this.element.classList.remove('hidden');
    this.element.classList.add('visible');
    this.render();
  }

  hide(): void {
    this.visible = false;
    this.element.classList.remove('visible');
    this.element.classList.add('hidden');
  }

  destroy(): void {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

describe('UIManager', () => {
  let uiManager: UIManager;
  let eventSystem: EventSystem;
  let rootElement: HTMLElement;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="test-root"></div>';
    rootElement = document.getElementById('test-root')!;
    
    // Create instances
    eventSystem = new EventSystem();
    uiManager = new UIManager(eventSystem, rootElement);
  });

  afterEach(() => {
    uiManager.destroy();
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    it('should create UI container', () => {
      const container = document.getElementById('ui-container');
      expect(container).toBeTruthy();
      expect(container?.className).toBe('ui-container');
    });

    it('should apply default theme styles', () => {
      const styles = document.head.querySelectorAll('style');
      expect(styles.length).toBeGreaterThan(0);
      
      // Check if theme styles are applied
      const hasUIStyles = Array.from(styles).some(style => 
        style.textContent?.includes('.ui-container')
      );
      expect(hasUIStyles).toBe(true);
    });

    it('should detect mobile device correctly', () => {
      // Mock window.innerWidth for mobile detection
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      const mobileUIManager = new UIManager(eventSystem, rootElement);
      expect(mobileUIManager.isMobileDevice()).toBe(true);
      
      mobileUIManager.destroy();
    });
  });

  describe('Component Management', () => {
    it('should register and manage components', () => {
      const component = new MockUIComponent('test-component');
      
      uiManager.registerComponent(component);
      
      const retrievedComponent = uiManager.getComponent('test-component');
      expect(retrievedComponent).toBe(component);
      
      // Check if component element is added to container
      const container = document.getElementById('ui-container');
      expect(container?.contains(component.element)).toBe(true);
    });

    it('should unregister components', () => {
      const component = new MockUIComponent('test-component');
      
      uiManager.registerComponent(component);
      uiManager.unregisterComponent('test-component');
      
      const retrievedComponent = uiManager.getComponent('test-component');
      expect(retrievedComponent).toBeUndefined();
    });

    it('should show and hide components', () => {
      const component = new MockUIComponent('test-component');
      uiManager.registerComponent(component);
      
      uiManager.showComponent('test-component');
      expect(component.visible).toBe(true);
      expect(component.element.classList.contains('visible')).toBe(true);
      
      uiManager.hideComponent('test-component');
      expect(component.visible).toBe(false);
      expect(component.element.classList.contains('hidden')).toBe(true);
    });

    it('should hide all components', () => {
      const component1 = new MockUIComponent('component-1');
      const component2 = new MockUIComponent('component-2');
      
      uiManager.registerComponent(component1);
      uiManager.registerComponent(component2);
      
      uiManager.showComponent('component-1');
      uiManager.showComponent('component-2');
      
      expect(component1.visible).toBe(true);
      expect(component2.visible).toBe(true);
      
      uiManager.hideAllComponents();
      
      expect(component1.visible).toBe(false);
      expect(component2.visible).toBe(false);
    });
  });

  describe('UI Element Creation', () => {
    it('should create buttons with correct properties', () => {
      const clickHandler = vi.fn();
      const button = uiManager.createButton('Test Button', clickHandler, 'custom-class');
      
      expect(button.tagName).toBe('BUTTON');
      expect(button.textContent).toBe('Test Button');
      expect(button.className).toContain('ui-button');
      expect(button.className).toContain('custom-class');
      
      button.click();
      expect(clickHandler).toHaveBeenCalledOnce();
    });

    it('should create input elements with correct properties', () => {
      const input = uiManager.createInput('email', 'Enter email', 'custom-input');
      
      expect(input.tagName).toBe('INPUT');
      expect(input.type).toBe('email');
      expect(input.placeholder).toBe('Enter email');
      expect(input.className).toContain('ui-input');
      expect(input.className).toContain('custom-input');
    });

    it('should create panels with correct styling', () => {
      const panel = uiManager.createPanel('custom-panel');
      
      expect(panel.tagName).toBe('DIV');
      expect(panel.className).toContain('ui-panel');
      expect(panel.className).toContain('custom-panel');
    });
  });

  describe('Notifications', () => {
    it('should show notifications with correct styling', () => {
      uiManager.showNotification('Test message', 'success', 1000);
      
      const notification = document.querySelector('.ui-notification');
      expect(notification).toBeTruthy();
      expect(notification?.textContent).toBe('Test message');
      expect(notification?.classList.contains('text-success')).toBe(true);
    });

    it('should auto-remove notifications after duration', (done) => {
      uiManager.showNotification('Test message', 'success', 100);
      
      setTimeout(() => {
        const notification = document.querySelector('.ui-notification');
        expect(notification).toBeFalsy();
        done();
      }, 500);
    });

    it('should show different notification types', () => {
      uiManager.showNotification('Error message', 'error');
      uiManager.showNotification('Warning message', 'warning');
      
      const notifications = document.querySelectorAll('.ui-notification');
      expect(notifications.length).toBe(2);
      
      const errorNotification = Array.from(notifications).find(n => 
        n.classList.contains('text-error')
      );
      const warningNotification = Array.from(notifications).find(n => 
        n.classList.contains('text-warning')
      );
      
      expect(errorNotification).toBeTruthy();
      expect(warningNotification).toBeTruthy();
    });
  });

  describe('Responsive Design', () => {
    it('should handle window resize events', () => {
      const component = new MockUIComponent('test-component');
      const renderSpy = vi.spyOn(component, 'render');
      
      uiManager.registerComponent(component);
      uiManager.showComponent('test-component');
      
      // Trigger resize event
      window.dispatchEvent(new Event('resize'));
      
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should handle orientation change on mobile', (done) => {
      // Mock mobile environment
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      const mobileUIManager = new UIManager(eventSystem, rootElement);
      const component = new MockUIComponent('test-component');
      const renderSpy = vi.spyOn(component, 'render');
      
      mobileUIManager.registerComponent(component);
      mobileUIManager.showComponent('test-component');
      
      // Trigger orientation change
      window.dispatchEvent(new Event('orientationchange'));
      
      // Orientation change has a timeout, so we need to wait
      setTimeout(() => {
        expect(renderSpy).toHaveBeenCalled();
        mobileUIManager.destroy();
        done();
      }, 150);
    });
  });

  describe('Theme Management', () => {
    it('should provide access to theme', () => {
      const theme = uiManager.getTheme();
      
      expect(theme).toBeTruthy();
      expect(theme.colors).toBeTruthy();
      expect(theme.colors.primary).toBeTruthy();
      expect(theme.fonts).toBeTruthy();
      expect(theme.spacing).toBeTruthy();
    });

    it('should have correct rarity colors', () => {
      const theme = uiManager.getTheme();
      
      expect(theme.colors.rarity.common).toBe('#ffffff');
      expect(theme.colors.rarity.rare).toBe('#3498db');
      expect(theme.colors.rarity.epic).toBe('#9b59b6');
      expect(theme.colors.rarity.legendary).toBe('#e67e22');
    });
  });

  describe('Cleanup', () => {
    it('should properly destroy and cleanup', () => {
      const component = new MockUIComponent('test-component');
      uiManager.registerComponent(component);
      
      const container = document.getElementById('ui-container');
      expect(container).toBeTruthy();
      
      uiManager.destroy();
      
      const containerAfterDestroy = document.getElementById('ui-container');
      expect(containerAfterDestroy).toBeFalsy();
    });
  });
});