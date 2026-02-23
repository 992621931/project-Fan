/**
 * Property-based tests for Rarity System
 * **Feature: codename-rice-game, Property 27: 稀有度标识一致性**
 * **Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  RarityType, 
  RarityConfig, 
  RARITY_CONFIGS, 
  getRarityConfig, 
  getRarityColor, 
  getRarityDisplayName 
} from './RarityTypes';

describe('Rarity System Property Tests', () => {
  /**
   * Property 27: 稀有度标识一致性
   * For any item or character, the system should assign corresponding color identifiers 
   * and attribute strength based on rarity (Common-White-Basic, Rare-Blue-Enhanced, 
   * Epic-Purple-Strong, Legendary-Orange-Top)
   */
  it('Property 27: 稀有度标识一致性', () => {
    // Generator for all valid rarity types
    const rarityGenerator = fc.constantFrom(
      RarityType.Common,
      RarityType.Rare,
      RarityType.Epic,
      RarityType.Legendary
    );

    fc.assert(
      fc.property(rarityGenerator, (rarity) => {
        const config = getRarityConfig(rarity);
        const color = getRarityColor(rarity);
        const displayName = getRarityDisplayName(rarity);

        // Verify config consistency
        expect(config.type).toBe(rarity);
        expect(config.color).toBe(color);
        expect(config.displayName).toBe(displayName);

        // Verify specific rarity mappings according to requirements
        switch (rarity) {
          case RarityType.Common:
            // 普通 (白色) - Basic attributes
            expect(color).toBe('#FFFFFF');
            expect(displayName).toBe('普通');
            expect(config.attributeMultiplier).toBe(1.0);
            expect(config.dropRate).toBeGreaterThan(0.5); // Most common
            break;

          case RarityType.Rare:
            // 稀有 (蓝色) - Enhanced attributes
            expect(color).toBe('#0080FF');
            expect(displayName).toBe('稀有');
            expect(config.attributeMultiplier).toBeGreaterThan(1.0);
            expect(config.attributeMultiplier).toBeLessThan(2.0);
            expect(config.dropRate).toBeLessThan(0.5);
            expect(config.dropRate).toBeGreaterThan(0.1);
            break;

          case RarityType.Epic:
            // 神话 (紫色) - Strong attributes
            expect(color).toBe('#8000FF');
            expect(displayName).toBe('神话');
            expect(config.attributeMultiplier).toBeGreaterThanOrEqual(2.0);
            expect(config.attributeMultiplier).toBeLessThan(3.0);
            expect(config.dropRate).toBeLessThan(0.1);
            expect(config.dropRate).toBeGreaterThan(0.01);
            break;

          case RarityType.Legendary:
            // 传说 (橙色) - Top attributes
            expect(color).toBe('#FF8000');
            expect(displayName).toBe('传说');
            expect(config.attributeMultiplier).toBeGreaterThanOrEqual(3.0);
            expect(config.dropRate).toBeLessThanOrEqual(0.01);
            break;
        }

        // Verify all configs have required properties
        expect(config.type).toBeTypeOf('number');
        expect(config.color).toMatch(/^#[0-9A-F]{6}$/i); // Valid hex color
        expect(config.displayName).toBeTypeOf('string');
        expect(config.displayName.length).toBeGreaterThan(0);
        expect(config.dropRate).toBeGreaterThan(0);
        expect(config.dropRate).toBeLessThanOrEqual(1);
        expect(config.attributeMultiplier).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain rarity hierarchy in attribute multipliers', () => {
    // Property: Higher rarity should always have higher or equal attribute multipliers
    fc.assert(
      fc.property(
        fc.constantFrom(RarityType.Common, RarityType.Rare, RarityType.Epic, RarityType.Legendary),
        fc.constantFrom(RarityType.Common, RarityType.Rare, RarityType.Epic, RarityType.Legendary),
        (rarity1, rarity2) => {
          const config1 = getRarityConfig(rarity1);
          const config2 = getRarityConfig(rarity2);

          if (rarity1 <= rarity2) {
            expect(config1.attributeMultiplier).toBeLessThanOrEqual(config2.attributeMultiplier);
          } else {
            expect(config1.attributeMultiplier).toBeGreaterThanOrEqual(config2.attributeMultiplier);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain rarity hierarchy in drop rates', () => {
    // Property: Higher rarity should have lower drop rates
    fc.assert(
      fc.property(
        fc.constantFrom(RarityType.Common, RarityType.Rare, RarityType.Epic, RarityType.Legendary),
        fc.constantFrom(RarityType.Common, RarityType.Rare, RarityType.Epic, RarityType.Legendary),
        (rarity1, rarity2) => {
          const config1 = getRarityConfig(rarity1);
          const config2 = getRarityConfig(rarity2);

          if (rarity1 < rarity2) {
            expect(config1.dropRate).toBeGreaterThanOrEqual(config2.dropRate);
          } else if (rarity1 > rarity2) {
            expect(config1.dropRate).toBeLessThanOrEqual(config2.dropRate);
          } else {
            expect(config1.dropRate).toBe(config2.dropRate);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should have consistent configuration access methods', () => {
    // Property: All access methods should return consistent data
    fc.assert(
      fc.property(
        fc.constantFrom(RarityType.Common, RarityType.Rare, RarityType.Epic, RarityType.Legendary),
        (rarity) => {
          const config = getRarityConfig(rarity);
          const directConfig = RARITY_CONFIGS[rarity];
          const color = getRarityColor(rarity);
          const displayName = getRarityDisplayName(rarity);

          // All methods should return the same data
          expect(config).toEqual(directConfig);
          expect(color).toBe(config.color);
          expect(color).toBe(directConfig.color);
          expect(displayName).toBe(config.displayName);
          expect(displayName).toBe(directConfig.displayName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have valid total drop rate distribution', () => {
    // Property: All drop rates should sum to approximately 1.0
    const totalDropRate = Object.values(RARITY_CONFIGS)
      .reduce((sum, config) => sum + config.dropRate, 0);
    
    expect(totalDropRate).toBeCloseTo(1.0, 2);
  });

  it('should have unique colors for each rarity', () => {
    // Property: Each rarity should have a unique color identifier
    const colors = Object.values(RARITY_CONFIGS).map(config => config.color);
    const uniqueColors = new Set(colors);
    
    expect(uniqueColors.size).toBe(colors.length);
  });

  it('should have unique display names for each rarity', () => {
    // Property: Each rarity should have a unique display name
    const displayNames = Object.values(RARITY_CONFIGS).map(config => config.displayName);
    const uniqueDisplayNames = new Set(displayNames);
    
    expect(uniqueDisplayNames.size).toBe(displayNames.length);
  });
});