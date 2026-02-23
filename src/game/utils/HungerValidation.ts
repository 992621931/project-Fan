/**
 * Hunger validation utilities
 * Provides functions to validate and clamp hunger component values
 */

import { HungerComponent } from '../components/CharacterComponents';

/**
 * Clamps a value between a minimum and maximum
 * @param value - The value to clamp
 * @param min - The minimum allowed value
 * @param max - The maximum allowed value
 * @returns The clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Validates and corrects hunger component values
 * Ensures:
 * - current is within [0, maximum]
 * - maximum is greater than 0
 * 
 * @param hunger - The hunger component to validate
 * @returns A validated hunger component with corrected values
 */
export function validateHunger(hunger: HungerComponent): HungerComponent {
  // Requirement 7.3: Ensure maximum > 0
  const validMaximum = Math.max(1, hunger.maximum);
  
  // Requirement 7.1, 7.2: Ensure current is in [0, maximum]
  const validCurrent = clamp(hunger.current, 0, validMaximum);
  
  return {
    type: 'hunger',
    current: validCurrent,
    maximum: validMaximum
  };
}

/**
 * Sets the current hunger value with validation
 * Ensures the value is clamped to [0, maximum]
 * 
 * @param hunger - The hunger component to modify
 * @param newCurrent - The new current value to set
 * @returns A new hunger component with the updated current value
 */
export function setHungerCurrent(hunger: HungerComponent, newCurrent: number): HungerComponent {
  return validateHunger({
    type: 'hunger',
    current: newCurrent,
    maximum: hunger.maximum
  });
}

/**
 * Sets the maximum hunger value with validation
 * Ensures maximum > 0 and current is adjusted if needed
 * 
 * @param hunger - The hunger component to modify
 * @param newMaximum - The new maximum value to set
 * @returns A new hunger component with the updated maximum value
 */
export function setHungerMaximum(hunger: HungerComponent, newMaximum: number): HungerComponent {
  return validateHunger({
    type: 'hunger',
    current: hunger.current,
    maximum: newMaximum
  });
}
