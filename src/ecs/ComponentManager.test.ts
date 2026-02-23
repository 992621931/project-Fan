import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentManager } from './ComponentManager';
import { createComponentType, Component } from './Component';

// Test components
class TestComponent extends Component {
  public readonly type = 'TestComponent';
  constructor(public value: number) {
    super();
  }
}

class AnotherComponent extends Component {
  public readonly type = 'AnotherComponent';
  constructor(public name: string) {
    super();
  }
}

const TestComponentType = createComponentType<TestComponent>('TestComponent');
const AnotherComponentType = createComponentType<AnotherComponent>('AnotherComponent');

describe('ComponentManager', () => {
  let componentManager: ComponentManager;

  beforeEach(() => {
    componentManager = new ComponentManager();
  });

  it('should add and retrieve components', () => {
    const entityId = 1;
    const component = new TestComponent(42);
    
    componentManager.addComponent(entityId, TestComponentType, component);
    
    const retrieved = componentManager.getComponent(entityId, TestComponentType);
    expect(retrieved).toBe(component);
    expect(retrieved?.value).toBe(42);
  });

  it('should check if entity has component', () => {
    const entityId = 1;
    const component = new TestComponent(42);
    
    expect(componentManager.hasComponent(entityId, TestComponentType)).toBe(false);
    
    componentManager.addComponent(entityId, TestComponentType, component);
    expect(componentManager.hasComponent(entityId, TestComponentType)).toBe(true);
  });

  it('should remove components', () => {
    const entityId = 1;
    const component = new TestComponent(42);
    
    componentManager.addComponent(entityId, TestComponentType, component);
    expect(componentManager.hasComponent(entityId, TestComponentType)).toBe(true);
    
    const removed = componentManager.removeComponent(entityId, TestComponentType);
    expect(removed).toBe(true);
    expect(componentManager.hasComponent(entityId, TestComponentType)).toBe(false);
  });

  it('should handle multiple components per entity', () => {
    const entityId = 1;
    const testComponent = new TestComponent(42);
    const anotherComponent = new AnotherComponent('test');
    
    componentManager.addComponent(entityId, TestComponentType, testComponent);
    componentManager.addComponent(entityId, AnotherComponentType, anotherComponent);
    
    expect(componentManager.hasComponent(entityId, TestComponentType)).toBe(true);
    expect(componentManager.hasComponent(entityId, AnotherComponentType)).toBe(true);
    
    const retrieved1 = componentManager.getComponent(entityId, TestComponentType);
    const retrieved2 = componentManager.getComponent(entityId, AnotherComponentType);
    
    expect(retrieved1?.value).toBe(42);
    expect(retrieved2?.name).toBe('test');
  });

  it('should handle multiple entities with same component type', () => {
    const entity1 = 1;
    const entity2 = 2;
    const component1 = new TestComponent(42);
    const component2 = new TestComponent(84);
    
    componentManager.addComponent(entity1, TestComponentType, component1);
    componentManager.addComponent(entity2, TestComponentType, component2);
    
    const retrieved1 = componentManager.getComponent(entity1, TestComponentType);
    const retrieved2 = componentManager.getComponent(entity2, TestComponentType);
    
    expect(retrieved1?.value).toBe(42);
    expect(retrieved2?.value).toBe(84);
  });

  it('should get all components of a type', () => {
    const entity1 = 1;
    const entity2 = 2;
    const component1 = new TestComponent(42);
    const component2 = new TestComponent(84);
    
    componentManager.addComponent(entity1, TestComponentType, component1);
    componentManager.addComponent(entity2, TestComponentType, component2);
    
    const allComponents = componentManager.getAllComponents(TestComponentType);
    expect(allComponents.size).toBe(2);
    expect(allComponents.get(entity1)?.value).toBe(42);
    expect(allComponents.get(entity2)?.value).toBe(84);
  });

  it('should remove all components from entity', () => {
    const entityId = 1;
    const testComponent = new TestComponent(42);
    const anotherComponent = new AnotherComponent('test');
    
    componentManager.addComponent(entityId, TestComponentType, testComponent);
    componentManager.addComponent(entityId, AnotherComponentType, anotherComponent);
    
    expect(componentManager.hasComponent(entityId, TestComponentType)).toBe(true);
    expect(componentManager.hasComponent(entityId, AnotherComponentType)).toBe(true);
    
    componentManager.removeAllComponents(entityId);
    
    expect(componentManager.hasComponent(entityId, TestComponentType)).toBe(false);
    expect(componentManager.hasComponent(entityId, AnotherComponentType)).toBe(false);
  });

  it('should get component count', () => {
    expect(componentManager.getComponentCount()).toBe(0);
    
    componentManager.addComponent(1, TestComponentType, new TestComponent(42));
    expect(componentManager.getComponentCount()).toBe(1);
    
    componentManager.addComponent(2, TestComponentType, new TestComponent(84));
    expect(componentManager.getComponentCount()).toBe(2);
    
    componentManager.addComponent(1, AnotherComponentType, new AnotherComponent('test'));
    expect(componentManager.getComponentCount()).toBe(3);
  });
});