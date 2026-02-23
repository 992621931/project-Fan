/**
 * EventSystem - Handles communication between systems through events
 */

export interface IEvent {
  readonly type: string;
  readonly timestamp: number;
}

export type EventHandler<T extends IEvent> = (event: T) => void;

export class EventSystem {
  private listeners: Map<string, EventHandler<any>[]> = new Map();
  private eventQueue: IEvent[] = [];
  private processing: boolean = false;
  
  /**
   * Subscribe to an event type
   */
  public subscribe<T extends IEvent>(eventType: string, handler: EventHandler<T>): void {
    let handlers = this.listeners.get(eventType);
    
    if (!handlers) {
      handlers = [];
      this.listeners.set(eventType, handlers);
    }
    
    handlers.push(handler);
  }
  
  /**
   * Unsubscribe from an event type
   */
  public unsubscribe<T extends IEvent>(eventType: string, handler: EventHandler<T>): boolean {
    const handlers = this.listeners.get(eventType);
    
    if (!handlers) {
      return false;
    }
    
    const index = handlers.indexOf(handler);
    if (index === -1) {
      return false;
    }
    
    handlers.splice(index, 1);
    
    // Clean up empty handler arrays
    if (handlers.length === 0) {
      this.listeners.delete(eventType);
    }
    
    return true;
  }
  
  /**
   * Emit an event immediately (synchronous)
   */
  public emit<T extends IEvent>(event: T): void {
    const handlers = this.listeners.get(event.type);
    
    if (!handlers) {
      return;
    }
    
    // Create a copy of handlers to avoid issues if handlers are modified during iteration
    const handlersCopy = [...handlers];
    
    for (const handler of handlersCopy) {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    }
  }
  
  /**
   * Queue an event to be processed later (asynchronous)
   */
  public queue<T extends IEvent>(event: T): void {
    this.eventQueue.push(event);
  }
  
  /**
   * Process all queued events
   */
  public processQueue(): void {
    if (this.processing) {
      return; // Prevent recursive processing
    }
    
    this.processing = true;
    
    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (event) {
          this.emit(event);
        }
      }
    } finally {
      this.processing = false;
    }
  }
  
  /**
   * Get the number of queued events
   */
  public getQueueSize(): number {
    return this.eventQueue.length;
  }
  
  /**
   * Clear all queued events
   */
  public clearQueue(): void {
    this.eventQueue.length = 0;
  }
  
  /**
   * Get all registered event types
   */
  public getEventTypes(): string[] {
    return Array.from(this.listeners.keys());
  }
  
  /**
   * Get the number of listeners for a specific event type
   */
  public getListenerCount(eventType: string): number {
    const handlers = this.listeners.get(eventType);
    return handlers ? handlers.length : 0;
  }
  
  /**
   * Clear all event listeners
   */
  public clear(): void {
    this.listeners.clear();
    this.clearQueue();
  }
  
  /**
   * Alias for subscribe (for compatibility)
   */
  public on<T extends IEvent>(eventType: string, handler: EventHandler<T>): void {
    this.subscribe(eventType, handler);
  }
  
  /**
   * Alias for unsubscribe (for compatibility)
   */
  public off<T extends IEvent>(eventType: string, handler: EventHandler<T>): boolean {
    return this.unsubscribe(eventType, handler);
  }
}

/**
 * Helper function to create events with timestamp
 */
export function createEvent<T extends Omit<IEvent, 'timestamp'>>(event: T): T & IEvent {
  return {
    ...event,
    timestamp: Date.now(),
  } as T & IEvent;
}