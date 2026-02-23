import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Game } from './index';

// Mock DOM elements
const mockCanvas = {
  getContext: vi.fn(() => ({
    fillStyle: '',
    font: '',
    textAlign: '',
    fillText: vi.fn(),
  })),
  width: 800,
  height: 600,
};

const mockDocument = {
  getElementById: vi.fn(),
  createElement: vi.fn(() => mockCanvas),
  addEventListener: vi.fn(),
};

const mockWindow = {
  innerWidth: 800,
  innerHeight: 600,
  addEventListener: vi.fn(),
};

// Setup global mocks
Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true,
});

Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true,
});

describe('Game', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a game instance', () => {
    const game = new Game();
    expect(game).toBeInstanceOf(Game);
  });

  it('should have isInitialized method', () => {
    const game = new Game();
    expect(typeof game.isInitialized).toBe('function');
  });

  it('should initialize with proper DOM setup', () => {
    // Mock the game container element
    const mockContainer = {
      innerHTML: '',
      appendChild: vi.fn(),
    };
    
    mockDocument.getElementById.mockReturnValue(mockContainer);
    
    const game = new Game();
    
    // Verify DOM interactions
    expect(mockDocument.getElementById).toHaveBeenCalledWith('loading');
    expect(mockDocument.getElementById).toHaveBeenCalledWith('game-container');
  });
});