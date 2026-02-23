import { describe, it, expect, beforeEach } from 'vitest';
import { Entity } from './Entity';

describe('Entity', () => {
  beforeEach(() => {
    Entity.resetIdCounter();
  });

  it('should create entities with unique IDs', () => {
    const entity1 = new Entity();
    const entity2 = new Entity();
    
    expect(entity1.id).toBe(1);
    expect(entity2.id).toBe(2);
    expect(entity1.id).not.toBe(entity2.id);
  });

  it('should create entities with specific IDs', () => {
    const entity1 = new Entity(5);
    const entity2 = new Entity(3);
    const entity3 = new Entity(); // Should get next available ID
    
    expect(entity1.id).toBe(5);
    expect(entity2.id).toBe(3);
    expect(entity3.id).toBe(6); // Next ID after 5
  });

  it('should increment ID counter correctly', () => {
    expect(Entity.getNextId()).toBe(1);
    
    new Entity();
    expect(Entity.getNextId()).toBe(2);
    
    new Entity();
    expect(Entity.getNextId()).toBe(3);
  });

  it('should update counter when creating entity with higher ID', () => {
    expect(Entity.getNextId()).toBe(1);
    
    new Entity(10);
    expect(Entity.getNextId()).toBe(11);
    
    new Entity(); // Should get ID 11
    expect(Entity.getNextId()).toBe(12);
  });

  it('should reset ID counter', () => {
    new Entity();
    new Entity();
    expect(Entity.getNextId()).toBe(3);
    
    Entity.resetIdCounter();
    expect(Entity.getNextId()).toBe(1);
    
    const entity = new Entity();
    expect(entity.id).toBe(1);
  });
});