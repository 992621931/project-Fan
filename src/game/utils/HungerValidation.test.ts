/**
 * Unit tests for HungerValidation
 * Tests hunger component value validation and clamping
 */

import { describe, it, expect } from 'vitest';
import { validateHunger, setHungerCurrent, setHungerMaximum } from './HungerValidation';
import { HungerComponent } from '../components/CharacterComponents';

describe('HungerValidation', () => {
  describe('validateHunger', () => {
    it('should return valid hunger unchanged', () => {
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 50,
        maximum: 100
      };
      
      const result = validateHunger(hunger);
      
      expect(result.current).toBe(50);
      expect(result.maximum).toBe(100);
    });

    it('should clamp current to 0 when negative', () => {
      const hunger: HungerComponent = {
        type: 'hunger',
        current: -10,
        maximum: 100
      };
      
      const result = validateHunger(hunger);
      
      expect(result.current).toBe(0);
      expect(result.maximum).toBe(100);
    });

    it('should clamp current to maximum when exceeding', () => {
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 150,
        maximum: 100
      };
      
      const result = validateHunger(hunger);
      
      expect(result.current).toBe(100);
      expect(result.maximum).toBe(100);
    });

    it('should set maximum to 1 when zero', () => {
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 50,
        maximum: 0
      };
      
      const result = validateHunger(hunger);
      
      expect(result.current).toBe(1); // Clamped to new maximum
      expect(result.maximum).toBe(1);
    });

    it('should set maximum to 1 when negative', () => {
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 50,
        maximum: -10
      };
      
      const result = validateHunger(hunger);
      
      expect(result.current).toBe(1); // Clamped to new maximum
      expect(result.maximum).toBe(1);
    });

    it('should handle boundary case: current = 0', () => {
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 0,
        maximum: 100
      };
      
      const result = validateHunger(hunger);
      
      expect(result.current).toBe(0);
      expect(result.maximum).toBe(100);
    });

    it('should handle boundary case: current = maximum', () => {
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 100,
        maximum: 100
      };
      
      const result = validateHunger(hunger);
      
      expect(result.current).toBe(100);
      expect(result.maximum).toBe(100);
    });
  });

  describe('setHungerCurrent', () => {
    it('should set current value within valid range', () => {
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 50,
        maximum: 100
      };
      
      const result = setHungerCurrent(hunger, 75);
      
      expect(result.current).toBe(75);
      expect(result.maximum).toBe(100);
    });

    it('should clamp negative values to 0', () => {
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 50,
        maximum: 100
      };
      
      const result = setHungerCurrent(hunger, -20);
      
      expect(result.current).toBe(0);
      expect(result.maximum).toBe(100);
    });

    it('should clamp values exceeding maximum', () => {
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 50,
        maximum: 100
      };
      
      const result = setHungerCurrent(hunger, 150);
      
      expect(result.current).toBe(100);
      expect(result.maximum).toBe(100);
    });
  });

  describe('setHungerMaximum', () => {
    it('should set maximum value and keep current unchanged if valid', () => {
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 50,
        maximum: 100
      };
      
      const result = setHungerMaximum(hunger, 150);
      
      expect(result.current).toBe(50);
      expect(result.maximum).toBe(150);
    });

    it('should adjust current when new maximum is lower', () => {
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 80,
        maximum: 100
      };
      
      const result = setHungerMaximum(hunger, 50);
      
      expect(result.current).toBe(50); // Clamped to new maximum
      expect(result.maximum).toBe(50);
    });

    it('should enforce minimum maximum of 1', () => {
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 50,
        maximum: 100
      };
      
      const result = setHungerMaximum(hunger, 0);
      
      expect(result.current).toBe(1); // Clamped to new maximum
      expect(result.maximum).toBe(1);
    });

    it('should enforce minimum maximum of 1 for negative values', () => {
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 50,
        maximum: 100
      };
      
      const result = setHungerMaximum(hunger, -50);
      
      expect(result.current).toBe(1); // Clamped to new maximum
      expect(result.maximum).toBe(1);
    });
  });
});
