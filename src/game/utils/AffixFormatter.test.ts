/**
 * Unit tests for AffixFormatter
 * Tests affix display formatting and color styling
 */

import { describe, it, expect } from 'vitest';
import { formatAffixDisplay, getAffixColorStyle } from './AffixFormatter';
import { AppliedAffix, AffixType } from '../types/AffixTypes';
import { RarityType } from '../types/RarityTypes';

describe('AffixFormatter', () => {
  describe('getAffixColorStyle', () => {
    it('should return correct color for Common rarity', () => {
      const color = getAffixColorStyle(RarityType.Common);
      expect(color).toBe('#9e9e9e');
    });

    it('should return correct color for Rare rarity', () => {
      const color = getAffixColorStyle(RarityType.Rare);
      expect(color).toBe('#0080FF');
    });

    it('should return correct color for Epic rarity', () => {
      const color = getAffixColorStyle(RarityType.Epic);
      expect(color).toBe('#8000FF');
    });

    it('should return correct color for Legendary rarity', () => {
      const color = getAffixColorStyle(RarityType.Legendary);
      expect(color).toBe('#FF8000');
    });

    it('should return default gray color for invalid rarity', () => {
      // Force an invalid rarity value
      const invalidRarity = 999 as RarityType;
      const color = getAffixColorStyle(invalidRarity);
      expect(color).toBe('#9e9e9e');
    });
  });

  describe('formatAffixDisplay', () => {
    describe('percentage formatting', () => {
      it('should format whole number percentage without decimal', () => {
        const affix: AppliedAffix = {
          type: AffixType.CritRate,
          rarity: RarityType.Common,
          displayName: '普通致命',
          value: 5,
          isPercentage: true
        };
        const formatted = formatAffixDisplay(affix);
        expect(formatted).toBe('普通致命：暴击率+5%');
      });

      it('should format decimal percentage with one decimal place', () => {
        const affix: AppliedAffix = {
          type: AffixType.CritRate,
          rarity: RarityType.Rare,
          displayName: '稀有致命',
          value: 5.5,
          isPercentage: true
        };
        const formatted = formatAffixDisplay(affix);
        expect(formatted).toBe('稀有致命：暴击率+5.5%');
      });

      it('should round percentage to one decimal place', () => {
        const affix: AppliedAffix = {
          type: AffixType.CritRate,
          rarity: RarityType.Epic,
          displayName: '神话致命',
          value: 5.67,
          isPercentage: true
        };
        const formatted = formatAffixDisplay(affix);
        expect(formatted).toBe('神话致命：暴击率+5.7%');
      });
    });

    describe('decimal precision formatting', () => {
      it('should format whole number without decimal', () => {
        const affix: AppliedAffix = {
          type: AffixType.Strength,
          rarity: RarityType.Common,
          displayName: '普通大力',
          value: 5,
          isPercentage: false
        };
        const formatted = formatAffixDisplay(affix);
        expect(formatted).toBe('普通大力：力量+5');
      });

      it('should format decimal value with one decimal place', () => {
        const affix: AppliedAffix = {
          type: AffixType.HPRegen,
          rarity: RarityType.Rare,
          displayName: '稀有生命恢复',
          value: 0.5,
          isPercentage: false
        };
        const formatted = formatAffixDisplay(affix);
        expect(formatted).toBe('稀有生命恢复：回血+0.5');
      });

      it('should round decimal value to one decimal place', () => {
        const affix: AppliedAffix = {
          type: AffixType.MPRegen,
          rarity: RarityType.Epic,
          displayName: '神话魔力恢复',
          value: 1.47,
          isPercentage: false
        };
        const formatted = formatAffixDisplay(affix);
        expect(formatted).toBe('神话魔力恢复：回魔+1.5');
      });

      it('should handle very small decimal values', () => {
        const affix: AppliedAffix = {
          type: AffixType.HPRegen,
          rarity: RarityType.Common,
          displayName: '普通生命恢复',
          value: 0.1,
          isPercentage: false
        };
        const formatted = formatAffixDisplay(affix);
        expect(formatted).toBe('普通生命恢复：回血+0.1');
      });
    });

    describe('edge cases', () => {
      it('should handle zero value', () => {
        const affix: AppliedAffix = {
          type: AffixType.Strength,
          rarity: RarityType.Common,
          displayName: '普通大力',
          value: 0,
          isPercentage: false
        };
        const formatted = formatAffixDisplay(affix);
        expect(formatted).toBe('普通大力：力量+0');
      });

      it('should handle large values', () => {
        const affix: AppliedAffix = {
          type: AffixType.MoveSpeed,
          rarity: RarityType.Legendary,
          displayName: '传说移速',
          value: 30,
          isPercentage: false
        };
        const formatted = formatAffixDisplay(affix);
        expect(formatted).toBe('传说移速：移动速度+30');
      });
    });
  });
});
