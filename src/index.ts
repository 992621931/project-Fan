/**
 * 代号：饭 - Codename Rice Game
 * 
 * A fantasy-themed idle simulation management game built with TypeScript and ECS architecture.
 * Features character collection, crafting, exploration, shop management, and more.
 */

import './styles/main.css';
import { EventSystem } from './ecs/EventSystem';
import { World } from './ecs/World';
import { GameUI } from './ui/GameUI';
import { initializeVersionManager, getVersionManager, VersionInfo } from './utils/VersionManager';
import { initializeUpdateNotifications } from './ui/components/UpdateNotification';

// Declare global version info
declare global {
  interface Window {
    __VERSION_INFO__: VersionInfo;
    gameWorld?: World;
    game?: Game;
  }
}

// Main game entry point
class Game {
  private initialized: boolean = false;
  private eventSystem: EventSystem;
  private world: World;
  private gameUI: GameUI;

  constructor() {
    this.eventSystem = new EventSystem();
    this.world = new World(this.eventSystem);
    this.gameUI = new GameUI(this.eventSystem, this.world, document.getElementById('game-container')!);
    this.init();
  }

  private async init(): Promise<void> {
    try {
      // Initialize version management first
      this.initializeVersionManagement();
      
      console.log('🍚 代号：饭 - Codename Rice Game');
      console.log('🎮 Initializing game systems...');
      
      const versionManager = getVersionManager();
      console.log('📦 Version:', versionManager.getVersionString());
      
      // Remove loading screen
      const loadingElement = document.getElementById('loading');
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
      
      // Initialize game systems
      await this.initializeGameSystems();
      
      // Initialize update notifications
      this.initializeUpdateSystem();
      
      // Create game canvas (background) - DISABLED
      // this.createGameCanvas();
      
      // Start game loop
      this.startGameLoop();
      
      // Show welcome message
      this.gameUI.showNotification('🍚 代号：饭 - 游戏系统已启动！', 'success', 5000);
      
      this.initialized = true;
      console.log('✅ Game initialized successfully!');
      
    } catch (error) {
      console.error('❌ Failed to initialize game:', error);
      this.showError('游戏初始化失败，请刷新页面重试。');
    }
  }

  private lastFrameTime: number = 0;

  private startGameLoop(): void {
    console.log('🎮 Starting game loop...');
    this.lastFrameTime = performance.now();
    this.gameLoop();
  }

  private gameLoop = (): void => {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = currentTime;

    // Update world (which updates all systems)
    this.world.update(deltaTime);

    // Continue loop
    requestAnimationFrame(this.gameLoop);
  };

  private initializeVersionManagement(): void {
    // Get version info from webpack DefinePlugin or fallback
    let versionInfo: VersionInfo;
    
    try {
      versionInfo = window.__VERSION_INFO__ || {
        version: 'dev',
        buildTime: new Date().toISOString(),
        commit: 'unknown',
        branch: 'development',
        environment: 'development'
      };
    } catch (error) {
      versionInfo = {
        version: 'dev',
        buildTime: new Date().toISOString(),
        commit: 'unknown',
        branch: 'development',
        environment: 'development'
      };
    }
    
    initializeVersionManager(versionInfo);
    
    // Log version info to console
    const versionManager = getVersionManager();
    console.log('📋 Version Details:\n' + versionManager.getDetailedVersionInfo());
  }

  private initializeUpdateSystem(): void {
    // Only initialize update notifications in production
    const versionManager = getVersionManager();
    
    if (versionManager.isProduction()) {
      try {
        initializeUpdateNotifications();
        console.log('🔄 Update notification system initialized');
      } catch (error) {
        console.warn('⚠️ Failed to initialize update notifications:', error);
      }
    } else {
      console.log('🔧 Running in development mode - update notifications disabled');
    }
  }

  private async initializeGameSystems(): Promise<void> {
    // Initialize ECS world
    console.log('🌍 Initializing ECS World...');
    
    // Load game data and initialize ConfigManager
    console.log('📦 Loading game data...');
    try {
      const { DataLoader } = await import('./game/data/DataLoader');
      const dataLoader = DataLoader.getInstance();
      await dataLoader.loadGameData();
      console.log('✅ Game data loaded successfully');
    } catch (error) {
      console.error('⚠️ Failed to load game data:', error);
      console.log('⚠️ Initializing ConfigManager with embedded configuration');
      
      // Fallback: Initialize ConfigManager with embedded config
      try {
        const { ConfigManager } = await import('./game/config/ConfigManager');
        const configManager = ConfigManager.getInstance();
        await configManager.initialize();
        console.log('✅ ConfigManager initialized with embedded config');
      } catch (fallbackError) {
        console.error('❌ Failed to initialize ConfigManager:', fallbackError);
      }
    }
    
    // Create a test player entity for UI demonstration
    const playerEntity = this.world.createEntity();
    
    // Add currency component to player with initial amounts
    const currencyComponent = {
      type: 'currency' as const,
      amounts: {
        gold: 0,
        crystal: 0,
        reputation: 0
      },
      transactionHistory: []
    };
    
    // Import CurrencyComponentType
    const { CurrencyComponentType } = await import('./game/components/SystemComponents');
    this.world.addComponent(playerEntity.id, CurrencyComponentType, currencyComponent);
    
    this.gameUI.setPlayerEntity(playerEntity);
    
    // Setup event listeners
    this.setupEventListeners();
    
    console.log('✅ Game systems initialized');
  }

  private setupEventListeners(): void {
    // Handle window resize
    window.addEventListener('resize', () => {
      this.handleResize();
    });

    // Handle visibility change (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('🎮 Game paused (tab hidden)');
      } else {
        console.log('🎮 Game resumed (tab visible)');
      }
    });

    // Add keyboard shortcuts for version info
    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+V to show version info
      if (event.ctrlKey && event.shiftKey && event.key === 'V') {
        this.showVersionInfo();
      }
    });
  }

  private showVersionInfo(): void {
    const versionManager = getVersionManager();
    const versionInfo = versionManager.getDetailedVersionInfo();
    
    this.gameUI.showNotification(
      `📦 版本信息\n${versionInfo}`,
      'success',
      8000
    );
  }

  private handleResize(): void {
    // Canvas disabled
    /*
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      this.drawBackground(canvas);
    }
    */
  }

  private createGameCanvas(): void {
    const container = document.getElementById('game-container');
    if (!container) {
      throw new Error('Game container not found');
    }

    // Create main game canvas (background layer)
    const canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      z-index: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      pointer-events: none;
    `;
    
    // Draw background
    this.drawBackground(canvas);
    
    // Insert canvas as background
    container.insertBefore(canvas, container.firstChild);
  }

  private drawBackground(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw subtle pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    const gridSize = 50;
    
    for (let x = 0; x < canvas.width; x += gridSize) {
      for (let y = 0; y < canvas.height; y += gridSize) {
        if ((x / gridSize + y / gridSize) % 2 === 0) {
          ctx.fillRect(x, y, gridSize, gridSize);
        }
      }
    }
    
    // Draw game title in center (when no UI is open)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.font = 'bold 48px Arial, Microsoft YaHei';
    ctx.textAlign = 'center';
    ctx.fillText('🍚 代号：饭', canvas.width / 2, canvas.height / 2 - 50);
    
    ctx.font = '20px Arial, Microsoft YaHei';
    ctx.fillText('Codename Rice Game', canvas.width / 2, canvas.height / 2);
    
    ctx.font = '16px Arial, Microsoft YaHei';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillText('使用底部菜单栏开始游戏', canvas.width / 2, canvas.height / 2 + 40);
    ctx.fillText('按 C 打开角色面板，按 I 打开背包', canvas.width / 2, canvas.height / 2 + 65);
    
    // Add version info in corner
    const versionManager = getVersionManager();
    ctx.font = '12px Arial, Microsoft YaHei';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.textAlign = 'right';
    ctx.fillText(versionManager.getVersionString(), canvas.width - 20, canvas.height - 20);
    
    // Add performance info if available
    const performanceMonitor = this.world.getPerformanceMonitor();
    const currentMetrics = performanceMonitor.getCurrentMetrics();
    
    if (currentMetrics) {
      const fps = Math.round(1000 / currentMetrics.frameTime);
      ctx.textAlign = 'left';
      ctx.fillText(`FPS: ${fps}`, 20, canvas.height - 20);
    }
  }

  private showError(message: string): void {
    const container = document.getElementById('game-container');
    if (container) {
      container.innerHTML = `
        <div style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          color: #ff6b6b;
          background: rgba(0,0,0,0.8);
          padding: 40px;
          border-radius: 12px;
          z-index: 10000;
        ">
          <h2>❌ 错误</h2>
          <p style="margin: 20px 0;">${message}</p>
          <button onclick="location.reload()" style="
            padding: 12px 24px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.2s ease;
          " onmouseover="this.style.background='#2980b9'" onmouseout="this.style.background='#3498db'">
            重新加载
          </button>
        </div>
      `;
    }
  }

  public getEventSystem(): EventSystem {
    return this.eventSystem;
  }

  public getWorld(): World {
    return this.world;
  }

  public getGameUI(): GameUI {
    return this.gameUI;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public destroy(): void {
    this.gameUI.destroy();
    console.log('🎮 Game destroyed');
  }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  // Expose to window for debugging
  window.game = game;
  window.gameWorld = game.getWorld();
});

// Export for potential testing
export { Game };