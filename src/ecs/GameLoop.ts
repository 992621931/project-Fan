/**
 * GameLoop - Handles the main game update and render loop with time management
 */

import { World } from './World';

export interface GameLoopConfig {
  targetFPS?: number;
  maxDeltaTime?: number;
  enableVSync?: boolean;
}

export interface GameLoopStats {
  fps: number;
  deltaTime: number;
  totalTime: number;
  frameCount: number;
  averageFPS: number;
  isPaused: boolean;
}

export class GameLoop {
  private world: World;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastTime: number = 0;
  private totalTime: number = 0;
  private frameCount: number = 0;
  private fpsHistory: number[] = [];
  private animationFrameId: number | null = null;
  
  // Configuration
  private targetFPS: number;
  private targetFrameTime: number;
  private maxDeltaTime: number;
  private enableVSync: boolean;
  
  // Callbacks
  private updateCallback?: (deltaTime: number) => void;
  private renderCallback?: (deltaTime: number) => void;
  private statsCallback?: (stats: GameLoopStats) => void;
  
  constructor(world: World, config: GameLoopConfig = {}) {
    this.world = world;
    this.targetFPS = config.targetFPS || 60;
    this.targetFrameTime = 1000 / this.targetFPS;
    this.maxDeltaTime = config.maxDeltaTime || 100; // Max 100ms delta to prevent spiral of death
    this.enableVSync = config.enableVSync !== false; // Default to true
  }
  
  /**
   * Start the game loop
   */
  public start(): void {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.totalTime = 0;
    this.frameCount = 0;
    this.fpsHistory = [];
    
    // Initialize the world if not already initialized
    if (!this.world.isInitialized()) {
      this.world.initialize();
    }
    
    this.loop();
  }
  
  /**
   * Stop the game loop
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    this.isPaused = false;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Pause the game loop
   */
  public pause(): void {
    if (!this.isRunning || this.isPaused) {
      return;
    }
    
    this.isPaused = true;
  }
  
  /**
   * Resume the game loop
   */
  public resume(): void {
    if (!this.isRunning || !this.isPaused) {
      return;
    }
    
    this.isPaused = false;
    this.lastTime = performance.now(); // Reset time to prevent large delta
  }
  
  /**
   * Toggle pause state
   */
  public togglePause(): void {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }
  
  /**
   * Main game loop
   */
  private loop = (): void => {
    if (!this.isRunning) {
      return;
    }
    
    const currentTime = performance.now();
    let deltaTime = currentTime - this.lastTime;
    
    // Clamp delta time to prevent spiral of death
    deltaTime = Math.min(deltaTime, this.maxDeltaTime);
    
    // Start performance monitoring
    const performanceMonitor = this.world.getPerformanceMonitor();
    performanceMonitor.startFrame();
    
    // Update frame statistics
    this.updateStats(deltaTime);
    
    // Only update if not paused
    if (!this.isPaused) {
      // Update the world
      this.world.update(deltaTime);
      
      // Call custom update callback
      if (this.updateCallback) {
        this.updateCallback(deltaTime);
      }
      
      this.totalTime += deltaTime;
    }
    
    // Always render (even when paused)
    if (this.renderCallback) {
      performanceMonitor.startRender();
      this.renderCallback(deltaTime);
      performanceMonitor.endRender();
    }
    
    // Record frame performance metrics
    this.world.recordFrameMetrics();
    
    // Call stats callback
    if (this.statsCallback) {
      this.statsCallback(this.getStats());
    }
    
    this.lastTime = currentTime;
    this.frameCount++;
    
    // Schedule next frame
    if (this.enableVSync) {
      this.animationFrameId = requestAnimationFrame(this.loop);
    } else {
      // Manual frame rate limiting
      const frameTime = performance.now() - currentTime;
      const delay = Math.max(0, this.targetFrameTime - frameTime);
      this.animationFrameId = setTimeout(() => {
        this.animationFrameId = requestAnimationFrame(this.loop);
      }, delay) as any;
    }
  };
  
  /**
   * Update frame statistics
   */
  private updateStats(deltaTime: number): void {
    const fps = deltaTime > 0 ? 1000 / deltaTime : 0;
    
    // Keep a rolling average of FPS
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 60) { // Keep last 60 frames
      this.fpsHistory.shift();
    }
  }
  
  /**
   * Get current game loop statistics
   */
  public getStats(): GameLoopStats {
    const currentFPS = this.fpsHistory.length > 0 ? this.fpsHistory[this.fpsHistory.length - 1] : 0;
    const averageFPS = this.fpsHistory.length > 0 
      ? this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length 
      : 0;
    
    return {
      fps: Math.round(currentFPS),
      deltaTime: this.lastTime > 0 ? performance.now() - this.lastTime : 0,
      totalTime: this.totalTime,
      frameCount: this.frameCount,
      averageFPS: Math.round(averageFPS),
      isPaused: this.isPaused,
    };
  }
  
  /**
   * Set update callback
   */
  public setUpdateCallback(callback: (deltaTime: number) => void): void {
    this.updateCallback = callback;
  }
  
  /**
   * Set render callback
   */
  public setRenderCallback(callback: (deltaTime: number) => void): void {
    this.renderCallback = callback;
  }
  
  /**
   * Set stats callback
   */
  public setStatsCallback(callback: (stats: GameLoopStats) => void): void {
    this.statsCallback = callback;
  }
  
  /**
   * Get current state
   */
  public isGameRunning(): boolean {
    return this.isRunning;
  }
  
  /**
   * Get pause state
   */
  public isGamePaused(): boolean {
    return this.isPaused;
  }
  
  /**
   * Get the world instance
   */
  public getWorld(): World {
    return this.world;
  }
  
  /**
   * Update configuration
   */
  public updateConfig(config: Partial<GameLoopConfig>): void {
    if (config.targetFPS !== undefined) {
      this.targetFPS = config.targetFPS;
      this.targetFrameTime = 1000 / this.targetFPS;
    }
    
    if (config.maxDeltaTime !== undefined) {
      this.maxDeltaTime = config.maxDeltaTime;
    }
    
    if (config.enableVSync !== undefined) {
      this.enableVSync = config.enableVSync;
    }
  }
}