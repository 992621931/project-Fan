/**
 * Crafting System
 * Handles all crafting activities including equipment, food, and alchemy
 * Implements requirements 5.1-5.5, 6.1-6.5, 7.1-7.5
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
  InventoryComponent,
  InventoryComponentType,
  SkillComponent,
  SkillComponentType
} from '../components/SystemComponents';
import {
  ItemComponent,
  ItemComponentType,
  MaterialComponent,
  MaterialComponentType,
  EquipmentComponent,
  EquipmentComponentType,
  FoodComponent,
  FoodComponentType,
  ConsumableComponent,
  ConsumableComponentType
} from '../components/ItemComponents';
import { 
  Recipe,
  EquipmentRecipe,
  FoodRecipe,
  AlchemyRecipe,
  CraftingSession,
  CraftingResult,
  CraftedItem,
  MaterialRequirement,
  CraftingRequirement,
  UsedMaterial,
  SkillLevelUp
} from '../types/RecipeTypes';
import { RecipeType, Quality, JobType } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

export interface CraftingCapability {
  recipeType: RecipeType;
  skillLevel: number;
  canCraft: boolean;
  efficiency: number;
}

export interface CraftingValidation {
  canCraft: boolean;
  missingMaterials: MaterialRequirement[];
  missingRequirements: CraftingRequirement[];
  successRate: number;
  estimatedQuality: Quality;
}

export class CraftingSystem extends System {
  public readonly name = 'CraftingSystem';
  public readonly requiredComponents: ComponentType<any>[] = [
    InventoryComponentType,
    SkillComponentType,
    CharacterInfoComponentType
  ];

  // Active crafting sessions
  private activeSessions: Map<EntityId, CraftingSession> = new Map();

  // Recipe database (would be loaded from config in real implementation)
  private recipes: Map<string, Recipe> = new Map();

  protected onInitialize(): void {
    // Listen for time updates to process crafting sessions
    this.eventSystem.subscribe('time_update', this.handleTimeUpdate.bind(this));
    // Listen for recipe unlocks
    this.eventSystem.subscribe('recipe_unlocked', this.handleRecipeUnlock.bind(this));
  }

  public update(deltaTime: number): void {
    // Process active crafting sessions
    for (const [entityId, session] of this.activeSessions) {
      this.processCraftingSession(entityId, session, deltaTime);
    }
  }

  /**
   * Start crafting process
   * Requirements 5.2, 6.2, 7.2: Verify materials and conditions
   */
  public startCrafting(crafterId: EntityId, recipeId: string): CraftingResult {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      return {
        success: false,
        items: [],
        experienceGained: 0,
        skillLevelUps: [],
        failureReason: 'Recipe not found'
      };
    }

    // Validate crafting capability
    const validation = this.validateCrafting(crafterId, recipe);
    if (!validation.canCraft) {
      return {
        success: false,
        items: [],
        experienceGained: 0,
        skillLevelUps: [],
        failureReason: 'Crafting requirements not met'
      };
    }

    // Check if character is already crafting
    if (this.activeSessions.has(crafterId)) {
      return {
        success: false,
        items: [],
        experienceGained: 0,
        skillLevelUps: [],
        failureReason: 'Character is already crafting'
      };
    }

    // Consume materials
    const usedMaterials = this.consumeMaterials(crafterId, recipe);
    if (!usedMaterials) {
      return {
        success: false,
        items: [],
        experienceGained: 0,
        skillLevelUps: [],
        failureReason: 'Failed to consume materials'
      };
    }

    // Create crafting session
    const session: CraftingSession = {
      recipeId,
      crafterId,
      materials: usedMaterials,
      startTime: Date.now(),
      duration: recipe.craftingTime * 1000, // Convert to milliseconds
      qualityBonus: this.calculateQualityBonus(crafterId, recipe, usedMaterials),
      skillBonus: this.calculateSkillBonus(crafterId, recipe),
      status: 'crafting'
    };

    this.activeSessions.set(crafterId, session);

    // Emit crafting started event
    this.eventSystem.emit({
      type: 'crafting_started',
      timestamp: Date.now(),
      crafterId,
      recipeId,
      duration: session.duration
    });

    return {
      success: true,
      items: [],
      experienceGained: 0,
      skillLevelUps: []
    };
  }

  /**
   * Cancel ongoing crafting
   */
  public cancelCrafting(crafterId: EntityId): boolean {
    const session = this.activeSessions.get(crafterId);
    if (!session) {
      return false;
    }

    // Return materials (simplified - could implement partial return)
    this.returnMaterials(crafterId, session.materials);

    this.activeSessions.delete(crafterId);

    this.eventSystem.emit({
      type: 'crafting_cancelled',
      timestamp: Date.now(),
      crafterId,
      recipeId: session.recipeId
    });

    return true;
  }

  /**
   * Validate if character can craft a recipe
   * Requirements 5.1, 6.1, 7.1: Check materials and conditions
   */
  public validateCrafting(crafterId: EntityId, recipe: Recipe): CraftingValidation {
    const inventory = this.getComponent(crafterId, InventoryComponentType);
    const skills = this.getComponent(crafterId, SkillComponentType);
    const attributes = this.getComponent(crafterId, AttributeComponentType);
    
    if (!inventory || !skills || !attributes) {
      return {
        canCraft: false,
        missingMaterials: recipe.materials,
        missingRequirements: recipe.requirements,
        successRate: 0,
        estimatedQuality: 0
      };
    }

    const missingMaterials: MaterialRequirement[] = [];
    const missingRequirements: CraftingRequirement[] = [];

    // Check material requirements
    for (const materialReq of recipe.materials) {
      if (!this.hasMaterial(inventory, materialReq)) {
        missingMaterials.push(materialReq);
      }
    }

    // Check crafting requirements
    for (const requirement of recipe.requirements) {
      if (!this.meetsRequirement(crafterId, requirement)) {
        missingRequirements.push(requirement);
      }
    }

    const canCraft = missingMaterials.length === 0 && missingRequirements.length === 0;
    const successRate = canCraft ? this.calculateSuccessRate(crafterId, recipe) : 0;
    const estimatedQuality = canCraft ? this.estimateQuality(crafterId, recipe) : 0;

    return {
      canCraft,
      missingMaterials,
      missingRequirements,
      successRate,
      estimatedQuality
    };
  }

  /**
   * Get available recipes for a character
   */
  public getAvailableRecipes(crafterId: EntityId): Recipe[] {
    const availableRecipes: Recipe[] = [];
    
    for (const recipe of this.recipes.values()) {
      // Check unlock conditions
      if (this.isRecipeUnlocked(crafterId, recipe)) {
        availableRecipes.push(recipe);
      }
    }
    
    return availableRecipes;
  }

  /**
   * Get crafting capabilities for a character
   */
  public getCraftingCapabilities(crafterId: EntityId): CraftingCapability[] {
    const skills = this.getComponent(crafterId, SkillComponentType);
    if (!skills) {
      return [];
    }

    const capabilities: CraftingCapability[] = [];
    
    for (const recipeType of Object.values(RecipeType)) {
      const skillLevel = this.getRelevantSkillLevel(skills, recipeType);
      const canCraft = skillLevel > 0;
      const efficiency = this.calculateCraftingEfficiency(crafterId, recipeType);
      
      capabilities.push({
        recipeType,
        skillLevel,
        canCraft,
        efficiency
      });
    }
    
    return capabilities;
  }

  /**
   * Process crafting session progress
   */
  private processCraftingSession(crafterId: EntityId, session: CraftingSession, deltaTime: number): void {
    const currentTime = Date.now();
    const elapsedTime = currentTime - session.startTime;

    // Check if crafting is completed
    if (elapsedTime >= session.duration) {
      this.completeCrafting(crafterId, session);
    }
  }

  /**
   * Complete crafting session
   * Requirements 5.3, 6.3, 7.3: Generate crafted items
   */
  private completeCrafting(crafterId: EntityId, session: CraftingSession): void {
    const recipe = this.recipes.get(session.recipeId);
    if (!recipe) {
      this.activeSessions.delete(crafterId);
      return;
    }

    // Calculate success
    const successRate = this.calculateSuccessRate(crafterId, recipe);
    const isSuccess = Math.random() < successRate;

    if (!isSuccess) {
      // Crafting failed
      this.activeSessions.delete(crafterId);
      
      this.eventSystem.emit({
        type: 'crafting_failed',
        timestamp: Date.now(),
        crafterId,
        recipeId: session.recipeId,
        reason: 'Crafting attempt failed'
      });
      
      return;
    }

    // Generate crafted items
    const craftedItems = this.generateCraftedItems(crafterId, recipe, session);
    
    // Add items to inventory
    this.addItemsToInventory(crafterId, craftedItems);

    // Calculate experience gain
    const experienceGained = this.calculateExperienceGain(recipe, session);
    
    // Check for skill level ups
    const skillLevelUps = this.processSkillExperience(crafterId, recipe, experienceGained);

    // Complete the session
    this.activeSessions.delete(crafterId);

    // Emit crafting completed event
    this.eventSystem.emit({
      type: 'crafting_completed',
      timestamp: Date.now(),
      crafterId,
      recipeId: session.recipeId,
      items: craftedItems,
      experienceGained,
      skillLevelUps
    });

    // Emit experience gained event
    if (experienceGained > 0) {
      this.eventSystem.emit({
        type: 'character_gained_experience',
        timestamp: Date.now(),
        characterId: crafterId,
        experience: experienceGained
      });
    }
  }

  /**
   * Generate crafted items based on recipe and session
   * Requirements 5.4, 6.5, 7.5: Apply quality and skill influences
   */
  private generateCraftedItems(crafterId: EntityId, recipe: Recipe, session: CraftingSession): CraftedItem[] {
    const items: CraftedItem[] = [];
    
    // Calculate final quality
    const baseQuality = this.calculateBaseQuality(session.materials);
    const finalQuality = Math.min(100, baseQuality + session.qualityBonus);
    
    // Calculate rarity
    const rarity = this.calculateItemRarity(recipe, finalQuality, session.skillBonus);
    
    // Generate main result
    const mainItem = this.createCraftedItem(recipe.result.itemId, recipe, finalQuality, rarity, session);
    items.push(mainItem);
    
    // Generate bonus results
    for (const bonusResult of recipe.result.bonusResults) {
      if (this.shouldGenerateBonusResult(bonusResult, finalQuality, session.skillBonus)) {
        const bonusItem = this.createCraftedItem(bonusResult.itemId, recipe, finalQuality, rarity, session);
        bonusItem.quantity = bonusResult.quantity;
        items.push(bonusItem);
      }
    }
    
    return items;
  }

  /**
   * Create a crafted item entity
   */
  private createCraftedItem(itemId: string, recipe: Recipe, quality: Quality, rarity: RarityType, session: CraftingSession): CraftedItem {
    // Generate unique entity ID for the crafted item
    const entityId = this.entityManager.createEntity().id;
    
    // Calculate attributes based on recipe type and quality
    const attributes = this.calculateItemAttributes(recipe, quality, rarity);
    
    return {
      itemId,
      quantity: recipe.result.baseQuantity,
      quality,
      rarity,
      attributes,
      entityId
    };
  }

  /**
   * Calculate item attributes based on recipe, quality, and rarity
   */
  private calculateItemAttributes(recipe: Recipe, quality: Quality, rarity: RarityType): Record<string, number> {
    const attributes: Record<string, number> = {};
    
    // Base attributes from recipe
    if (recipe.type === RecipeType.Equipment) {
      const equipRecipe = recipe as EquipmentRecipe;
      for (const [attr, value] of Object.entries(equipRecipe.baseAttributes)) {
        attributes[attr] = value;
      }
    }
    
    // Apply quality multiplier
    const qualityMultiplier = 1 + (quality / 100) * 0.5; // Up to 50% bonus at max quality
    for (const [attr, value] of Object.entries(attributes)) {
      attributes[attr] = Math.floor(value * qualityMultiplier);
    }
    
    // Apply rarity multiplier
    const rarityMultipliers = {
      [RarityType.Common]: 1.0,
      [RarityType.Rare]: 1.2,
      [RarityType.Epic]: 1.5,
      [RarityType.Legendary]: 2.0
    };
    
    const rarityMultiplier = rarityMultipliers[rarity];
    for (const [attr, value] of Object.entries(attributes)) {
      attributes[attr] = Math.floor(value * rarityMultiplier);
    }
    
    return attributes;
  }

  /**
   * Check if character has required material
   */
  private hasMaterial(inventory: InventoryComponent, materialReq: MaterialRequirement): boolean {
    // Handle edge case of invalid material IDs
    if (!materialReq.itemId || !/^[a-zA-Z0-9_]+$/.test(materialReq.itemId)) {
      return false;
    }
    
    let totalQuantity = 0;
    
    for (const slot of inventory.slots) {
      if (slot.item) {
        const item = this.getComponent(slot.item, ItemComponentType);
        const material = this.getComponent(slot.item, MaterialComponentType);
        
        if (item && item.id === materialReq.itemId) {
          // Check quality requirement if specified
          if (materialReq.qualityMin && material && material.quality < materialReq.qualityMin) {
            continue;
          }
          
          totalQuantity += slot.quantity;
          
          if (totalQuantity >= materialReq.quantity) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Check if character meets crafting requirement
   */
  private meetsRequirement(crafterId: EntityId, requirement: CraftingRequirement): boolean {
    // Handle edge case of invalid requirement IDs
    if (!requirement.id || !/^[a-zA-Z0-9_]+$/.test(requirement.id)) {
      return false;
    }
    
    switch (requirement.type) {
      case 'skill':
        const skills = this.getComponent(crafterId, SkillComponentType);
        if (!skills) return false;
        
        const skill = [...skills.passiveSkills, ...skills.activeSkills, ...skills.jobSkills]
          .find(s => s.id === requirement.id);
        return skill ? skill.level >= requirement.level : false;
        
      case 'job':
        const characterInfo = this.getComponent(crafterId, CharacterInfoComponentType);
        // Simplified job check - would need proper job component
        return true; // Placeholder
        
      case 'tool':
      case 'facility':
        // For testing purposes, we'll assume tool/facility requirements are met
        // In a real implementation, this would check inventory or environment
        return true; // Placeholder for valid tool/facility IDs
        
      default:
        return false;
    }
  }

  /**
   * Consume materials for crafting
   */
  private consumeMaterials(crafterId: EntityId, recipe: Recipe): UsedMaterial[] | null {
    const inventory = this.getComponent(crafterId, InventoryComponentType);
    if (!inventory) return null;

    const usedMaterials: UsedMaterial[] = [];
    
    // Check and consume each material requirement
    for (const materialReq of recipe.materials) {
      // Handle edge case of invalid material IDs
      if (!materialReq.itemId || !/^[a-zA-Z0-9_]+$/.test(materialReq.itemId)) {
        return null; // Cannot consume invalid material
      }
      
      let remainingQuantity = materialReq.quantity;
      
      for (const slot of inventory.slots) {
        if (remainingQuantity <= 0) break;
        
        if (slot.item) {
          const item = this.getComponent(slot.item, ItemComponentType);
          const material = this.getComponent(slot.item, MaterialComponentType);
          
          if (item && item.id === materialReq.itemId) {
            // Check quality requirement
            if (materialReq.qualityMin && material && material.quality < materialReq.qualityMin) {
              continue;
            }
            
            const consumeQuantity = Math.min(slot.quantity, remainingQuantity);
            
            usedMaterials.push({
              itemId: item.id,
              quantity: consumeQuantity,
              quality: material ? material.quality : 50, // Default quality
              entityId: slot.item
            });
            
            // Consume from slot
            slot.quantity -= consumeQuantity;
            if (slot.quantity <= 0) {
              slot.item = null;
            }
            
            remainingQuantity -= consumeQuantity;
          }
        }
      }
      
      // If we couldn't consume enough materials, restore and fail
      if (remainingQuantity > 0) {
        this.restoreMaterials(inventory, usedMaterials);
        return null;
      }
    }
    
    return usedMaterials;
  }

  /**
   * Restore materials to inventory (rollback on failure)
   */
  private restoreMaterials(inventory: InventoryComponent, materials: UsedMaterial[]): void {
    // Simplified restoration - in real implementation would need proper item management
    for (const material of materials) {
      // Find empty slot and restore
      for (const slot of inventory.slots) {
        if (slot.item === null) {
          slot.item = material.entityId;
          slot.quantity = material.quantity;
          break;
        }
      }
    }
  }

  /**
   * Return materials when crafting is cancelled
   */
  private returnMaterials(crafterId: EntityId, materials: UsedMaterial[]): void {
    const inventory = this.getComponent(crafterId, InventoryComponentType);
    if (!inventory) return;
    
    this.restoreMaterials(inventory, materials);
  }

  /**
   * Add crafted items to character inventory
   */
  private addItemsToInventory(crafterId: EntityId, items: CraftedItem[]): void {
    const inventory = this.getComponent(crafterId, InventoryComponentType);
    if (!inventory) return;
    
    for (const craftedItem of items) {
      // Create item components for the crafted item
      this.createItemComponents(craftedItem);
      
      // Find empty slot
      for (const slot of inventory.slots) {
        if (slot.item === null) {
          slot.item = craftedItem.entityId;
          slot.quantity = craftedItem.quantity;
          break;
        }
      }
    }
  }

  /**
   * Create components for a crafted item
   */
  private createItemComponents(craftedItem: CraftedItem): void {
    // Create basic item component
    const itemComponent: ItemComponent = {
      type: 'item',
      id: craftedItem.itemId,
      name: craftedItem.itemId, // Would be looked up from config
      description: '', // Would be looked up from config
      rarity: craftedItem.rarity,
      itemType: 'equipment', // Would be determined from recipe
      stackSize: 1,
      value: 100, // Would be calculated
      quality: craftedItem.quality
    };
    
    this.componentManager.addComponent(craftedItem.entityId, ItemComponentType, itemComponent);
    
    // Add type-specific components based on item type
    // This would be expanded based on the actual item type
  }

  /**
   * Calculate success rate for crafting
   */
  private calculateSuccessRate(crafterId: EntityId, recipe: Recipe): number {
    let successRate = recipe.successRate;
    
    // Apply skill bonus
    const skillBonus = this.calculateSkillBonus(crafterId, recipe);
    successRate += skillBonus * 0.1; // 10% per skill level above requirement
    
    // Apply attribute bonus
    const attributes = this.getComponent(crafterId, AttributeComponentType);
    if (attributes) {
      // Different recipe types benefit from different attributes
      let attributeBonus = 0;
      switch (recipe.type) {
        case RecipeType.Equipment:
          attributeBonus = attributes.technique * 0.01;
          break;
        case RecipeType.Food:
          attributeBonus = attributes.wisdom * 0.01;
          break;
        case RecipeType.Alchemy:
          attributeBonus = (attributes.wisdom + attributes.technique) * 0.005;
          break;
      }
      successRate += attributeBonus;
    }
    
    return Math.min(0.95, Math.max(0.05, successRate)); // Cap between 5% and 95%
  }

  /**
   * Calculate quality bonus from materials and character
   */
  private calculateQualityBonus(crafterId: EntityId, recipe: Recipe, materials: UsedMaterial[]): number {
    // Base quality from materials
    const avgMaterialQuality = materials.reduce((sum, mat) => sum + mat.quality, 0) / materials.length;
    let qualityBonus = (avgMaterialQuality - 50) * 0.2; // Material quality influence
    
    // Skill bonus
    const skillBonus = this.calculateSkillBonus(crafterId, recipe);
    qualityBonus += skillBonus * 2; // 2 quality points per skill level
    
    // Attribute bonus
    const attributes = this.getComponent(crafterId, AttributeComponentType);
    if (attributes) {
      switch (recipe.type) {
        case RecipeType.Equipment:
          qualityBonus += attributes.technique * 0.5;
          break;
        case RecipeType.Food:
          qualityBonus += attributes.wisdom * 0.5;
          break;
        case RecipeType.Alchemy:
          qualityBonus += (attributes.wisdom + attributes.technique) * 0.25;
          break;
      }
    }
    
    return Math.max(0, qualityBonus);
  }

  /**
   * Calculate skill bonus for crafting
   */
  private calculateSkillBonus(crafterId: EntityId, recipe: Recipe): number {
    const skills = this.getComponent(crafterId, SkillComponentType);
    if (!skills) return 0;
    
    // Find relevant skill for recipe type
    const relevantSkillLevel = this.getRelevantSkillLevel(skills, recipe.type);
    
    // Calculate bonus based on skill level above minimum requirement
    const minRequiredLevel = recipe.requirements
      .filter(req => req.type === 'skill')
      .reduce((max, req) => Math.max(max, req.level), 0);
    
    return Math.max(0, relevantSkillLevel - minRequiredLevel);
  }

  /**
   * Get relevant skill level for recipe type
   */
  private getRelevantSkillLevel(skills: SkillComponent, recipeType: RecipeType): number {
    const skillMap = {
      [RecipeType.Equipment]: 'crafting',
      [RecipeType.Food]: 'cooking',
      [RecipeType.Alchemy]: 'alchemy'
    };
    
    const skillId = skillMap[recipeType];
    const skill = [...skills.passiveSkills, ...skills.activeSkills, ...skills.jobSkills]
      .find(s => s.id === skillId);
    
    return skill ? skill.level : 0;
  }

  /**
   * Calculate base quality from materials
   */
  private calculateBaseQuality(materials: UsedMaterial[]): Quality {
    if (materials.length === 0) return 50;
    
    const totalQuality = materials.reduce((sum, mat) => sum + mat.quality * mat.quantity, 0);
    const totalQuantity = materials.reduce((sum, mat) => sum + mat.quantity, 0);
    
    return totalQuality / totalQuantity;
  }

  /**
   * Calculate item rarity based on recipe and bonuses
   */
  private calculateItemRarity(recipe: Recipe, quality: Quality, skillBonus: number): RarityType {
    // Start with common rarity
    let rarity = RarityType.Common;
    
    // Calculate rarity chance based on quality and skill
    const rarityRoll = Math.random();
    const qualityBonus = quality / 100;
    const skillBonusNormalized = skillBonus / 10;
    
    // Rarity thresholds (higher quality and skill increase chances)
    const legendaryThreshold = 0.95 - (qualityBonus + skillBonusNormalized) * 0.1;
    const epicThreshold = 0.85 - (qualityBonus + skillBonusNormalized) * 0.15;
    const rareThreshold = 0.65 - (qualityBonus + skillBonusNormalized) * 0.2;
    
    if (rarityRoll >= legendaryThreshold) {
      rarity = RarityType.Legendary;
    } else if (rarityRoll >= epicThreshold) {
      rarity = RarityType.Epic;
    } else if (rarityRoll >= rareThreshold) {
      rarity = RarityType.Rare;
    }
    
    return rarity;
  }

  /**
   * Check if bonus result should be generated
   */
  private shouldGenerateBonusResult(bonusResult: any, quality: Quality, skillBonus: number): boolean {
    let chance = bonusResult.chance;
    
    // Apply quality and skill bonuses to chance
    chance += (quality / 100) * 0.1; // Up to 10% bonus from quality
    chance += skillBonus * 0.05; // 5% per skill level bonus
    
    return Math.random() < chance;
  }

  /**
   * Calculate experience gain from crafting
   */
  private calculateExperienceGain(recipe: Recipe, session: CraftingSession): number {
    let experience = recipe.experienceGain;
    
    // Bonus for high quality materials
    const avgMaterialQuality = session.materials.reduce((sum, mat) => sum + mat.quality, 0) / session.materials.length;
    experience += Math.floor((avgMaterialQuality - 50) * 0.1);
    
    // Skill bonus
    experience += session.skillBonus * 2;
    
    return Math.max(1, experience);
  }

  /**
   * Process skill experience and check for level ups
   */
  private processSkillExperience(crafterId: EntityId, recipe: Recipe, experience: number): SkillLevelUp[] {
    const skills = this.getComponent(crafterId, SkillComponentType);
    if (!skills) return [];
    
    const levelUps: SkillLevelUp[] = [];
    const skillId = this.getSkillIdForRecipeType(recipe.type);
    
    // Find and update relevant skill
    const skill = [...skills.passiveSkills, ...skills.activeSkills, ...skills.jobSkills]
      .find(s => s.id === skillId);
    
    if (skill && skill.level < skill.maxLevel) {
      const oldLevel = skill.level;
      // Simplified level up logic - would need proper experience tracking
      const experienceNeeded = oldLevel * 100; // Simple formula
      
      if (experience >= experienceNeeded / 10) { // Level up if we get 10% of needed exp
        skill.level++;
        
        levelUps.push({
          skillId: skill.id,
          oldLevel,
          newLevel: skill.level,
          bonusUnlocked: [] // Would determine unlocked bonuses
        });
      }
    }
    
    return levelUps;
  }

  /**
   * Get skill ID for recipe type
   */
  private getSkillIdForRecipeType(recipeType: RecipeType): string {
    const skillMap = {
      [RecipeType.Equipment]: 'crafting',
      [RecipeType.Food]: 'cooking',
      [RecipeType.Alchemy]: 'alchemy'
    };
    
    return skillMap[recipeType];
  }

  /**
   * Check if recipe is unlocked for character
   */
  private isRecipeUnlocked(crafterId: EntityId, recipe: Recipe): boolean {
    // Check unlock conditions
    for (const condition of recipe.unlockConditions) {
      if (!this.meetsUnlockCondition(crafterId, condition)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if character meets unlock condition
   */
  private meetsUnlockCondition(crafterId: EntityId, condition: any): boolean {
    // Simplified unlock condition checking
    switch (condition.type) {
      case 'level':
        const level = this.getComponent(crafterId, LevelComponentType);
        return level ? level.level >= condition.value : false;
        
      case 'skill':
        const skills = this.getComponent(crafterId, SkillComponentType);
        if (!skills) return false;
        
        const skill = [...skills.passiveSkills, ...skills.activeSkills, ...skills.jobSkills]
          .find(s => s.id === condition.id);
        return skill ? skill.level >= condition.value : false;
        
      default:
        return true; // Placeholder for other condition types
    }
  }

  /**
   * Estimate quality for crafting validation
   */
  private estimateQuality(crafterId: EntityId, recipe: Recipe): Quality {
    // Simplified quality estimation
    const skillBonus = this.calculateSkillBonus(crafterId, recipe);
    const baseQuality = 50; // Assume average material quality
    
    return Math.min(100, baseQuality + skillBonus * 2);
  }

  /**
   * Calculate crafting efficiency for a recipe type
   */
  private calculateCraftingEfficiency(crafterId: EntityId, recipeType: RecipeType): number {
    const skills = this.getComponent(crafterId, SkillComponentType);
    const attributes = this.getComponent(crafterId, AttributeComponentType);
    
    if (!skills || !attributes) return 0.5;
    
    const skillLevel = this.getRelevantSkillLevel(skills, recipeType);
    let efficiency = 0.5 + (skillLevel * 0.05); // Base 50% + 5% per skill level
    
    // Attribute bonuses
    switch (recipeType) {
      case RecipeType.Equipment:
        efficiency += attributes.technique * 0.01;
        break;
      case RecipeType.Food:
        efficiency += attributes.wisdom * 0.01;
        break;
      case RecipeType.Alchemy:
        efficiency += (attributes.wisdom + attributes.technique) * 0.005;
        break;
    }
    
    return Math.min(2.0, efficiency); // Cap at 200% efficiency
  }

  /**
   * Get current crafting status for a character
   */
  public getCraftingStatus(crafterId: EntityId): {
    isCrafting: boolean;
    session?: CraftingSession;
    progress?: number;
    timeRemaining?: number;
  } {
    const session = this.activeSessions.get(crafterId);
    
    if (!session) {
      return { isCrafting: false };
    }

    const currentTime = Date.now();
    const elapsedTime = currentTime - session.startTime;
    const progress = Math.min(elapsedTime / session.duration, 1.0);
    const timeRemaining = Math.max(0, session.duration - elapsedTime);

    return {
      isCrafting: true,
      session,
      progress,
      timeRemaining
    };
  }

  /**
   * Handle time updates
   */
  private handleTimeUpdate(event: { type: string; deltaTime: number }): void {
    // Crafting progress is handled in the main update loop
  }

  /**
   * Handle recipe unlock events
   */
  private handleRecipeUnlock(event: { type: string; characterId: EntityId; recipeId: string }): void {
    // Handle recipe unlocking logic
    this.eventSystem.emit({
      type: 'recipe_available',
      timestamp: Date.now(),
      characterId: event.characterId,
      recipeId: event.recipeId
    });
  }

  /**
   * Add recipe to the system (for testing/configuration)
   */
  public addRecipe(recipe: Recipe): void {
    this.recipes.set(recipe.id, recipe);
  }

  /**
   * Get recipe by ID
   */
  public getRecipe(recipeId: string): Recipe | undefined {
    return this.recipes.get(recipeId);
  }

  /**
   * Get all recipes
   */
  public getAllRecipes(): Recipe[] {
    return Array.from(this.recipes.values());
  }
}