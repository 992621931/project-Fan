/**
 * UI Manager - Core UI system for the game
 * Manages all UI components and provides responsive framework
 */

import { EventSystem } from '../ecs/EventSystem';

export interface UIComponent {
  id: string;
  element: HTMLElement;
  visible: boolean;
  render(): void;
  show(): void;
  hide(): void;
  destroy(): void;
}

export interface UITheme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    rarity: {
      common: string;
      rare: string;
      epic: string;
      legendary: string;
    };
  };
  fonts: {
    primary: string;
    secondary: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: string;
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
}

export class UIManager {
  private components: Map<string, UIComponent> = new Map();
  private eventSystem: EventSystem;
  private theme: UITheme;
  private rootElement: HTMLElement;
  private isMobile: boolean = false;

  constructor(eventSystem: EventSystem, rootElement: HTMLElement) {
    this.eventSystem = eventSystem;
    this.rootElement = rootElement;
    this.theme = this.createDefaultTheme();
    this.isMobile = this.detectMobile();
    
    this.initialize();
    this.setupEventListeners();
  }

  private initialize(): void {
    // Clear existing content
    this.rootElement.innerHTML = '';
    
    // Create main UI container
    const uiContainer = document.createElement('div');
    uiContainer.id = 'ui-container';
    uiContainer.className = 'ui-container';
    this.rootElement.appendChild(uiContainer);
    
    // Apply theme styles
    this.applyTheme();
    
    console.log('🎨 UI Manager initialized');
  }

  private createDefaultTheme(): UITheme {
    return {
      colors: {
        primary: '#667eea',
        secondary: '#764ba2',
        background: '#1a1a1a',
        surface: '#2d2d2d',
        text: '#ffffff',
        textSecondary: '#b0b0b0',
        accent: '#3498db',
        success: '#2ecc71',
        warning: '#f39c12',
        error: '#e74c3c',
        rarity: {
          common: '#ffffff',
          rare: '#3498db',
          epic: '#9b59b6',
          legendary: '#e67e22'
        }
      },
      fonts: {
        primary: "'Arial', 'Microsoft YaHei', sans-serif",
        secondary: "'Courier New', monospace"
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px'
      },
      borderRadius: '8px',
      shadows: {
        sm: '0 2px 4px rgba(0,0,0,0.1)',
        md: '0 4px 8px rgba(0,0,0,0.2)',
        lg: '0 8px 16px rgba(0,0,0,0.3)'
      }
    };
  }

  private applyTheme(): void {
    const style = document.createElement('style');
    style.textContent = `
      .ui-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 1000;
        font-family: ${this.theme.fonts.primary};
        color: ${this.theme.colors.text};
      }
      
      .ui-panel {
        position: absolute;
        background: ${this.theme.colors.surface};
        border-radius: ${this.theme.borderRadius};
        box-shadow: ${this.theme.shadows.lg};
        pointer-events: auto;
        padding: ${this.theme.spacing.md};
        border: 1px solid rgba(255,255,255,0.1);
      }
      
      .ui-button {
        background: ${this.theme.colors.primary};
        color: ${this.theme.colors.text};
        border: none;
        border-radius: ${this.theme.borderRadius};
        padding: ${this.theme.spacing.sm} ${this.theme.spacing.md};
        cursor: pointer;
        font-family: ${this.theme.fonts.primary};
        font-size: 14px;
        transition: all 0.2s ease;
      }
      
      .ui-button:hover {
        background: ${this.theme.colors.secondary};
        transform: translateY(-1px);
      }
      
      .ui-button:active {
        transform: translateY(0);
      }
      
      .ui-button:disabled {
        background: #666;
        cursor: not-allowed;
        transform: none;
      }
      
      .ui-input {
        background: ${this.theme.colors.background};
        color: ${this.theme.colors.text};
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: ${this.theme.borderRadius};
        padding: ${this.theme.spacing.sm};
        font-family: ${this.theme.fonts.primary};
        font-size: 14px;
      }
      
      .ui-input:focus {
        outline: none;
        border-color: ${this.theme.colors.primary};
        box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
      }
      
      .rarity-common { color: ${this.theme.colors.rarity.common}; }
      .rarity-rare { color: ${this.theme.colors.rarity.rare}; }
      .rarity-epic { color: ${this.theme.colors.rarity.epic}; }
      .rarity-legendary { color: ${this.theme.colors.rarity.legendary}; }
      
      .text-success { color: ${this.theme.colors.success}; }
      .text-warning { color: ${this.theme.colors.warning}; }
      .text-error { color: ${this.theme.colors.error}; }
      
      .hidden { display: none !important; }
      .visible { display: block !important; }
      
      /* Mobile responsive */
      @media (max-width: 768px) {
        .ui-panel {
          padding: ${this.theme.spacing.sm};
          font-size: 14px;
        }
        
        .ui-button {
          padding: ${this.theme.spacing.md};
          font-size: 16px;
          min-height: 44px;
        }
        
        .ui-input {
          padding: ${this.theme.spacing.md};
          font-size: 16px;
          min-height: 44px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private detectMobile(): boolean {
    return window.innerWidth <= 768 || 'ontouchstart' in window;
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', () => {
      this.isMobile = this.detectMobile();
      this.handleResize();
    });
    
    // Handle orientation change on mobile
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.handleResize(), 100);
    });
  }

  private handleResize(): void {
    this.components.forEach(component => {
      if (component.visible) {
        component.render();
      }
    });
  }

  public registerComponent(component: UIComponent): void {
    this.components.set(component.id, component);
    
    // Add component element to UI container
    const container = document.getElementById('ui-container');
    if (container) {
      container.appendChild(component.element);
    }
  }

  public unregisterComponent(id: string): void {
    const component = this.components.get(id);
    if (component) {
      component.destroy();
      this.components.delete(id);
    }
  }

  public getComponent<T extends UIComponent>(id: string): T | undefined {
    return this.components.get(id) as T;
  }

  public showComponent(id: string): void {
    const component = this.components.get(id);
    if (component) {
      component.show();
    }
  }

  public hideComponent(id: string): void {
    const component = this.components.get(id);
    if (component) {
      component.hide();
    }
  }

  public hideAllComponents(): void {
    this.components.forEach(component => component.hide());
  }

  public createButton(text: string, onClick: () => void, className: string = ''): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = `ui-button ${className}`;
    button.addEventListener('click', onClick);
    return button;
  }

  public createInput(type: string = 'text', placeholder: string = '', className: string = ''): HTMLInputElement {
    const input = document.createElement('input');
    input.type = type;
    input.placeholder = placeholder;
    input.className = `ui-input ${className}`;
    return input;
  }

  public createPanel(className: string = ''): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = `ui-panel ${className}`;
    return panel;
  }

  private notificationQueue: HTMLElement[] = []; // Track active notifications

  public showNotification(message: string, type: 'success' | 'warning' | 'error' = 'success', duration: number = 3000): void {
    const notification = document.createElement('div');
    notification.className = `ui-notification text-${type}`;
    notification.textContent = message;
    
    // Determine background and text color based on type
    let backgroundColor = this.theme.colors.surface;
    let textColor = this.theme.colors.text;
    
    if (type === 'success') {
      backgroundColor = 'rgba(0, 0, 0, 0.4)';
      textColor = '#90ff90';
    } else if (type === 'warning') {
      backgroundColor = 'rgba(0, 0, 0, 0.4)';
      textColor = this.theme.colors.warning;
    } else if (type === 'error') {
      backgroundColor = 'rgba(0, 0, 0, 0.4)';
      textColor = this.theme.colors.error;
    }
    
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${backgroundColor};
      color: ${textColor};
      padding: ${this.theme.spacing.md};
      border-radius: ${this.theme.borderRadius};
      box-shadow: ${this.theme.shadows.lg};
      z-index: 10000;
      pointer-events: auto;
      animation: slideInUp 0.3s ease;
      min-width: 200px;
      text-align: center;
      font-weight: bold;
      transition: bottom 0.3s ease;
    `;
    
    const container = document.getElementById('ui-container');
    if (container) {
      // Add new notification to queue
      this.notificationQueue.push(notification);
      container.appendChild(notification);
      
      // Update positions of all notifications (push older ones up)
      this.updateNotificationPositions();
      
      setTimeout(() => {
        notification.style.animation = 'fadeOutScale 0.3s ease';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
          // Remove from queue
          const index = this.notificationQueue.indexOf(notification);
          if (index > -1) {
            this.notificationQueue.splice(index, 1);
          }
          // Update positions after removal
          this.updateNotificationPositions();
        }, 300);
      }, duration);
    }
  }

  private updateNotificationPositions(): void {
    const baseBottom = 20; // Base distance from bottom
    const spacing = 10; // Space between notifications
    
    // Update each notification's position from bottom to top
    this.notificationQueue.forEach((notification, index) => {
      const offset = index * (notification.offsetHeight + spacing);
      notification.style.bottom = `${baseBottom + offset}px`;
    });
  }

  public getTheme(): UITheme {
    return this.theme;
  }

  public isMobileDevice(): boolean {
    return this.isMobile;
  }

  public destroy(): void {
    this.components.forEach(component => component.destroy());
    this.components.clear();
    
    const container = document.getElementById('ui-container');
    if (container) {
      container.remove();
    }
  }
}