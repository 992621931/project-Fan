/**
 * System - Contains game logic and operates on entities with specific components
 * Systems define behavior and process entities that match their component requirements
 */

import { EntityId } from './Entity';
import { ComponentType, IComponent } from './Component';
import { EntityManager } from './EntityManager';
import { ComponentManager } from './ComponentManager';
import { EventSystem } from './EventSystem';

export interface ISystem {
  readonly name: string;
  readonly requiredComponents: ComponentType<any>[];
  
  initialize(entityManager: EntityManager, componentManager: ComponentManager, eventSystem: EventSystem): void;
  update(deltaTime: number): void;
  shutdown(): void;
}

/**
 * Base system class that all systems should extend
 */
export abstract class System implements ISystem {
  public abstract readonly name: string;
  public abstract readonly requiredComponents: ComponentType<any>[];
  
  protected entityManager!: EntityManager;
  protected componentManager!: ComponentManager;
  protected eventSystem!: EventSystem;
  
  private initialized: boolean = false;
  
  public initialize(entityManager: EntityManager, componentManager: ComponentManager, eventSystem: EventSystem): void {
    this.entityManager = entityManager;
    this.componentManager = componentManager;
    this.eventSystem = eventSystem;
    this.initialized = true;
    this.onInitialize();
  }
  
  public abstract update(deltaTime: number): void;
  
  public shutdown(): void {
    this.onShutdown();
    this.initialized = false;
  }
  
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Get all entities that have the required components for this system
   */
  protected getEntities(): EntityId[] {
    return this.entityManager.getEntitiesWithComponents(this.requiredComponents);
  }
  
  /**
   * Get a specific component from an entity
   */
  protected getComponent<T extends IComponent>(entityId: EntityId, componentType: ComponentType<T>): T | null {
    return this.componentManager.getComponent(entityId, componentType);
  }
  
  /**
   * Check if an entity has a specific component
   */
  protected hasComponent<T extends IComponent>(entityId: EntityId, componentType: ComponentType<T>): boolean {
    return this.componentManager.hasComponent(entityId, componentType);
  }
  
  /**
   * Override this method to perform system-specific initialization
   */
  protected onInitialize(): void {
    // Default implementation does nothing
  }
  
  /**
   * Override this method to perform system-specific cleanup
   */
  protected onShutdown(): void {
    // Default implementation does nothing
  }
}