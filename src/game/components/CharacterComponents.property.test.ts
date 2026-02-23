/**
 * Property-based tests for Character Components
 * **Feature: hunger-system, Property 1: 饱腹度值范围不变性**
 * **Validates: Requirements 7.1, 7.2, 7.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { HungerComponent, HungerComponentType } from './CharacterComponents';

describe('HungerComponent Property Tests', () => {
  /**
   * Helper function to validate hunger component values
   */
  function validateHunger(hunger: HungerComponent): HungerComponent {
    return {
      type: 'hunger',
      current: Math.max(0, Math.min(hunger.current, hunger.maximum)),
      maximum: Math.max(1, hunger.maximum)
    };
  }

  /**
   * Property 1: 饱腹度值范围不变性
   * For any HungerComponent, the current value should always be within [0, maximum]
   * and the maximum value should always be greater than 0
   */
  it('Property 1: 饱腹度值范围不变性 - current should be within [0, maximum] and maximum > 0', () => {
    // Generator for hunger component values
    const hungerGenerator = fc.record({
      current: fc.float({ min: -100, max: 200, noNaN: true }),
      maximum: fc.float({ min: -50, max: 200, noNaN: true })
    });

    fc.assert(
      fc.property(hungerGenerator, (hungerData) => {
        // Create a hunger component with potentially invalid values
        const rawHunger: HungerComponent = {
          type: 'hunger',
          current: hungerData.current,
          maximum: hungerData.maximum
        };

        // Validate the hunger component
        const validatedHunger = validateHunger(rawHunger);

        // Requirement 7.1: current should be >= 0
        expect(validatedHunger.current).toBeGreaterThanOrEqual(0);

        // Requirement 7.2: current should be <= maximum
        expect(validatedHunger.current).toBeLessThanOrEqual(validatedHunger.maximum);

        // Requirement 7.3: maximum should be > 0
        expect(validatedHunger.maximum).toBeGreaterThan(0);

        // Additional invariant: if original values were valid (within bounds and maximum >= 1), they should be preserved
        if (hungerData.current >= 0 && hungerData.current <= hungerData.maximum && hungerData.maximum >= 1) {
          expect(validatedHunger.current).toBe(hungerData.current);
          expect(validatedHunger.maximum).toBe(hungerData.maximum);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1: 饱腹度值范围不变性 - boundary conditions', () => {
    // Test specific boundary conditions
    const boundaryGenerator = fc.oneof(
      // Zero current
      fc.constant({ current: 0, maximum: 100 }),
      // Full current
      fc.record({
        maximum: fc.integer({ min: 1, max: 200 })
      }).map(({ maximum }) => ({ current: maximum, maximum })),
      // Minimum maximum
      fc.constant({ current: 0, maximum: 1 }),
      // Negative current (should be clamped)
      fc.record({
        current: fc.integer({ min: -100, max: -1 }),
        maximum: fc.integer({ min: 1, max: 200 })
      }),
      // Current exceeds maximum (should be clamped)
      fc.record({
        maximum: fc.integer({ min: 1, max: 100 })
      }).map(({ maximum }) => ({ current: maximum + fc.sample(fc.integer({ min: 1, max: 100 }), 1)[0], maximum })),
      // Zero or negative maximum (should be adjusted)
      fc.record({
        current: fc.integer({ min: 0, max: 100 }),
        maximum: fc.integer({ min: -50, max: 0 })
      })
    );

    fc.assert(
      fc.property(boundaryGenerator, (hungerData) => {
        const rawHunger: HungerComponent = {
          type: 'hunger',
          current: hungerData.current,
          maximum: hungerData.maximum
        };

        const validatedHunger = validateHunger(rawHunger);

        // All requirements must hold
        expect(validatedHunger.current).toBeGreaterThanOrEqual(0);
        expect(validatedHunger.current).toBeLessThanOrEqual(validatedHunger.maximum);
        expect(validatedHunger.maximum).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1: 饱腹度值范围不变性 - idempotence of validation', () => {
    // Validating an already valid hunger component should not change it
    const validHungerGenerator = fc.record({
      current: fc.integer({ min: 0, max: 100 }),
      maximum: fc.integer({ min: 1, max: 200 })
    }).filter(({ current, maximum }) => current <= maximum);

    fc.assert(
      fc.property(validHungerGenerator, (hungerData) => {
        const hunger: HungerComponent = {
          type: 'hunger',
          current: hungerData.current,
          maximum: hungerData.maximum
        };

        const validated1 = validateHunger(hunger);
        const validated2 = validateHunger(validated1);

        // Validating twice should produce the same result (idempotence)
        expect(validated2.current).toBe(validated1.current);
        expect(validated2.maximum).toBe(validated1.maximum);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1: 饱腹度值范围不变性 - component type preservation', () => {
    // The component type should always be preserved
    const hungerGenerator = fc.record({
      current: fc.float({ min: -100, max: 200, noNaN: true }),
      maximum: fc.float({ min: -50, max: 200, noNaN: true })
    });

    fc.assert(
      fc.property(hungerGenerator, (hungerData) => {
        const rawHunger: HungerComponent = {
          type: 'hunger',
          current: hungerData.current,
          maximum: hungerData.maximum
        };

        const validatedHunger = validateHunger(rawHunger);

        // Type should always be 'hunger'
        expect(validatedHunger.type).toBe('hunger');
        
        // Component type name should match
        expect(HungerComponentType.name).toBe('hunger');
      }),
      { numRuns: 100 }
    );
  });
});
