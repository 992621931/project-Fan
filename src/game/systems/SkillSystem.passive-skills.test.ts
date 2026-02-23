/**
 * Unit tests for passive skills expansion
 * Tests for aim_weakness, extreme_cruelty, and arcane_supremacy skills
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SkillSystem } from './SkillSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
import { 
  SkillComponent, 
  SkillComponentType,
  CurrencyComponent,
  CurrencyComponentType
} from '../components/SystemComponents';
import { 
  AttributeComponent,
  AttributeComponentType,
  DerivedStatsComponent,
  DerivedStatsComponentType,
  CharacterInfoComponent,
  CharacterInfoComponentType,
  ManaComponent,
  ManaComponentType,
  LevelComponent,
  LevelComponentType,
  JobComponent,
  JobComponentType
} from '../components/CharacterComponents';
import { SkillType, JobType, CharacterStatus } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

describe('Passive Skills Expansion - Basic Attribute Bonuses', () => {
  let skillSystem: SkillSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;

  beforeEach(() => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    
    skillSystem = new SkillSystem();
    skillSystem.initialize(entityManager, componentManager, eventSystem);
  });

  /**
   * Helper function to create a test character
   */
  function createTestCharacter(): string {
    const characterEntity = entityManager.createEntity();
    const character = characterEntity.id;

    const attributeComponent: AttributeComponent = {
      type: 'attribute',
      strength: 20,
      agility: 20,
      wisdom: 20,
      technique: 20
    };

    const derivedStats: DerivedStatsComponent = {
      type: 'derivedStats',
      attack: 60,
      defense: 40,
      moveSpeed: 30,
      dodgeRate: 10,
      critRate: 0.05, // 5% base crit rate
      critDamage: 1.5, // 150% base crit damage
      resistance: 16,
      magicPower: 50, // Base magic power
      carryWeight: 150,
      hitRate: 95,
      expRate: 100,
      healthRegen: 4,
      manaRegen: 6,
      weight: 70,
      volume: 1
    };

    const mana: ManaComponent = {
      type: 'mana',
      current: 100,
      maximum: 100
    };

    const levelComponent: LevelComponent = {
      type: 'level',
      level: 1,
      experience: 0,
      experienceToNext: 100
    };

    const jobComponent: JobComponent = {
      type: 'job',
      currentJob: JobType.Warrior,
      availableJobs: [JobType.Warrior],
      jobExperience: new Map([[JobType.Warrior, 0]])
    };

    const characterInfo: CharacterInfoComponent = {
      type: 'characterInfo',
      title: 'Test',
      name: 'Character',
      isSpecial: false,
      rarity: RarityType.Common,
      status: CharacterStatus.Available
    };

    const skillComponent: SkillComponent = {
      type: 'skill',
      passiveSkills: [],
      activeSkills: [],
      jobSkills: [],
      badgeSkills: []
    };

    const currency: CurrencyComponent = {
      type: 'currency',
      amounts: {
        gold: 10000,
        crystal: 0,
        reputation: 0
      },
      transactionHistory: []
    };

    componentManager.addComponent(character, AttributeComponentType, attributeComponent);
    componentManager.addComponent(character, DerivedStatsComponentType, derivedStats);
    componentManager.addComponent(character, ManaComponentType, mana);
    componentManager.addComponent(character, LevelComponentType, levelComponent);
    componentManager.addComponent(character, JobComponentType, jobComponent);
    componentManager.addComponent(character, CharacterInfoComponentType, characterInfo);
    componentManager.addComponent(character, SkillComponentType, skillComponent);
    componentManager.addComponent(character, CurrencyComponentType, currency);

    return character;
  }

  it('should apply critRate bonus when learning aim_weakness skill', () => {
    const characterId = createTestCharacter();
    
    // Get initial crit rate
    const derivedStatsBefore = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(derivedStatsBefore).not.toBeNull();
    const initialCritRate = derivedStatsBefore!.critRate;

    // Learn aim_weakness skill
    const skillData = {
      name: '瞄准弱点',
      description: '精准地瞄准敌人的弱点，增加8%暴击率。',
      type: SkillType.Passive,
      manaCost: 0,
      cooldown: 0,
      maxLevel: 1,
      effects: [
        {
          type: 'attribute_bonus',
          target: 'self',
          attribute: 'critRate',
          value: 0.08,
          duration: -1
        }
      ],
      requirements: []
    };

    const result = skillSystem.learnSkill(characterId, 'aim_weakness', skillData);
    expect(result.success).toBe(true);

    // Verify crit rate increased by 8%
    const derivedStatsAfter = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(derivedStatsAfter).not.toBeNull();
    expect(derivedStatsAfter!.critRate).toBeCloseTo(initialCritRate + 0.08, 5);
  });

  it('should apply critDamage bonus when learning extreme_cruelty skill', () => {
    const characterId = createTestCharacter();
    
    // Get initial crit damage
    const derivedStatsBefore = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(derivedStatsBefore).not.toBeNull();
    const initialCritDamage = derivedStatsBefore!.critDamage;

    // Learn extreme_cruelty skill
    const skillData = {
      name: '残忍至极',
      description: '对敌人毫不留情，暴击伤害+10%。',
      type: SkillType.Passive,
      manaCost: 0,
      cooldown: 0,
      maxLevel: 1,
      effects: [
        {
          type: 'attribute_bonus',
          target: 'self',
          attribute: 'critDamage',
          value: 0.1,
          duration: -1
        }
      ],
      requirements: []
    };

    const result = skillSystem.learnSkill(characterId, 'extreme_cruelty', skillData);
    expect(result.success).toBe(true);

    // Verify crit damage increased by 10%
    const derivedStatsAfter = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(derivedStatsAfter).not.toBeNull();
    expect(derivedStatsAfter!.critDamage).toBeCloseTo(initialCritDamage + 0.1, 5);
  });

  it('should apply magicPower bonus when learning arcane_supremacy skill', () => {
    const characterId = createTestCharacter();
    
    // Get initial magic power
    const derivedStatsBefore = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(derivedStatsBefore).not.toBeNull();
    const initialMagicPower = derivedStatsBefore!.magicPower;

    // Learn arcane_supremacy skill
    const skillData = {
      name: '奥术至尊',
      description: '掌握奥术的精髓，魔法强度+8。',
      type: SkillType.Passive,
      manaCost: 0,
      cooldown: 0,
      maxLevel: 1,
      effects: [
        {
          type: 'attribute_bonus',
          target: 'self',
          attribute: 'magicPower',
          value: 8,
          duration: -1
        }
      ],
      requirements: []
    };

    const result = skillSystem.learnSkill(characterId, 'arcane_supremacy', skillData);
    expect(result.success).toBe(true);

    // Verify magic power increased by 8
    const derivedStatsAfter = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(derivedStatsAfter).not.toBeNull();
    expect(derivedStatsAfter!.magicPower).toBe(initialMagicPower + 8);
  });

  it('should apply all three skill bonuses correctly when learned together', () => {
    const characterId = createTestCharacter();
    
    // Get initial values
    const derivedStatsBefore = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(derivedStatsBefore).not.toBeNull();
    const initialCritRate = derivedStatsBefore!.critRate;
    const initialCritDamage = derivedStatsBefore!.critDamage;
    const initialMagicPower = derivedStatsBefore!.magicPower;

    // Learn all three skills
    skillSystem.learnSkill(characterId, 'aim_weakness', {
      name: '瞄准弱点',
      type: SkillType.Passive,
      manaCost: 0,
      cooldown: 0,
      maxLevel: 1,
      effects: [{ type: 'attribute_bonus', target: 'self', attribute: 'critRate', value: 0.08, duration: -1 }],
      requirements: []
    });

    skillSystem.learnSkill(characterId, 'extreme_cruelty', {
      name: '残忍至极',
      type: SkillType.Passive,
      manaCost: 0,
      cooldown: 0,
      maxLevel: 1,
      effects: [{ type: 'attribute_bonus', target: 'self', attribute: 'critDamage', value: 0.1, duration: -1 }],
      requirements: []
    });

    skillSystem.learnSkill(characterId, 'arcane_supremacy', {
      name: '奥术至尊',
      type: SkillType.Passive,
      manaCost: 0,
      cooldown: 0,
      maxLevel: 1,
      effects: [{ type: 'attribute_bonus', target: 'self', attribute: 'magicPower', value: 8, duration: -1 }],
      requirements: []
    });

    // Verify all bonuses applied
    const derivedStatsAfter = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(derivedStatsAfter).not.toBeNull();
    expect(derivedStatsAfter!.critRate).toBeCloseTo(initialCritRate + 0.08, 5);
    expect(derivedStatsAfter!.critDamage).toBeCloseTo(initialCritDamage + 0.1, 5);
    expect(derivedStatsAfter!.magicPower).toBe(initialMagicPower + 8);
  });
});


describe('Passive Skills Expansion - Loading from skills.json', () => {
  let skillSystem: SkillSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;
  let skillsData: any;

  beforeEach(async () => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    
    skillSystem = new SkillSystem();
    skillSystem.initialize(entityManager, componentManager, eventSystem);

    // Load skills data
    const fs = await import('fs/promises');
    const path = await import('path');
    const skillsPath = path.join(process.cwd(), 'src/game/data/skills.json');
    const skillsContent = await fs.readFile(skillsPath, 'utf-8');
    skillsData = JSON.parse(skillsContent);
  });

  /**
   * Helper function to create a test character
   */
  function createTestCharacter(): string {
    const characterEntity = entityManager.createEntity();
    const character = characterEntity.id;

    const attributeComponent: AttributeComponent = {
      type: 'attribute',
      strength: 20,
      agility: 20,
      wisdom: 20,
      technique: 20
    };

    const derivedStats: DerivedStatsComponent = {
      type: 'derivedStats',
      attack: 60,
      defense: 40,
      moveSpeed: 30,
      dodgeRate: 10,
      critRate: 0.05,
      critDamage: 1.5,
      resistance: 16,
      magicPower: 50,
      carryWeight: 150,
      hitRate: 95,
      expRate: 100,
      healthRegen: 4,
      manaRegen: 6,
      weight: 70,
      volume: 1
    };

    const mana: ManaComponent = {
      type: 'mana',
      current: 100,
      maximum: 100
    };

    const levelComponent: LevelComponent = {
      type: 'level',
      level: 1,
      experience: 0,
      experienceToNext: 100
    };

    const jobComponent: JobComponent = {
      type: 'job',
      currentJob: JobType.Warrior,
      availableJobs: [JobType.Warrior],
      jobExperience: new Map([[JobType.Warrior, 0]])
    };

    const characterInfo: CharacterInfoComponent = {
      type: 'characterInfo',
      title: 'Test',
      name: 'Character',
      isSpecial: false,
      rarity: RarityType.Common,
      status: CharacterStatus.Available
    };

    const skillComponent: SkillComponent = {
      type: 'skill',
      passiveSkills: [],
      activeSkills: [],
      jobSkills: [],
      badgeSkills: []
    };

    const currency: CurrencyComponent = {
      type: 'currency',
      amounts: {
        gold: 10000,
        crystal: 0,
        reputation: 0
      },
      transactionHistory: []
    };

    componentManager.addComponent(character, AttributeComponentType, attributeComponent);
    componentManager.addComponent(character, DerivedStatsComponentType, derivedStats);
    componentManager.addComponent(character, ManaComponentType, mana);
    componentManager.addComponent(character, LevelComponentType, levelComponent);
    componentManager.addComponent(character, JobComponentType, jobComponent);
    componentManager.addComponent(character, CharacterInfoComponentType, characterInfo);
    componentManager.addComponent(character, SkillComponentType, skillComponent);
    componentManager.addComponent(character, CurrencyComponentType, currency);

    return character;
  }

  it('should correctly load and apply aim_weakness skill from skills.json', () => {
    const characterId = createTestCharacter();
    
    // Find the skill in the loaded data
    const aimWeaknessSkill = skillsData.skills.find((s: any) => s.id === 'aim_weakness');
    expect(aimWeaknessSkill).toBeDefined();
    expect(aimWeaknessSkill.name).toBe('瞄准弱点');

    // Get initial crit rate
    const derivedStatsBefore = componentManager.getComponent(characterId, DerivedStatsComponentType);
    const initialCritRate = derivedStatsBefore!.critRate;

    // Learn the skill
    const result = skillSystem.learnSkill(characterId, 'aim_weakness', aimWeaknessSkill);
    expect(result.success).toBe(true);

    // Verify crit rate increased by 8%
    const derivedStatsAfter = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(derivedStatsAfter!.critRate).toBeCloseTo(initialCritRate + 0.08, 5);
  });

  it('should correctly load and apply extreme_cruelty skill from skills.json', () => {
    const characterId = createTestCharacter();
    
    // Find the skill in the loaded data
    const extremeCrueltySkill = skillsData.skills.find((s: any) => s.id === 'extreme_cruelty');
    expect(extremeCrueltySkill).toBeDefined();
    expect(extremeCrueltySkill.name).toBe('残忍至极');

    // Get initial crit damage
    const derivedStatsBefore = componentManager.getComponent(characterId, DerivedStatsComponentType);
    const initialCritDamage = derivedStatsBefore!.critDamage;

    // Learn the skill
    const result = skillSystem.learnSkill(characterId, 'extreme_cruelty', extremeCrueltySkill);
    expect(result.success).toBe(true);

    // Verify crit damage increased by 10%
    const derivedStatsAfter = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(derivedStatsAfter!.critDamage).toBeCloseTo(initialCritDamage + 0.1, 5);
  });

  it('should correctly load and apply arcane_supremacy skill from skills.json', () => {
    const characterId = createTestCharacter();
    
    // Find the skill in the loaded data
    const arcaneSupremacySkill = skillsData.skills.find((s: any) => s.id === 'arcane_supremacy');
    expect(arcaneSupremacySkill).toBeDefined();
    expect(arcaneSupremacySkill.name).toBe('奥术至尊');

    // Get initial magic power
    const derivedStatsBefore = componentManager.getComponent(characterId, DerivedStatsComponentType);
    const initialMagicPower = derivedStatsBefore!.magicPower;

    // Learn the skill
    const result = skillSystem.learnSkill(characterId, 'arcane_supremacy', arcaneSupremacySkill);
    expect(result.success).toBe(true);

    // Verify magic power increased by 8
    const derivedStatsAfter = componentManager.getComponent(characterId, DerivedStatsComponentType);
    expect(derivedStatsAfter!.magicPower).toBe(initialMagicPower + 8);
  });
});
