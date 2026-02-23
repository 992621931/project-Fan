/**
 * Property-based tests for AffixSelector
 * **Feature: equipment-affix-system**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AffixSelector } from './AffixSelector';
import { RarityType } from '../types/RarityTypes';
import { AffixPoolConfig, AffixDefinition, AFFIX_PROBABILITY_CONFIG } from '../types/AffixTypes';
import affixDefinitions from '../data/affix-definitions.json';

describe('AffixSelector Property Tests', () => {
  let affixSelector: AffixSelector;
  let affixPool: AffixPoolConfig;

  beforeEach(() => {
    affixPool = affixDefinitions as AffixPoolConfig;
    affixSelector = new AffixSelector(affixPool, AFFIX_PROBABILITY_CONFIG);
  });

  /**
   * Property 1: Affix rarity probability distribution for Common equipment
   * For any large sample of affixes generated for Common equipment, 
   * approximately 90% should be Common rarity and 10% should be Rare rarity 
   * (within statistical bounds)
   * **Validates: Requirements 2.1**
   */
  it('Property 1: Affix rarity probability distribution for Common equipment', () => {
    const sampleSize = 1000;
    const tolerance = 0.05; // ±5% tolerance for statistical variation

    // Generate large sample of affixes for Common equipment
    const affixes = Array.from({ length: sampleSize }, () => 
      affixSelector.selectAffix(RarityType.Common)
    );

    // Count affixes by rarity
    const rarityCounts = new Map<RarityType, number>();
    for (const affix of affixes) {
      const count = rarityCounts.get(affix.rarity) || 0;
      rarityCounts.set(affix.rarity, count + 1);
    }

    // Calculate actual probabilities
    const commonCount = rarityCounts.get(RarityType.Common) || 0;
    const rareCount = rarityCounts.get(RarityType.Rare) || 0;
    
    const commonProbability = commonCount / sampleSize;
    const rareProbability = rareCount / sampleSize;

    // Expected probabilities from configuration
    const expectedCommonProbability = 0.90;
    const expectedRareProbability = 0.10;

    // Verify probabilities are within tolerance
    expect(commonProbability).toBeGreaterThanOrEqual(expectedCommonProbability - tolerance);
    expect(commonProbability).toBeLessThanOrEqual(expectedCommonProbability + tolerance);
    
    expect(rareProbability).toBeGreaterThanOrEqual(expectedRareProbability - tolerance);
    expect(rareProbability).toBeLessThanOrEqual(expectedRareProbability + tolerance);

    // Verify no other rarities appear
    expect(rarityCounts.has(RarityType.Epic)).toBe(false);
    expect(rarityCounts.has(RarityType.Legendary)).toBe(false);

    // Verify all affixes are accounted for
    expect(commonCount + rareCount).toBe(sampleSize);
  });

  /**
   * Property 2: Affix rarity probability distribution for Rare equipment
   * For any large sample of affixes generated for Rare equipment, 
   * approximately 50% should be Common rarity, 40% should be Rare rarity, 
   * and 10% should be Epic rarity (within statistical bounds)
   * **Validates: Requirements 2.2**
   */
  it('Property 2: Affix rarity probability distribution for Rare equipment', () => {
    const sampleSize = 1000;
    const tolerance = 0.05; // ±5% tolerance for statistical variation

    // Generate large sample of affixes for Rare equipment
    const affixes = Array.from({ length: sampleSize }, () => 
      affixSelector.selectAffix(RarityType.Rare)
    );

    // Count affixes by rarity
    const rarityCounts = new Map<RarityType, number>();
    for (const affix of affixes) {
      const count = rarityCounts.get(affix.rarity) || 0;
      rarityCounts.set(affix.rarity, count + 1);
    }

    // Calculate actual probabilities
    const commonCount = rarityCounts.get(RarityType.Common) || 0;
    const rareCount = rarityCounts.get(RarityType.Rare) || 0;
    const epicCount = rarityCounts.get(RarityType.Epic) || 0;
    
    const commonProbability = commonCount / sampleSize;
    const rareProbability = rareCount / sampleSize;
    const epicProbability = epicCount / sampleSize;

    // Expected probabilities from configuration
    const expectedCommonProbability = 0.50;
    const expectedRareProbability = 0.40;
    const expectedEpicProbability = 0.10;

    // Verify probabilities are within tolerance
    expect(commonProbability).toBeGreaterThanOrEqual(expectedCommonProbability - tolerance);
    expect(commonProbability).toBeLessThanOrEqual(expectedCommonProbability + tolerance);
    
    expect(rareProbability).toBeGreaterThanOrEqual(expectedRareProbability - tolerance);
    expect(rareProbability).toBeLessThanOrEqual(expectedRareProbability + tolerance);
    
    expect(epicProbability).toBeGreaterThanOrEqual(expectedEpicProbability - tolerance);
    expect(epicProbability).toBeLessThanOrEqual(expectedEpicProbability + tolerance);

    // Verify no Legendary rarities appear
    expect(rarityCounts.has(RarityType.Legendary)).toBe(false);

    // Verify all affixes are accounted for
    expect(commonCount + rareCount + epicCount).toBe(sampleSize);
  });

  /**
   * Property 3: Affix rarity probability distribution for Epic equipment
   * For any large sample of affixes generated for Epic equipment, 
   * approximately 15% should be Common rarity, 50% should be Rare rarity, 
   * 30% should be Epic rarity, and 5% should be Legendary rarity 
   * (within statistical bounds)
   * **Validates: Requirements 2.3**
   */
  it('Property 3: Affix rarity probability distribution for Epic equipment', () => {
    const sampleSize = 1000;
    const tolerance = 0.05; // ±5% tolerance for statistical variation

    // Generate large sample of affixes for Epic equipment
    const affixes = Array.from({ length: sampleSize }, () => 
      affixSelector.selectAffix(RarityType.Epic)
    );

    // Count affixes by rarity
    const rarityCounts = new Map<RarityType, number>();
    for (const affix of affixes) {
      const count = rarityCounts.get(affix.rarity) || 0;
      rarityCounts.set(affix.rarity, count + 1);
    }

    // Calculate actual probabilities
    const commonCount = rarityCounts.get(RarityType.Common) || 0;
    const rareCount = rarityCounts.get(RarityType.Rare) || 0;
    const epicCount = rarityCounts.get(RarityType.Epic) || 0;
    const legendaryCount = rarityCounts.get(RarityType.Legendary) || 0;
    
    const commonProbability = commonCount / sampleSize;
    const rareProbability = rareCount / sampleSize;
    const epicProbability = epicCount / sampleSize;
    const legendaryProbability = legendaryCount / sampleSize;

    // Expected probabilities from configuration
    const expectedCommonProbability = 0.15;
    const expectedRareProbability = 0.50;
    const expectedEpicProbability = 0.30;
    const expectedLegendaryProbability = 0.05;

    // Verify probabilities are within tolerance
    expect(commonProbability).toBeGreaterThanOrEqual(expectedCommonProbability - tolerance);
    expect(commonProbability).toBeLessThanOrEqual(expectedCommonProbability + tolerance);
    
    expect(rareProbability).toBeGreaterThanOrEqual(expectedRareProbability - tolerance);
    expect(rareProbability).toBeLessThanOrEqual(expectedRareProbability + tolerance);
    
    expect(epicProbability).toBeGreaterThanOrEqual(expectedEpicProbability - tolerance);
    expect(epicProbability).toBeLessThanOrEqual(expectedEpicProbability + tolerance);
    
    expect(legendaryProbability).toBeGreaterThanOrEqual(expectedLegendaryProbability - tolerance);
    expect(legendaryProbability).toBeLessThanOrEqual(expectedLegendaryProbability + tolerance);

    // Verify all affixes are accounted for
    expect(commonCount + rareCount + epicCount + legendaryCount).toBe(sampleSize);
  });

  /**
   * Property 4: Affix rarity probability distribution for Legendary equipment
   * For any large sample of affixes generated for Legendary equipment, 
   * approximately 5% should be Common rarity, 15% should be Rare rarity, 
   * 50% should be Epic rarity, and 30% should be Legendary rarity 
   * (within statistical bounds)
   * **Validates: Requirements 2.4**
   */
  it('Property 4: Affix rarity probability distribution for Legendary equipment', () => {
    const sampleSize = 1000;
    const tolerance = 0.05; // ±5% tolerance for statistical variation

    // Generate large sample of affixes for Legendary equipment
    const affixes = Array.from({ length: sampleSize }, () => 
      affixSelector.selectAffix(RarityType.Legendary)
    );

    // Count affixes by rarity
    const rarityCounts = new Map<RarityType, number>();
    for (const affix of affixes) {
      const count = rarityCounts.get(affix.rarity) || 0;
      rarityCounts.set(affix.rarity, count + 1);
    }

    // Calculate actual probabilities
    const commonCount = rarityCounts.get(RarityType.Common) || 0;
    const rareCount = rarityCounts.get(RarityType.Rare) || 0;
    const epicCount = rarityCounts.get(RarityType.Epic) || 0;
    const legendaryCount = rarityCounts.get(RarityType.Legendary) || 0;
    
    const commonProbability = commonCount / sampleSize;
    const rareProbability = rareCount / sampleSize;
    const epicProbability = epicCount / sampleSize;
    const legendaryProbability = legendaryCount / sampleSize;

    // Expected probabilities from configuration
    const expectedCommonProbability = 0.05;
    const expectedRareProbability = 0.15;
    const expectedEpicProbability = 0.50;
    const expectedLegendaryProbability = 0.30;

    // Verify probabilities are within tolerance
    expect(commonProbability).toBeGreaterThanOrEqual(expectedCommonProbability - tolerance);
    expect(commonProbability).toBeLessThanOrEqual(expectedCommonProbability + tolerance);
    
    expect(rareProbability).toBeGreaterThanOrEqual(expectedRareProbability - tolerance);
    expect(rareProbability).toBeLessThanOrEqual(expectedRareProbability + tolerance);
    
    expect(epicProbability).toBeGreaterThanOrEqual(expectedEpicProbability - tolerance);
    expect(epicProbability).toBeLessThanOrEqual(expectedEpicProbability + tolerance);
    
    expect(legendaryProbability).toBeGreaterThanOrEqual(expectedLegendaryProbability - tolerance);
    expect(legendaryProbability).toBeLessThanOrEqual(expectedLegendaryProbability + tolerance);

    // Verify all affixes are accounted for
    expect(commonCount + rareCount + epicCount + legendaryCount).toBe(sampleSize);
  });

  /**
   * Property 5: Affix value within range
   * For any affix definition and generated affix value, the value must be 
   * greater than or equal to the minimum and less than or equal to the maximum 
   * defined in the affix definition
   * **Validates: Requirements 3.1, 3.5**
   */
  it('Property 5: Affix value within range', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary equipment rarity
        fc.constantFrom(
          RarityType.Common,
          RarityType.Rare,
          RarityType.Epic,
          RarityType.Legendary
        ),
        (equipmentRarity) => {
          // Generate affix for the equipment rarity
          const affix = affixSelector.selectAffix(equipmentRarity);
          
          // Find the corresponding affix definition to get min/max values
          let affixDefinitions: AffixDefinition[] = [];
          switch (affix.rarity) {
            case RarityType.Common:
              affixDefinitions = affixPool.common;
              break;
            case RarityType.Rare:
              affixDefinitions = affixPool.rare;
              break;
            case RarityType.Epic:
              affixDefinitions = affixPool.epic;
              break;
            case RarityType.Legendary:
              affixDefinitions = affixPool.legendary;
              break;
          }
          
          const definition = affixDefinitions.find(d => d.type === affix.type);
          
          // Verify definition exists
          expect(definition).toBeDefined();
          
          if (definition) {
            // Verify value is within range [minValue, maxValue]
            expect(affix.value).toBeGreaterThanOrEqual(definition.minValue);
            expect(affix.value).toBeLessThanOrEqual(definition.maxValue);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Integer affixes produce whole numbers
   * For any affix with decimalPlaces set to 0, the generated value must be 
   * a whole number (no fractional component)
   * **Validates: Requirements 3.2**
   */
  it('Property 6: Integer affixes produce whole numbers', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary equipment rarity
        fc.constantFrom(
          RarityType.Common,
          RarityType.Rare,
          RarityType.Epic,
          RarityType.Legendary
        ),
        (equipmentRarity) => {
          // Generate affix for the equipment rarity
          const affix = affixSelector.selectAffix(equipmentRarity);
          
          // Find the corresponding affix definition
          let affixDefinitions: AffixDefinition[] = [];
          switch (affix.rarity) {
            case RarityType.Common:
              affixDefinitions = affixPool.common;
              break;
            case RarityType.Rare:
              affixDefinitions = affixPool.rare;
              break;
            case RarityType.Epic:
              affixDefinitions = affixPool.epic;
              break;
            case RarityType.Legendary:
              affixDefinitions = affixPool.legendary;
              break;
          }
          
          const definition = affixDefinitions.find(d => d.type === affix.type);
          
          // Verify definition exists
          expect(definition).toBeDefined();
          
          if (definition && definition.decimalPlaces === 0) {
            // Verify value is a whole number (no fractional component)
            expect(Number.isInteger(affix.value)).toBe(true);
            
            // Alternative check: value should equal its floor
            expect(affix.value).toBe(Math.floor(affix.value));
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Percentage and decimal affixes respect precision
   * For any affix with decimalPlaces set to 1, the generated value must have 
   * at most one decimal place
   * **Validates: Requirements 3.3, 3.4**
   */
  it('Property 7: Percentage and decimal affixes respect precision', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary equipment rarity
        fc.constantFrom(
          RarityType.Common,
          RarityType.Rare,
          RarityType.Epic,
          RarityType.Legendary
        ),
        (equipmentRarity) => {
          // Generate affix for the equipment rarity
          const affix = affixSelector.selectAffix(equipmentRarity);
          
          // Find the corresponding affix definition
          let affixDefinitions: AffixDefinition[] = [];
          switch (affix.rarity) {
            case RarityType.Common:
              affixDefinitions = affixPool.common;
              break;
            case RarityType.Rare:
              affixDefinitions = affixPool.rare;
              break;
            case RarityType.Epic:
              affixDefinitions = affixPool.epic;
              break;
            case RarityType.Legendary:
              affixDefinitions = affixPool.legendary;
              break;
          }
          
          const definition = affixDefinitions.find(d => d.type === affix.type);
          
          // Verify definition exists
          expect(definition).toBeDefined();
          
          if (definition && definition.decimalPlaces === 1) {
            // Verify value has at most one decimal place
            // Multiply by 10, check if it's an integer
            const multiplied = affix.value * 10;
            expect(Number.isInteger(multiplied)).toBe(true);
            
            // Alternative check: value should equal itself when rounded to 1 decimal place
            const rounded = Math.round(affix.value * 10) / 10;
            expect(affix.value).toBe(rounded);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Uniform affix type distribution within tier
   * For any rarity tier and large sample of affixes selected from that tier, 
   * each affix type within the tier should appear with approximately equal 
   * frequency (within statistical bounds)
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
   */
  it('Property 13: Uniform affix type distribution within tier', () => {
    const sampleSize = 5000; // Large sample for statistical significance
    const tolerance = 0.02; // ±2% tolerance for uniform distribution
    
    // Test each rarity tier
    const raritiesToTest = [
      { rarity: RarityType.Common, expectedCount: 18 }, // All 18 affix types
      { rarity: RarityType.Rare, expectedCount: 17 },   // 17 types (no Carry Weight)
      { rarity: RarityType.Epic, expectedCount: 17 },   // 17 types (no Carry Weight)
      { rarity: RarityType.Legendary, expectedCount: 17 } // 17 types (no Carry Weight)
    ];

    for (const { rarity, expectedCount } of raritiesToTest) {
      // Get the affix definitions for this tier
      let affixDefinitions: AffixDefinition[] = [];
      switch (rarity) {
        case RarityType.Common:
          affixDefinitions = affixPool.common;
          break;
        case RarityType.Rare:
          affixDefinitions = affixPool.rare;
          break;
        case RarityType.Epic:
          affixDefinitions = affixPool.epic;
          break;
        case RarityType.Legendary:
          affixDefinitions = affixPool.legendary;
          break;
      }

      // Verify the tier has the expected number of affix types
      expect(affixDefinitions.length).toBe(expectedCount);

      // Generate large sample by directly selecting from this tier
      // We need to force selection from a specific tier, so we'll generate
      // affixes for equipment of the same rarity and filter to only those
      // that match the tier we're testing
      const typeCounts = new Map<string, number>();
      let samplesFromTier = 0;

      // Generate enough samples to get sampleSize from the target tier
      // For efficiency, we'll use a helper approach
      while (samplesFromTier < sampleSize) {
        const affix = affixSelector.selectAffix(rarity);
        
        // Only count affixes that match the tier we're testing
        if (affix.rarity === rarity) {
          const count = typeCounts.get(affix.type) || 0;
          typeCounts.set(affix.type, count + 1);
          samplesFromTier++;
        }
      }

      // Calculate expected frequency for uniform distribution
      const expectedFrequency = 1 / expectedCount;
      const expectedCountPerType = sampleSize * expectedFrequency;

      // Verify each affix type appears with approximately equal frequency
      for (const definition of affixDefinitions) {
        const actualCount = typeCounts.get(definition.type) || 0;
        const actualFrequency = actualCount / sampleSize;

        // Check frequency is within tolerance of expected uniform distribution
        expect(actualFrequency).toBeGreaterThanOrEqual(expectedFrequency - tolerance);
        expect(actualFrequency).toBeLessThanOrEqual(expectedFrequency + tolerance);
      }

      // Verify all types were encountered
      expect(typeCounts.size).toBe(expectedCount);

      // Verify total count matches sample size
      const totalCount = Array.from(typeCounts.values()).reduce((sum, count) => sum + count, 0);
      expect(totalCount).toBe(sampleSize);
    }
  });
});
