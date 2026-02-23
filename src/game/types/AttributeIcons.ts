/**
 * Attribute Icons - Centralized emoji constants for primary attributes
 * Use these constants throughout the codebase to ensure consistency
 */

export const ATTRIBUTE_ICONS = {
  STRENGTH: '💪',
  AGILITY: '👟',
  WISDOM: '🧠',
  SKILL: '🔧'
} as const;

export type AttributeIcon = typeof ATTRIBUTE_ICONS[keyof typeof ATTRIBUTE_ICONS];
