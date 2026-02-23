/**
 * Badge System
 * Handles badge equipment, effect application/removal, and skill triggering
 * Implements requirements 3.1-3.4
 */

import { System } from '../../ecs/System';
import { ComponentType } from '../../ecs/Component';
import { EntityId } from '../../ecs/Entity';
import { 
  BadgeComponent, 
  BadgeComponentType,
  Badge,
  SkillComponent,
  SkillComponentType,
  WorkAssignmentComponent,
  WorkAssignmentComponentType
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
  LevelComponentType
} from '../components/CharacterComponents';
import { WorkType, CharacterStatus } from '../types/GameTypes';

export interface BadgeEquipResult {
  success: boolean;
  badge?: Badge;
  error?: string;
}

export interface BadgeActivationCondition {
  type: 'level' | 'attribute' | 'item' | 'achievement';
  value: string | number;
  minimum: number;
}

export class BadgeSystem extends System {
  public readonly name = 'BadgeSystem';
  public readonly requiredComponents: ComponentType<any>[] = [
    BadgeComponentType
  ];

  protected onInitialize(): void {
    // Listen for badge-related events
    this.eventSystem.subscribe('badge_unlocked', this.handleBadgeUnlock.bind(this));
    this.eventSystem.subscribe('work_started', this.handleWorkStart.bind(this));
    this.eventSystem.subscribe('skill_used', this.handleSkillUsed.bind(this));
  }

  public update(deltaTime: number): void {
    // Update badge skill cooldowns and effects
    const entities = this.getEntities();
    
    for (const entityId of entities) {
      this.updateBadgeEffects(entityId, deltaTime);
    }
  }

  /**
   * Equip a badge to a character
   * Requirement 3.2: Apply badge effects when equipped
   */
  public equipBadge(entityId: EntityId, badgeId: string): BadgeEquipResult {
    const badgeComponent = this.getComponent(entityId, BadgeComponentType);
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    
    if (!badgeComponent || !characterInfo) {
      return { success: false, error: 'Missing required components' };
    }

    // Check if character is available
    if (characterInfo.status !== CharacterStatus.Available) {
      return { success: false, error: 'Character is not available' };
    }

    // Find the badge in available badges
    const badge = badgeComponent.availableBadges.find(b => b.id === badgeId);
    if (!badge) {
      return { success: false, error: 'Badge not found in available badges' };
    }

    // Check if badge is unlocked
    if (!badge.unlocked) {
      return { success: false, error: 'Badge is not unlocked' };
    }

    // Check if badge is already equipped
    const alreadyEquipped = badgeComponent.equippedBadges.some(b => b.id === badgeId);
    if (alreadyEquipped) {
      return { success: false, error: 'Badge is already equipped' };
    }

    // Check for work type conflicts (only one badge per work type)
    const conflictingBadge = badgeComponent.equippedBadges.find(b => b.workType === badge.workType);
    if (conflictingBadge) {
      return { success: false, error: `Badge conflicts with ${conflictingBadge.name} (same work type)` };
    }

    // Equip the badge
    badgeComponent.equippedBadges.push(badge);
    
    // Apply badge effects
    this.applyBadgeEffects(entityId, badge);
    
    // Add badge skills to character
    this.addBadgeSkills(entityId, badge);

    // Emit badge equipped event
    this.eventSystem.emit({
      type: 'badge_equipped',
      timestamp: Date.now(),
      characterId: entityId,
      badgeId: badge.id,
      workType: badge.workType
    });

    return { success: true, badge };
  }

  /**
   * Unequip a badge from a character
   * Requirement 3.3: Remove badge effects when unequipped
   */
  public unequipBadge(entityId: EntityId, badgeId: string): BadgeEquipResult {
    const badgeComponent = this.getComponent(entityId, BadgeComponentType);
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    
    if (!badgeComponent || !characterInfo) {
      return { success: false, error: 'Missing required components' };
    }

    // Check if character is available
    if (characterInfo.status !== CharacterStatus.Available) {
      return { success: false, error: 'Character is not available' };
    }

    // Find the badge in equipped badges
    const badgeIndex = badgeComponent.equippedBadges.findIndex(b => b.id === badgeId);
    if (badgeIndex === -1) {
      return { success: false, error: 'Badge is not equipped' };
    }

    const badge = badgeComponent.equippedBadges[badgeIndex];

    // Remove badge effects
    this.removeBadgeEffects(entityId, badge);
    
    // Remove badge skills from character
    this.removeBadgeSkills(entityId, badge);

    // Unequip the badge
    badgeComponent.equippedBadges.splice(badgeIndex, 1);

    // Emit badge unequipped event
    this.eventSystem.emit({
      type: 'badge_unequipped',
      timestamp: Date.now(),
      characterId: entityId,
      badgeId: badge.id,
      workType: badge.workType
    });

    return { success: true, badge };
  }

  /**
   * Apply badge attribute bonuses and effects
   */
  private applyBadgeEffects(entityId: EntityId, badge: Badge): void {
    const attributes = this.getComponent(entityId, AttributeComponentType);
    const derivedStats = this.getComponent(entityId, DerivedStatsComponentType);
    
    if (!attributes || !derivedStats) return;

    // Apply attribute bonuses
    for (const [attribute, bonus] of Object.entries(badge.attributeBonus)) {
      if (attribute in attributes) {
        (attributes as any)[attribute] += bonus;
      } else if (attribute in derivedStats) {
        (derivedStats as any)[attribute] += bonus;
      }
    }

    // Trigger attribute recalculation
    this.eventSystem.emit({
      type: 'equipment_changed',
      timestamp: Date.now(),
      characterId: entityId
    });
  }

  /**
   * Remove badge attribute bonuses and effects
   */
  private removeBadgeEffects(entityId: EntityId, badge: Badge): void {
    const attributes = this.getComponent(entityId, AttributeComponentType);
    const derivedStats = this.getComponent(entityId, DerivedStatsComponentType);
    
    if (!attributes || !derivedStats) return;

    // Remove attribute bonuses
    for (const [attribute, bonus] of Object.entries(badge.attributeBonus)) {
      if (attribute in attributes) {
        (attributes as any)[attribute] -= bonus;
      } else if (attribute in derivedStats) {
        (derivedStats as any)[attribute] -= bonus;
      }
    }

    // Trigger attribute recalculation
    this.eventSystem.emit({
      type: 'equipment_changed',
      timestamp: Date.now(),
      characterId: entityId
    });
  }

  /**
   * Add badge skills to character's skill component
   */
  private addBadgeSkills(entityId: EntityId, badge: Badge): void {
    const skillComponent = this.getComponent(entityId, SkillComponentType);
    if (!skillComponent) return;

    // Add badge skills to badgeSkills array
    for (const skill of badge.skills) {
      const existingSkill = skillComponent.badgeSkills.find(s => s.id === skill.id);
      if (!existingSkill) {
        skillComponent.badgeSkills.push({ ...skill });
      }
    }
  }

  /**
   * Remove badge skills from character's skill component
   */
  private removeBadgeSkills(entityId: EntityId, badge: Badge): void {
    const skillComponent = this.getComponent(entityId, SkillComponentType);
    if (!skillComponent) return;

    // Remove badge skills from badgeSkills array
    for (const skill of badge.skills) {
      const skillIndex = skillComponent.badgeSkills.findIndex(s => s.id === skill.id);
      if (skillIndex !== -1) {
        skillComponent.badgeSkills.splice(skillIndex, 1);
      }
    }
  }

  /**
   * Check if character can perform a specific work type
   * Requirement 3.1: Verify work ability through badges
   */
  public canPerformWork(entityId: EntityId, workType: WorkType): boolean {
    const badgeComponent = this.getComponent(entityId, BadgeComponentType);
    if (!badgeComponent) return false;

    // Check if character has an equipped badge for this work type
    return badgeComponent.equippedBadges.some(badge => badge.workType === workType);
  }

  /**
   * Get work efficiency for a character based on equipped badges
   */
  public getWorkEfficiency(entityId: EntityId, workType: WorkType): number {
    const badgeComponent = this.getComponent(entityId, BadgeComponentType);
    if (!badgeComponent) return 0;

    const workBadge = badgeComponent.equippedBadges.find(badge => badge.workType === workType);
    if (!workBadge) return 0;

    // Base efficiency from badge, can be modified by character attributes
    let efficiency = 0.5; // Base 50% efficiency

    // Get character attributes to calculate efficiency bonus
    const attributes = this.getComponent(entityId, AttributeComponentType);
    if (attributes) {
      // Different work types benefit from different attributes
      switch (workType) {
        case WorkType.Mining:
        case WorkType.Logging:
          efficiency += attributes.strength * 0.01; // Strength-based work
          break;
        case WorkType.Crafting:
        case WorkType.Alchemy:
          efficiency += attributes.technique * 0.01; // Technique-based work
          break;
        case WorkType.Farming:
          efficiency += (attributes.strength + attributes.technique) * 0.005; // Mixed
          break;
        case WorkType.Trading:
        case WorkType.Research:
          efficiency += attributes.wisdom * 0.01; // Wisdom-based work
          break;
        default:
          efficiency += (attributes.strength + attributes.agility + attributes.wisdom + attributes.technique) * 0.0025;
      }
    }

    return Math.min(1.0, efficiency); // Cap at 100% efficiency
  }

  /**
   * Unlock a badge for a character
   * Requirement 3.1: Badge activation conditions
   */
  public unlockBadge(entityId: EntityId, badgeId: string, conditions: BadgeActivationCondition[]): boolean {
    const badgeComponent = this.getComponent(entityId, BadgeComponentType);
    if (!badgeComponent) return false;

    // Find the badge in available badges
    const badge = badgeComponent.availableBadges.find(b => b.id === badgeId);
    if (!badge || badge.unlocked) return false;

    // Check all activation conditions
    const conditionsMet = this.checkBadgeConditions(entityId, conditions);
    if (!conditionsMet) return false;

    // Unlock the badge
    badge.unlocked = true;

    // Emit badge unlocked event
    this.eventSystem.emit({
      type: 'badge_unlocked',
      timestamp: Date.now(),
      characterId: entityId,
      badgeId: badge.id,
      workType: badge.workType
    });

    return true;
  }

  /**
   * Check if badge activation conditions are met
   */
  private checkBadgeConditions(entityId: EntityId, conditions: BadgeActivationCondition[]): boolean {
    for (const condition of conditions) {
      if (!this.checkSingleCondition(entityId, condition)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check a single badge activation condition
   */
  private checkSingleCondition(entityId: EntityId, condition: BadgeActivationCondition): boolean {
    switch (condition.type) {
      case 'level': {
        const levelComponent = this.getComponent(entityId, LevelComponentType);
        return levelComponent && levelComponent.level >= condition.minimum;
      }
      case 'attribute': {
        const attributes = this.getComponent(entityId, AttributeComponentType);
        if (!attributes) return false;
        const attributeValue = (attributes as any)[condition.value as string];
        return attributeValue >= condition.minimum;
      }
      // Add more condition types as needed
      default:
        return false;
    }
  }

  /**
   * Trigger badge skills when appropriate conditions are met
   * Requirement 3.4: Badge skill triggering logic
   */
  public triggerBadgeSkill(entityId: EntityId, skillId: string, targetId?: EntityId): boolean {
    const badgeComponent = this.getComponent(entityId, BadgeComponentType);
    const skillComponent = this.getComponent(entityId, SkillComponentType);
    const mana = this.getComponent(entityId, ManaComponentType);
    
    if (!badgeComponent || !skillComponent || !mana) return false;

    // Find the skill in badge skills
    const skill = skillComponent.badgeSkills.find(s => s.id === skillId);
    if (!skill) return false;

    // Check mana cost
    if (mana.current < skill.manaCost) return false;

    // Check cooldown (simplified - would need cooldown tracking)
    // For now, assume skill is available

    // Consume mana
    mana.current -= skill.manaCost;

    // Apply skill effects
    this.applySkillEffects(entityId, skill, targetId);

    // Emit skill used event
    this.eventSystem.emit({
      type: 'badge_skill_used',
      timestamp: Date.now(),
      characterId: entityId,
      skillId: skill.id,
      targetId,
      manaCost: skill.manaCost
    });

    return true;
  }

  /**
   * Apply skill effects to target(s)
   */
  private applySkillEffects(entityId: EntityId, skill: any, targetId?: EntityId): void {
    // Apply each effect in the skill
    for (const effect of skill.effects) {
      const target = targetId || entityId; // Default to self if no target specified
      
      switch (effect.type) {
        case 'heal':
          this.applyHealEffect(target, effect.value);
          break;
        case 'buff':
          this.applyBuffEffect(target, effect.attribute, effect.value, effect.duration);
          break;
        case 'restore':
          this.applyRestoreEffect(target, effect.attribute, effect.value);
          break;
        // Add more effect types as needed
      }
    }
  }

  /**
   * Apply healing effect
   */
  private applyHealEffect(targetId: EntityId, amount: number): void {
    const health = this.getComponent(targetId, HealthComponentType);
    if (health) {
      health.current = Math.min(health.maximum, health.current + amount);
    }
  }

  /**
   * Apply buff effect (simplified implementation)
   */
  private applyBuffEffect(targetId: EntityId, attribute: string, value: number, duration: number): void {
    // This would typically involve a buff/debuff system
    // For now, just emit an event
    this.eventSystem.emit({
      type: 'buff_applied',
      timestamp: Date.now(),
      targetId,
      attribute,
      value,
      duration
    });
  }

  /**
   * Apply restore effect (mana/stamina restoration)
   */
  private applyRestoreEffect(targetId: EntityId, attribute: string, amount: number): void {
    if (attribute === 'mana') {
      const mana = this.getComponent(targetId, ManaComponentType);
      if (mana) {
        mana.current = Math.min(mana.maximum, mana.current + amount);
      }
    }
  }

  /**
   * Update badge effects over time
   */
  private updateBadgeEffects(entityId: EntityId, deltaTime: number): void {
    // Update skill cooldowns, temporary effects, etc.
    // This would be expanded based on specific badge mechanics
  }

  /**
   * Handle badge unlock events
   */
  private handleBadgeUnlock(event: { type: string; characterId: EntityId; badgeId: string }): void {
    // Additional processing when a badge is unlocked
  }

  /**
   * Handle work start events to verify badge requirements
   */
  private handleWorkStart(event: { type: string; characterId: EntityId; workType: WorkType }): void {
    if (!this.canPerformWork(event.characterId, event.workType)) {
      // Cancel work if character doesn't have required badge
      this.eventSystem.emit({
        type: 'work_cancelled',
        timestamp: Date.now(),
        characterId: event.characterId,
        reason: 'Missing required badge'
      });
    }
  }

  /**
   * Handle skill usage events
   */
  private handleSkillUsed(event: { type: string; characterId: EntityId; skillId: string }): void {
    // Track skill usage for badge-related achievements or effects
  }

  /**
   * Get all equipped badges for a character
   */
  public getEquippedBadges(entityId: EntityId): Badge[] {
    const badgeComponent = this.getComponent(entityId, BadgeComponentType);
    return badgeComponent ? badgeComponent.equippedBadges : [];
  }

  /**
   * Get all available badges for a character
   */
  public getAvailableBadges(entityId: EntityId): Badge[] {
    const badgeComponent = this.getComponent(entityId, BadgeComponentType);
    return badgeComponent ? badgeComponent.availableBadges : [];
  }

  /**
   * Get unlocked badges for a character
   */
  public getUnlockedBadges(entityId: EntityId): Badge[] {
    const badgeComponent = this.getComponent(entityId, BadgeComponentType);
    return badgeComponent ? badgeComponent.availableBadges.filter(b => b.unlocked) : [];
  }
}