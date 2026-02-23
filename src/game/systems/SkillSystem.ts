/**
 * Skill System
 * Handles skill learning, usage, passive/active skill logic, and skill upgrades
 * Implements requirements 8.1-8.5
 */

import { System } from '../../ecs/System';
import { ComponentType } from '../../ecs/Component';
import { EntityId } from '../../ecs/Entity';
import { 
  SkillComponent, 
  SkillComponentType,
  Skill,
  SkillRequirement,
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
  HealthComponent,
  HealthComponentType,
  LevelComponent,
  LevelComponentType,
  JobComponent,
  JobComponentType
} from '../components/CharacterComponents';
import { TimeCondition } from '../components/ItemComponents';
import { SkillType, JobType, CharacterStatus } from '../types/GameTypes';

export interface SkillLearnResult {
  success: boolean;
  skill?: Skill;
  error?: string;
}

export interface SkillUseResult {
  success: boolean;
  effects?: SkillEffect[];
  error?: string;
}

export interface SkillUpgradeResult {
  success: boolean;
  newLevel?: number;
  error?: string;
}

export interface SkillEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'restore' | 'attribute_bonus' | 'conditional_bonus' | 'percentage_modifier';
  target: EntityId;
  attribute?: string;
  value: number;
  duration?: number;
  condition?: TimeCondition;
}

export interface SkillCooldown {
  skillId: string;
  remainingTime: number;
}

export class SkillSystem extends System {
  public readonly name = 'SkillSystem';
  public readonly requiredComponents: ComponentType<any>[] = [
    SkillComponentType
  ];

  private skillCooldowns: Map<EntityId, SkillCooldown[]> = new Map();
  private activeBuffs: Map<EntityId, ActiveBuff[]> = new Map();
  private conditionalBonuses: Map<EntityId, ConditionalBonus[]> = new Map();
  private currentTimeOfDay: 'day' | 'night' = 'day';

  protected onInitialize(): void {
    // Listen for skill-related events
    this.eventSystem.subscribe('skill_learned', this.handleSkillLearned.bind(this));
    this.eventSystem.subscribe('skill_used', this.handleSkillUsed.bind(this));
    this.eventSystem.subscribe('level_up', this.handleLevelUp.bind(this));
    this.eventSystem.subscribe('job_changed', this.handleJobChanged.bind(this));
    // Listen for time changes to update conditional passive skills
    this.eventSystem.subscribe('time_of_day_changed', this.handleTimeOfDayChanged.bind(this));
  }

  public update(deltaTime: number): void {
    // Update skill cooldowns
    this.updateCooldowns(deltaTime);
    
    // Update active buffs/debuffs
    this.updateActiveBuffs(deltaTime);
  }

  /**
   * Learn a new skill
   * Requirement 8.1: Verify learning conditions and consume resources
   */
  public learnSkill(entityId: EntityId, skillId: string, skillData: Partial<Skill>): SkillLearnResult {
    const skillComponent = this.getComponent(entityId, SkillComponentType);
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    const currency = this.getComponent(entityId, CurrencyComponentType);
    
    if (!skillComponent || !characterInfo || !currency) {
      return { success: false, error: 'Missing required components' };
    }

    // Check if character is available
    if (characterInfo.status !== CharacterStatus.Available) {
      return { success: false, error: 'Character is not available' };
    }

    // Check if skill is already learned
    const allSkills = [
      ...skillComponent.passiveSkills,
      ...skillComponent.activeSkills,
      ...skillComponent.jobSkills,
      ...skillComponent.badgeSkills
    ];
    
    if (allSkills.some(skill => skill.id === skillId)) {
      return { success: false, error: 'Skill is already learned' };
    }

    // Create the skill with default values
    const skill: Skill = {
      id: skillId,
      name: skillData.name || `Skill ${skillId}`,
      description: skillData.description || '',
      level: 1,
      maxLevel: skillData.maxLevel || 5,
      type: skillData.type || SkillType.Active,
      manaCost: skillData.manaCost || 10,
      cooldown: skillData.cooldown || 0,
      effects: skillData.effects || [],
      requirements: skillData.requirements || []
    };

    // Check learning requirements
    const requirementsMet = this.checkSkillRequirements(entityId, skill.requirements);
    if (!requirementsMet) {
      return { success: false, error: 'Requirements not met' };
    }

    // Calculate learning cost (simplified - could be more complex)
    const learningCost = this.calculateLearningCost(skill);
    
    // Check if player has enough currency
    if (currency.amounts.gold < learningCost) {
      return { success: false, error: `Insufficient gold. Need ${learningCost}, have ${currency.amounts.gold}` };
    }

    // Consume currency
    currency.amounts.gold -= learningCost;

    // Add skill to appropriate category
    switch (skill.type) {
      case SkillType.Passive:
        skillComponent.passiveSkills.push(skill);
        // Apply passive skill effects immediately
        this.applyPassiveSkillEffectOnce(entityId, skill);
        break;
      case SkillType.Active:
        skillComponent.activeSkills.push(skill);
        break;
      case SkillType.Job:
        skillComponent.jobSkills.push(skill);
        break;
      case SkillType.Badge:
        skillComponent.badgeSkills.push(skill);
        break;
    }

    // Record currency transaction
    currency.transactionHistory.push({
      type: 'spend',
      currency: 'gold',
      amount: learningCost,
      reason: `Learned skill: ${skill.name}`,
      timestamp: Date.now()
    });

    // Emit skill learned event
    this.eventSystem.emit({
      type: 'skill_learned',
      timestamp: Date.now(),
      characterId: entityId,
      skillId: skill.id,
      skillType: skill.type,
      cost: learningCost
    });

    return { success: true, skill };
  }

  /**
   * Use an active skill
   * Requirement 8.3: Consume mana and execute skill effects
   */
  public useSkill(entityId: EntityId, skillId: string, targetId?: EntityId): SkillUseResult {
    const skillComponent = this.getComponent(entityId, SkillComponentType);
    const mana = this.getComponent(entityId, ManaComponentType);
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    
    if (!skillComponent || !mana || !characterInfo) {
      return { success: false, error: 'Missing required components' };
    }

    // Check if character is available
    if (characterInfo.status !== CharacterStatus.Available) {
      return { success: false, error: 'Character is not available' };
    }

    // Find the skill
    const skill = skillComponent.activeSkills.find(s => s.id === skillId) ||
                  skillComponent.jobSkills.find(s => s.id === skillId) ||
                  skillComponent.badgeSkills.find(s => s.id === skillId);

    if (!skill) {
      return { success: false, error: 'Skill not found' };
    }

    // Check if skill is on cooldown
    if (this.isSkillOnCooldown(entityId, skillId)) {
      return { success: false, error: 'Skill is on cooldown' };
    }

    // Check mana cost
    if (mana.current < skill.manaCost) {
      return { success: false, error: `Insufficient mana. Need ${skill.manaCost}, have ${mana.current}` };
    }

    // Consume mana
    mana.current -= skill.manaCost;

    // Apply skill effects
    const effects = this.applySkillEffects(entityId, skill, targetId);

    // Start cooldown
    if (skill.cooldown > 0) {
      this.startCooldown(entityId, skillId, skill.cooldown);
    }

    // Emit skill used event
    this.eventSystem.emit({
      type: 'skill_used',
      timestamp: Date.now(),
      characterId: entityId,
      skillId: skill.id,
      targetId,
      manaCost: skill.manaCost,
      effects: effects.length
    });

    return { success: true, effects };
  }

  /**
   * Upgrade a skill to the next level
   * Requirement 8.5: Increase skill effects and reduce costs
   */
  public upgradeSkill(entityId: EntityId, skillId: string): SkillUpgradeResult {
    const skillComponent = this.getComponent(entityId, SkillComponentType);
    const currency = this.getComponent(entityId, CurrencyComponentType);
    
    if (!skillComponent || !currency) {
      return { success: false, error: 'Missing required components' };
    }

    // Find the skill in all categories
    let skill: Skill | undefined;
    let skillArray: Skill[] | undefined;

    if (skillComponent.passiveSkills.some(s => s.id === skillId)) {
      skillArray = skillComponent.passiveSkills;
      skill = skillArray.find(s => s.id === skillId);
    } else if (skillComponent.activeSkills.some(s => s.id === skillId)) {
      skillArray = skillComponent.activeSkills;
      skill = skillArray.find(s => s.id === skillId);
    } else if (skillComponent.jobSkills.some(s => s.id === skillId)) {
      skillArray = skillComponent.jobSkills;
      skill = skillArray.find(s => s.id === skillId);
    }

    if (!skill || !skillArray) {
      return { success: false, error: 'Skill not found or cannot be upgraded' };
    }

    // Check if skill is at max level
    if (skill.level >= skill.maxLevel) {
      return { success: false, error: 'Skill is already at maximum level' };
    }

    // Calculate upgrade cost
    const upgradeCost = this.calculateUpgradeCost(skill);
    
    // Check if player has enough currency
    if (currency.amounts.gold < upgradeCost) {
      return { success: false, error: `Insufficient gold. Need ${upgradeCost}, have ${currency.amounts.gold}` };
    }

    // Consume currency
    currency.amounts.gold -= upgradeCost;

    // Upgrade the skill
    const oldLevel = skill.level;
    skill.level += 1;

    // Enhance skill effects based on new level
    this.enhanceSkillEffects(skill);

    // Record currency transaction
    currency.transactionHistory.push({
      type: 'spend',
      currency: 'gold',
      amount: upgradeCost,
      reason: `Upgraded skill: ${skill.name} to level ${skill.level}`,
      timestamp: Date.now()
    });

    // Emit skill upgraded event
    this.eventSystem.emit({
      type: 'skill_upgraded',
      timestamp: Date.now(),
      characterId: entityId,
      skillId: skill.id,
      oldLevel,
      newLevel: skill.level,
      cost: upgradeCost
    });

    return { success: true, newLevel: skill.level };
  }

  /**
   * Check if a skill's requirements are met
   */
  private checkSkillRequirements(entityId: EntityId, requirements: SkillRequirement[]): boolean {
    for (const requirement of requirements) {
      if (!this.checkSingleRequirement(entityId, requirement)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check a single skill requirement
   */
  private checkSingleRequirement(entityId: EntityId, requirement: SkillRequirement): boolean {
    switch (requirement.type) {
      case 'level': {
        const levelComponent = this.getComponent(entityId, LevelComponentType);
        return levelComponent !== null && levelComponent.level >= requirement.minimum;
      }
      case 'attribute': {
        const attributes = this.getComponent(entityId, AttributeComponentType);
        if (!attributes) return false;
        const attributeValue = (attributes as any)[requirement.value as string];
        return attributeValue >= requirement.minimum;
      }
      case 'job': {
        const jobComponent = this.getComponent(entityId, JobComponentType);
        return jobComponent !== null && jobComponent.currentJob === requirement.value;
      }
      // Add more requirement types as needed
      default:
        return false;
    }
  }

  /**
   * Calculate the cost to learn a skill
   */
  private calculateLearningCost(skill: Skill): number {
    // Base cost varies by skill type
    let baseCost = 100;
    
    switch (skill.type) {
      case SkillType.Passive:
        baseCost = 150;
        break;
      case SkillType.Active:
        baseCost = 200;
        break;
      case SkillType.Job:
        baseCost = 300;
        break;
      case SkillType.Badge:
        baseCost = 100; // Badge skills are cheaper as they require badges
        break;
    }

    // Adjust cost based on skill power (mana cost as proxy)
    const powerMultiplier = 1 + (skill.manaCost / 100);
    
    return Math.floor(baseCost * powerMultiplier);
  }

  /**
   * Calculate the cost to upgrade a skill
   */
  private calculateUpgradeCost(skill: Skill): number {
    // Cost increases exponentially with level
    const baseCost = this.calculateLearningCost(skill);
    const levelMultiplier = Math.pow(1.5, skill.level);
    
    return Math.floor(baseCost * 0.5 * levelMultiplier);
  }

  /**
   * Apply skill effects to targets
   */
  private applySkillEffects(entityId: EntityId, skill: Skill, targetId?: EntityId): SkillEffect[] {
    const effects: SkillEffect[] = [];
    const actualTarget = targetId || entityId; // Default to self if no target

    for (const effect of skill.effects) {
      const skillEffect = this.applySkillEffect(entityId, actualTarget, effect, skill.level);
      if (skillEffect) {
        effects.push(skillEffect);
      }
    }

    return effects;
  }

  /**
   * Apply a single skill effect
   */
  private applySkillEffect(casterId: EntityId, targetId: EntityId, effect: any, skillLevel: number): SkillEffect | null {
    const levelMultiplier = 1 + (skillLevel - 1) * 0.2; // 20% increase per level
    const effectValue = Math.floor(effect.value * levelMultiplier);

    switch (effect.type) {
      case 'heal': {
        const health = this.getComponent(targetId, HealthComponentType);
        if (health) {
          const healAmount = Math.min(effectValue, health.maximum - health.current);
          health.current += healAmount;
          return {
            type: 'heal',
            target: targetId,
            attribute: 'health',
            value: healAmount
          };
        }
        break;
      }
      case 'restore': {
        if (effect.attribute === 'mana') {
          const mana = this.getComponent(targetId, ManaComponentType);
          if (mana) {
            const restoreAmount = Math.min(effectValue, mana.maximum - mana.current);
            mana.current += restoreAmount;
            return {
              type: 'restore',
              target: targetId,
              attribute: 'mana',
              value: restoreAmount
            };
          }
        }
        break;
      }
      case 'buff': {
        this.applyBuff(targetId, effect.attribute, effectValue, effect.duration || 30);
        return {
          type: 'buff',
          target: targetId,
          attribute: effect.attribute,
          value: effectValue,
          duration: effect.duration || 30
        };
      }
      case 'damage': {
        // This would typically interact with a combat system
        return {
          type: 'damage',
          target: targetId,
          value: effectValue
        };
      }
    }

    return null;
  }

  /**
   * Apply a temporary buff to a character
   */
  private applyBuff(targetId: EntityId, attribute: string, value: number, duration: number): void {
    if (!this.activeBuffs.has(targetId)) {
      this.activeBuffs.set(targetId, []);
    }

    const buffs = this.activeBuffs.get(targetId)!;
    
    // Check if buff already exists and refresh it
    const existingBuff = buffs.find(b => b.attribute === attribute);
    if (existingBuff) {
      existingBuff.value = Math.max(existingBuff.value, value); // Take stronger buff
      existingBuff.remainingTime = Math.max(existingBuff.remainingTime, duration);
    } else {
      buffs.push({
        attribute,
        value,
        remainingTime: duration,
        applied: false
      });
    }
  }

  /**
   * Enhance skill effects when leveling up
   * Requirement 8.5: Skill upgrades increase effects and reduce costs
   */
  private enhanceSkillEffects(skill: Skill): void {
    // Reduce mana cost by 5% per level (minimum 1)
    const costReduction = Math.floor(skill.manaCost * 0.05);
    skill.manaCost = Math.max(1, skill.manaCost - costReduction);

    // Reduce cooldown by 10% per level (minimum 0)
    if (skill.cooldown > 0) {
      const cooldownReduction = Math.floor(skill.cooldown * 0.1);
      skill.cooldown = Math.max(0, skill.cooldown - cooldownReduction);
    }

    // Effects are enhanced through the level multiplier in applySkillEffect
    // No need to modify the base effect values here
  }

  /**
   * Check if a skill is on cooldown
   */
  private isSkillOnCooldown(entityId: EntityId, skillId: string): boolean {
    const cooldowns = this.skillCooldowns.get(entityId);
    if (!cooldowns) return false;

    return cooldowns.some(cd => cd.skillId === skillId && cd.remainingTime > 0);
  }

  /**
   * Start a skill cooldown
   */
  private startCooldown(entityId: EntityId, skillId: string, duration: number): void {
    if (!this.skillCooldowns.has(entityId)) {
      this.skillCooldowns.set(entityId, []);
    }

    const cooldowns = this.skillCooldowns.get(entityId)!;
    
    // Remove existing cooldown for this skill
    const existingIndex = cooldowns.findIndex(cd => cd.skillId === skillId);
    if (existingIndex !== -1) {
      cooldowns.splice(existingIndex, 1);
    }

    // Add new cooldown
    cooldowns.push({
      skillId,
      remainingTime: duration
    });
  }

  /**
   * Update skill cooldowns
   */
  private updateCooldowns(deltaTime: number): void {
    for (const [entityId, cooldowns] of this.skillCooldowns.entries()) {
      for (let i = cooldowns.length - 1; i >= 0; i--) {
        const cooldown = cooldowns[i];
        if (!cooldown) continue;
        
        cooldown.remainingTime -= deltaTime;
        
        // Remove expired cooldowns
        if (cooldown.remainingTime <= 0) {
          cooldowns.splice(i, 1);
        }
      }
    }
  }

  /**
   * Update active buffs/debuffs
   */
  private updateActiveBuffs(deltaTime: number): void {
    for (const [entityId, buffs] of this.activeBuffs.entries()) {
      for (let i = buffs.length - 1; i >= 0; i--) {
        const buff = buffs[i];
        if (!buff) continue;
        
        // Apply buff if not already applied
        if (!buff.applied) {
          this.applyBuffToAttributes(entityId, buff.attribute, buff.value);
          buff.applied = true;
        }
        
        buff.remainingTime -= deltaTime;
        
        // Remove expired buffs
        if (buff.remainingTime <= 0) {
          this.removeBuffFromAttributes(entityId, buff.attribute, buff.value);
          buffs.splice(i, 1);
        }
      }
    }
  }

  /**
   * Apply passive skills continuously
   */
  private applyPassiveSkills(): void {
    const entities = this.getEntities();
    
    for (const entityId of entities) {
      const skillComponent = this.getComponent(entityId, SkillComponentType);
      if (!skillComponent) continue;

      // Apply passive skill effects
      for (const skill of skillComponent.passiveSkills) {
        this.applyPassiveSkillEffect(entityId, skill);
      }
    }
  }

  /**
   * Apply a passive skill effect once when learned
   */
  private applyPassiveSkillEffectOnce(entityId: EntityId, skill: Skill): void {
      for (const effect of skill.effects) {
        // Support both 'buff' and 'attribute_bonus' effect types for passive skills
        if ((effect.type === 'buff' || effect.type === 'attribute_bonus') && effect.target === 'self') {
          // Apply permanent attribute bonus
          const levelMultiplier = 1 + (skill.level - 1) * 0.1;
          const effectValue = effect.value * levelMultiplier;

          // Apply the attribute bonus directly
          this.applyBuffToAttributes(entityId, effect.attribute, effectValue);

          // Emit event for tracking
          this.eventSystem.emit({
            type: 'passive_skill_applied',
            timestamp: Date.now(),
            characterId: entityId,
            skillId: skill.id,
            attribute: effect.attribute,
            value: effectValue
          });
        }
        // Support conditional_bonus effect type for time-dependent passive skills
        else if (effect.type === 'conditional_bonus' && effect.target === 'self' && effect.condition) {
          // Register the conditional bonus for tracking
          if (!this.conditionalBonuses.has(entityId)) {
            this.conditionalBonuses.set(entityId, []);
          }

          const bonuses = this.conditionalBonuses.get(entityId)!;
          const levelMultiplier = 1 + (skill.level - 1) * 0.1;
          const effectValue = effect.value * levelMultiplier;

          bonuses.push({
            skillId: skill.id,
            attribute: effect.attribute,
            value: effectValue,
            condition: effect.condition,
            isActive: false
          });

          // Check if condition is currently met and apply if so
          this.updateConditionalPassiveSkills(this.currentTimeOfDay);
        }
        // Support percentage_modifier effect type for passive skills
        else if (effect.type === 'percentage_modifier' && effect.target === 'self') {
          // Apply percentage-based attribute modifier
          const levelMultiplier = 1 + (skill.level - 1) * 0.1;
          const percentageValue = effect.value * levelMultiplier;

          // Special handling for satietyConsumptionRate - apply value directly
          if (effect.attribute === 'satietyConsumptionRate') {
            this.applyBuffToAttributes(entityId, effect.attribute, percentageValue);

            // Emit event for tracking
            this.eventSystem.emit({
              type: 'passive_skill_applied',
              timestamp: Date.now(),
              characterId: entityId,
              skillId: skill.id,
              attribute: effect.attribute,
              value: percentageValue,
              isPercentage: true,
              percentageValue: percentageValue
            });
          } else {
            // Get current attribute value for percentage calculation
            const attributes = this.getComponent(entityId, AttributeComponentType);
            const derivedStats = this.getComponent(entityId, DerivedStatsComponentType);

            let currentValue = 0;
            if (attributes && effect.attribute in attributes) {
              currentValue = (attributes as any)[effect.attribute];
            } else if (derivedStats && effect.attribute in derivedStats) {
              currentValue = (derivedStats as any)[effect.attribute];
            }

            // Calculate the absolute change based on percentage
            const absoluteChange = currentValue * percentageValue;

            // Apply the change
            this.applyBuffToAttributes(entityId, effect.attribute, absoluteChange);

            // Emit event for tracking
            this.eventSystem.emit({
              type: 'passive_skill_applied',
              timestamp: Date.now(),
              characterId: entityId,
              skillId: skill.id,
              attribute: effect.attribute,
              value: absoluteChange,
              isPercentage: true,
              percentageValue: percentageValue
            });
          }
        }
      }
    }


  /**
   * Apply a passive skill effect
   */
  private applyPassiveSkillEffect(entityId: EntityId, skill: Skill): void {
    // Passive skills provide continuous benefits
    // This is a simplified implementation - in practice, you'd want more sophisticated passive effect handling
    
    for (const effect of skill.effects) {
      // Support both 'buff' and 'attribute_bonus' effect types for passive skills
      if ((effect.type === 'buff' || effect.type === 'attribute_bonus') && effect.target === 'self') {
        // Apply permanent attribute bonus
        const levelMultiplier = 1 + (skill.level - 1) * 0.1;
        const effectValue = effect.value * levelMultiplier;
        
        // Apply the attribute bonus directly
        this.applyBuffToAttributes(entityId, effect.attribute, effectValue);
        
        // Emit event for tracking
        this.eventSystem.emit({
          type: 'passive_skill_applied',
          timestamp: Date.now(),
          characterId: entityId,
          skillId: skill.id,
          attribute: effect.attribute,
          value: effectValue
        });
      }
      // Support percentage_modifier effect type for passive skills
      else if (effect.type === 'percentage_modifier' && effect.target === 'self') {
        // Apply percentage-based attribute modifier
        const levelMultiplier = 1 + (skill.level - 1) * 0.1;
        const percentageValue = effect.value * levelMultiplier;
        
        // Special handling for satietyConsumptionRate - apply value directly
        if (effect.attribute === 'satietyConsumptionRate') {
          this.applyBuffToAttributes(entityId, effect.attribute, percentageValue);
          
          // Emit event for tracking
          this.eventSystem.emit({
            type: 'passive_skill_applied',
            timestamp: Date.now(),
            characterId: entityId,
            skillId: skill.id,
            attribute: effect.attribute,
            value: percentageValue,
            isPercentage: true,
            percentageValue: percentageValue
          });
        } else {
          // Get current attribute value for percentage calculation
          const attributes = this.getComponent(entityId, AttributeComponentType);
          const derivedStats = this.getComponent(entityId, DerivedStatsComponentType);
          
          let currentValue = 0;
          if (attributes && effect.attribute in attributes) {
            currentValue = (attributes as any)[effect.attribute];
          } else if (derivedStats && effect.attribute in derivedStats) {
            currentValue = (derivedStats as any)[effect.attribute];
          }
          
          // Calculate the absolute change based on percentage
          const absoluteChange = currentValue * percentageValue;
          
          // Apply the change
          this.applyBuffToAttributes(entityId, effect.attribute, absoluteChange);
          
          // Emit event for tracking
          this.eventSystem.emit({
            type: 'passive_skill_applied',
            timestamp: Date.now(),
            characterId: entityId,
            skillId: skill.id,
            attribute: effect.attribute,
            value: absoluteChange,
            isPercentage: true,
            percentageValue: percentageValue
          });
        }
      }
    }
  }

  /**
   * Apply buff to character attributes
   */
  private applyBuffToAttributes(entityId: EntityId, attribute: string, value: number): void {
    const attributes = this.getComponent(entityId, AttributeComponentType);
    const derivedStats = this.getComponent(entityId, DerivedStatsComponentType);
    
    // Handle special attribute mappings
    if (attribute === 'maxHealth') {
      // Map maxHealth to health.maximum
      const health = this.getComponent(entityId, HealthComponentType);
      if (health) {
        const oldMaximum = health.maximum;
        health.maximum = Math.max(1, health.maximum + value); // Ensure minimum of 1
        
        // Adjust current health proportionally to maintain health percentage
        const healthRatio = health.current / oldMaximum;
        health.current = Math.floor(health.maximum * healthRatio);
        
        // Ensure current health doesn't exceed new maximum
        health.current = Math.min(health.current, health.maximum);
      }
    } else if (attribute === 'satietyConsumptionRate') {
      // Handle satietyConsumptionRate as a special derived stat
      // This attribute will be used by future hunger consumption systems
      if (derivedStats) {
        // Add the attribute dynamically if it doesn't exist
        if (!('satietyConsumptionRate' in derivedStats)) {
          (derivedStats as any).satietyConsumptionRate = 1.0; // Default rate
        }
        (derivedStats as any).satietyConsumptionRate += value;
        // Ensure rate doesn't go below 0
        (derivedStats as any).satietyConsumptionRate = Math.max(0, (derivedStats as any).satietyConsumptionRate);
      }
    } else if (attributes && attribute in attributes) {
      (attributes as any)[attribute] += value;
    } else if (derivedStats && attribute in derivedStats) {
      (derivedStats as any)[attribute] += value;
    }

    // Trigger attribute recalculation
    this.eventSystem.emit({
      type: 'attributes_changed',
      timestamp: Date.now(),
      characterId: entityId,
      reason: 'buff_applied'
    });
  }

  /**
   * Remove buff from character attributes
   */
  private removeBuffFromAttributes(entityId: EntityId, attribute: string, value: number): void {
    const attributes = this.getComponent(entityId, AttributeComponentType);
    const derivedStats = this.getComponent(entityId, DerivedStatsComponentType);
    
    // Handle special attribute mappings
    if (attribute === 'maxHealth') {
      // Map maxHealth to health.maximum
      const health = this.getComponent(entityId, HealthComponentType);
      if (health) {
        const oldMaximum = health.maximum;
        health.maximum = Math.max(1, health.maximum - value); // Ensure minimum of 1
        
        // Adjust current health proportionally to maintain health percentage
        const healthRatio = health.current / oldMaximum;
        health.current = Math.floor(health.maximum * healthRatio);
        
        // Ensure current health doesn't exceed new maximum
        health.current = Math.min(health.current, health.maximum);
      }
    } else if (attribute === 'satietyConsumptionRate') {
      // Handle satietyConsumptionRate as a special derived stat
      if (derivedStats && 'satietyConsumptionRate' in derivedStats) {
        (derivedStats as any).satietyConsumptionRate -= value;
        // Ensure rate doesn't go below 0
        (derivedStats as any).satietyConsumptionRate = Math.max(0, (derivedStats as any).satietyConsumptionRate);
      }
    } else if (attributes && attribute in attributes) {
      (attributes as any)[attribute] -= value;
    } else if (derivedStats && attribute in derivedStats) {
      (derivedStats as any)[attribute] -= value;
    }

    // Trigger attribute recalculation
    this.eventSystem.emit({
      type: 'attributes_changed',
      timestamp: Date.now(),
      characterId: entityId,
      reason: 'buff_removed'
    });
  }

  /**
   * Get all skills for a character
   */
  public getAllSkills(entityId: EntityId): Skill[] {
    const skillComponent = this.getComponent(entityId, SkillComponentType);
    if (!skillComponent) return [];

    return [
      ...skillComponent.passiveSkills,
      ...skillComponent.activeSkills,
      ...skillComponent.jobSkills,
      ...skillComponent.badgeSkills
    ];
  }

  /**
   * Get skills by type
   */
  public getSkillsByType(entityId: EntityId, type: SkillType): Skill[] {
    const skillComponent = this.getComponent(entityId, SkillComponentType);
    if (!skillComponent) return [];

    switch (type) {
      case SkillType.Passive:
        return skillComponent.passiveSkills;
      case SkillType.Active:
        return skillComponent.activeSkills;
      case SkillType.Job:
        return skillComponent.jobSkills;
      case SkillType.Badge:
        return skillComponent.badgeSkills;
      default:
        return [];
    }
  }

  /**
   * Get remaining cooldown for a skill
   */
  public getSkillCooldown(entityId: EntityId, skillId: string): number {
    const cooldowns = this.skillCooldowns.get(entityId);
    if (!cooldowns) return 0;

    const cooldown = cooldowns.find(cd => cd.skillId === skillId);
    return cooldown ? Math.max(0, cooldown.remainingTime) : 0;
  }

  /**
   * Get active buffs for a character
   */
  public getActiveBuffs(entityId: EntityId): ActiveBuff[] {
    return this.activeBuffs.get(entityId) || [];
  }

  /**
   * Set the current time of day and update conditional passive skills
   * This method can be called by a TimeSystem or manually for testing
   */
  public setTimeOfDay(timeOfDay: 'day' | 'night'): void {
    if (this.currentTimeOfDay !== timeOfDay) {
      this.currentTimeOfDay = timeOfDay;
      this.updateConditionalPassiveSkills(timeOfDay);

      // Emit event for other systems
      this.eventSystem.emit({
        type: 'time_of_day_changed',
        timestamp: Date.now(),
        timeOfDay: timeOfDay
      });
    }
  }

  /**
   * Get the current time of day
   */
  public getTimeOfDay(): 'day' | 'night' {
    return this.currentTimeOfDay;
  }

  /**
   * Update conditional passive skills based on current time of day
   * This method applies or removes conditional bonuses based on whether their conditions are met
   */
  private updateConditionalPassiveSkills(timeOfDay: 'day' | 'night'): void {
    // Iterate through all entities with conditional bonuses
    for (const [entityId, bonuses] of this.conditionalBonuses.entries()) {
      for (const bonus of bonuses) {
        // Check if the condition is met
        const conditionMet = bonus.condition.type === 'time_of_day' && bonus.condition.value === timeOfDay;

        // Apply or remove bonus based on condition
        if (conditionMet && !bonus.isActive) {
          // Condition is now met, apply the bonus
          // Check if this is a percentage bonus (value between 0 and 1 for attack/defense attributes)
          let actualValue = bonus.value;
          if ((bonus.attribute === 'attack' || bonus.attribute === 'defense') && bonus.value > 0 && bonus.value < 1) {
            // This is a percentage bonus, calculate the actual value based on current attribute
            const attributes = this.getComponent(entityId, AttributeComponentType);
            const derivedStats = this.getComponent(entityId, DerivedStatsComponentType);
            
            let currentValue = 0;
            if (attributes && bonus.attribute in attributes) {
              currentValue = (attributes as any)[bonus.attribute];
            } else if (derivedStats && bonus.attribute in derivedStats) {
              currentValue = (derivedStats as any)[bonus.attribute];
            }
            
            if (currentValue > 0) {
              actualValue = currentValue * bonus.value;
            }
          }

          this.applyBuffToAttributes(entityId, bonus.attribute, actualValue);
          bonus.appliedValue = actualValue; // Store the actual applied value
          bonus.isActive = true;

          // Emit event for tracking
          this.eventSystem.emit({
            type: 'conditional_bonus_applied',
            timestamp: Date.now(),
            characterId: entityId,
            skillId: bonus.skillId,
            attribute: bonus.attribute,
            value: actualValue,
            condition: bonus.condition
          });
        } else if (!conditionMet && bonus.isActive) {
          // Condition is no longer met, remove the bonus
          // Use the stored applied value for accurate removal
          const valueToRemove = bonus.appliedValue || bonus.value;
          this.removeBuffFromAttributes(entityId, bonus.attribute, valueToRemove);
          bonus.isActive = false;

          // Emit event for tracking
          this.eventSystem.emit({
            type: 'conditional_bonus_removed',
            timestamp: Date.now(),
            characterId: entityId,
            skillId: bonus.skillId,
            attribute: bonus.attribute,
            value: valueToRemove,
            condition: bonus.condition
          });
        }
      }
    }
  }

  /**
   * Handle time of day changed events
   */
  private handleTimeOfDayChanged(event: any): void {
    if (event.timeOfDay === 'day' || event.timeOfDay === 'night') {
      this.currentTimeOfDay = event.timeOfDay;
      this.updateConditionalPassiveSkills(this.currentTimeOfDay);
    }
  }

  /**
   * Handle skill learned events
   */
  private handleSkillLearned(event: any): void {
    // Additional processing when a skill is learned
  }

  /**
   * Handle skill used events
   */
  private handleSkillUsed(event: any): void {
    // Track skill usage for achievements or other systems
  }

  /**
   * Handle level up events - may unlock new skills
   */
  private handleLevelUp(event: any): void {
    // Check if new skills become available at this level
    // This would typically involve checking a skill database/config
  }

  /**
   * Handle job change events - may unlock job-specific skills
   */
  private handleJobChanged(event: any): void {
    const skillComponent = this.getComponent(event.characterId, SkillComponentType);
    if (!skillComponent) return;

    // Remove old job skills (optional - depends on game design)
    // skillComponent.jobSkills = skillComponent.jobSkills.filter(skill => skill.jobType !== event.oldJob);

    // Add new job skills would typically be done through a skill database lookup
    // For now, just emit an event that other systems can listen to
    this.eventSystem.emit({
      type: 'job_skills_available',
      timestamp: Date.now(),
      characterId: event.characterId,
      jobType: event.newJob
    });
  }
}

/**
 * Interface for conditional bonuses that depend on game state (e.g., time of day)
 */
interface ConditionalBonus {
  skillId: string;
  attribute: string;
  value: number; // The original value from the skill definition
  appliedValue?: number; // The actual value that was applied (for percentage bonuses)
  condition: TimeCondition;
  isActive: boolean;
}

/**
 * Interface for active buffs/debuffs
 */
interface ActiveBuff {
  attribute: string;
  value: number;
  remainingTime: number;
  applied: boolean;
}