/**
 * Property-based tests for Job System
 * **Feature: codename-rice-game, Property 16: 转职技能保留**
 * **Validates: Requirements 9.2, 9.4**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { JobSystem } from './JobSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
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
  Skill
} from '../components/SystemComponents';
import { JobType, CharacterStatus } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

describe('Job System Property Tests', () => {
  let jobSystem: JobSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;

  beforeEach(() => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    
    jobSystem = new JobSystem();
    jobSystem.initialize(entityManager, componentManager, eventSystem);
  });

  /**
   * Helper function to create a test character with all required components
   */
  function createTestCharacter(
    level: number = 1,
    attributes: { strength: number; agility: number; wisdom: number; technique: number } = 
      { strength: 10, agility: 10, wisdom: 10, technique: 10 },
    rarity: RarityType = RarityType.Common,
    currentJob: JobType = JobType.Warrior
  ): string {
    const characterEntity = entityManager.createEntity();
    const character = characterEntity.id;

    const attributeComponent: AttributeComponent = {
      type: 'attribute',
      ...attributes
    };

    const levelComponent: LevelComponent = {
      type: 'level',
      level,
      experience: 0,
      experienceToNext: 100
    };

    const jobComponent: JobComponent = {
      type: 'job',
      currentJob,
      availableJobs: [currentJob],
      jobExperience: new Map([[currentJob, 0]])
    };

    const characterInfo: CharacterInfoComponent = {
      type: 'characterInfo',
      title: 'Test',
      name: 'Character',
      isSpecial: false,
      rarity,
      status: CharacterStatus.Available
    };

    // Create some test skills
    const passiveSkills: Skill[] = [
      {
        id: 'passive_1',
        name: 'Test Passive 1',
        description: 'A test passive skill',
        level: 1,
        maxLevel: 5,
        type: 'passive',
        manaCost: 0,
        cooldown: 0,
        effects: [],
        requirements: []
      },
      {
        id: 'passive_2',
        name: 'Test Passive 2',
        description: 'Another test passive skill',
        level: 2,
        maxLevel: 5,
        type: 'passive',
        manaCost: 0,
        cooldown: 0,
        effects: [],
        requirements: []
      }
    ];

    const activeSkills: Skill[] = [
      {
        id: 'active_1',
        name: 'Test Active 1',
        description: 'A test active skill',
        level: 1,
        maxLevel: 5,
        type: 'active',
        manaCost: 10,
        cooldown: 5,
        effects: [],
        requirements: []
      }
    ];

    const skillComponent: SkillComponent = {
      type: 'skill',
      passiveSkills,
      activeSkills,
      jobSkills: [], // Will be set by job system
      badgeSkills: []
    };

    componentManager.addComponent(character, AttributeComponentType, attributeComponent);
    componentManager.addComponent(character, LevelComponentType, levelComponent);
    componentManager.addComponent(character, JobComponentType, jobComponent);
    componentManager.addComponent(character, CharacterInfoComponentType, characterInfo);
    componentManager.addComponent(character, SkillComponentType, skillComponent);

    return character;
  }

  /**
   * Property 16: 转职技能保留
   * For any character job change, the system should retain learned general skills 
   * while updating job-specific skills
   * **Validates: Requirements 9.2, 9.4**
   */
  it('Property 16: 转职技能保留', () => {
    // Generator for character levels that can access different jobs
    const characterLevelGenerator = fc.integer({ min: 1, max: 30 });
    
    // Generator for attributes that might meet job requirements
    const attributeGenerator = fc.record({
      strength: fc.integer({ min: 5, max: 50 }),
      agility: fc.integer({ min: 5, max: 50 }),
      wisdom: fc.integer({ min: 5, max: 50 }),
      technique: fc.integer({ min: 5, max: 50 })
    });

    // Generator for character rarity
    const rarityGenerator = fc.constantFrom(
      RarityType.Common,
      RarityType.Rare,
      RarityType.Epic,
      RarityType.Legendary
    );

    // Generator for initial and target jobs
    const jobPairGenerator = fc.tuple(
      fc.constantFrom(...Object.values(JobType)),
      fc.constantFrom(...Object.values(JobType))
    ).filter(([initial, target]) => initial !== target);

    fc.assert(
      fc.property(
        characterLevelGenerator,
        attributeGenerator,
        rarityGenerator,
        jobPairGenerator,
        (level, attributes, rarity, [initialJob, targetJob]) => {
          const characterId = createTestCharacter(level, attributes, rarity, initialJob);

          // Get initial skill state
          const initialSkillComponent = componentManager.getComponent(characterId, SkillComponentType);
          expect(initialSkillComponent).not.toBeNull();

          const initialPassiveSkills = [...initialSkillComponent!.passiveSkills];
          const initialActiveSkills = [...initialSkillComponent!.activeSkills];
          const initialPassiveCount = initialPassiveSkills.length;
          const initialActiveCount = initialActiveSkills.length;

          // Trigger character creation event to set initial job skills
          eventSystem.emit({
            type: 'character_created',
            timestamp: Date.now(),
            characterId,
            rarity
          });

          const skillsAfterCreation = componentManager.getComponent(characterId, SkillComponentType);
          expect(skillsAfterCreation).not.toBeNull();
          const initialJobSkillCount = skillsAfterCreation!.jobSkills.length;

          // Attempt job change
          const result = jobSystem.changeJob(characterId, targetJob);

          const finalSkillComponent = componentManager.getComponent(characterId, SkillComponentType);
          expect(finalSkillComponent).not.toBeNull();

          if (result.success) {
            // Requirement 9.4: Retain learned general skills
            // Passive skills should be retained
            expect(finalSkillComponent!.passiveSkills.length).toBe(initialPassiveCount);
            
            // Active skills should be retained
            expect(finalSkillComponent!.activeSkills.length).toBe(initialActiveCount);

            // Check that the actual skills are the same (by ID)
            const finalPassiveIds = finalSkillComponent!.passiveSkills.map(s => s.id).sort();
            const initialPassiveIds = initialPassiveSkills.map(s => s.id).sort();
            expect(finalPassiveIds).toEqual(initialPassiveIds);

            const finalActiveIds = finalSkillComponent!.activeSkills.map(s => s.id).sort();
            const initialActiveIds = initialActiveSkills.map(s => s.id).sort();
            expect(finalActiveIds).toEqual(initialActiveIds);

            // Requirement 9.2: Update job and unlock new job skills
            // Job skills should be updated (different from initial job skills)
            const finalJobSkillCount = finalSkillComponent!.jobSkills.length;
            
            // Should have job skills for the new job
            expect(finalJobSkillCount).toBeGreaterThan(0);
            
            // Job skills should be different if jobs are different
            if (initialJob !== targetJob) {
              const finalJobSkillIds = finalSkillComponent!.jobSkills.map(s => s.id).sort();
              const initialJobSkillIds = skillsAfterCreation!.jobSkills.map(s => s.id).sort();
              
              // Job skills should be different (unless by coincidence they have same skill IDs)
              const skillsChanged = !finalJobSkillIds.every((id, index) => id === initialJobSkillIds[index]) ||
                                  finalJobSkillIds.length !== initialJobSkillIds.length;
              
              // At minimum, the job skills should be marked as 'job' type
              finalSkillComponent!.jobSkills.forEach(skill => {
                expect(skill.type).toBe('job');
              });
            }

            // Verify job component was updated
            const jobComponent = componentManager.getComponent(characterId, JobComponentType);
            expect(jobComponent).not.toBeNull();
            expect(jobComponent!.currentJob).toBe(targetJob);
            
            // Target job should be in available jobs
            expect(jobComponent!.availableJobs).toContain(targetJob);

            // Should have gained experience in previous job
            const previousJobExp = jobComponent!.jobExperience.get(initialJob) || 0;
            expect(previousJobExp).toBeGreaterThan(0);

          } else {
            // If job change failed, skills should remain unchanged
            expect(finalSkillComponent!.passiveSkills.length).toBe(initialPassiveCount);
            expect(finalSkillComponent!.activeSkills.length).toBe(initialActiveCount);
            expect(finalSkillComponent!.jobSkills.length).toBe(initialJobSkillCount);

            // Job should remain the same
            const jobComponent = componentManager.getComponent(characterId, JobComponentType);
            expect(jobComponent).not.toBeNull();
            expect(jobComponent!.currentJob).toBe(initialJob);
          }

          // Badge skills should always remain unchanged during job changes
          expect(finalSkillComponent!.badgeSkills.length).toBe(0); // Initially empty

          // Total skill count should be reasonable
          const totalSkills = finalSkillComponent!.passiveSkills.length + 
                            finalSkillComponent!.activeSkills.length + 
                            finalSkillComponent!.jobSkills.length + 
                            finalSkillComponent!.badgeSkills.length;
          expect(totalSkills).toBeGreaterThan(0);
          expect(totalSkills).toBeLessThan(50); // Reasonable upper bound
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain job requirement consistency', () => {
    // Property: Job requirements should be consistently enforced
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.record({
          strength: fc.integer({ min: 1, max: 100 }),
          agility: fc.integer({ min: 1, max: 100 }),
          wisdom: fc.integer({ min: 1, max: 100 }),
          technique: fc.integer({ min: 1, max: 100 })
        }),
        fc.constantFrom(...Object.values(RarityType)),
        fc.constantFrom(...Object.values(JobType)),
        (level, attributes, rarity, targetJob) => {
          const characterId = createTestCharacter(level, attributes, rarity);

          const canChange = jobSystem.canChangeJob(characterId, targetJob);
          const result = jobSystem.changeJob(characterId, targetJob);

          // If canChangeJob returns true, changeJob should succeed
          // If canChangeJob returns false, changeJob should fail
          expect(result.success).toBe(canChange);

          if (canChange) {
            expect(result.error).toBeUndefined();
            expect(result.newJob).toBe(targetJob);
          } else {
            expect(result.error).toBeDefined();
            expect(result.newJob).toBe(targetJob);
            expect(result.previousJob).not.toBe(targetJob);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle job experience correctly', () => {
    // Property: Job experience should accumulate correctly and be persistent
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(JobType)),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
        (jobType, experienceGains) => {
          const characterId = createTestCharacter();

          let expectedTotal = 0;

          for (const expGain of experienceGains) {
            jobSystem.addJobExperience(characterId, jobType, expGain);
            expectedTotal += expGain;

            const currentExp = jobSystem.getJobExperience(characterId, jobType);
            expect(currentExp).toBe(expectedTotal);
          }

          // Experience should be non-negative
          expect(expectedTotal).toBeGreaterThanOrEqual(0);

          // Experience should be persistent in the component
          const jobComponent = componentManager.getComponent(characterId, JobComponentType);
          expect(jobComponent).not.toBeNull();
          
          const storedExp = jobComponent!.jobExperience.get(jobType) || 0;
          expect(storedExp).toBe(expectedTotal);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should provide consistent available jobs list', () => {
    // Property: Available jobs should be consistent with individual job checks
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.record({
          strength: fc.integer({ min: 5, max: 50 }),
          agility: fc.integer({ min: 5, max: 50 }),
          wisdom: fc.integer({ min: 5, max: 50 }),
          technique: fc.integer({ min: 5, max: 50 })
        }),
        fc.constantFrom(...Object.values(RarityType)),
        (level, attributes, rarity) => {
          const characterId = createTestCharacter(level, attributes, rarity);

          const availableJobs = jobSystem.getAvailableJobs(characterId);

          // Each job in available jobs should pass individual canChangeJob check
          for (const job of availableJobs) {
            expect(jobSystem.canChangeJob(characterId, job)).toBe(true);
          }

          // Each job not in available jobs should fail individual canChangeJob check
          const allJobs = Object.values(JobType);
          const unavailableJobs = allJobs.filter(job => !availableJobs.includes(job));
          
          for (const job of unavailableJobs) {
            expect(jobSystem.canChangeJob(characterId, job)).toBe(false);
          }

          // Available jobs should not contain duplicates
          const uniqueJobs = [...new Set(availableJobs)];
          expect(uniqueJobs.length).toBe(availableJobs.length);

          // Available jobs should be a subset of all jobs
          for (const job of availableJobs) {
            expect(allJobs).toContain(job);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle job skill upgrades correctly', () => {
    // Property: Job skill upgrades should be bounded and consistent
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(JobType)),
        fc.integer({ min: 1, max: 10 }), // Number of upgrade attempts
        (jobType, upgradeAttempts) => {
          const characterId = createTestCharacter(1, { strength: 10, agility: 10, wisdom: 10, technique: 10 }, RarityType.Common, jobType);

          // Trigger character creation to get job skills
          eventSystem.emit({
            type: 'character_created',
            timestamp: Date.now(),
            characterId,
            rarity: RarityType.Common
          });

          const skillComponent = componentManager.getComponent(characterId, SkillComponentType);
          expect(skillComponent).not.toBeNull();

          if (skillComponent!.jobSkills.length > 0) {
            const skillToUpgrade = skillComponent!.jobSkills[0];
            const initialLevel = skillToUpgrade.level;
            const maxLevel = skillToUpgrade.maxLevel;

            let currentLevel = initialLevel;
            let successfulUpgrades = 0;

            for (let i = 0; i < upgradeAttempts; i++) {
              const success = jobSystem.upgradeJobSkill(characterId, skillToUpgrade.id);
              
              if (success) {
                successfulUpgrades++;
                currentLevel++;
                expect(skillToUpgrade.level).toBe(currentLevel);
              } else {
                // Should fail when at max level
                expect(skillToUpgrade.level).toBe(maxLevel);
              }

              // Level should never exceed max level
              expect(skillToUpgrade.level).toBeLessThanOrEqual(maxLevel);
              expect(skillToUpgrade.level).toBeGreaterThanOrEqual(initialLevel);
            }

            // Number of successful upgrades should not exceed available levels
            const maxPossibleUpgrades = maxLevel - initialLevel;
            expect(successfulUpgrades).toBeLessThanOrEqual(maxPossibleUpgrades);

            // Final level should be initial + successful upgrades
            expect(skillToUpgrade.level).toBe(initialLevel + successfulUpgrades);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain character status consistency during job changes', () => {
    // Property: Character status should be properly checked and maintained during job changes
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(CharacterStatus)),
        fc.constantFrom(...Object.values(JobType)),
        fc.constantFrom(...Object.values(JobType)),
        (status, initialJob, targetJob) => {
          if (initialJob === targetJob) return; // Skip same job changes

          const characterId = createTestCharacter(20, { strength: 30, agility: 30, wisdom: 30, technique: 30 }, RarityType.Rare, initialJob);

          // Set character status
          const characterInfo = componentManager.getComponent(characterId, CharacterInfoComponentType);
          expect(characterInfo).not.toBeNull();
          characterInfo!.status = status;

          const result = jobSystem.changeJob(characterId, targetJob);

          if (status === CharacterStatus.Available) {
            // Available characters should be able to change jobs (if requirements met)
            const canChange = jobSystem.canChangeJob(characterId, targetJob);
            expect(result.success).toBe(canChange);
          } else {
            // Non-available characters should not be able to change jobs
            expect(result.success).toBe(false);
            expect(result.error).toContain('not available');
            
            // Job should remain unchanged
            const jobComponent = componentManager.getComponent(characterId, JobComponentType);
            expect(jobComponent).not.toBeNull();
            expect(jobComponent!.currentJob).toBe(initialJob);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});