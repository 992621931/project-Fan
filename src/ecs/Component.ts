/**
 * Component - Pure data containers that define entity properties
 * Components should only contain data, no behavior
 */

export interface IComponent {
  readonly type: string;
}

/**
 * Base component class that all components should extend
 */
export abstract class Component implements IComponent {
  public abstract readonly type: string;
}

/**
 * Component type registry for type-safe component management
 */
export class ComponentType<T extends IComponent> {
  constructor(public readonly name: string) {}
}

/**
 * Helper function to create component types
 */
export function createComponentType<T extends IComponent>(name: string): ComponentType<T> {
  return new ComponentType<T>(name);
}