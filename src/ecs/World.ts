/**
 * World - Main ECS coordinator that manages entities, components, systems, and events
 */

import { Entity, EntityId } from './Entity';
import { ComponentType, IComponent } from './Component';
import { System, ISystem } from './System';
import { EntityManager } from './EntityManager';
import { ComponentManager } from './ComponentManager';
import { EventSystem, IEvent } from './EventSystem';
import { PoolManager } from './ObjectPool';
import { CacheManager } from './CacheSystem';
import { PerformanceMonitor } from './PerformanceMonitor';

export class World {
  public entityManager: EntityManager;
  public componentManager: ComponentManager;
  private eventSystem: EventSystem;
  private systems: Map<string, ISystem> = new Map();
  private initialized: boolean = false;
  
  // Performance optimization systems
  private poolManager: PoolManager;
  private cacheManager: CacheManager;
  private performanceMonitor: PerformanceMonitor;
  
  constructor(eventSystem?: EventSystem) {
    this.componentManager = new ComponentManager();
    this.entityManager = new EntityManager(this.componentManager);
    this.eventSystem = eventSystem || new EventSystem();
    this.poolManager = new PoolManager();
    this.cacheManager = new CacheManager();
    this.performanceMonitor = new PerformanceMonitor();
  }
  
  /**
   * Initialize the world and all systems
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }
    
    // Initialize all systems
    for (const system of this.systems.values()) {
      system.initialize(this.entityManager, this.componentManager, this.eventSystem);
    }
    
    this.initialized = true;
  }
  
  /**
   * Update all systems
   */
  public update(deltaTime: number): void {
    if (!this.initialized) {
      return;
    }
    
    // Start performance monitoring
    this.performanceMonitor.startUpdate();
    
    // Process queued events first
    this.eventSystem.processQueue();
    
    // Update all systems
    for (const system of this.systems.values()) {
      system.update(deltaTime);
    }
    
    // End performance monitoring
    this.performanceMonitor.endUpdate();
  }
  
  /**
   * Shutdown the world and all systems
   */
  public shutdown(): void {
    if (!this.initialized) {
      return;
    }
    
    // Shutdown all systems
    for (const system of this.systems.values()) {
      system.shutdown();
    }
    
    // Clear all data
    this.systems.clear();
    this.entityManager.clear();
    this.componentManager.clear();
    this.eventSystem.clear();
    
    // Clear performance optimization systems
    this.poolManager.clearAll();
    this.cacheManager.clearAll();
    this.performanceMonitor.clearAlerts();
    
    this.initialized = false;
  }
  
  /**
   * Add a system to the world
   */
  public addSystem(system: ISystem): void {
    if (this.systems.has(system.name)) {
      throw new Error(`System with name '${system.name}' already exists`);
    }
    
    this.systems.set(system.name, system);
    
    // Initialize the system if the world is already initialized
    if (this.initialized) {
      system.initialize(this.entityManager, this.componentManager, this.eventSystem);
    }
  }
  
  /**
   * Remove a system from the world
   */
  public removeSystem(systemName: string): boolean {
    const system = this.systems.get(systemName);
    
    if (!system) {
      return false;
    }
    
    // Shutdown the system if it's initialized
    if (this.initialized) {
      system.shutdown();
    }
    
    this.systems.delete(systemName);
    return true;
  }
  
  /**
   * Get a system by name
   */
  public getSystem<T extends ISystem>(systemName: string): T | null {
    return (this.systems.get(systemName) as T) || null;
  }
  
  /**
   * Check if a system exists
   */
  public hasSystem(systemName: string): boolean {
    return this.systems.has(systemName);
  }
  
  /**
   * Get all system names
   */
  public getSystemNames(): string[] {
    return Array.from(this.systems.keys());
  }
  
  // Entity management methods
  
  /**
   * Create a new entity
   */
  public createEntity(id?: EntityId): Entity {
    return this.entityManager.createEntity(id);
  }
  
  /**
   * Destroy an entity
   */
  public destroyEntity(entityId: EntityId): boolean {
    return this.entityManager.destroyEntity(entityId);
  }
  
  /**
   * Get an entity by ID
   */
  public getEntity(entityId: EntityId): Entity | null {
    return this.entityManager.getEntity(entityId);
  }
  
  /**
   * Get all entities
   */
  public getAllEntities(): Entity[] {
    return this.entityManager.getAllEntities();
  }
  
  /**
   * Get entities that have a specific component
   */
  public getEntitiesWithComponent<T extends IComponent>(componentType: ComponentType<T>): EntityId[] {
    return this.entityManager.getEntitiesWithComponents([componentType]);
  }
  
  /**
   * Get entities that have all specified components
   */
  public getEntitiesWithComponents(componentTypes: ComponentType<any>[]): EntityId[] {
    return this.entityManager.getEntitiesWithComponents(componentTypes);
  }
  
  // Component management methods
  
  /**
   * Add a component to an entity
   */
  public addComponent<T extends IComponent>(entityId: EntityId, componentType: ComponentType<T>, component: T): void {
    this.componentManager.addComponent(entityId, componentType, component);
  }
  
  /**
   * Remove a component from an entity
   */
  public removeComponent<T extends IComponent>(entityId: EntityId, componentType: ComponentType<T>): boolean {
    return this.componentManager.removeComponent(entityId, componentType);
  }
  
  /**
   * Get a component from an entity
   */
  public getComponent<T extends IComponent>(entityId: EntityId, componentType: ComponentType<T>): T | null {
    return this.componentManager.getComponent(entityId, componentType);
  }
  
  /**
   * Check if an entity has a component
   */
  public hasComponent<T extends IComponent>(entityId: EntityId, componentType: ComponentType<T>): boolean {
    return this.componentManager.hasComponent(entityId, componentType);
  }
  
  // Event system methods
  
  /**
   * Emit an event
   */
  public emit<T extends IEvent>(event: T): void {
    this.eventSystem.emit(event);
  }
  
  /**
   * Queue an event
   */
  public queue<T extends IEvent>(event: T): void {
    this.eventSystem.queue(event);
  }
  
  /**
   * Subscribe to an event
   */
  public subscribe<T extends IEvent>(eventType: string, handler: (event: T) => void): void {
    this.eventSystem.subscribe(eventType, handler);
  }
  
  /**
   * Unsubscribe from an event
   */
  public unsubscribe<T extends IEvent>(eventType: string, handler: (event: T) => void): boolean {
    return this.eventSystem.unsubscribe(eventType, handler);
  }
  
  // Utility methods
  
  /**
   * Check if the world is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Get world statistics
   */
  public getStats(): {
    entityCount: number;
    componentCount: number;
    systemCount: number;
    queuedEventCount: number;
    poolStats: Record<string, any>;
    cacheStats: Record<string, any>;
    performanceMetrics: any;
  } {
    const poolStats = this.poolManager.getAllStats();
    const cacheStats = this.cacheManager.getAllStats();
    const performanceMetrics = this.performanceMonitor.getCurrentMetrics();
    
    return {
      entityCount: this.entityManager.getEntityCount(),
      componentCount: this.componentManager.getComponentCount(),
      systemCount: this.systems.size,
      queuedEventCount: this.eventSystem.getQueueSize(),
      poolStats,
      cacheStats,
      performanceMetrics,
    };
  }
  
  // Performance optimization accessors
  
  /**
   * Get the pool manager
   */
  public getPoolManager(): PoolManager {
    return this.poolManager;
  }
  
  /**
   * Get the cache manager
   */
  public getCacheManager(): CacheManager {
    return this.cacheManager;
  }
  
  /**
   * Get the performance monitor
   */
  public getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }
  
  /**
   * Record frame performance metrics
   */
  public recordFrameMetrics(): void {
    const stats = this.getStats();
    const cacheHitRate = this.calculateAverageCacheHitRate();
    const poolEfficiency = this.calculateAveragePoolEfficiency();
    
    this.performanceMonitor.endFrame(
      stats.entityCount,
      stats.componentCount,
      stats.systemCount,
      cacheHitRate,
      poolEfficiency
    );
  }
  
  /**
   * Calculate average cache hit rate across all caches
   */
  private calculateAverageCacheHitRate(): number {
    const cacheStats = this.cacheManager.getAllStats();
    const cacheNames = Object.keys(cacheStats);
    
    if (cacheNames.length === 0) return 0;
    
    const totalHitRate = cacheNames.reduce((sum, name) => {
      return sum + (cacheStats[name].hitRate || 0);
    }, 0);
    
    return totalHitRate / cacheNames.length;
  }
  
  /**
   * Calculate average pool efficiency across all pools
   */
  private calculateAveragePoolEfficiency(): number {
    const poolStats = this.poolManager.getAllStats();
    const poolNames = Object.keys(poolStats);
    
    if (poolNames.length === 0) return 0;
    
    const totalEfficiency = poolNames.reduce((sum, name) => {
      return sum + (poolStats[name].efficiency || 0);
    }, 0);
    
    return totalEfficiency / poolNames.length;
  }
}