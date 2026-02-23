/**
 * Job System
 * Handles job changes, skill retention, and job-specific abilities
 * Implements requirements 9.1-9.5
 */

import { System } from '../../ecs/System';
import { ComponentType } from '../../ecs/Component';
import { EntityId } from '../../ecs/Entity';
import { 
  JobComponent, 
  JobComponentType,
  LevelComponent,
  LevelComponentType,
  AttributeComponent,
  AttributeComponentType,
  CharacterInfoComponent,
  CharacterInfoComponentType
} from '../components/CharacterComponents';
import { 
  SkillComponent,
  SkillComponentType,
  Skill,
  SkillRequirement
} from '../components/SystemComponents';
import { JobType, CharacterStatus } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

export interface JobRequirement {
  type: 'level' | 'attribute' | 'previousJob' | 'rarity';
  value: string | number;
  minimum: number;
}

export interface JobConfig {
  jobType: JobType;
  name: string;
  description: string;
  requirements: JobRequirement[];
  baseSkills: string[]; // Skill IDs that come with this job
  attributeBonus: Partial<AttributeComponent>;
  unlockLevel: number;
}

export interface JobChangeResult {
  success: boolean;
  previousJob: JobType;
  newJob: JobType;
  retainedSkills: Skill[];
  newSkills: Skill[];
  error?: string;
}

export class JobSystem extends System {
  public readonly name = 'JobSystem';
  public readonly requiredComponents: ComponentType<any>[] = [
    JobComponentType,
    SkillComponentType
  ];

  private jobConfigs: Record<JobType, JobConfig> = {
    [JobType.Warrior]: {
      jobType: JobType.Warrior,
      name: '战士',
      description: '近战物理职业，擅长使用武器和防御',
      requirements: [],
      baseSkills: ['sword_mastery', 'shield_bash'],
      attributeBonus: { strength: 2, defense: 1 },
      unlockLevel: 1
    },
    [JobType.Mage]: {
      jobType: JobType.Mage,
      name: '法师',
      description: '远程魔法职业，擅长元素魔法',
      requirements: [],
      baseSkills: ['fireball', 'magic_shield'],
      attributeBonus: { wisdom: 2, magicPower: 1 },
      unlockLevel: 1
    },
    [JobType.Archer]: {
      jobType: JobType.Archer,
      name: '弓箭手',
      description: '远程物理职业，擅长精准射击',
      requirements: [],
      baseSkills: ['precise_shot', 'quick_draw'],
      attributeBonus: { agility: 2, technique: 1 },
      unlockLevel: 1
    },
    [JobType.Healer]: {
      jobType: JobType.Healer,
      name: '治疗师',
      description: '支援职业，擅长治疗和辅助',
      requirements: [],
      baseSkills: ['heal', 'blessing'],
      attributeBonus: { wisdom: 1, manaRegen: 1 },
      unlockLevel: 1
    },
    [JobType.Rogue]: {
      jobType: JobType.Rogue,
      name: '盗贼',
      description: '敏捷职业，擅长偷袭和闪避',
      requirements: [
        { type: 'level', value: 10, minimum: 10 },
        { type: 'attribute', value: 'agility', minimum: 15 }
      ],
      baseSkills: ['stealth', 'backstab'],
      attributeBonus: { agility: 2, critRate: 5 },
      unlockLevel: 10
    },
    [JobType.Paladin]: {
      jobType: JobType.Paladin,
      name: '圣骑士',
      description: '神圣战士，兼具战斗和治疗能力',
      requirements: [
        { type: 'level', value: 15, minimum: 15 },
        { type: 'previousJob', value: JobType.Warrior, minimum: 1 },
        { type: 'previousJob', value: JobType.Healer, minimum: 1 }
      ],
      baseSkills: ['holy_strike', 'divine_protection'],
      attributeBonus: { strength: 1, wisdom: 1, resistance: 1 },
      unlockLevel: 15
    },
    [JobType.Berserker]: {
      jobType: JobType.Berserker,
      name: '狂战士',
      description: '狂暴战士，以生命换取强大攻击力',
      requirements: [
        { type: 'level', value: 20, minimum: 20 },
        { type: 'previousJob', value: JobType.Warrior, minimum: 1 },
        { type: 'attribute', value: 'strength', minimum: 25 }
      ],
      baseSkills: ['berserk', 'blood_frenzy'],
      attributeBonus: { strength: 3, attack: 2 },
      unlockLevel: 20
    },
    [JobType.Wizard]: {
      jobType: JobType.Wizard,
      name: '大法师',
      description: '高级法师，掌握强大的魔法',
      requirements: [
        { type: 'level', value: 25, minimum: 25 },
        { type: 'previousJob', value: JobType.Mage, minimum: 1 },
        { type: 'attribute', value: 'wisdom', minimum: 30 },
        { type: 'rarity', value: RarityType.Rare, minimum: RarityType.Rare }
      ],
      baseSkills: ['meteor', 'time_stop'],
      attributeBonus: { wisdom: 3, magicPower: 2 },
      unlockLevel: 25
    }
  };

  protected onInitialize(): void {
    // Listen for character creation to set initial job
    this.eventSystem.subscribe('character_created', this.handleCharacterCreated.bind(this));
    // Listen for level ups to check for new job unlocks
    this.eventSystem.subscribe('character_level_up', this.handleLevelUp.bind(this));
  }

  public update(deltaTime: number): void {
    // Job system doesn't need regular updates
    // All operations are event-driven
  }

  /**
   * Change a character's job
   * Requirement 9.1: Display available job options when conditions are met
   * Requirement 9.2: Update job and unlock new job skills
   * Requirement 9.4: Retain learned general skills
   */
  public changeJob(entityId: EntityId, newJob: JobType): JobChangeResult {
    const jobComponent = this.getComponent(entityId, JobComponentType);
    const skillComponent = this.getComponent(entityId, SkillComponentType);
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    
    if (!jobComponent || !skillComponent || !characterInfo) {
      return {
        success: false,
        previousJob: JobType.Warrior,
        newJob,
        retainedSkills: [],
        newSkills: [],
        error: 'Missing required components'
      };
    }

    // Check if character is available for job change
    if (characterInfo.status !== CharacterStatus.Available) {
      return {
        success: false,
        previousJob: jobComponent.currentJob,
        newJob,
        retainedSkills: [],
        newSkills: [],
        error: 'Character is not available for job change'
      };
    }

    // Check if job change is valid
    if (!this.canChangeJob(entityId, newJob)) {
      return {
        success: false,
        previousJob: jobComponent.currentJob,
        newJob,
        retainedSkills: [],
        newSkills: [],
        error: 'Job requirements not met'
      };
    }

    const previousJob = jobComponent.currentJob;
    
    // Add experience to previous job
    const currentExp = jobComponent.jobExperience.get(previousJob) || 0;
    jobComponent.jobExperience.set(previousJob, currentExp + 100); // Bonus exp for job change

    // Change to new job
    jobComponent.currentJob = newJob;
    if (!jobComponent.availableJobs.includes(newJob)) {
      jobComponent.availableJobs.push(newJob);
    }

    // Retain general skills (passive and active, but not job-specific)
    const retainedSkills = [
      ...skillComponent.passiveSkills,
      ...skillComponent.activeSkills
    ];

    // Remove old job skills
    skillComponent.jobSkills = [];

    // Add new job skills
    const newJobConfig = this.jobConfigs[newJob];
    const newSkills = this.createJobSkills(newJobConfig.baseSkills);
    skillComponent.jobSkills = newSkills;

    // Emit job change event
    this.eventSystem.emit({
      type: 'character_job_changed',
      timestamp: Date.now(),
      characterId: entityId,
      previousJob,
      newJob,
      retainedSkills: retainedSkills.length,
      newSkills: newSkills.length
    });

    return {
      success: true,
      previousJob,
      newJob,
      retainedSkills,
      newSkills
    };
  }

  /**
   * Check if a character can change to a specific job
   * Requirement 9.1: Verify job change conditions
   */
  public canChangeJob(entityId: EntityId, targetJob: JobType): boolean {
    const jobComponent = this.getComponent(entityId, JobComponentType);
    const levelComponent = this.getComponent(entityId, LevelComponentType);
    const attributeComponent = this.getComponent(entityId, AttributeComponentType);
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    
    if (!jobComponent || !levelComponent || !attributeComponent || !characterInfo) {
      return false;
    }

    // Can't change to current job
    if (jobComponent.currentJob === targetJob) {
      return false;
    }

    const jobConfig = this.jobConfigs[targetJob];
    
    // Check all requirements
    for (const requirement of jobConfig.requirements) {
      if (!this.checkRequirement(entityId, requirement)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get available jobs for a character
   * Requirement 9.1: Show available job options
   */
  public getAvailableJobs(entityId: EntityId): JobType[] {
    const availableJobs: JobType[] = [];
    
    for (const jobType of Object.values(JobType)) {
      if (this.canChangeJob(entityId, jobType)) {
        availableJobs.push(jobType);
      }
    }
    
    return availableJobs;
  }

  /**
   * Get job configuration
   */
  public getJobConfig(jobType: JobType): JobConfig {
    return this.jobConfigs[jobType];
  }

  /**
   * Get character's job experience
   */
  public getJobExperience(entityId: EntityId, jobType: JobType): number {
    const jobComponent = this.getComponent(entityId, JobComponentType);
    if (!jobComponent) return 0;
    
    return jobComponent.jobExperience.get(jobType) || 0;
  }

  /**
   * Add experience to a specific job
   */
  public addJobExperience(entityId: EntityId, jobType: JobType, experience: number): void {
    const jobComponent = this.getComponent(entityId, JobComponentType);
    if (!jobComponent) return;
    
    const currentExp = jobComponent.jobExperience.get(jobType) || 0;
    jobComponent.jobExperience.set(jobType, currentExp + experience);
    
    this.eventSystem.emit({
      type: 'job_experience_gained',
      timestamp: Date.now(),
      characterId: entityId,
      jobType,
      experience,
      totalExperience: currentExp + experience
    });
  }

  /**
   * Check if a requirement is met
   */
  private checkRequirement(entityId: EntityId, requirement: JobRequirement): boolean {
    const levelComponent = this.getComponent(entityId, LevelComponentType);
    const attributeComponent = this.getComponent(entityId, AttributeComponentType);
    const jobComponent = this.getComponent(entityId, JobComponentType);
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    
    switch (requirement.type) {
      case 'level':
        return levelComponent ? levelComponent.level >= requirement.minimum : false;
        
      case 'attribute':
        if (!attributeComponent) return false;
        const attrValue = (attributeComponent as any)[requirement.value as string];
        return attrValue >= requirement.minimum;
        
      case 'previousJob':
        if (!jobComponent) return false;
        const jobExp = jobComponent.jobExperience.get(requirement.value as JobType) || 0;
        return jobExp >= requirement.minimum;
        
      case 'rarity':
        if (!characterInfo) return false;
        return characterInfo.rarity >= (requirement.value as RarityType);
        
      default:
        return false;
    }
  }

  /**
   * Create job skills from skill IDs
   */
  private createJobSkills(skillIds: string[]): Skill[] {
    // This would normally load from configuration
    // For now, create basic skills
    return skillIds.map(skillId => ({
      id: skillId,
      name: this.getSkillName(skillId),
      description: `Job skill: ${skillId}`,
      level: 1,
      maxLevel: 5,
      type: 'job' as const,
      manaCost: 10,
      cooldown: 0,
      effects: [],
      requirements: []
    }));
  }

  /**
   * Get localized skill name
   */
  private getSkillName(skillId: string): string {
    const skillNames: Record<string, string> = {
      'sword_mastery': '剑术精通',
      'shield_bash': '盾击',
      'fireball': '火球术',
      'magic_shield': '魔法盾',
      'precise_shot': '精准射击',
      'quick_draw': '快速拔箭',
      'heal': '治疗术',
      'blessing': '祝福',
      'stealth': '潜行',
      'backstab': '背刺',
      'holy_strike': '神圣打击',
      'divine_protection': '神圣守护',
      'berserk': '狂暴',
      'blood_frenzy': '血之狂热',
      'meteor': '流星术',
      'time_stop': '时间停止'
    };
    
    return skillNames[skillId] || skillId;
  }

  /**
   * Handle character creation - set initial job
   */
  private handleCharacterCreated(event: { type: string; characterId: EntityId; rarity: RarityType }): void {
    const jobComponent = this.getComponent(event.characterId, JobComponentType);
    const skillComponent = this.getComponent(event.characterId, SkillComponentType);
    
    if (jobComponent && skillComponent) {
      // Set initial job skills
      const jobConfig = this.jobConfigs[jobComponent.currentJob];
      skillComponent.jobSkills = this.createJobSkills(jobConfig.baseSkills);
    }
  }

  /**
   * Handle level up - check for new job unlocks
   */
  private handleLevelUp(event: { type: string; characterId: EntityId; newLevel: number }): void {
    const availableJobs = this.getAvailableJobs(event.characterId);
    
    if (availableJobs.length > 0) {
      this.eventSystem.emit({
        type: 'new_jobs_available',
        timestamp: Date.now(),
        characterId: event.characterId,
        availableJobs
      });
    }
  }

  /**
   * Get all job skills for a character
   * Requirement 9.3: Manage job skill trees
   */
  public getJobSkills(entityId: EntityId): Skill[] {
    const skillComponent = this.getComponent(entityId, SkillComponentType);
    return skillComponent ? skillComponent.jobSkills : [];
  }

  /**
   * Upgrade a job skill
   * Requirement 9.5: Provide stronger abilities for higher level jobs
   */
  public upgradeJobSkill(entityId: EntityId, skillId: string): boolean {
    const skillComponent = this.getComponent(entityId, SkillComponentType);
    if (!skillComponent) return false;
    
    const skill = skillComponent.jobSkills.find(s => s.id === skillId);
    if (!skill || skill.level >= skill.maxLevel) return false;
    
    skill.level += 1;
    
    this.eventSystem.emit({
      type: 'job_skill_upgraded',
      timestamp: Date.now(),
      characterId: entityId,
      skillId,
      newLevel: skill.level
    });
    
    return true;
  }
}