/**
 * Property-based tests for debounce utility function
 * Feature: warehouse-panel-grid-layout-bugfix
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';

// Extract debounce function for testing
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = window.setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

describe('Debounce Function Property Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 10: 防抖函数行为
   * For any sequence of consecutive function calls, the debounced function should only execute once after the wait time following the last call
   * **Validates: Requirements 7.1**
   */
  describe('Property 10: Debounce Function Behavior', () => {
    it('**Validates: Requirements 7.1** - should only execute once after the last call in a sequence', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: 500 }), // wait time
          fc.integer({ min: 2, max: 10 }), // number of calls
          (waitTime, numCalls) => {
            const mockFn = vi.fn();
            const debouncedFn = debounce(mockFn, waitTime);

            // Make multiple rapid calls
            for (let i = 0; i < numCalls; i++) {
              debouncedFn(i);
            }

            // Function should not have been called yet
            expect(mockFn).not.toHaveBeenCalled();

            // Advance time by wait time
            vi.advanceTimersByTime(waitTime);

            // Function should have been called exactly once with the last argument
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith(numCalls - 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('**Validates: Requirements 7.1** - should reset timer on each call', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 300 }), // wait time
          fc.array(fc.integer({ min: 10, max: 80 }), { minLength: 2, maxLength: 5 }), // intervals between calls
          (waitTime, intervals) => {
            const mockFn = vi.fn();
            const debouncedFn = debounce(mockFn, waitTime);

            let totalTime = 0;
            
            // Make calls with specified intervals
            intervals.forEach((interval, index) => {
              debouncedFn(index);
              vi.advanceTimersByTime(interval);
              totalTime += interval;
              
              // If interval is less than wait time, function should not have been called
              if (interval < waitTime) {
                expect(mockFn).not.toHaveBeenCalled();
              }
            });

            // Advance time by remaining wait time
            vi.advanceTimersByTime(waitTime);

            // Function should have been called exactly once with the last argument
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith(intervals.length - 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('**Validates: Requirements 7.1** - should execute immediately if wait time passes without new calls', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: 200 }), // wait time
          fc.integer({ min: 1, max: 5 }), // number of separate call sequences
          (waitTime, numSequences) => {
            const mockFn = vi.fn();
            const debouncedFn = debounce(mockFn, waitTime);

            for (let seq = 0; seq < numSequences; seq++) {
              debouncedFn(seq);
              
              // Advance time past wait time
              vi.advanceTimersByTime(waitTime + 10);
              
              // Function should have been called once for this sequence
              expect(mockFn).toHaveBeenCalledTimes(seq + 1);
              expect(mockFn).toHaveBeenLastCalledWith(seq);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('**Validates: Requirements 7.1** - should preserve function context (this)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: 200 }), // wait time
          fc.string({ minLength: 1, maxLength: 20 }), // context value
          (waitTime, contextValue) => {
            const context = { value: contextValue };
            let capturedThis: any = null;
            
            const mockFn = function(this: any) {
              capturedThis = this;
            };
            
            const debouncedFn = debounce(mockFn, waitTime);
            
            // Call with specific context
            debouncedFn.call(context);
            
            // Advance time
            vi.advanceTimersByTime(waitTime);
            
            // Verify context was preserved
            expect(capturedThis).toBe(context);
            expect(capturedThis?.value).toBe(contextValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('**Validates: Requirements 7.1** - should pass all arguments correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: 200 }), // wait time
          fc.array(fc.anything(), { minLength: 0, maxLength: 5 }), // arguments
          (waitTime, args) => {
            const mockFn = vi.fn();
            const debouncedFn = debounce(mockFn, waitTime);

            // Call with arguments
            debouncedFn(...args);

            // Advance time
            vi.advanceTimersByTime(waitTime);

            // Verify arguments were passed correctly
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith(...args);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('**Validates: Requirements 7.1** - should handle zero wait time', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 0);

      debouncedFn('test');

      // Function should not have been called yet (still async)
      expect(mockFn).not.toHaveBeenCalled();

      // Advance timers
      vi.advanceTimersByTime(0);

      // Function should have been called
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('**Validates: Requirements 7.1** - should cancel previous timeout on new call', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 300 }), // wait time
          fc.integer({ min: 2, max: 5 }), // number of calls
          (waitTime, numCalls) => {
            const mockFn = vi.fn();
            const debouncedFn = debounce(mockFn, waitTime);

            // Make calls with partial wait time between them
            for (let i = 0; i < numCalls; i++) {
              debouncedFn(i);
              
              // Advance time by less than wait time
              if (i < numCalls - 1) {
                vi.advanceTimersByTime(waitTime / 2);
              }
            }

            // Function should not have been called yet
            expect(mockFn).not.toHaveBeenCalled();

            // Advance time by full wait time
            vi.advanceTimersByTime(waitTime);

            // Function should have been called exactly once with the last argument
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith(numCalls - 1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
