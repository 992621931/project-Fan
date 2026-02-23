/**
 * Unit tests for AffixSelector
 * Tests probability configuration, Carry Weight exclusion, and error handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AffixSelector } from './AffixSelector';
import { RarityType } from '../types/RarityTypes';
import {
  AffixType,
  AffixPoolConfig,
  AffixProbabilityConfig,
  AFFIX_PROBABILITY_CONFIG
} from '../types/AffixTypes';
import affixDefinitionsData from '../data/affix-definitions.json';

describe('AffixSelector Unit Tests', () => {
  let affixPool: AffixPoolConfig;
  let selector: AffixSelector;

  beforeEach(() => {
    affixPool = affixDefinitionsData as AffixPoolConfig;
    selector = new AffixSelector(affixPool, AFFIX_PROBABILITY_CONFIG);
  });

  describe('Probability Configuration Sum', () => {
    it('should have probabilities sum to 100% for Common equipment', () => {
      const probabilities = AFFIX_PROBABILITY_CONFIG[RarityType.Common];
      const sum = Object.values(probabilities).reduce((acc, val) => acc + val, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('should have probabilities sum to 100% for Rare equipment', () => {
      const probabilities = AFFIX_PROBABILITY_CONFIG[RarityType.Rare];
      const sum = Object.values(probabilities).reduce((acc, val) => acc + val, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('should have probabilities sum to 100% for Epic equipment', () => {
      const probabilities = AFFIX_PROBABILITY_CONFIG[RarityType.Epic];
      const sum = Object.values(probabilities).reduce((acc, val) => acc + val, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('should have probabilities sum to 100% for Legendary equipment', () => {
      const probabilities = AFFIX_PROBABILITY_CONFIG[RarityType.Legendary];
      const sum = Object.values(probabilities).reduce((acc, val) => acc + val, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });
  });

  describe('Carry Weight Exclusion', () => {
    it('should exclude Carry Weight from Rare tier', () => {
      const rareAffixes = affixPool.rare;
      const hasCarryWeight = rareAffixes.some(affix => affix.type === AffixType.CarryWeight);
      expect(hasCarryWeight).toBe(false);
      expect(rareAffixes.length).toBe(17);
    });

    it('should exclude Carry Weight from Epic tier', () => {
      const epicAffixes = affixPool.epic;
      const hasCarryWeight = epicAffixes.some(affix => affix.type === AffixType.CarryWeight);
      expect(hasCarryWeight).toBe(false);
      expect(epicAffixes.length).toBe(17);
    });

    it('should exclude Carry Weight from Legendary tier', () => {
      const legendaryAffixes = affixPool.legendary;
      const hasCarryWeight = legendaryAffixes.some(affix => affix.type === AffixType.CarryWeight);
      expect(hasCarryWeight).toBe(false);
      expect(legendaryAffixes.length).toBe(17);
    });

    it('should include Carry Weight in Common tier', () => {
      const commonAffixes = affixPool.common;
      const hasCarryWeight = commonAffixes.some(affix => affix.type === AffixType.CarryWeight);
      expect(hasCarryWeight).toBe(true);
      expect(commonAffixes.length).toBe(18);
    });
  });

  describe('Error Handling - Invalid Equipment Rarity', () => {
    it('should handle invalid equipment rarity gracefully', () => {
      const invalidRarity = 999 as RarityType;
      
      // Should not throw, should default to Common rarity behavior
      expect(() => {
        selector.selectAffix(invalidRarity);
      }).not.toThrow();
    });

    it('should return a valid affix when given invalid equipment rarity', () => {
      const invalidRarity = 999 as RarityType;
      const affix = selector.selectAffix(invalidRarity);
      
      // Should return a valid affix structure
      expect(affix).toBeDefined();
      expect(affix.type).toBeDefined();
      expect(affix.rarity).toBeDefined();
      expect(affix.displayName).toBeDefined();
      expect(affix.value).toBeDefined();
      expect(typeof affix.isPercentage).toBe('boolean');
    });
  });

  describe('Error Handling - Empty Affix Pool', () => {
    it('should throw error when affix pool is empty for a tier', () => {
      const emptyPool: AffixPoolConfig = {
        common: [],
        rare: affixPool.rare,
        epic: affixPool.epic,
        legendary: affixPool.legendary
      };
      
      const emptySelector = new AffixSelector(emptyPool, AFFIX_PROBABILITY_CONFIG);
      
      // Should throw when trying to select from empty Common pool
      expect(() => {
        emptySelector.selectAffix(RarityType.Common);
      }).toThrow('Empty affix pool');
    });

    it('should throw error when all affix pools are empty', () => {
      const emptyPool: AffixPoolConfig = {
        common: [],
        rare: [],
        epic: [],
        legendary: []
      };
      
      const emptySelector = new AffixSelector(emptyPool, AFFIX_PROBABILITY_CONFIG);
      
      // Should throw for any equipment rarity
      expect(() => {
        emptySelector.selectAffix(RarityType.Common);
      }).toThrow('Empty affix pool');
    });
  });
});
