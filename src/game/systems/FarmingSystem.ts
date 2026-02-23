/**
 * Farming System
 * Handles crop planting, growth cycles, and harvesting
 * Implements requirements 11.1-11.5
 */

import { System } from '../../ecs/System';
import { ComponentType } from '../../ecs/Component';
import { EntityId } from '../../ecs/Entity';
import { 
  FarmComponent,
  FarmComponentType,
  FarmPlot,
  InventoryComponent,
  InventoryComponentType
} from '../components/SystemComponents';
import { ItemComponent, ItemComponentType } from '../components/ItemComponents';
import { Season, ItemType } from '../types/GameTypes';
import { RarityType } from '../types/RarityTypes';

export interface Crop {
  id: string;
  name: string;
  description: string;
  seedItemId: string;
  harvestItemId: string;
  growthTime: number; // in milliseconds
  seasons: Season[];
  baseYield: number;
  qualityMultiplier: number;
  fertilizerBonus: number;
  waterRequirement: number; // per growth stage
  soilQualityRequirement: number; // minimum soil quality needed
}

export interface PlantingResult {
  success: boolean;
  plotId?: number;
  cropId?: string;
  estimatedHarvestTime?: number;
  error?: string;
}

export interface HarvestResult {
  success: boolean;
  plotId?: number;
  items?: HarvestItem[];
  experience?: number;
  error?: string;
}

export interface HarvestItem {
  itemId: string;
  quantity: number;
  quality: number;
}

export interface FertilizerEffect {
  growthSpeedMultiplier: number;
  yieldMultiplier: number;
  qualityBonus: number;
  duration: number; // in milliseconds
}

export class FarmingSystem extends System {
  public readonly name = 'FarmingSystem';
  public readonly requiredComponents: ComponentType<any>[] = [
    FarmComponentType
  ];

  // Current season (simplified - in real game would be managed by time system)
  private currentSeason: Season = Season.Spring;

  // Crop definitions
  private crops: Record<string, Crop> = {
    wheat: {
      id: 'wheat',
      name: '小麦',
      description: '基础粮食作物',
      seedItemId: 'wheat_seed',
      harvestItemId: 'wheat',
      growthTime: 300000, // 5 minutes for testing
      seasons: [Season.Spring, Season.Summer],
      baseYield: 3,
      qualityMultiplier: 1.0,
      fertilizerBonus: 0.5,
      waterRequirement: 20,
      soilQualityRequirement: 30
    },
    potato: {
      id: 'potato',
      name: '土豆',
      description: '营养丰富的块茎作物',
      seedItemId: 'potato_seed',
      harvestItemId: 'potato',
      growthTime: 240000, // 4 minutes
      seasons: [Season.Spring, Season.Autumn],
      baseYield: 4,
      qualityMultiplier: 1.2,
      fertilizerBonus: 0.3,
      waterRequirement: 15,
      soilQualityRequirement: 20
    },
    carrot: {
      id: 'carrot',
      name: '胡萝卜',
      description: '橙色的根茎蔬菜',
      seedItemId: 'carrot_seed',
      harvestItemId: 'carrot',
      growthTime: 180000, // 3 minutes
      seasons: [Season.Summer, Season.Autumn],
      baseYield: 2,
      qualityMultiplier: 0.8,
      fertilizerBonus: 0.7,
      waterRequirement: 25,
      soilQualityRequirement: 40
    },
    herb: {
      id: 'herb',
      name: '草药',
      description: '用于炼金的神秘植物',
      seedItemId: 'herb_seed',
      harvestItemId: 'herb',
      growthTime: 420000, // 7 minutes
      seasons: [Season.Spring, Season.Summer, Season.Autumn],
      baseYield: 1,
      qualityMultiplier: 2.0,
      fertilizerBonus: 1.0,
      waterRequirement: 30,
      soilQualityRequirement: 60
    },
    rare_flower: {
      id: 'rare_flower',
      name: '稀有花朵',
      description: '美丽而珍贵的观赏植物',
      seedItemId: 'rare_flower_seed',
      harvestItemId: 'rare_flower',
      growthTime: 600000, // 10 minutes
      seasons: [Season.Spring],
      baseYield: 1,
      qualityMultiplier: 3.0,
      fertilizerBonus: 1.5,
      waterRequirement: 40,
      soilQualityRequirement: 80
    }
  };

  // Fertilizer effects
  private fertilizers: Record<string, FertilizerEffect> = {
    basic_fertilizer: {
      growthSpeedMultiplier: 1.2,
      yieldMultiplier: 1.1,
      qualityBonus: 5,
      duration: 600000 // 10 minutes
    },
    premium_fertilizer: {
      growthSpeedMultiplier: 1.5,
      yieldMultiplier: 1.3,
      qualityBonus: 15,
      duration: 900000 // 15 minutes
    },
    magical_fertilizer: {
      growthSpeedMultiplier: 2.0,
      yieldMultiplier: 1.5,
      qualityBonus: 25,
      duration: 1200000 // 20 minutes
    }
  };

  protected onInitialize(): void {
    // Listen for time updates to process crop growth
    this.eventSystem.subscribe('time_update', this.handleTimeUpdate.bind(this));
    // Listen for season changes
    this.eventSystem.subscribe('season_changed', this.handleSeasonChange.bind(this));
  }

  public update(deltaTime: number): void {
    const entities = this.getEntities();
    
    for (const entityId of entities) {
      this.processCropGrowth(entityId, deltaTime);
      this.updatePlotConditions(entityId, deltaTime);
    }
  }

  /**
   * Plant a crop in a specific plot
   * Requirement 11.1: Consume seed and start growth timer
   */
  public plantCrop(farmId: EntityId, plotId: number, cropId: string, seedItemId: EntityId): PlantingResult {
    const farm = this.getComponent(farmId, FarmComponentType);
    const inventory = this.getComponent(farmId, InventoryComponentType);
    
    if (!farm || !inventory) {
      return {
        success: false,
        error: 'Farm or inventory component not found'
      };
    }

    // Validate plot
    if (plotId < 0 || plotId >= farm.plots.length) {
      return {
        success: false,
        error: 'Invalid plot ID'
      };
    }

    const plot = farm.plots[plotId];
    if (plot.crop !== null) {
      return {
        success: false,
        error: 'Plot is already occupied'
      };
    }

    // Validate crop
    const crop = this.crops[cropId];
    if (!crop) {
      return {
        success: false,
        error: 'Unknown crop type'
      };
    }

    // Check season compatibility
    if (!crop.seasons.includes(this.currentSeason)) {
      return {
        success: false,
        error: `${crop.name} cannot be planted in ${this.currentSeason}`
      };
    }

    // Check soil quality requirement
    if (plot.fertility < crop.soilQualityRequirement) {
      return {
        success: false,
        error: `Soil quality too low for ${crop.name} (need ${crop.soilQualityRequirement}, have ${plot.fertility})`
      };
    }

    // Check if player has the seed
    const seedSlot = inventory.slots.find(slot => slot.item === seedItemId && slot.quantity > 0);
    if (!seedSlot) {
      return {
        success: false,
        error: 'No seeds available'
      };
    }

    // Plant the crop
    const currentTime = Date.now();
    plot.crop = seedItemId; // Store seed item ID for reference
    plot.plantTime = currentTime;
    plot.growthStage = 0;
    plot.waterLevel = Math.max(plot.waterLevel, 50); // Planting provides some water

    // Consume seed
    seedSlot.quantity -= 1;
    if (seedSlot.quantity === 0) {
      seedSlot.item = null;
    }

    const estimatedHarvestTime = currentTime + crop.growthTime;

    // Emit planting event
    this.eventSystem.emit({
      type: 'crop_planted',
      timestamp: currentTime,
      farmId,
      plotId,
      cropId,
      estimatedHarvestTime
    });

    return {
      success: true,
      plotId,
      cropId,
      estimatedHarvestTime
    };
  }

  /**
   * Harvest a mature crop
   * Requirement 11.2: Allow harvest when crop is mature and generate resources
   */
  public harvestCrop(farmId: EntityId, plotId: number): HarvestResult {
    const farm = this.getComponent(farmId, FarmComponentType);
    const inventory = this.getComponent(farmId, InventoryComponentType);
    
    if (!farm || !inventory) {
      return {
        success: false,
        error: 'Farm or inventory component not found'
      };
    }

    // Validate plot
    if (plotId < 0 || plotId >= farm.plots.length) {
      return {
        success: false,
        error: 'Invalid plot ID'
      };
    }

    const plot = farm.plots[plotId];
    if (plot.crop === null) {
      return {
        success: false,
        error: 'No crop planted in this plot'
      };
    }

    if (plot.growthStage < 4) {
      return {
        success: false,
        error: 'Crop is not ready for harvest'
      };
    }

    // Find the crop type by matching seed item
    const cropType = this.findCropBySeedItem(plot.crop as string);
    if (!cropType) {
      return {
        success: false,
        error: 'Unknown crop type'
      };
    }

    const crop = this.crops[cropType];

    // Calculate harvest yield
    const harvestItems = this.calculateHarvestYield(crop, plot, farm.soilQuality);
    
    // Add items to inventory
    for (const harvestItem of harvestItems) {
      this.addItemToInventory(inventory, harvestItem.itemId, harvestItem.quantity);
    }

    // Calculate experience gain
    const experience = Math.floor(crop.baseYield * 5 * (1 + plot.fertility / 100));

    // Clear the plot
    plot.crop = null;
    plot.plantTime = 0;
    plot.growthStage = 0;
    plot.fertilized = false;
    
    // Reduce plot fertility slightly
    plot.fertility = Math.max(10, plot.fertility - 5);

    // Emit harvest event
    this.eventSystem.emit({
      type: 'crop_harvested',
      timestamp: Date.now(),
      farmId,
      plotId,
      cropId: cropType,
      items: harvestItems,
      experience
    });

    return {
      success: true,
      plotId,
      items: harvestItems,
      experience
    };
  }

  /**
   * Apply fertilizer to a plot
   * Requirement 11.3: Fertilizer effects accelerate growth and improve yield
   */
  public applyFertilizer(farmId: EntityId, plotId: number, fertilizerItemId: EntityId): boolean {
    const farm = this.getComponent(farmId, FarmComponentType);
    const inventory = this.getComponent(farmId, InventoryComponentType);
    
    if (!farm || !inventory) {
      return false;
    }

    // Validate plot
    if (plotId < 0 || plotId >= farm.plots.length) {
      return false;
    }

    const plot = farm.plots[plotId];
    if (plot.crop === null) {
      return false; // No crop to fertilize
    }

    // Check if fertilizer is available
    const fertilizerSlot = inventory.slots.find(slot => slot.item === fertilizerItemId && slot.quantity > 0);
    if (!fertilizerSlot) {
      return false;
    }

    // Apply fertilizer effect
    plot.fertilized = true;
    plot.fertility = Math.min(100, plot.fertility + 10); // Improve soil quality

    // Consume fertilizer
    fertilizerSlot.quantity -= 1;
    if (fertilizerSlot.quantity === 0) {
      fertilizerSlot.item = null;
    }

    // Emit fertilizer applied event
    this.eventSystem.emit({
      type: 'fertilizer_applied',
      timestamp: Date.now(),
      farmId,
      plotId,
      fertilizerItemId
    });

    return true;
  }

  /**
   * Water a plot
   */
  public waterPlot(farmId: EntityId, plotId: number): boolean {
    const farm = this.getComponent(farmId, FarmComponentType);
    
    if (!farm) {
      return false;
    }

    // Validate plot
    if (plotId < 0 || plotId >= farm.plots.length) {
      return false;
    }

    const plot = farm.plots[plotId];
    plot.waterLevel = Math.min(100, plot.waterLevel + 30);

    // Emit watering event
    this.eventSystem.emit({
      type: 'plot_watered',
      timestamp: Date.now(),
      farmId,
      plotId
    });

    return true;
  }

  /**
   * Get farm status and plot information
   */
  public getFarmStatus(farmId: EntityId): {
    plots: Array<{
      id: number;
      crop: string | null;
      growthStage: number;
      growthProgress: number;
      fertility: number;
      waterLevel: number;
      fertilized: boolean;
      readyToHarvest: boolean;
      estimatedHarvestTime?: number;
    }>;
    soilQuality: number;
    totalPlots: number;
    activePlots: number;
  } | null {
    const farm = this.getComponent(farmId, FarmComponentType);
    
    if (!farm) {
      return null;
    }

    const currentTime = Date.now();
    const plotsInfo = farm.plots.map((plot, index) => {
      let cropType: string | null = null;
      let growthProgress = 0;
      let readyToHarvest = false;
      let estimatedHarvestTime: number | undefined;

      if (plot.crop) {
        cropType = this.findCropBySeedItem(plot.crop as string);
        if (cropType) {
          const crop = this.crops[cropType];
          const elapsedTime = currentTime - plot.plantTime;
          growthProgress = Math.min(1, elapsedTime / crop.growthTime);
          readyToHarvest = plot.growthStage >= 4;
          estimatedHarvestTime = plot.plantTime + crop.growthTime;
        }
      }

      return {
        id: index,
        crop: cropType,
        growthStage: plot.growthStage,
        growthProgress,
        fertility: plot.fertility,
        waterLevel: plot.waterLevel,
        fertilized: plot.fertilized,
        readyToHarvest,
        estimatedHarvestTime
      };
    });

    const activePlots = plotsInfo.filter(plot => plot.crop !== null).length;

    return {
      plots: plotsInfo,
      soilQuality: farm.soilQuality,
      totalPlots: farm.plots.length,
      activePlots
    };
  }

  /**
   * Get available crops for current season
   */
  public getAvailableCrops(): Crop[] {
    return Object.values(this.crops).filter(crop => 
      crop.seasons.includes(this.currentSeason)
    );
  }

  /**
   * Set current season
   * Requirement 11.5: Season changes affect crop growth and availability
   */
  public setCurrentSeason(season: Season): void {
    const previousSeason = this.currentSeason;
    this.currentSeason = season;

    // Emit season change event
    this.eventSystem.emit({
      type: 'season_changed',
      timestamp: Date.now(),
      previousSeason,
      newSeason: season
    });
  }

  /**
   * Process crop growth for all plots in a farm
   */
  private processCropGrowth(farmId: EntityId, deltaTime: number): void {
    const farm = this.getComponent(farmId, FarmComponentType);
    
    if (!farm) {
      return;
    }

    const currentTime = Date.now();

    for (let i = 0; i < farm.plots.length; i++) {
      const plot = farm.plots[i];
      
      if (plot.crop === null) {
        continue;
      }

      const cropType = this.findCropBySeedItem(plot.crop as string);
      if (!cropType) {
        continue;
      }

      const crop = this.crops[cropType];
      const elapsedTime = currentTime - plot.plantTime;
      
      // Calculate growth progress
      let growthMultiplier = 1.0;
      
      // Season effect
      if (!crop.seasons.includes(this.currentSeason)) {
        growthMultiplier *= 0.5; // Slower growth in wrong season
      }

      // Fertilizer effect
      if (plot.fertilized) {
        growthMultiplier *= 1.3;
      }

      // Water effect
      if (plot.waterLevel < crop.waterRequirement) {
        growthMultiplier *= 0.7; // Slower growth without enough water
      }

      // Soil quality effect
      const soilBonus = Math.max(0.5, plot.fertility / 100);
      growthMultiplier *= soilBonus;

      const adjustedGrowthTime = crop.growthTime / growthMultiplier;
      const growthProgress = elapsedTime / adjustedGrowthTime;

      // Update growth stage
      const newGrowthStage = Math.min(4, Math.floor(growthProgress * 5));
      
      if (newGrowthStage > plot.growthStage) {
        plot.growthStage = newGrowthStage;
        
        // Consume water as crop grows
        plot.waterLevel = Math.max(0, plot.waterLevel - crop.waterRequirement / 5);
        
        // Emit growth stage change event
        this.eventSystem.emit({
          type: 'crop_growth_stage_changed',
          timestamp: currentTime,
          farmId,
          plotId: i,
          cropId: cropType,
          newStage: newGrowthStage,
          readyToHarvest: newGrowthStage >= 4
        });
      }
    }
  }

  /**
   * Update plot conditions over time
   */
  private updatePlotConditions(farmId: EntityId, deltaTime: number): void {
    const farm = this.getComponent(farmId, FarmComponentType);
    
    if (!farm) {
      return;
    }

    // Gradually decrease water levels
    for (const plot of farm.plots) {
      plot.waterLevel = Math.max(0, plot.waterLevel - (deltaTime / 60000)); // 1 point per minute
      
      // Slowly improve soil quality if not being used
      if (plot.crop === null) {
        plot.fertility = Math.min(100, plot.fertility + (deltaTime / 300000)); // 1 point per 5 minutes
      }
    }
  }

  /**
   * Calculate harvest yield based on various factors
   * Requirement 11.4: Seed quality and planting skill affect harvest quantity
   */
  private calculateHarvestYield(crop: Crop, plot: FarmPlot, farmSoilQuality: number): HarvestItem[] {
    let baseYield = crop.baseYield;
    let qualityMultiplier = crop.qualityMultiplier;

    // Fertilizer bonus
    if (plot.fertilized) {
      baseYield *= (1 + crop.fertilizerBonus);
      qualityMultiplier += 0.2;
    }

    // Water level effect
    const waterEfficiency = Math.min(1, plot.waterLevel / crop.waterRequirement);
    baseYield *= (0.5 + 0.5 * waterEfficiency);

    // Soil quality effect
    const soilBonus = (plot.fertility + farmSoilQuality) / 200; // Average of plot and farm soil quality
    baseYield *= (0.7 + 0.6 * soilBonus);
    qualityMultiplier *= (0.8 + 0.4 * soilBonus);

    // Season effect
    if (!crop.seasons.includes(this.currentSeason)) {
      baseYield *= 0.6;
      qualityMultiplier *= 0.8;
    }

    // Calculate final yield
    const finalYield = Math.max(1, Math.floor(baseYield));
    const finalQuality = Math.max(10, Math.min(100, Math.floor(50 * qualityMultiplier)));

    return [{
      itemId: crop.harvestItemId,
      quantity: finalYield,
      quality: finalQuality
    }];
  }

  /**
   * Find crop type by seed item ID
   */
  private findCropBySeedItem(seedItemId: string): string | null {
    for (const [cropId, crop] of Object.entries(this.crops)) {
      if (crop.seedItemId === seedItemId) {
        return cropId;
      }
    }
    return null;
  }

  /**
   * Add item to inventory (simplified)
   */
  private addItemToInventory(inventory: InventoryComponent, itemId: string, quantity: number): void {
    // Find existing stack or empty slot
    let added = false;
    
    for (const slot of inventory.slots) {
      if (slot.item === itemId) {
        slot.quantity += quantity;
        added = true;
        break;
      } else if (slot.item === null) {
        slot.item = itemId as any; // Simplified for now
        slot.quantity = quantity;
        added = true;
        break;
      }
    }
    
    if (!added) {
      // Emit inventory full event
      this.eventSystem.emit({
        type: 'inventory_full',
        timestamp: Date.now(),
        itemId,
        quantity
      });
    }
  }

  /**
   * Handle time updates
   */
  private handleTimeUpdate(event: { type: string; deltaTime: number }): void {
    // Growth processing is handled in the main update loop
  }

  /**
   * Handle season changes
   */
  private handleSeasonChange(event: { type: string; newSeason: Season }): void {
    this.currentSeason = event.newSeason;
    
    // Notify about crops that are no longer in season
    const entities = this.getEntities();
    
    for (const entityId of entities) {
      const farm = this.getComponent(entityId, FarmComponentType);
      if (!farm) continue;

      for (let i = 0; i < farm.plots.length; i++) {
        const plot = farm.plots[i];
        if (plot.crop) {
          const cropType = this.findCropBySeedItem(plot.crop as string);
          if (cropType) {
            const crop = this.crops[cropType];
            if (!crop.seasons.includes(event.newSeason)) {
              this.eventSystem.emit({
                type: 'crop_out_of_season',
                timestamp: Date.now(),
                farmId: entityId,
                plotId: i,
                cropId: cropType
              });
            }
          }
        }
      }
    }
  }

  /**
   * Get crop information
   */
  public getCropInfo(cropId: string): Crop | null {
    return this.crops[cropId] || null;
  }

  /**
   * Get fertilizer information
   */
  public getFertilizerInfo(fertilizerId: string): FertilizerEffect | null {
    return this.fertilizers[fertilizerId] || null;
  }

  /**
   * Initialize a new farm with default plots
   */
  public initializeFarm(farmId: EntityId, plotCount: number = 6): boolean {
    const farm = this.getComponent(farmId, FarmComponentType);
    
    if (!farm) {
      return false;
    }

    // Initialize plots
    farm.plots = [];
    for (let i = 0; i < plotCount; i++) {
      farm.plots.push({
        id: i,
        crop: null,
        plantTime: 0,
        growthStage: 0,
        fertility: 50 + Math.random() * 30, // Random initial fertility 50-80
        waterLevel: 30 + Math.random() * 20, // Random initial water 30-50
        fertilized: false
      });
    }

    farm.soilQuality = 60; // Default soil quality
    farm.tools = [];
    farm.storage = [];

    return true;
  }
}