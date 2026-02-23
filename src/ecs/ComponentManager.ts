/**
 * ComponentManager - Manages component storage and retrieval
 */

import { EntityId } from './Entity';
import { ComponentType, IComponent } from './Component';

export class ComponentManager {
  // Map from component type name to Map of entity ID to component instance
  private components: Map<string, Map<EntityId, IComponent>> = new Map();
  
  /**
   * Add a component to an entity
   */
  public addComponent<T extends IComponent>(entityId: EntityId, componentType: ComponentType<T>, component: T): void {
    let componentMap = this.components.get(componentType.name);
    
    if (!componentMap) {
      componentMap = new Map<EntityId, IComponent>();
      this.components.set(componentType.name, componentMap);
    }
    
    componentMap.set(entityId, component);
  }
  
  /**
   * Remove a component from an entity
   */
  public removeComponent<T extends IComponent>(entityId: EntityId, componentType: ComponentType<T>): boolean {
    const componentMap = this.components.get(componentType.name);
    
    if (!componentMap) {
      return false;
    }
    
    const removed = componentMap.delete(entityId);
    
    // Clean up empty component maps
    if (componentMap.size === 0) {
      this.components.delete(componentType.name);
    }
    
    return removed;
  }
  
  /**
   * Get a component from an entity
   */
  public getComponent<T extends IComponent>(entityId: EntityId, componentType: ComponentType<T>): T | null {
    const componentMap = this.components.get(componentType.name);
    
    if (!componentMap) {
      return null;
    }
    
    const component = componentMap.get(entityId);
    return component as T || null;
  }
  
  /**
   * Check if an entity has a specific component
   */
  public hasComponent<T extends IComponent>(entityId: EntityId, componentType: ComponentType<T>): boolean {
    const componentMap = this.components.get(componentType.name);
    return componentMap ? componentMap.has(entityId) : false;
  }
  
  /**
   * Get all components of a specific type
   */
  public getAllComponents<T extends IComponent>(componentType: ComponentType<T>): Map<EntityId, T> {
    const componentMap = this.components.get(componentType.name);
    
    if (!componentMap) {
      return new Map<EntityId, T>();
    }
    
    return componentMap as Map<EntityId, T>;
  }
  
  /**
   * Get all components for a specific entity
   */
  public getEntityComponents(entityId: EntityId): IComponent[] {
    const result: IComponent[] = [];
    
    for (const componentMap of this.components.values()) {
      const component = componentMap.get(entityId);
      if (component) {
        result.push(component);
      }
    }
    
    return result;
  }
  
  /**
   * Remove all components from an entity
   */
  public removeAllComponents(entityId: EntityId): void {
    for (const [componentTypeName, componentMap] of this.components.entries()) {
      componentMap.delete(entityId);
      
      // Clean up empty component maps
      if (componentMap.size === 0) {
        this.components.delete(componentTypeName);
      }
    }
  }
  
  /**
   * Get all registered component types
   */
  public getComponentTypes(): string[] {
    return Array.from(this.components.keys());
  }
  
  /**
   * Get the total number of components
   */
  public getComponentCount(): number {
    let count = 0;
    for (const componentMap of this.components.values()) {
      count += componentMap.size;
    }
    return count;
  }
  
  /**
   * Clear all components
   */
  public clear(): void {
    this.components.clear();
  }
}