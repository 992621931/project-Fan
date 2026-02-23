/**
 * Test for new passive skills in NPCSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NPCSystem } from './NPCSystem';
import { World } from '../../ecs/World';

describe('NPCSystem - New Passive Skills', () => {
  let world: World;
  let npcSystem: NPCSystem;

  beforeEach(() => {
    world = new World();
    npcSystem = new NPCSystem(world);
  });

  describe('Permanent Attribute Bonuses', () => {
    it('should apply aim_weakness (critRate +8%)', () => {
      const character = npcSystem.createAdventurer();
      const baseCritRate = character.critRate;
      
      // Manually set passive skill and reapply
      character.passiveSkill = 'aim_weakness';
      npcSystem.applyPassiveSkillEffects(character);
      
      // critRate should increase by 8% (multiply by 1.08)
      expect(character.critRate).toBeGreaterThan(baseCritRate);
    });

    it('should apply extreme_cruelty (critDamage +10%)', () => {
      const character = npcSystem.createAdventurer();
      const baseCritDamage = character.critDamage;
      
      character.passiveSkill = 'extreme_cruelty';
      npcSystem.applyPassiveSkillEffects(character);
      
      expect(character.critDamage).toBeGreaterThan(baseCritDamage);
    });

    it('should apply arcane_supremacy (magicPower +8)', () => {
      const character = npcSystem.createAdventurer();
      const baseMagicPower = character.magicPower;
      
      character.passiveSkill = 'arcane_supremacy';
      npcSystem.applyPassiveSkillEffects(character);
      
      expect(character.magicPower).toBe(baseMagicPower + 8);
    });

    it('should apply titan_bloodline (volume +30, weight +10)', () => {
      const character = npcSystem.createAdventurer();
      const baseVolume = character.volume;
      const baseWeight = character.weight;
      
      character.passiveSkill = 'titan_bloodline';
      npcSystem.applyPassiveSkillEffects(character);
      
      expect(character.volume).toBe(baseVolume + 30);
      expect(character.weight).toBe(baseWeight + 10);
    });

    it('should apply carrier (carryWeight +30, moveSpeed -30%)', () => {
      const character = npcSystem.createAdventurer();
      const baseCarryWeight = character.carryWeight;
      const baseMoveSpeed = character.moveSpeed;
      
      character.passiveSkill = 'carrier';
      npcSystem.applyPassiveSkillEffects(character);
      
      expect(character.carryWeight).toBe(baseCarryWeight + 30);
      expect(character.moveSpeed).toBeLessThan(baseMoveSpeed);
    });

    it('should apply gastritis (maxHP -10)', () => {
      const character = npcSystem.createAdventurer();
      const baseMaxHP = character.maxHP;
      
      character.passiveSkill = 'gastritis';
      npcSystem.applyPassiveSkillEffects(character);
      
      expect(character.maxHP).toBe(baseMaxHP - 10);
    });
  });

  describe('Runtime Effects (logged but not applied at generation)', () => {
    it('should recognize lifesteal skill', () => {
      const character = npcSystem.createAdventurer();
      character.passiveSkill = 'lifesteal';
      
      // Should not throw error
      expect(() => npcSystem.applyPassiveSkillEffects(character)).not.toThrow();
      
      // Verify skill exists in data
      const skill = npcSystem.getPassiveSkill('lifesteal');
      expect(skill).toBeDefined();
      expect(skill.triggerCondition).toBe('on_collision');
    });

    it('should recognize midas_touch skill', () => {
      const character = npcSystem.createAdventurer();
      character.passiveSkill = 'midas_touch';
      
      expect(() => npcSystem.applyPassiveSkillEffects(character)).not.toThrow();
      
      const skill = npcSystem.getPassiveSkill('midas_touch');
      expect(skill).toBeDefined();
      expect(skill.triggerCondition).toBe('on_collision');
    });

    it('should recognize moon_blessing skill', () => {
      const character = npcSystem.createAdventurer();
      character.passiveSkill = 'moon_blessing';
      
      expect(() => npcSystem.applyPassiveSkillEffects(character)).not.toThrow();
      
      const skill = npcSystem.getPassiveSkill('moon_blessing');
      expect(skill).toBeDefined();
      expect(skill.triggerCondition).toBe('time_of_day');
    });

    it('should recognize photosynthesis skill', () => {
      const character = npcSystem.createAdventurer();
      character.passiveSkill = 'photosynthesis';
      
      expect(() => npcSystem.applyPassiveSkillEffects(character)).not.toThrow();
      
      const skill = npcSystem.getPassiveSkill('photosynthesis');
      expect(skill).toBeDefined();
      expect(skill.triggerCondition).toBe('time_of_day');
    });

    it('should recognize challenger skill', () => {
      const character = npcSystem.createAdventurer();
      character.passiveSkill = 'challenger';
      
      expect(() => npcSystem.applyPassiveSkillEffects(character)).not.toThrow();
      
      const skill = npcSystem.getPassiveSkill('challenger');
      expect(skill).toBeDefined();
      expect(skill.effects[0].type).toBe('damage_modifier');
    });

    it('should recognize natural_science skill', () => {
      const character = npcSystem.createAdventurer();
      character.passiveSkill = 'natural_science';
      
      expect(() => npcSystem.applyPassiveSkillEffects(character)).not.toThrow();
      
      const skill = npcSystem.getPassiveSkill('natural_science');
      expect(skill).toBeDefined();
      expect(skill.effects[0].type).toBe('damage_modifier');
    });
  });

  describe('Skill Data Integrity', () => {
    it('should have all 18 passive skills loaded', () => {
      const skills = npcSystem.getPassiveSkills();
      expect(skills.length).toBeGreaterThanOrEqual(18);
    });

    it('should have all new skills with correct IDs', () => {
      const newSkillIds = [
        'aim_weakness',
        'extreme_cruelty',
        'arcane_supremacy',
        'titan_bloodline',
        'carrier',
        'gastritis',
        'moon_blessing',
        'photosynthesis',
        'lifesteal',
        'midas_touch',
        'challenger',
        'natural_science'
      ];

      newSkillIds.forEach(skillId => {
        const skill = npcSystem.getPassiveSkill(skillId);
        expect(skill).toBeDefined();
        expect(skill.id).toBe(skillId);
      });
    });

    it('should have all new skills with common rarity', () => {
      const newSkillIds = [
        'aim_weakness',
        'extreme_cruelty',
        'arcane_supremacy',
        'titan_bloodline',
        'carrier',
        'gastritis',
        'moon_blessing',
        'photosynthesis',
        'lifesteal',
        'midas_touch',
        'challenger',
        'natural_science'
      ];

      newSkillIds.forEach(skillId => {
        const skill = npcSystem.getPassiveSkill(skillId);
        expect(skill.rarity).toBe('common');
      });
    });
  });
});
