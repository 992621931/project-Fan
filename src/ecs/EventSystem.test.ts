import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventSystem, IEvent, createEvent } from './EventSystem';

// Test events
interface TestEvent extends IEvent {
  type: 'test';
  data: string;
}

interface NumberEvent extends IEvent {
  type: 'number';
  value: number;
}

describe('EventSystem', () => {
  let eventSystem: EventSystem;

  beforeEach(() => {
    eventSystem = new EventSystem();
  });

  it('should emit events to subscribers', () => {
    const handler = vi.fn();
    const event = createEvent({ type: 'test', data: 'hello' });
    
    eventSystem.subscribe('test', handler);
    eventSystem.emit(event);
    
    expect(handler).toHaveBeenCalledWith(event);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should support multiple subscribers for same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const event = createEvent({ type: 'test', data: 'hello' });
    
    eventSystem.subscribe('test', handler1);
    eventSystem.subscribe('test', handler2);
    eventSystem.emit(event);
    
    expect(handler1).toHaveBeenCalledWith(event);
    expect(handler2).toHaveBeenCalledWith(event);
  });

  it('should unsubscribe handlers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const event = createEvent({ type: 'test', data: 'hello' });
    
    eventSystem.subscribe('test', handler1);
    eventSystem.subscribe('test', handler2);
    
    const unsubscribed = eventSystem.unsubscribe('test', handler1);
    expect(unsubscribed).toBe(true);
    
    eventSystem.emit(event);
    
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledWith(event);
  });

  it('should handle event queuing', () => {
    const handler = vi.fn();
    const event1 = createEvent({ type: 'test', data: 'first' });
    const event2 = createEvent({ type: 'test', data: 'second' });
    
    eventSystem.subscribe('test', handler);
    
    eventSystem.queue(event1);
    eventSystem.queue(event2);
    
    expect(handler).not.toHaveBeenCalled();
    expect(eventSystem.getQueueSize()).toBe(2);
    
    eventSystem.processQueue();
    
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, event1);
    expect(handler).toHaveBeenNthCalledWith(2, event2);
    expect(eventSystem.getQueueSize()).toBe(0);
  });

  it('should handle different event types', () => {
    const testHandler = vi.fn();
    const numberHandler = vi.fn();
    
    const testEvent = createEvent({ type: 'test', data: 'hello' });
    const numberEvent = createEvent({ type: 'number', value: 42 });
    
    eventSystem.subscribe('test', testHandler);
    eventSystem.subscribe('number', numberHandler);
    
    eventSystem.emit(testEvent);
    eventSystem.emit(numberEvent);
    
    expect(testHandler).toHaveBeenCalledWith(testEvent);
    expect(testHandler).not.toHaveBeenCalledWith(numberEvent);
    
    expect(numberHandler).toHaveBeenCalledWith(numberEvent);
    expect(numberHandler).not.toHaveBeenCalledWith(testEvent);
  });

  it('should handle errors in event handlers gracefully', () => {
    const errorHandler = vi.fn(() => {
      throw new Error('Handler error');
    });
    const normalHandler = vi.fn();
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const event = createEvent({ type: 'test', data: 'hello' });
    
    eventSystem.subscribe('test', errorHandler);
    eventSystem.subscribe('test', normalHandler);
    
    eventSystem.emit(event);
    
    expect(errorHandler).toHaveBeenCalled();
    expect(normalHandler).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('should get listener count', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    expect(eventSystem.getListenerCount('test')).toBe(0);
    
    eventSystem.subscribe('test', handler1);
    expect(eventSystem.getListenerCount('test')).toBe(1);
    
    eventSystem.subscribe('test', handler2);
    expect(eventSystem.getListenerCount('test')).toBe(2);
    
    eventSystem.unsubscribe('test', handler1);
    expect(eventSystem.getListenerCount('test')).toBe(1);
  });

  it('should clear all listeners and queue', () => {
    const handler = vi.fn();
    const event = createEvent({ type: 'test', data: 'hello' });
    
    eventSystem.subscribe('test', handler);
    eventSystem.queue(event);
    
    expect(eventSystem.getListenerCount('test')).toBe(1);
    expect(eventSystem.getQueueSize()).toBe(1);
    
    eventSystem.clear();
    
    expect(eventSystem.getListenerCount('test')).toBe(0);
    expect(eventSystem.getQueueSize()).toBe(0);
  });
});