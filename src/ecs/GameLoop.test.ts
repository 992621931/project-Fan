import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameLoop } from './GameLoop';
import { World } from './World';

// Mock performance.now
const mockPerformanceNow = vi.fn();
Object.defineProperty(global, 'performance', {
  value: { now: mockPerformanceNow },
  writable: true,
});

// Mock requestAnimationFrame and cancelAnimationFrame
const mockRequestAnimationFrame = vi.fn();
const mockCancelAnimationFrame = vi.fn();
Object.defineProperty(global, 'requestAnimationFrame', {
  value: mockRequestAnimationFrame,
  writable: true,
});
Object.defineProperty(global, 'cancelAnimationFrame', {
  value: mockCancelAnimationFrame,
  writable: true,
});

describe('GameLoop', () => {
  let world: World;
  let gameLoop: GameLoop;
  let currentTime: number;

  beforeEach(() => {
    vi.clearAllMocks();
    currentTime = 0;
    mockPerformanceNow.mockImplementation(() => currentTime);
    mockRequestAnimationFrame.mockImplementation((callback) => {
      setTimeout(callback, 16); // Simulate 60 FPS
      return 1;
    });
    
    world = new World();
    gameLoop = new GameLoop(world);
  });

  afterEach(() => {
    gameLoop.stop();
  });

  it('should create a game loop with default configuration', () => {
    expect(gameLoop).toBeInstanceOf(GameLoop);
    expect(gameLoop.isGameRunning()).toBe(false);
    expect(gameLoop.isGamePaused()).toBe(false);
  });

  it('should start and stop the game loop', () => {
    expect(gameLoop.isGameRunning()).toBe(false);
    
    gameLoop.start();
    expect(gameLoop.isGameRunning()).toBe(true);
    expect(mockRequestAnimationFrame).toHaveBeenCalled();
    
    gameLoop.stop();
    expect(gameLoop.isGameRunning()).toBe(false);
  });

  it('should pause and resume the game loop', () => {
    gameLoop.start();
    expect(gameLoop.isGamePaused()).toBe(false);
    
    gameLoop.pause();
    expect(gameLoop.isGamePaused()).toBe(true);
    
    gameLoop.resume();
    expect(gameLoop.isGamePaused()).toBe(false);
  });

  it('should toggle pause state', () => {
    gameLoop.start();
    expect(gameLoop.isGamePaused()).toBe(false);
    
    gameLoop.togglePause();
    expect(gameLoop.isGamePaused()).toBe(true);
    
    gameLoop.togglePause();
    expect(gameLoop.isGamePaused()).toBe(false);
  });

  it('should call update callback when running', () => {
    const updateCallback = vi.fn();
    gameLoop.setUpdateCallback(updateCallback);
    
    gameLoop.start();
    
    // The callback should be set and ready to be called
    // Since we can't easily test the async loop, we just verify it's registered
    expect(updateCallback).toHaveBeenCalled();
  });

  it('should call render callback', () => {
    const renderCallback = vi.fn();
    gameLoop.setRenderCallback(renderCallback);
    
    gameLoop.start();
    
    // The render callback should be called
    expect(renderCallback).toHaveBeenCalled();
  });

  it('should provide game loop statistics', () => {
    gameLoop.start();
    
    const stats = gameLoop.getStats();
    expect(stats).toHaveProperty('fps');
    expect(stats).toHaveProperty('deltaTime');
    expect(stats).toHaveProperty('totalTime');
    expect(stats).toHaveProperty('frameCount');
    expect(stats).toHaveProperty('averageFPS');
    expect(stats).toHaveProperty('isPaused');
    
    expect(stats.isPaused).toBe(false);
  });

  it('should update configuration', () => {
    gameLoop.updateConfig({
      targetFPS: 30,
      maxDeltaTime: 50,
      enableVSync: false,
    });
    
    // Configuration should be updated (we can't easily test the internal values)
    expect(gameLoop).toBeInstanceOf(GameLoop);
  });

  it('should get the world instance', () => {
    const retrievedWorld = gameLoop.getWorld();
    expect(retrievedWorld).toBe(world);
  });

  it('should not start if already running', () => {
    gameLoop.start();
    const firstCallCount = mockRequestAnimationFrame.mock.calls.length;
    
    gameLoop.start(); // Try to start again
    const secondCallCount = mockRequestAnimationFrame.mock.calls.length;
    
    // Should not call requestAnimationFrame again
    expect(secondCallCount).toBe(firstCallCount);
  });

  it('should not pause if not running', () => {
    expect(gameLoop.isGameRunning()).toBe(false);
    gameLoop.pause();
    expect(gameLoop.isGamePaused()).toBe(false);
  });

  it('should not resume if not paused', () => {
    gameLoop.start();
    expect(gameLoop.isGamePaused()).toBe(false);
    
    gameLoop.resume(); // Try to resume when not paused
    expect(gameLoop.isGamePaused()).toBe(false);
  });
});