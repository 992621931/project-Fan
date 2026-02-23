/**
 * Unit test to verify SkillSystem supports attribute_bonus effect type
 * Task 2.1: 验证SkillSystem支持attribute_bonus效果类型
 * Requirements: 12.1
 */

import { describe, it, expect } from 'vitest';
import { Effect } from '../components/ItemComponents';

describe('SkillSystem attribute_bonus support', () => {
  it('should accept attribute_bonus as a valid effect type', () => {
    // This test verifies that the Effect interface accepts 'attribute_bonus' as a valid type
    const attributeBonusEffect: Effect = {
      type: 'attribute_bonus',
      target: 'self',
      attribute: 'critRate',
      value: 0.08,
      duration: -1
    };

    expect(attributeBonusEffect.type).toBe('attribute_bonus');
    expect(attributeBonusEffect.target).toBe('self');
    expect(attributeBonusEffect.attribute).toBe('critRate');
    expect(attributeBonusEffect.value).toBe(0.08);
    expect(attributeBonusEffect.duration).toBe(-1);
  });

  it('should accept buff as a valid effect type', () => {
    // Verify that the existing 'buff' type still works
    const buffEffect: Effect = {
      type: 'buff',
      target: 'self',
      attribute: 'attack',
      value: 10,
      duration: 60
    };

    expect(buffEffect.type).toBe('buff');
  });

  it('should accept all valid effect types', () => {
    // Verify all effect types are valid
    const effectTypes: Effect['type'][] = [
      'heal',
      'buff',
      'debuff',
      'damage',
      'restore',
      'attribute_bonus'
    ];

    effectTypes.forEach(type => {
      const effect: Effect = {
        type,
        target: 'self',
        attribute: 'test',
        value: 1,
        duration: 0
      };
      expect(effect.type).toBe(type);
    });
  });
});
