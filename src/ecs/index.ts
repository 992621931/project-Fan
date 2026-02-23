/**
 * ECS (Entity-Component-System) Architecture
 * 
 * This module provides the core ECS framework for the game.
 * All game objects are entities with components, and systems process the logic.
 */

// Core ECS classes
export { Entity, EntityId } from './Entity';
export { Component, IComponent, ComponentType, createComponentType } from './Component';
export { System, ISystem } from './System';

// Managers
export { EntityManager } from './EntityManager';
export { ComponentManager } from './ComponentManager';

// Event system
export { EventSystem, IEvent, EventHandler, createEvent } from './EventSystem';

// ECS World - Main coordinator
export { World } from './World';

// Game loop and time management
export { GameLoop, GameLoopConfig, GameLoopStats } from './GameLoop';
export { TimeManager, Timer, TimeScale } from './TimeManager';

// Save system
export { SaveSystem, SerializedWorld, SerializedEntity, SerializedComponent } from './SaveSystem';

// Performance optimization systems
export { ObjectPool, PoolManager, IPoolable } from './ObjectPool';
export { Cache, CacheManager, CacheConfig, CacheEntry } from './CacheSystem';
export { 
  PerformanceMonitor, 
  PerformanceMetrics, 
  PerformanceThresholds, 
  PerformanceAlert 
} from './PerformanceMonitor';