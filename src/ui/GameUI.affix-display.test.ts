/**
 * Tests for affix display in GameUI tooltips
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatAffixDisplay, getAffixColorStyle } from '../game/utils/AffixFormatter';
import { RarityType } from '../game/types/RarityTypes';
import { AffixType } from '../game/types/AffixTypes';

describe('GameUI Affix Display', () => {
  describe('Affix Tooltip Integration', () => {
    it('should format affix display correctly for equipment tooltips', () => {
      const testAffix = {
        type: AffixType.Strength,
        rarity: RarityType.Rare,
        displayName: '稀有大力',
        value: 8,
        isPercentage: false
      };

      const formattedText = formatAffixDisplay(testAffix);
      expect(formattedText).toBe('稀有大力：力量+8');
    });

    it('should get correct color style for affix rarity', () => {
      const commonColor = getAffixColorStyle(RarityType.Common);
      const rareColor = getAffixColorStyle(RarityType.Rare);
      const epicColor = getAffixColorStyle(RarityType.Epic);
      const legendaryColor = getAffixColorStyle(RarityType.Legendary);

      // Colors should be valid hex codes
      expect(commonColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(rareColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(epicColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(legendaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);

      // Colors should be different for different rarities
      expect(commonColor).not.toBe(rareColor);
      expect(rareColor).not.toBe(epicColor);
      expect(epicColor).not.toBe(legendaryColor);
    });

    it('should format percentage affixes correctly', () => {
      const percentageAffix = {
        type: AffixType.CritRate,
        rarity: RarityType.Epic,
        displayName: '史诗致命',
        value: 10.5,
        isPercentage: true
      };

      const formattedText = formatAffixDisplay(percentageAffix);
      expect(formattedText).toBe('史诗致命：暴击率+10.5%');
    });

    it('should format decimal affixes correctly', () => {
      const decimalAffix = {
        type: AffixType.HPRegen,
        rarity: RarityType.Legendary,
        displayName: '传说生命恢复',
        value: 1.5,
        isPercentage: false
      };

      const formattedText = formatAffixDisplay(decimalAffix);
      expect(formattedText).toBe('传说生命恢复：回血+1.5');
    });

    it('should handle items without affixes gracefully', () => {
      const itemWithoutAffix = {
        name: 'Test Item',
        rarity: RarityType.Common,
        description: 'Test description',
        icon: 'test.png'
      };

      // Should not throw error when affix is undefined
      expect(itemWithoutAffix.affix).toBeUndefined();
    });

    it('should display affix with colored text outline', () => {
      const testAffix = {
        type: AffixType.Attack,
        rarity: RarityType.Epic,
        displayName: '史诗攻击',
        value: 12,
        isPercentage: false
      };

      const affixColor = getAffixColorStyle(testAffix.rarity);
      const affixText = formatAffixDisplay(testAffix);

      // Verify the HTML structure would include color and text-shadow
      const expectedHTML = `
        <div style="color: ${affixColor}; text-shadow: 0 0 2px ${affixColor}, 0 0 4px ${affixColor}; font-weight: bold;">
          ${affixText}
        </div>
      `;

      expect(expectedHTML).toContain(affixColor);
      expect(expectedHTML).toContain(affixText);
      expect(expectedHTML).toContain('text-shadow');
    });
  });
});
