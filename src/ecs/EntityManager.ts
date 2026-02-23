/**
 * EntityManager - Manages entity creation, destruction, and component queries
 */

import { Entity, EntityId } from './Entity';
import { ComponentType, IComponent } from './Component';
import { ComponentManager } from './ComponentManager';

export class EntityManager {
  private entities: Map<EntityId, Entity> = new Map();
  private componentManager: ComponentManager;
  
  constructor(componentManager: ComponentManager) {
    this.componentManager = componentManager;
  }
  
  /**
   * Create a new entity
   */
  public createEntity(id?: EntityId): Entity {
    const entity = new Entity(id);
    this.entities.set(entity.id, entity);
    return entity;
  }
  
  /**
   * Destroy an entity and remove all its components
   */
  public destroyEntity(entityId: EntityId): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return false;
    }
    
    // Remove all components from this entity
    this.componentManager.removeAllComponents(entityId);
    
    // Remove the entity
    this.entities.delete(entityId);
    return true;
  }
  
  /**
   * Check if an entity exists
   */
  public hasEntity(entityId: EntityId): boolean {
    return this.entities.has(entityId);
  }
  
  /**
   * Get an entity by ID
   */
  public getEntity(entityId: EntityId): Entity | null {
    return this.entities.get(entityId) || null;
  }
  
  /**
   * Get all entities
   */
  public getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }
  
  /**
   * Get all entity IDs
   */
  public getAllEntityIds(): EntityId[] {
    return Array.from(this.entities.keys());
  }
  
  /**
   * Get entities that have all the specified components
   */
  public getEntitiesWithComponents(componentTypes: ComponentType<any>[]): EntityId[] {
    if (componentTypes.length === 0) {
      return this.getAllEntityIds();
    }
    
    const result: EntityId[] = [];
    
    for (const entityId of this.entities.keys()) {
      let hasAllComponents = true;
      
      for (const componentType of componentTypes) {
        if (!this.componentManager.hasComponent(entityId, componentType)) {
          hasAllComponents = false;
          break;
        }
      }
      
      if (hasAllComponents) {
        result.push(entityId);
      }
    }
    
    return result;
  }
  
  /**
   * Get entities that have any of the specified components
   */
  public getEntitiesWithAnyComponent(componentTypes: ComponentType<any>[]): EntityId[] {
    if (componentTypes.length === 0) {
      return [];
    }
    
    const result: EntityId[] = [];
    
    for (const entityId of this.entities.keys()) {
      for (const componentType of componentTypes) {
        if (this.componentManager.hasComponent(entityId, componentType)) {
          result.push(entityId);
          break; // Found at least one component, add entity and move to next
        }
      }
    }
    
    return result;
  }
  
  /**
   * Get the total number of entities
   */
  public getEntityCount(): number {
    return this.entities.size;
  }
  
  /**
   * Clear all entities and their components
   */
  public clear(): void {
    // Remove all components first
    for (const entityId of this.entities.keys()) {
      this.componentManager.removeAllComponents(entityId);
    }
    
    // Clear entities
    this.entities.clear();
  }
}