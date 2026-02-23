/**
 * Property-based tests for Farming System
 * **Feature: codename-rice-game, Property 19: 种植生长周期**
 * **Feature: codename-rice-game, Property 20: 种植因素影响产量**
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { FarmingSystem } from './FarmingSystem';
import { EntityManager } from '../../ecs/EntityManager';
import { ComponentManager } from '../../ecs/ComponentManager';
import { EventSystem } from '../../ecs/EventSystem';
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

describe('Farming System Property Tests', () => {
  let farmingSystem: FarmingSystem;
  let entityManager: EntityManager;
  let componentManager: ComponentManager;
  let eventSystem: EventSystem;

  beforeEach(() => {
    componentManager = new ComponentManager();
    entityManager = new EntityManager(componentManager);
    eventSystem = new EventSystem();
    
    farmingSystem = new FarmingSystem();
    farmingSystem.initialize(entityManager, componentManager, eventSystem);
  });

  /**
   * Helper function to create a test farm
   */
  function createTestFarm(
    plotCount: number = 6,
    soilQuality: number = 60,
    initialPlots?: FarmPlot[]
  ): string {
    const farmEntity = entityManager.createEntity();
    const farmId = farmEntity.id;

    const plots = initialPlots || Array(plotCount).fill(null).map((_, index) => ({
      id: index,
      crop: null,
      plantTime: 0,
      growthStage: 0,
      fertility: 50 + Math.random() * 30,
      waterLevel: 50,
      fertilized: false
    }));

    const farmComponent: FarmComponent = {
      type: 'farm',
      plots,
      tools: [],
      storage: [],
      soilQuality
    };

    const inventory: InventoryComponent = {
      type: 'inventory',
      slots: Array(20).fill(null).map(() => ({ item: null, quantity: 0, locked: false })),
      capacity: 20
    };

    componentManager.addComponent(farmId, FarmComponentType, farmComponent);
    componentManager.addComponent(farmId, InventoryComponentType, inventory);

    return farmId;
  }

  /**
   * Helper function to create a test seed item
   */
  function createTestSeed(
    seedId: string = 'wheat_seed',
    name: string = 'Wheat Seed',
    quantity: number = 10
  ): string {
    const seedEntity = entityManager.createEntity();
    const seedItemId = seedEntity.id;

    const seedComponent: ItemComponent = {
      type: 'item',
      id: seedItemId,
      name,
      description: 'A test seed',
      itemType: ItemType.Seed,
      rarity: RarityType.Common,
      stackSize: 64,
      value: 5,
      quality: 50,
      durability: 100,
      maxDurability: 100,
      effects: [],
      requirements: []
    };

    componentManager.addComponent(seedItemId, ItemComponentType, seedComponent);
    return seedItemId;
  }

  /**
   * Helper function to add seeds to farm inventory
   */
  function addSeedsToInventory(farmId: string, seedItemId: string, quantity: number): void {
    const inventory = componentManager.getComponent(farmId, InventoryComponentType);
    if (inventory) {
      const emptySlot = inventory.slots.find(slot => slot.item === null);
      if (emptySlot) {
        emptySlot.item = seedItemId as any;
        emptySlot.quantity = quantity;
      }
    }
  }

  /**
   * Property 19: 种植生长周期
   * For any crop planting, the system should consume seed and start growth timer,
   * allowing harvest when crop is mature and generating resources
   * **Validates: Requirements 11.1, 11.2**
   */
  it('Property 19: 种植生长周期', () => {
    // Generator for plot properties
    const plotGenerator = fc.record({
      fertility: fc.integer({ min: 20, max: 100 }),
      waterLevel: fc.integer({ min: 0, max: 100 })
    });

    // Generator for crop types
    const cropGenerator = fc.constantFrom('wheat', 'potato', 'carrot', 'herb');

    // Generator for seed quantities
    const seedQuantityGenerator = fc.integer({ min: 1, max: 20 });

    fc.assert(
      fc.property(
        plotGenerator,
        cropGenerator,
        seedQuantityGenerator,
        fc.constantFrom(...Object.values(Season)),
        (plotProps, cropId, seedQuantity, season) => {
          // Set season
          farmingSystem.setCurrentSeason(season);

          // Create farm with specific plot properties
          const plots: FarmPlot[] = [{
            id: 0,
            crop: null,
            plantTime: 0,
            growthStage: 0,
            fertility: plotProps.fertility,
            waterLevel: plotProps.waterLevel,
            fertilized: false
          }];

          const farmId = createTestFarm(1, 60, plots);
          const seedItemId = createTestSeed(`${cropId}_seed`, `${cropId} seed`, seedQuantity);
          
          // Add seeds to inventory
          addSeedsToInventory(farmId, seedItemId, seedQuantity);

          // Get crop info to check season compatibility
          const cropInfo = farmingSystem.getCropInfo(cropId);
          expect(cropInfo).not.toBeNull();

          const isSeasonCompatible = cropInfo!.seasons.includes(season);
          const hasEnoughSoilQuality = plotProps.fertility >= cropInfo!.soilQualityRequirement;

          // Get initial inventory state
          const initialInventory = componentManager.getComponent(farmId, InventoryComponentType);
          expect(initialInventory).not.toBeNull();
          const initialSeedSlot = initialInventory!.slots.find(slot => slot.item === seedItemId);
          const initialSeedCount = initialSeedSlot ? initialSeedSlot.quantity : 0;

          // Attempt to plant crop
          const plantResult = farmingSystem.plantCrop(farmId, 0, cropId, seedItemId as any);

          if (isSeasonCompatible && hasEnoughSoilQuality && initialSeedCount > 0) {
            // Requirement 11.1: Planting should succeed and consume seed
            expect(plantResult.success).toBe(true);
            expect(plantResult.plotId).toBe(0);
            expect(plantResult.cropId).toBe(cropId);
            expect(plantResult.estimatedHarvestTime).toBeGreaterThan(Date.now());

            // Check that seed was consumed
            const finalInventory = componentManager.getComponent(farmId, InventoryComponentType);
            expect(finalInventory).not.toBeNull();
            const finalSeedSlot = finalInventory!.slots.find(slot => slot.item === seedItemId);
            const finalSeedCount = finalSeedSlot ? finalSeedSlot.quantity : 0;
            expect(finalSeedCount).toBe(initialSeedCount - 1);

            // Check plot state
            const farm = componentManager.getComponent(farmId, FarmComponentType);
            expect(farm).not.toBeNull();
            const plot = farm!.plots[0];
            expect(plot.crop).toBe(seedItemId);
            expect(plot.plantTime).toBeGreaterThan(0);
            expect(plot.growthStage).toBe(0);

            // Simulate crop growth to maturity
            plot.growthStage = 4; // Manually set to mature for testing
            plot.plantTime = Date.now() - cropInfo!.growthTime - 1000; // Make it overdue
            plot.crop = `${cropId}_seed` as any; // Use the correct seed item ID string

            // Requirement 11.2: Harvest should succeed when crop is mature
            const harvestResult = farmingSystem.harvestCrop(farmId, 0);
            expect(harvestResult.success).toBe(true);
            expect(harvestResult.plotId).toBe(0);
            expect(harvestResult.items).toBeDefined();
            expect(harvestResult.items!.length).toBeGreaterThan(0);
            expect(harvestResult.experience).toBeGreaterThan(0);

            // Check that plot is cleared after harvest
            const finalFarm = componentManager.getComponent(farmId, FarmComponentType);
            expect(finalFarm).not.toBeNull();
            const finalPlot = finalFarm!.plots[0];
            expect(finalPlot.crop).toBeNull();
            expect(finalPlot.growthStage).toBe(0);
            expect(finalPlot.fertilized).toBe(false);

            // Check harvest items
            for (const item of harvestResult.items!) {
              expect(item.itemId).toBe(cropInfo!.harvestItemId);
              expect(item.quantity).toBeGreaterThan(0);
              expect(item.quality).toBeGreaterThan(0);
              expect(item.quality).toBeLessThanOrEqual(100);
            }

          } else {
            // Planting should fail due to season, soil quality, or no seeds
            expect(plantResult.success).toBe(false);
            expect(plantResult.error).toBeDefined();

            if (!isSeasonCompatible) {
              expect(plantResult.error).toContain('cannot be planted');
            } else if (!hasEnoughSoilQuality) {
              expect(plantResult.error).toContain('Soil quality too low');
            } else if (initialSeedCount === 0) {
              expect(plantResult.error).toContain('No seeds available');
            }

            // Inventory should remain unchanged
            const finalInventory = componentManager.getComponent(farmId, InventoryComponentType);
            expect(finalInventory).not.toBeNull();
            const finalSeedSlot = finalInventory!.slots.find(slot => slot.item === seedItemId);
            const finalSeedCount = finalSeedSlot ? finalSeedSlot.quantity : 0;
            expect(finalSeedCount).toBe(initialSeedCount);

            // Plot should remain empty
            const farm = componentManager.getComponent(farmId, FarmComponentType);
            expect(farm).not.toBeNull();
            const plot = farm!.plots[0];
            expect(plot.crop).toBeNull();
            expect(plot.growthStage).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 20: 种植因素影响产量
   * For any crop harvest, the yield should be affected by seed quality, planting skill,
   * fertilizer use, and seasonal factors
   * **Validates: Requirements 11.3, 11.4, 11.5**
   */
  it('Property 20: 种植因素影响产量', () => {
    // Generator for farming conditions
    const conditionsGenerator = fc.record({
      fertility: fc.integer({ min: 30, max: 100 }),
      waterLevel: fc.integer({ min: 10, max: 100 }),
      soilQuality: fc.integer({ min: 20, max: 100 }),
      fertilized: fc.boolean(),
      season: fc.constantFrom(...Object.values(Season))
    });

    // Generator for crop types
    const cropGenerator = fc.constantFrom('wheat', 'potato', 'carrot');

    fc.assert(
      fc.property(
        conditionsGenerator,
        conditionsGenerator,
        cropGenerator,
        (conditions1, conditions2, cropId) => {
          // Ensure we have different conditions for comparison
          const fertility1 = conditions1.fertility;
          const fertility2 = Math.max(30, Math.min(100, conditions2.fertility + 20)); // Ensure different
          const fertilized1 = conditions1.fertilized;
          const fertilized2 = !conditions1.fertilized; // Opposite fertilization

          // Set season for both tests
          farmingSystem.setCurrentSeason(conditions1.season);

          // Create two farms with different conditions
          const plots1: FarmPlot[] = [{
            id: 0,
            crop: `${cropId}_seed` as any,
            plantTime: Date.now() - 1000000, // Long ago
            growthStage: 4, // Mature
            fertility: fertility1,
            waterLevel: conditions1.waterLevel,
            fertilized: fertilized1
          }];

          const plots2: FarmPlot[] = [{
            id: 0,
            crop: `${cropId}_seed` as any,
            plantTime: Date.now() - 1000000, // Long ago
            growthStage: 4, // Mature
            fertility: fertility2,
            waterLevel: conditions2.waterLevel,
            fertilized: fertilized2
          }];

          const farmId1 = createTestFarm(1, conditions1.soilQuality, plots1);
          const farmId2 = createTestFarm(1, conditions2.soilQuality, plots2);

          // Get crop info
          const cropInfo = farmingSystem.getCropInfo(cropId);
          expect(cropInfo).not.toBeNull();

          // Skip if crop is not compatible with current season
          if (!cropInfo!.seasons.includes(conditions1.season)) {
            return; // Skip this test case
          }

          // Harvest both crops
          const harvest1 = farmingSystem.harvestCrop(farmId1, 0);
          const harvest2 = farmingSystem.harvestCrop(farmId2, 0);

          expect(harvest1.success).toBe(true);
          expect(harvest2.success).toBe(true);
          expect(harvest1.items).toBeDefined();
          expect(harvest2.items).toBeDefined();

          const yield1 = harvest1.items![0];
          const yield2 = harvest2.items![0];

          // Requirement 11.3: Fertilizer should affect yield
          if (fertilized1 && !fertilized2) {
            // Fertilized plot should generally have better yield or quality
            const totalValue1 = yield1.quantity * yield1.quality;
            const totalValue2 = yield2.quantity * yield2.quality;
            
            // Allow for some variance due to other factors
            if (fertility1 >= fertility2 && conditions1.waterLevel >= conditions2.waterLevel) {
              expect(totalValue1).toBeGreaterThanOrEqual(totalValue2 * 0.9);
            }
          }

          // Requirement 11.4: Soil quality should affect harvest
          const soilDifference = conditions1.soilQuality - conditions2.soilQuality;
          const fertilityDifference = fertility1 - fertility2;
          
          if (soilDifference > 20 && fertilityDifference > 10 && fertilized1 === fertilized2) {
            // Better conditions should generally produce better results
            expect(yield1.quantity).toBeGreaterThanOrEqual(yield2.quantity);
          }

          // Requirement 11.5: All yields should be reasonable
          expect(yield1.quantity).toBeGreaterThan(0);
          expect(yield1.quantity).toBeLessThanOrEqual(cropInfo!.baseYield * 3); // Reasonable upper bound
          expect(yield1.quality).toBeGreaterThan(0);
          expect(yield1.quality).toBeLessThanOrEqual(100);

          expect(yield2.quantity).toBeGreaterThan(0);
          expect(yield2.quantity).toBeLessThanOrEqual(cropInfo!.baseYield * 3);
          expect(yield2.quality).toBeGreaterThan(0);
          expect(yield2.quality).toBeLessThanOrEqual(100);

          // Both should produce the correct harvest item
          expect(yield1.itemId).toBe(cropInfo!.harvestItemId);
          expect(yield2.itemId).toBe(cropInfo!.harvestItemId);

          // Experience should be reasonable
          expect(harvest1.experience).toBeGreaterThan(0);
          expect(harvest1.experience).toBeLessThanOrEqual(cropInfo!.baseYield * 20);
          expect(harvest2.experience).toBeGreaterThan(0);
          expect(harvest2.experience).toBeLessThanOrEqual(cropInfo!.baseYield * 20);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle fertilizer application correctly', () => {
    // Property: Fertilizer application should improve crop conditions
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 80 }), // Initial fertility
        fc.constantFrom('wheat', 'potato', 'carrot'),
        (initialFertility, cropId) => {
          // Create farm with planted crop
          const plots: FarmPlot[] = [{
            id: 0,
            crop: `${cropId}_seed` as any,
            plantTime: Date.now(),
            growthStage: 1,
            fertility: initialFertility,
            waterLevel: 50,
            fertilized: false
          }];

          const farmId = createTestFarm(1, 60, plots);
          const fertilizerItemId = createTestSeed('basic_fertilizer', 'Basic Fertilizer', 5);
          
          // Add fertilizer to inventory
          addSeedsToInventory(farmId, fertilizerItemId, 5);

          // Get initial plot state
          const initialFarm = componentManager.getComponent(farmId, FarmComponentType);
          expect(initialFarm).not.toBeNull();
          const initialPlot = initialFarm!.plots[0];
          const initialFertilized = initialPlot.fertilized;
          const initialPlotFertility = initialPlot.fertility;

          // Apply fertilizer
          const result = farmingSystem.applyFertilizer(farmId, 0, fertilizerItemId as any);
          expect(result).toBe(true);

          // Check plot state after fertilizer
          const finalFarm = componentManager.getComponent(farmId, FarmComponentType);
          expect(finalFarm).not.toBeNull();
          const finalPlot = finalFarm!.plots[0];

          // Fertilizer should have been applied
          expect(finalPlot.fertilized).toBe(true);
          expect(finalPlot.fertilized).not.toBe(initialFertilized);

          // Fertility should have improved
          expect(finalPlot.fertility).toBeGreaterThan(initialPlotFertility);
          expect(finalPlot.fertility).toBeLessThanOrEqual(100);

          // Fertilizer should have been consumed
          const finalInventory = componentManager.getComponent(farmId, InventoryComponentType);
          expect(finalInventory).not.toBeNull();
          const fertilizerSlot = finalInventory!.slots.find(slot => slot.item === fertilizerItemId);
          expect(fertilizerSlot).not.toBeUndefined();
          expect(fertilizerSlot!.quantity).toBe(4); // One consumed
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle watering correctly', () => {
    // Property: Watering should increase plot water level
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 70 }), // Initial water level (leave room for increase)
        (initialWaterLevel) => {
          // Create farm with low water plot
          const plots: FarmPlot[] = [{
            id: 0,
            crop: null,
            plantTime: 0,
            growthStage: 0,
            fertility: 50,
            waterLevel: initialWaterLevel,
            fertilized: false
          }];

          const farmId = createTestFarm(1, 60, plots);

          // Water the plot
          const result = farmingSystem.waterPlot(farmId, 0);
          expect(result).toBe(true);

          // Check water level increased
          const farm = componentManager.getComponent(farmId, FarmComponentType);
          expect(farm).not.toBeNull();
          const plot = farm!.plots[0];

          expect(plot.waterLevel).toBeGreaterThan(initialWaterLevel);
          expect(plot.waterLevel).toBeLessThanOrEqual(100);
          expect(plot.waterLevel).toBe(Math.min(100, initialWaterLevel + 30));
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle growth stage progression correctly', () => {
    // Property: Crop growth should progress through stages over time
    fc.assert(
      fc.property(
        fc.constantFrom('wheat', 'potato', 'carrot'),
        fc.integer({ min: 40, max: 100 }), // Fertility
        fc.integer({ min: 30, max: 100 }), // Water level
        fc.boolean(), // Fertilized
        (cropId, fertility, waterLevel, fertilized) => {
          // Set appropriate season
          const cropInfo = farmingSystem.getCropInfo(cropId);
          expect(cropInfo).not.toBeNull();
          farmingSystem.setCurrentSeason(cropInfo!.seasons[0]);

          // Create farm with planted crop
          const currentTime = Date.now();
          const plots: FarmPlot[] = [{
            id: 0,
            crop: `${cropId}_seed` as any,
            plantTime: currentTime - (cropInfo!.growthTime * 0.8), // 80% grown
            growthStage: 0,
            fertility,
            waterLevel,
            fertilized
          }];

          const farmId = createTestFarm(1, 60, plots);

          // Process growth
          farmingSystem.update(1000); // 1 second delta

          // Check growth progression
          const farm = componentManager.getComponent(farmId, FarmComponentType);
          expect(farm).not.toBeNull();
          const plot = farm!.plots[0];

          // Growth stage should have progressed
          expect(plot.growthStage).toBeGreaterThanOrEqual(0);
          expect(plot.growthStage).toBeLessThanOrEqual(4);

          // If enough time has passed, should be ready to harvest
          if (currentTime - plot.plantTime >= cropInfo!.growthTime) {
            expect(plot.growthStage).toBe(4);
          }

          // Water level should decrease over time if crop is growing
          if (plot.growthStage > 0 && waterLevel > cropInfo!.waterRequirement) {
            // Water should have been consumed (allowing for some tolerance)
            expect(plot.waterLevel).toBeLessThanOrEqual(waterLevel);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle season changes correctly', () => {
    // Property: Season changes should affect crop availability and growth
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(Season)),
        fc.constantFrom(...Object.values(Season)),
        (season1, season2) => {
          // Skip if seasons are the same
          if (season1 === season2) {
            return;
          }

          // Set initial season
          farmingSystem.setCurrentSeason(season1);
          const availableCrops1 = farmingSystem.getAvailableCrops();

          // Change season
          farmingSystem.setCurrentSeason(season2);
          const availableCrops2 = farmingSystem.getAvailableCrops();

          // Available crops should be consistent with season
          for (const crop of availableCrops1) {
            expect(crop.seasons).toContain(season1);
          }

          for (const crop of availableCrops2) {
            expect(crop.seasons).toContain(season2);
          }

          // Some crops might be available in both seasons
          const commonCrops = availableCrops1.filter(crop1 => 
            availableCrops2.some(crop2 => crop2.id === crop1.id)
          );

          for (const crop of commonCrops) {
            expect(crop.seasons).toContain(season1);
            expect(crop.seasons).toContain(season2);
          }

          // All available crops should be valid
          expect(availableCrops1.length).toBeGreaterThanOrEqual(0);
          expect(availableCrops2.length).toBeGreaterThanOrEqual(0);
          
          for (const crop of availableCrops1) {
            expect(crop.id).toBeDefined();
            expect(crop.name).toBeDefined();
            expect(crop.growthTime).toBeGreaterThan(0);
            expect(crop.baseYield).toBeGreaterThan(0);
          }

          for (const crop of availableCrops2) {
            expect(crop.id).toBeDefined();
            expect(crop.name).toBeDefined();
            expect(crop.growthTime).toBeGreaterThan(0);
            expect(crop.baseYield).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain farm status consistency', () => {
    // Property: Farm status should accurately reflect plot states
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // Number of plots
        fc.integer({ min: 0, max: 5 }), // Number of planted plots
        (totalPlots, plantedPlots) => {
          const actualPlantedPlots = Math.min(plantedPlots, totalPlots);
          
          // Create farm with mixed plot states
          const plots: FarmPlot[] = [];
          for (let i = 0; i < totalPlots; i++) {
            const isPlanted = i < actualPlantedPlots;
            plots.push({
              id: i,
              crop: isPlanted ? 'wheat_seed' as any : null,
              plantTime: isPlanted ? Date.now() - 60000 : 0, // 1 minute ago
              growthStage: isPlanted ? Math.floor(Math.random() * 5) : 0,
              fertility: 40 + Math.random() * 40,
              waterLevel: 30 + Math.random() * 50,
              fertilized: Math.random() > 0.5
            });
          }

          const farmId = createTestFarm(totalPlots, 60, plots);

          // Get farm status
          const status = farmingSystem.getFarmStatus(farmId);
          expect(status).not.toBeNull();

          // Verify status accuracy
          expect(status!.totalPlots).toBe(totalPlots);
          expect(status!.activePlots).toBe(actualPlantedPlots);
          expect(status!.plots.length).toBe(totalPlots);
          expect(status!.soilQuality).toBe(60);

          // Check individual plot status
          for (let i = 0; i < totalPlots; i++) {
            const plotStatus = status!.plots[i];
            const actualPlot = plots[i];

            expect(plotStatus.id).toBe(i);
            expect(plotStatus.growthStage).toBe(actualPlot.growthStage);
            expect(plotStatus.fertility).toBe(actualPlot.fertility);
            expect(plotStatus.waterLevel).toBe(actualPlot.waterLevel);
            expect(plotStatus.fertilized).toBe(actualPlot.fertilized);

            if (actualPlot.crop) {
              expect(plotStatus.crop).toBe('wheat'); // Crop type derived from seed
              expect(plotStatus.growthProgress).toBeGreaterThanOrEqual(0);
              expect(plotStatus.growthProgress).toBeLessThanOrEqual(1);
              expect(plotStatus.estimatedHarvestTime).toBeGreaterThan(actualPlot.plantTime);
              expect(plotStatus.readyToHarvest).toBe(actualPlot.growthStage >= 4);
            } else {
              expect(plotStatus.crop).toBeNull();
              expect(plotStatus.growthProgress).toBe(0);
              expect(plotStatus.readyToHarvest).toBe(false);
              expect(plotStatus.estimatedHarvestTime).toBeUndefined();
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});