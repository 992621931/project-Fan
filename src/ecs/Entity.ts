/**
 * Entity - A unique identifier in the ECS system
 * Entities are just IDs that can have components attached to them
 */

export type EntityId = number;

export class Entity {
  private static nextId: EntityId = 1;
  
  public readonly id: EntityId;
  
  constructor(id?: EntityId) {
    if (id !== undefined) {
      // Used for deserialization - create entity with specific ID
      this.id = id;
      // Update nextId if necessary
      if (id >= Entity.nextId) {
        Entity.nextId = id + 1;
      }
    } else {
      // Normal entity creation
      this.id = Entity.nextId++;
    }
  }
  
  /**
   * Reset the entity ID counter (useful for testing)
   */
  public static resetIdCounter(): void {
    Entity.nextId = 1;
  }
  
  /**
   * Get the current next ID (useful for testing)
   */
  public static getNextId(): EntityId {
    return Entity.nextId;
  }
}