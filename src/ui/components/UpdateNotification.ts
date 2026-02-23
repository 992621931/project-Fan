/**
 * UpdateNotification - UI component for displaying update notifications
 */

import { BaseUIComponent } from '../BaseUIComponent';
import { UpdateInfo, getVersionManager } from '../../utils/VersionManager';

export class UpdateNotification extends BaseUIComponent {
  private notification: HTMLElement | null = null;
  private isVisible: boolean = false;
  private updateInfo: UpdateInfo | null = null;

  constructor(uiManager: any, eventSystem: any, container: HTMLElement) {
    super('update-notification', uiManager, eventSystem);
    this.initialize();
  }

  protected createElement(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'update-notification-container';
    return element;
  }

  private initialize(): void {
    this.createNotificationElement();
    this.setupVersionManager();
  }

  private createNotificationElement(): void {
    this.notification = document.createElement('div');
    this.notification.className = 'update-notification';
    this.notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      max-width: 350px;
      transform: translateX(400px);
      transition: transform 0.3s ease-in-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    `;

    // Initially hidden
    this.notification.style.display = 'none';
    document.body.appendChild(this.notification);
  }

  private setupVersionManager(): void {
    const versionManager = getVersionManager();
    
    // Start checking for updates
    versionManager.startUpdateChecking((updateInfo) => {
      this.showUpdateNotification(updateInfo);
    });
  }

  private showUpdateNotification(updateInfo: UpdateInfo): void {
    if (!this.notification || this.isVisible) return;

    this.updateInfo = updateInfo;
    this.isVisible = true;

    // Create notification content
    const content = this.createNotificationContent(updateInfo);
    this.notification.innerHTML = content;

    // Show notification
    this.notification.style.display = 'block';
    
    // Animate in
    setTimeout(() => {
      if (this.notification) {
        this.notification.style.transform = 'translateX(0)';
      }
    }, 100);

    // Auto-hide after 10 seconds if not interacted with
    setTimeout(() => {
      if (this.isVisible && !this.notification?.matches(':hover')) {
        this.hideNotification();
      }
    }, 10000);
  }

  private createNotificationContent(updateInfo: UpdateInfo): string {
    const { currentVersion, latestVersion } = updateInfo;
    
    return `
      <div class="update-notification-content">
        <div class="update-header">
          <strong>🚀 Update Available!</strong>
          <button class="close-btn" onclick="this.closest('.update-notification').style.display='none'">×</button>
        </div>
        <div class="update-body">
          <p>A new version of the game is available.</p>
          <div class="version-info">
            <div>Current: <code>${currentVersion}</code></div>
            <div>Latest: <code>${latestVersion}</code></div>
          </div>
        </div>
        <div class="update-actions">
          <button class="update-btn" onclick="window.location.reload()">
            Update Now
          </button>
          <button class="dismiss-btn" onclick="this.closest('.update-notification').style.display='none'">
            Later
          </button>
        </div>
      </div>
      
      <style>
        .update-notification-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .update-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .close-btn {
          background: none;
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background-color 0.2s;
        }
        
        .close-btn:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
        
        .update-body p {
          margin: 0 0 8px 0;
        }
        
        .version-info {
          background: rgba(255, 255, 255, 0.1);
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
        }
        
        .version-info code {
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 4px;
          border-radius: 2px;
          font-family: 'Courier New', monospace;
        }
        
        .update-actions {
          display: flex;
          gap: 8px;
        }
        
        .update-btn, .dismiss-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .update-btn {
          background: white;
          color: #667eea;
          flex: 1;
        }
        
        .update-btn:hover {
          background: #f0f0f0;
          transform: translateY(-1px);
        }
        
        .dismiss-btn {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .dismiss-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      </style>
    `;
  }

  private hideNotification(): void {
    if (!this.notification || !this.isVisible) return;

    this.notification.style.transform = 'translateX(400px)';
    
    setTimeout(() => {
      if (this.notification) {
        this.notification.style.display = 'none';
      }
      this.isVisible = false;
    }, 300);
  }

  public show(): void {
    if (this.updateInfo) {
      this.showUpdateNotification(this.updateInfo);
    }
  }

  public hide(): void {
    this.hideNotification();
  }

  public destroy(): void {
    const versionManager = getVersionManager();
    versionManager.stopUpdateChecking();
    
    if (this.notification) {
      document.body.removeChild(this.notification);
      this.notification = null;
    }
    
    this.isVisible = false;
    this.updateInfo = null;
  }

  public render(): void {
    // This component manages its own rendering
  }

  public update(): void {
    // Check for updates manually
    const versionManager = getVersionManager();
    versionManager.checkForUpdates().then(updateInfo => {
      if (updateInfo.hasUpdate) {
        this.showUpdateNotification(updateInfo);
      }
    });
  }
}

/**
 * Initialize update notifications for the application
 */
export function initializeUpdateNotifications(): UpdateNotification {
  const container = document.body;
  // Create dummy UI manager and event system for compatibility
  const dummyUIManager = { getTheme: () => ({ colors: { primary: '#667eea' } }) };
  const dummyEventSystem = { on: () => {}, emit: () => {} };
  return new UpdateNotification(dummyUIManager, dummyEventSystem, container);
}