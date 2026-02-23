/**
 * Property-based tests for AffixFormatter
 * **Feature: equipment-affix-system**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getAffixColorStyle, formatAffixDisplay } from './AffixFormatter';
import { RarityType, getRarityColor } from '../types/RarityTypes';
import { AppliedAffix, AffixType } from '../types/AffixTypes';

describe('AffixFormatter Property Tests', () => {
  /**
   * Property 10: Affix display includes rarity color
   * For any affix rendered in the UI, the color returned by getAffixColorStyle
   * must match the affix's rarity tier color from the rarity configuration
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
   */
  it('Property 10: Affix display includes rarity color', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary rarity type
        fc.constantFrom(
          RarityType.Common,
          RarityType.Rare,
          RarityType.Epic,
          RarityType.Legendary
        ),
        (affixRarity) => {
          // Get the color style for this rarity
          const colorStyle = getAffixColorStyle(affixRarity);
          
          // Get the expected color from rarity configuration
          const expectedColor = getRarityColor(affixRarity);
          
          // Verify the color matches the rarity tier color
          expect(colorStyle).toBe(expectedColor);
          
          // Verify the color is a valid hex color format
          expect(colorStyle).toMatch(/^#[0-9A-Fa-f]{6}$/);
          
          // Verify specific color mappings for each rarity
          switch (affixRarity) {
            case RarityType.Common:
              expect(colorStyle).toBe('#9e9e9e'); // Gray
              break;
            case RarityType.Rare:
              expect(colorStyle).toBe('#0080FF'); // Blue
              break;
            case RarityType.Epic:
              expect(colorStyle).toBe('#8000FF'); // Purple
              break;
            case RarityType.Legendary:
              expect(colorStyle).toBe('#FF8000'); // Orange
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11: Affix display includes name and value
   * For any affix rendered in the UI, the rendered text must contain
   * both the affix display name and the affix value
   * **Validates: Requirements 5.6**
   */
  it('Property 11: Affix display includes name and value', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary affix type
        fc.constantFrom(...Object.values(AffixType)),
        // Generate arbitrary rarity
        fc.constantFrom(
          RarityType.Common,
          RarityType.Rare,
          RarityType.Epic,
          RarityType.Legendary
        ),
        // Generate arbitrary display name
        fc.string({ minLength: 1, maxLength: 20 }),
        // Generate arbitrary value (0.1 to 100)
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        // Generate arbitrary percentage flag
        fc.boolean(),
        (affixType, affixRarity, displayName, value, isPercentage) => {
          // Create an applied affix
          const affix: AppliedAffix = {
            type: affixType,
            rarity: affixRarity,
            displayName,
            value,
            isPercentage
          };

          // Format the affix display
          const displayText = formatAffixDisplay(affix);

          // Verify the display text contains the display name
          expect(displayText).toContain(displayName);

          // Verify the display text contains a numeric value
          // The value should be formatted as a number (possibly with decimal)
          const numericPattern = /\d+(\.\d+)?/;
          expect(displayText).toMatch(numericPattern);

          // Verify the display text contains a plus sign (for positive bonuses)
          expect(displayText).toContain('+');

          // Verify the display text contains a colon separator
          expect(displayText).toContain('：');

          // If percentage, verify it contains the % symbol
          if (isPercentage) {
            expect(displayText).toContain('%');
          }

          // Verify the format follows the pattern: "displayName：attributeName+value[%]"
          // The pattern should have: displayName, colon, some text (attribute name), plus, number
          const expectedPattern = isPercentage 
            ? new RegExp(`${displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}：.+\\+\\d+(\\.\\d+)?%`)
            : new RegExp(`${displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}：.+\\+\\d+(\\.\\d+)?`);
          expect(displayText).toMatch(expectedPattern);
        }
      ),
      { numRuns: 100 }
    );
  });
});
