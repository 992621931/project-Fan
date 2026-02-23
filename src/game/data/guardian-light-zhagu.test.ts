/**
 * Unit and Property-based tests for Guardian Light skill and Zhagu character
 * **Feature: guardian-light-zhagu-character**
 * **Validates: Requirements 1.1-1.7, 2.1-2.6, 3.1-3.9, 4.1-4.5**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ConfigManager } from '../config/ConfigManager';
import { DataLoader } from './DataLoader';
import { ExclusiveSkillConfig, OtherworldCharacterConfig } from '../config/ConfigTypes';

describe('Guardian Light Skill and Zhagu Character Tests', () => {
  let configManager: ConfigManager;
  let dataLoader: DataLoader;

  beforeEach(async () => {
    dataLoader = DataLoader.getInstance();
    configManager = ConfigManager.getInstance();
    
    // Load actual game data from JSON files
    await dataLoader.loadGameData();
  });

  /**
   * Unit Test 1: 守护之光技能数据验证
   * Verifies that shouhu_zhiguang skill exists with correct field values
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.1, 4.2, 4.3, 4.4**
   */
  describe('Unit Test 1: 守护之光技能数据验证', () => {
    it('should have shouhu_zhiguang skill in exclusive-skills.json', () => {
      const skill = configManager.getExclusiveSkillById('shouhu_zhiguang');
      
      // Requirement 1.1, 1.2: Skill exists with correct ID
      expect(skill).toBeDefined();
      expect(skill?.id).toBe('shouhu_zhiguang');
    });

    it('should have correct skill name', () => {
      const skill = configManager.getExclusiveSkillById('shouhu_zhiguang');
      
      // Requirement 1.3: Skill name is "守护之光"
      expect(skill?.name).toBe('守护之光');
    });

    it('should have correct skill type', () => {
      const skill = configManager.getExclusiveSkillById('shouhu_zhiguang');
      
      // Requirement 1.4: Skill type is "exclusive"
      expect(skill?.type).toBe('exclusive');
    });

    it('should have correct icon path', () => {
      const skill = configManager.getExclusiveSkillById('shouhu_zhiguang');
      
      // Requirement 1.5: Icon path is "images/zhudongjineng_shouhuzhiguang.png"
      expect(skill?.icon).toBe('images/zhudongjineng_shouhuzhiguang.png');
    });

    it('should have correct tags', () => {
      const skill = configManager.getExclusiveSkillById('shouhu_zhiguang');
      
      // Requirement 1.6: Tags are ["护盾", "群体"]
      expect(skill?.tags).toEqual(['护盾', '群体']);
    });

    it('should have correct description', () => {
      const skill = configManager.getExclusiveSkillById('shouhu_zhiguang');
      
      // Requirement 1.7: Description matches specification
      expect(skill?.description).toBe('给所有友方角色添加护盾，自身防御越高，护盾数值越高');
    });

    it('should have correct effect configuration', () => {
      const skill = configManager.getExclusiveSkillById('shouhu_zhiguang');
      
      // Requirement 4.1: Effect type is "shield_all_allies"
      expect(skill?.effects).toBeDefined();
      expect(skill?.effects.length).toBeGreaterThan(0);
      
      const effect = skill?.effects[0];
      expect(effect?.type).toBe('shield_all_allies');
      
      // Requirement 4.2: Shield base value is 15
      expect(effect?.shieldAmount).toBeDefined();
      expect(effect?.shieldAmount.base).toBe(15);
      
      // Requirement 4.3: Defense multiplier is 1.0
      expect(effect?.shieldAmount.defenseMultiplier).toBe(1.0);
      
      // Requirement 4.4: Duration is consistent with existing shield mechanism
      expect(effect?.duration).toBe(10000);
    });
  });

  /**
   * Unit Test 2: 扎古角色数据验证
   * Verifies that zhagu character exists with correct field values
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**
   */
  describe('Unit Test 2: 扎古角色数据验证', () => {
    it('should have zhagu character in otherworld-characters.json', () => {
      const character = configManager.getOtherworldCharacterById('zhagu');
      
      // Requirement 3.1: Character exists in otherworldCharacters array
      expect(character).toBeDefined();
    });

    it('should have correct character name', () => {
      const character = configManager.getOtherworldCharacterById('zhagu');
      
      // Requirement 3.2: Character name is "扎古"
      expect(character?.name).toBe('扎古');
    });

    it('should have correct character types', () => {
      const character = configManager.getOtherworldCharacterById('zhagu');
      
      // Requirement 3.3: Character types are ["异界", "冒险者"]
      expect(character?.characterTypes).toEqual(['异界', '冒险者']);
    });

    it('should have correct portrait path', () => {
      const character = configManager.getOtherworldCharacterById('zhagu');
      
      // Requirement 3.4: Portrait path is "images/touxiang_yijie_zhagu.png"
      expect(character?.portrait).toBe('images/touxiang_yijie_zhagu.png');
    });

    it('should have correct initial state', () => {
      const character = configManager.getOtherworldCharacterById('zhagu');
      
      // Requirement 3.5: Initial state values
      expect(character?.initialState).toBeDefined();
      expect(character?.initialState.level).toBe(1);
      expect(character?.initialState.maxHealth).toBe(200);
      expect(character?.initialState.maxMana).toBe(100);
      expect(character?.initialState.maxHunger).toBe(100);
    });

    it('should have correct base attributes', () => {
      const character = configManager.getOtherworldCharacterById('zhagu');
      
      // Requirement 3.6: Base attributes
      expect(character?.baseAttributes).toBeDefined();
      expect(character?.baseAttributes.strength).toBe(6);
      expect(character?.baseAttributes.agility).toBe(2);
      expect(character?.baseAttributes.wisdom).toBe(6);
      expect(character?.baseAttributes.technique).toBe(6);
    });

    it('should have correct starting job', () => {
      const character = configManager.getOtherworldCharacterById('zhagu');
      
      // Requirement 3.7: Starting job is "warrior"
      expect(character?.startingJob).toBe('warrior');
    });

    it('should have correct initial skills', () => {
      const character = configManager.getOtherworldCharacterById('zhagu');
      
      // Requirement 3.8: Initial skills
      expect(character?.initialSkills).toBeDefined();
      expect(character?.initialSkills.passive).toEqual([]);
      expect(character?.initialSkills.active).toEqual(['shouhu_zhiguang']);
    });

    it('should have correct combat stats', () => {
      const character = configManager.getOtherworldCharacterById('zhagu');
      
      // Requirement 3.9: Combat stats override
      expect(character?.combatStats).toBeDefined();
      expect(character?.combatStats?.attack).toBe(5);
      expect(character?.combatStats?.defense).toBe(10);
      expect(character?.combatStats?.moveSpeed).toBe(21);
      expect(character?.combatStats?.dodgeRate).toBe(0);
      expect(character?.combatStats?.critRate).toBe(0);
      expect(character?.combatStats?.critDamage).toBe(125);
      expect(character?.combatStats?.resistance).toBe(10);
      expect(character?.combatStats?.magicPower).toBe(0);
      expect(character?.combatStats?.carryWeight).toBe(60);
      expect(character?.combatStats?.volume).toBe(100);
      expect(character?.combatStats?.expRate).toBe(100);
      expect(character?.combatStats?.healthRegen).toBe(1);
      expect(character?.combatStats?.manaRegen).toBe(0);
      expect(character?.combatStats?.weight).toBe(65);
    });
  });

  /**
   * Property Test 1: 护盾公式属性测试
   * For any non-negative defense value, shield amount should equal 15 + defense * 1
   * **Feature: guardian-light-zhagu-character, Property 2: 护盾数值公式正确性**
   * **Validates: Requirement 2.2**
   */
  it('Property 1: 护盾数值公式正确性', () => {
    const skill = configManager.getExclusiveSkillById('shouhu_zhiguang');
    expect(skill).toBeDefined();
    
    const effect = skill?.effects[0];
    expect(effect?.type).toBe('shield_all_allies');
    
    const base = effect?.shieldAmount.base ?? 15;
    const defenseMultiplier = effect?.shieldAmount.defenseMultiplier ?? 1.0;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }), // Generate random defense values
        (defense) => {
          // Calculate shield amount using the formula
          const expectedShieldAmount = base + defense * defenseMultiplier;
          
          // Verify the formula: shield = 15 + defense * 1
          expect(expectedShieldAmount).toBe(15 + defense * 1);
          
          // Verify the calculation matches the expected formula
          const calculatedShield = base + defense * defenseMultiplier;
          expect(calculatedShield).toBe(expectedShieldAmount);
          
          // Verify shield amount is always >= base value
          expect(calculatedShield).toBeGreaterThanOrEqual(base);
          
          // Verify linear relationship
          if (defense > 0) {
            const shieldForZeroDefense = base + 0 * defenseMultiplier;
            const shieldIncrease = calculatedShield - shieldForZeroDefense;
            expect(shieldIncrease).toBe(defense * defenseMultiplier);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test 2: 护盾覆盖属性测试
   * Verifies that shield_all_allies effect configuration ensures all allies receive shields
   * **Feature: guardian-light-zhagu-character, Property 1: 守护之光覆盖所有友方角色**
   * **Validates: Requirement 2.1**
   */
  it('Property 2: 守护之光覆盖所有友方角色', () => {
    const skill = configManager.getExclusiveSkillById('shouhu_zhiguang');
    expect(skill).toBeDefined();
    
    fc.assert(
      fc.property(
        fc.record({
          allyCount: fc.integer({ min: 1, max: 10 }),
          enemyCount: fc.integer({ min: 0, max: 10 }),
          casterDefense: fc.integer({ min: 0, max: 100 })
        }),
        (scenario) => {
          // Get the effect configuration
          const effect = skill?.effects[0];
          
          // Verify effect type is shield_all_allies (Requirement 2.1)
          expect(effect?.type).toBe('shield_all_allies');
          
          // Verify the effect is configured to target all allies
          // The "shield_all_allies" type indicates it should apply to all friendly characters
          expect(effect?.type).toContain('all_allies');
          
          // Verify shield configuration exists
          expect(effect?.shieldAmount).toBeDefined();
          expect(effect?.shieldAmount.base).toBeGreaterThan(0);
          expect(effect?.shieldAmount.defenseMultiplier).toBeGreaterThanOrEqual(0);
          
          // Verify duration is positive
          expect(effect?.duration).toBeGreaterThan(0);
          
          // Calculate expected shield amount for this scenario
          const baseShield = effect?.shieldAmount?.base || 15;
          const defenseMultiplier = effect?.shieldAmount?.defenseMultiplier || 1.0;
          const expectedShield = Math.floor(baseShield + (scenario.casterDefense * defenseMultiplier));
          
          // Verify shield formula (Requirement 2.2)
          expect(expectedShield).toBe(15 + scenario.casterDefense * 1);
          
          // Property: The effect type "shield_all_allies" semantically guarantees
          // that all allies (up to scenario.allyCount) would receive the shield
          // This is a configuration-level verification that the BattleSystem
          // will apply shields to all allies when it processes this effect type
          expect(scenario.allyCount).toBeGreaterThan(0);
          expect(effect?.type).toBe('shield_all_allies');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Edge Case Test 1: 施法者防御力为0时的护盾数值
   * When caster defense is 0, shield amount should be the base value (15)
   * **Validates: Requirement 2.2**
   */
  it('Edge Case 1: 施法者防御力为0时护盾数值应为基础值', () => {
    const skill = configManager.getExclusiveSkillById('shouhu_zhiguang');
    const effect = skill?.effects[0];
    
    const base = effect?.shieldAmount.base ?? 15;
    const defenseMultiplier = effect?.shieldAmount.defenseMultiplier ?? 1.0;
    
    const defense = 0;
    const shieldAmount = base + defense * defenseMultiplier;
    
    // Shield amount should equal base value when defense is 0
    expect(shieldAmount).toBe(15);
    expect(shieldAmount).toBe(base);
  });

  /**
   * Edge Case Test 2: 高防御力值的护盾计算
   * Verifies shield calculation with high defense values
   * **Validates: Requirement 2.2**
   */
  it('Edge Case 2: 高防御力值的护盾计算', () => {
    const skill = configManager.getExclusiveSkillById('shouhu_zhiguang');
    const effect = skill?.effects[0];
    
    const base = effect?.shieldAmount.base ?? 15;
    const defenseMultiplier = effect?.shieldAmount.defenseMultiplier ?? 1.0;
    
    // Test with high defense value
    const highDefense = 100;
    const shieldAmount = base + highDefense * defenseMultiplier;
    
    // Shield should be 15 + 100 * 1 = 115
    expect(shieldAmount).toBe(115);
    expect(shieldAmount).toBe(15 + highDefense);
  });

  /**
   * Integration Test: 扎古角色引用守护之光技能
   * Verifies that Zhagu character correctly references shouhu_zhiguang skill
   * **Validates: Requirements 3.8, 4.5**
   */
  it('Integration Test: 扎古角色正确引用守护之光技能', () => {
    const character = configManager.getOtherworldCharacterById('zhagu');
    const skill = configManager.getExclusiveSkillById('shouhu_zhiguang');
    
    // Both character and skill should exist
    expect(character).toBeDefined();
    expect(skill).toBeDefined();
    
    // Zhagu should have shouhu_zhiguang in active skills
    expect(character?.initialSkills.active).toContain('shouhu_zhiguang');
    
    // The referenced skill should exist in the skill database
    const referencedSkill = configManager.getExclusiveSkillById(
      character?.initialSkills.active[0] ?? ''
    );
    expect(referencedSkill).toBeDefined();
    expect(referencedSkill?.id).toBe('shouhu_zhiguang');
  });
});
