/**
 * Affix formatting utilities
 * Provides functions for formatting and displaying affixes in the UI
 */

import { AppliedAffix, AffixType } from '../types/AffixTypes';
import { RarityType, getRarityColor } from '../types/RarityTypes';

/**
 * Mapping from AffixType to Chinese attribute name
 */
const AFFIX_TYPE_TO_ATTRIBUTE_NAME: Record<AffixType, string> = {
  [AffixType.Strength]: '力量',
  [AffixType.Agility]: '敏捷',
  [AffixType.Wisdom]: '智慧',
  [AffixType.Skill]: '技巧',
  [AffixType.Attack]: '攻击力',
  [AffixType.Defense]: '防御力',
  [AffixType.CritRate]: '暴击率',
  [AffixType.CritDamage]: '暴击伤害',
  [AffixType.DodgeRate]: '闪避率',
  [AffixType.MoveSpeed]: '移动速度',
  [AffixType.MagicPower]: '魔法强度',
  [AffixType.CarryWeight]: '负重',
  [AffixType.Resistance]: '抗性',
  [AffixType.ExperienceRate]: '经验率',
  [AffixType.HPRegen]: '回血',
  [AffixType.MPRegen]: '回魔',
  [AffixType.BodyWeight]: '体重',
  [AffixType.BodySize]: '体积'
};

/**
 * Format affix display text with name, attribute name, and value
 * Format: "普通钻研：经验率+1%"
 * Handles percentage formatting and decimal precision
 * 
 * @param affix - The applied affix to format
 * @returns Formatted string with affix name, attribute name, and value
 */
export function formatAffixDisplay(affix: AppliedAffix): string {
  let formattedValue: string;

  if (affix.isPercentage) {
    // Format percentage with 1 decimal place if needed
    const roundedValue = Math.round(affix.value * 10) / 10;
    formattedValue = roundedValue % 1 === 0 
      ? `${roundedValue.toFixed(0)}%` 
      : `${roundedValue.toFixed(1)}%`;
  } else {
    // Format decimal values with 1 decimal place if needed
    const roundedValue = Math.round(affix.value * 10) / 10;
    formattedValue = roundedValue % 1 === 0 
      ? roundedValue.toFixed(0) 
      : roundedValue.toFixed(1);
  }

  const attributeName = AFFIX_TYPE_TO_ATTRIBUTE_NAME[affix.type] || affix.type;
  return `${affix.displayName}：${attributeName}+${formattedValue}`;
}

/**
 * Format affix display text with value range appended in green
 * Format: "普通开窍：智慧+4（1~5）"
 * Returns HTML string with green range text
 */
export function formatAffixDisplayWithRange(affix: AppliedAffix): string {
  const base = formatAffixDisplay(affix);
  if (affix.minValue != null && affix.maxValue != null) {
    return `${base} <span style="color:#69f0ae;">(${affix.minValue}~${affix.maxValue})</span>`;
  }
  return base;
}

/**
 * Get CSS color style for affix rarity
 * Returns the color code corresponding to the affix's rarity tier
 * 
 * @param affixRarity - The rarity type of the affix
 * @returns CSS color string (hex format)
 */
export function getAffixColorStyle(affixRarity: RarityType): string {
  try {
    return getRarityColor(affixRarity);
  } catch (error) {
    // Fallback to default gray color if rarity color not found
    return '#9e9e9e';
  }
}


/**
 * Normalize affix data to always return an array
 * Handles backward compatibility with old single-affix format
 */
export function normalizeAffixes(affix: any): AppliedAffix[] {
  if (!affix) return [];
  if (Array.isArray(affix)) return affix;
  // Old format: single AppliedAffix object
  return [affix];
}
