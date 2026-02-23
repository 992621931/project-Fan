/**
 * Work System
 * Handles character work assignments, resource generation, and work state management
 * Implements requirements 4.1-4.5
 */

import { System } from '../../ecs/System';
import { ComponentType } from '../../ecs/Component';
import { EntityId } from '../../ecs/Entity';
import { 
  CharacterInfoComponent, 
  CharacterInfoComponentType,
  AttributeComponent,
  AttributeComponentType,
  LevelComponent,
  LevelComponentType
} from '../components/CharacterComponents';
import { 
  WorkAssignmentComponent,
  WorkAssignmentComponentType,
  WorkAssignment,
  ResourceGeneration,
  BadgeComponent,
  BadgeComponentType,
  InventoryComponent,
  InventoryComponentType
} from '../components/SystemComponents';
import { WorkType, CharacterStatus, ItemType } from '../types/GameTypes';

export interface WorkCapability {
  workType: WorkType;
  efficiency: number; // 0-1 multiplier for resource generation
  unlocked: boolean;
}

export interface WorkResult {
  success: boolean;
  workType?: WorkType;
  duration?: number;
  estimatedResources?: ResourceGeneration[];
  error?: string;
}

export interface WorkCompletionResult {
  characterId: EntityId;
  workType: WorkType;
  duration: number;
  resourcesGenerated: ResourceGeneration[];
  experience: number;
}

export class WorkSystem extends System {
  public readonly name = 'WorkSystem';
  public readonly requiredComponents: ComponentType<any>[] = [
    WorkAssignmentComponentType,
    CharacterInfoComponentType
  ];

  // Work type requirements and base resource generation
  private workConfigs: Record<WorkType, {
    name: string;
    description: string;
    requiredBadge?: string;
    baseEfficiency: number;
    resourceTypes: string[];
    experienceGain: number;
    attributeRequirements?: Partial<AttributeComponent>;
  }> = {
    [WorkType.Mining]: {
      name: '采矿',
      description: '开采矿物资源',
      requiredBadge: 'mining_badge',
      baseEfficiency: 1.0,
      resourceTypes: ['iron_ore', 'copper_ore', 'coal'],
      experienceGain: 10,
      attributeRequirements: { strength: 10 }
    },
    [WorkType.Logging]: {
      name: '伐木',
      description: '收集木材资源',
      requiredBadge: 'logging_badge',
      baseEfficiency: 1.0,
      resourceTypes: ['wood', 'hardwood'],
      experienceGain: 8,
      attributeRequirements: { strength: 8, technique: 5 }
    },
    [WorkType.Farming]: {
      name: '农业',
      description: '种植和收获作物',
      requiredBadge: 'farming_badge',
      baseEfficiency: 1.0,
      resourceTypes: ['wheat', 'vegetables', 'herbs'],
      experienceGain: 12,
      attributeRequirements: { wisdom: 8, technique: 8 }
    },
    [WorkType.Crafting]: {
      name: '制作',
      description: '制作装备和工具',
      requiredBadge: 'crafting_badge',
      baseEfficiency: 0.8,
      resourceTypes: ['basic_equipment', 'tools'],
      experienceGain: 15,
      attributeRequirements: { technique: 12, wisdom: 8 }
    },
    [WorkType.Cooking]: {
      name: '烹饪',
      description: '制作食物和药水',
      requiredBadge: 'cooking_badge',
      baseEfficiency: 0.9,
      resourceTypes: ['food', 'potions'],
      experienceGain: 12,
      attributeRequirements: { wisdom: 10, technique: 10 }
    },
    [WorkType.Alchemy]: {
      name: '炼金',
      description: '调制药水和合成材料',
      requiredBadge: 'alchemy_badge',
      baseEfficiency: 0.7,
      resourceTypes: ['potions', 'gems', 'magical_materials'],
      experienceGain: 20,
      attributeRequirements: { wisdom: 15, technique: 12 }
    },
    [WorkType.Trading]: {
      name: '贸易',
      description: '进行商品交易',
      requiredBadge: 'trading_badge',
      baseEfficiency: 1.2,
      resourceTypes: ['gold', 'rare_items'],
      experienceGain: 18,
      attributeRequirements: { wisdom: 12, agility: 8 }
    },
    [WorkType.Research]: {
      name: '研究',
      description: '进行学术研究',
      requiredBadge: 'research_badge',
      baseEfficiency: 0.6,
      resourceTypes: ['knowledge', 'blueprints'],
      experienceGain: 25,
      attributeRequirements: { wisdom: 20 }
    }
  };

  protected onInitialize(): void {
    // Listen for time updates to process ongoing work
    this.eventSystem.subscribe('time_update', this.handleTimeUpdate.bind(this));
    // Listen for character status changes
    this.eventSystem.subscribe('character_status_changed', this.handleCharacterStatusChange.bind(this));
  }

  public update(deltaTime: number): void {
    // Process ongoing work assignments
    const entities = this.getEntities();
    
    for (const entityId of entities) {
      this.processWorkProgress(entityId, deltaTime);
    }
  }

  /**
   * Assign a character to work
   * Requirement 4.1: Verify character has required work ability
   * Requirement 4.4: Prevent character from participating in other activities
   */
  public assignWork(entityId: EntityId, workType: WorkType, duration: number): WorkResult {
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    const workAssignment = this.getComponent(entityId, WorkAssignmentComponentType);
    
    if (!characterInfo || !workAssignment) {
      return {
        success: false,
        error: 'Missing required components'
      };
    }

    // Check if character already has work assignment first
    if (workAssignment.currentWork !== null) {
      return {
        success: false,
        error: 'Character is already assigned to work'
      };
    }

    // Check if character is available
    if (characterInfo.status !== CharacterStatus.Available) {
      return {
        success: false,
        error: 'Character is not available for work'
      };
    }

    // Verify work capability
    if (!this.hasWorkCapability(entityId, workType)) {
      return {
        success: false,
        error: 'Character does not have required work capability'
      };
    }

    // Calculate work efficiency
    const efficiency = this.calculateWorkEfficiency(entityId, workType);
    
    // Estimate resource generation
    const estimatedResources = this.estimateResourceGeneration(workType, duration, efficiency);

    // Create work assignment
    const newWorkAssignment: WorkAssignment = {
      workType,
      startTime: Date.now(),
      duration,
      efficiency,
      resourcesGenerated: []
    };

    // Assign work
    workAssignment.currentWork = newWorkAssignment;
    characterInfo.status = CharacterStatus.Working;

    // Emit work started event
    this.eventSystem.emit({
      type: 'work_started',
      timestamp: Date.now(),
      characterId: entityId,
      workType,
      duration,
      efficiency
    });

    return {
      success: true,
      workType,
      duration,
      estimatedResources
    };
  }

  /**
   * Cancel a character's work assignment
   * Requirement 4.5: Allow immediate work cancellation with partial rewards
   */
  public cancelWork(entityId: EntityId): WorkCompletionResult | null {
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    const workAssignment = this.getComponent(entityId, WorkAssignmentComponentType);
    
    if (!characterInfo || !workAssignment || !workAssignment.currentWork) {
      return null;
    }

    const work = workAssignment.currentWork;
    const currentTime = Date.now();
    const elapsedTime = currentTime - work.startTime;
    const completionRatio = Math.min(elapsedTime / work.duration, 1.0);

    // Generate partial resources based on completion ratio
    const partialResources = this.generateResources(work.workType, elapsedTime, work.efficiency);
    
    // Calculate experience based on time worked
    const experience = Math.floor(this.workConfigs[work.workType].experienceGain * completionRatio);

    const result: WorkCompletionResult = {
      characterId: entityId,
      workType: work.workType,
      duration: elapsedTime,
      resourcesGenerated: partialResources,
      experience
    };

    // Add resources to work assignment history
    work.resourcesGenerated = partialResources;
    workAssignment.workHistory.push(work);

    // Clear current work and restore character status
    workAssignment.currentWork = null;
    characterInfo.status = CharacterStatus.Available;

    // Add resources to character inventory
    this.addResourcesToInventory(entityId, partialResources);

    // Emit work cancelled event
    this.eventSystem.emit({
      type: 'work_cancelled',
      timestamp: Date.now(),
      characterId: entityId,
      workType: work.workType,
      completionRatio,
      resourcesGenerated: partialResources,
      experience
    });

    return result;
  }

  /**
   * Check if character has capability for specific work type
   * Requirement 4.1: Verify work ability through badges and attributes
   */
  public hasWorkCapability(entityId: EntityId, workType: WorkType): boolean {
    const badgeComponent = this.getComponent(entityId, BadgeComponentType);
    const attributeComponent = this.getComponent(entityId, AttributeComponentType);
    
    if (!badgeComponent || !attributeComponent) {
      return false;
    }

    const workConfig = this.workConfigs[workType];
    
    // Check badge requirement
    if (workConfig.requiredBadge) {
      const hasBadge = badgeComponent.equippedBadges.some(badge => 
        badge.workType === workType && badge.unlocked
      );
      if (!hasBadge) {
        return false;
      }
    }

    // Check attribute requirements
    if (workConfig.attributeRequirements) {
      for (const [attr, minValue] of Object.entries(workConfig.attributeRequirements)) {
        const currentValue = (attributeComponent as any)[attr];
        if (currentValue < minValue) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get all work capabilities for a character
   */
  public getWorkCapabilities(entityId: EntityId): WorkCapability[] {
    const capabilities: WorkCapability[] = [];
    
    for (const workType of Object.values(WorkType)) {
      const hasCapability = this.hasWorkCapability(entityId, workType);
      const efficiency = hasCapability ? this.calculateWorkEfficiency(entityId, workType) : 0;
      
      capabilities.push({
        workType,
        efficiency,
        unlocked: hasCapability
      });
    }
    
    return capabilities;
  }

  /**
   * Calculate work efficiency based on character attributes and level
   */
  private calculateWorkEfficiency(entityId: EntityId, workType: WorkType): number {
    const attributeComponent = this.getComponent(entityId, AttributeComponentType);
    const levelComponent = this.getComponent(entityId, LevelComponentType);
    
    if (!attributeComponent || !levelComponent) {
      return 0.5; // Default low efficiency
    }

    const workConfig = this.workConfigs[workType];
    let efficiency = workConfig.baseEfficiency;

    // Apply attribute bonuses
    if (workConfig.attributeRequirements) {
      for (const [attr, minValue] of Object.entries(workConfig.attributeRequirements)) {
        const currentValue = (attributeComponent as any)[attr];
        const bonus = Math.max(0, (currentValue - minValue) * 0.02); // 2% per point above minimum
        efficiency += bonus;
      }
    }

    // Apply level bonus
    const levelBonus = (levelComponent.level - 1) * 0.05; // 5% per level above 1
    efficiency += levelBonus;

    // Cap efficiency at reasonable bounds
    return Math.max(0.1, Math.min(2.0, efficiency));
  }

  /**
   * Process work progress for a character
   * Requirement 4.2: Generate resources based on time and character ability
   */
  private processWorkProgress(entityId: EntityId, deltaTime: number): void {
    const workAssignment = this.getComponent(entityId, WorkAssignmentComponentType);
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    
    if (!workAssignment || !characterInfo || !workAssignment.currentWork) {
      return;
    }

    const work = workAssignment.currentWork;
    const currentTime = Date.now();
    const elapsedTime = currentTime - work.startTime;

    // Check if work is completed
    if (elapsedTime >= work.duration) {
      this.completeWork(entityId);
    }
  }

  /**
   * Complete a work assignment
   * Requirement 4.3: Add generated resources to player inventory when work ends
   */
  private completeWork(entityId: EntityId): void {
    const workAssignment = this.getComponent(entityId, WorkAssignmentComponentType);
    const characterInfo = this.getComponent(entityId, CharacterInfoComponentType);
    
    if (!workAssignment || !characterInfo || !workAssignment.currentWork) {
      return;
    }

    const work = workAssignment.currentWork;
    
    // Generate final resources
    const resources = this.generateResources(work.workType, work.duration, work.efficiency);
    work.resourcesGenerated = resources;

    // Calculate experience
    const experience = this.workConfigs[work.workType].experienceGain;

    // Add to work history
    workAssignment.workHistory.push(work);
    workAssignment.currentWork = null;

    // Restore character status
    characterInfo.status = CharacterStatus.Available;

    // Add resources to inventory
    this.addResourcesToInventory(entityId, resources);

    // Emit work completed event
    this.eventSystem.emit({
      type: 'work_completed',
      timestamp: Date.now(),
      characterId: entityId,
      workType: work.workType,
      duration: work.duration,
      resourcesGenerated: resources,
      experience
    });

    // Add experience to character
    this.eventSystem.emit({
      type: 'character_gained_experience',
      timestamp: Date.now(),
      characterId: entityId,
      experience
    });
  }

  /**
   * Generate resources based on work type, duration, and efficiency
   */
  private generateResources(workType: WorkType, duration: number, efficiency: number): ResourceGeneration[] {
    const workConfig = this.workConfigs[workType];
    const resources: ResourceGeneration[] = [];
    
    // Base generation rate (resources per hour)
    const baseRate = 1.0;
    const durationHours = duration / (1000 * 60 * 60); // Convert ms to hours
    
    for (const resourceType of workConfig.resourceTypes) {
      const baseAmount = Math.floor(baseRate * durationHours);
      const actualAmount = Math.floor(baseAmount * efficiency);
      
      if (actualAmount > 0) {
        resources.push({
          itemId: resourceType,
          baseAmount,
          actualAmount
        });
      }
    }
    
    return resources;
  }

  /**
   * Estimate resource generation for work assignment
   */
  private estimateResourceGeneration(workType: WorkType, duration: number, efficiency: number): ResourceGeneration[] {
    return this.generateResources(workType, duration, efficiency);
  }

  /**
   * Add generated resources to character inventory
   */
  private addResourcesToInventory(entityId: EntityId, resources: ResourceGeneration[]): void {
    const inventory = this.getComponent(entityId, InventoryComponentType);
    
    if (!inventory) {
      // If no inventory component, emit event for external handling
      this.eventSystem.emit({
        type: 'resources_generated',
        timestamp: Date.now(),
        characterId: entityId,
        resources
      });
      return;
    }

    // Add resources to inventory (simplified implementation)
    for (const resource of resources) {
      // Find empty slot or existing stack
      let added = false;
      
      for (const slot of inventory.slots) {
        if (slot.item === null) {
          // Create new item entity for the resource (simplified)
          // In a real implementation, this would create proper item entities
          slot.item = resource.itemId as any; // Simplified for now
          slot.quantity = resource.actualAmount;
          added = true;
          break;
        }
      }
      
      if (!added) {
        // Inventory full - emit event for external handling
        this.eventSystem.emit({
          type: 'inventory_full',
          timestamp: Date.now(),
          characterId: entityId,
          resource
        });
      }
    }
  }

  /**
   * Get current work status for a character
   */
  public getWorkStatus(entityId: EntityId): {
    isWorking: boolean;
    currentWork?: WorkAssignment;
    progress?: number;
    timeRemaining?: number;
  } {
    const workAssignment = this.getComponent(entityId, WorkAssignmentComponentType);
    
    if (!workAssignment || !workAssignment.currentWork) {
      return { isWorking: false };
    }

    const work = workAssignment.currentWork;
    const currentTime = Date.now();
    const elapsedTime = currentTime - work.startTime;
    const progress = Math.min(elapsedTime / work.duration, 1.0);
    const timeRemaining = Math.max(0, work.duration - elapsedTime);

    return {
      isWorking: true,
      currentWork: work,
      progress,
      timeRemaining
    };
  }

  /**
   * Get work history for a character
   */
  public getWorkHistory(entityId: EntityId): WorkAssignment[] {
    const workAssignment = this.getComponent(entityId, WorkAssignmentComponentType);
    return workAssignment ? workAssignment.workHistory : [];
  }

  /**
   * Handle time updates for work processing
   */
  private handleTimeUpdate(event: { type: string; deltaTime: number }): void {
    // Work progress is handled in the main update loop
    // This could be used for more sophisticated time-based processing
  }

  /**
   * Handle character status changes
   */
  private handleCharacterStatusChange(event: { type: string; characterId: EntityId; newStatus: CharacterStatus }): void {
    // If character becomes unavailable while working, cancel their work
    if (event.newStatus !== CharacterStatus.Working && event.newStatus !== CharacterStatus.Available) {
      const workAssignment = this.getComponent(event.characterId, WorkAssignmentComponentType);
      if (workAssignment && workAssignment.currentWork) {
        this.cancelWork(event.characterId);
      }
    }
  }

  /**
   * Get work configuration
   */
  public getWorkConfig(workType: WorkType) {
    return this.workConfigs[workType];
  }

  /**
   * Check if any character is working on a specific work type
   */
  public isWorkTypeInUse(workType: WorkType): boolean {
    const entities = this.getEntities();
    
    for (const entityId of entities) {
      const workAssignment = this.getComponent(entityId, WorkAssignmentComponentType);
      if (workAssignment && workAssignment.currentWork && workAssignment.currentWork.workType === workType) {
        return true;
      }
    }
    
    return false;
  }
}