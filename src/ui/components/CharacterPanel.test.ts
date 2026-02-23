/**
 * Character Panel Tests - Test character management interface
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CharacterPanel } from './CharacterPanel';
import { UIManager } from '../UIManager';
import { EventSystem, createEvent } from '../../ecs/EventSystem';
import { World } from '../../ecs/World';
import { Entity } from '../../ecs/Entity';
import { 
  CharacterInfoComponent,
  CharacterInfoComponentType,
  AttributeComponent,
  AttributeComponentType,
  HealthComponent,
  HealthComponentType,
  ManaComponentType,
  LevelComponent,
  LevelComponentType,
  JobComponent,
  JobComponentType,
  DerivedStatsComponentType,
  HungerComponent,
  HungerComponentType
} from '../../game/components/CharacterComponents';
import { RarityType } from '../../game/types/RarityTypes';
import { JobType } from '../../game/types/GameTypes';

describe('CharacterPanel', () => {
  let characterPanel: CharacterPanel;
  let uiManager: UIManager;
  let eventSystem: EventSystem;
  let world: World;
  let rootElement: HTMLElement;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="test-root"></div>';
    rootElement = document.getElementById('test-root')!;
    
    // Create instances
    eventSystem = new EventSystem();
    world = new World();
    uiManager = new UIManager(eventSystem, rootElement);
    characterPanel = new CharacterPanel(uiManager, eventSystem, world);
    
    // Register the panel
    uiManager.registerComponent(characterPanel);
  });

  afterEach(() => {
    uiManager.destroy();
    document.body.innerHTML = '';
  });

  describe('Panel Structure', () => {
    it('should create panel with correct structure', () => {
      characterPanel.show();
      
      const panel = characterPanel.element;
      expect(panel).toBeTruthy();
      expect(panel.classList.contains('character-panel')).toBe(true);
      
      // Check for header
      const header = panel.querySelector('.panel-header');
      expect(header).toBeTruthy();
      expect(header?.textContent).toContain('角色管理');
      
      // Check for close button
      const closeBtn = panel.querySelector('.close-btn');
      expect(closeBtn).toBeTruthy();
    });

    it('should have character list and details sections', () => {
      characterPanel.show();
      
      const characterList = characterPanel.element.querySelector('.character-list');
      const characterDetails = characterPanel.element.querySelector('.character-details');
      
      expect(characterList).toBeTruthy();
      expect(characterDetails).toBeTruthy();
    });

    it('should close panel when close button is clicked', () => {
      characterPanel.show();
      expect(characterPanel.visible).toBe(true);
      
      const closeBtn = characterPanel.element.querySelector('.close-btn') as HTMLButtonElement;
      closeBtn.click();
      
      expect(characterPanel.visible).toBe(false);
    });
  });

  describe('Character List Rendering', () => {
    it('should show empty state when no characters exist', () => {
      characterPanel.show();
      characterPanel.render();
      
      const characterList = characterPanel.element.querySelector('.character-list');
      expect(characterList?.textContent).toContain('暂无角色');
    });

    it('should render character list items', () => {
      // Create test character
      const character = createTestCharacter(world);
      
      characterPanel.show();
      characterPanel.render();
      
      const characterItems = characterPanel.element.querySelectorAll('.character-item');
      expect(characterItems.length).toBe(1);
      
      const characterItem = characterItems[0];
      expect(characterItem.textContent).toContain('测试称号 测试角色');
      expect(characterItem.textContent).toContain('Lv.5');
      expect(characterItem.textContent).toContain('100/100 HP');
    });

    it('should apply correct rarity styling', () => {
      // Create characters with different rarities
      const commonChar = createTestCharacter(world, RarityType.Common);
      const rareChar = createTestCharacter(world, RarityType.Rare);
      
      characterPanel.show();
      characterPanel.render();
      
      const characterItems = characterPanel.element.querySelectorAll('.character-item');
      expect(characterItems.length).toBe(2);
      
      // Check rarity classes are applied
      const hasRarityClasses = Array.from(characterItems).some(item => {
        const nameElement = item.querySelector('.character-name');
        return nameElement?.classList.contains('rarity-common') || 
               nameElement?.classList.contains('rarity-rare');
      });
      expect(hasRarityClasses).toBe(true);
    });

    it('should handle character selection', () => {
      const character = createTestCharacter(world);
      
      characterPanel.show();
      characterPanel.render();
      
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      // Check if selection styling is applied
      expect(characterItem.classList.contains('selected')).toBe(true);
      
      // Check if character details are rendered
      const characterDetails = characterPanel.element.querySelector('.character-details');
      expect(characterDetails?.textContent).toContain('测试称号 测试角色');
    });
  });

  describe('Character Details Rendering', () => {
    it('should show empty state when no character is selected', () => {
      characterPanel.show();
      characterPanel.render();
      
      const characterDetails = characterPanel.element.querySelector('.character-details');
      expect(characterDetails?.textContent).toContain('请选择一个角色查看详情');
    });

    it('should render character details correctly', () => {
      const character = createTestCharacter(world);
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      const characterDetails = characterPanel.element.querySelector('.character-details');
      
      // Check basic info
      expect(characterDetails?.textContent).toContain('测试称号 测试角色');
      expect(characterDetails?.textContent).toContain('等级: 5');
      expect(characterDetails?.textContent).toContain('职业: 新手');
      expect(characterDetails?.textContent).toContain('稀有度: 普通');
      
      // Check attributes
      expect(characterDetails?.textContent).toContain('力量');
      expect(characterDetails?.textContent).toContain('敏捷');
      expect(characterDetails?.textContent).toContain('智慧');
      expect(characterDetails?.textContent).toContain('技巧');
      
      // Check derived stats
      expect(characterDetails?.textContent).toContain('攻击力');
      expect(characterDetails?.textContent).toContain('防御力');
    });

    it('should render health and mana bars', () => {
      const character = createTestCharacter(world);
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      const healthBar = characterPanel.element.querySelector('.health-bar');
      const manaBar = characterPanel.element.querySelector('.mana-bar');
      
      expect(healthBar).toBeTruthy();
      expect(manaBar).toBeTruthy();
      
      // Check bar widths (should be 100% for full health/mana)
      expect((healthBar as HTMLElement).style.width).toBe('100%');
      expect((manaBar as HTMLElement).style.width).toBe('100%');
    });

    it('should render experience bar', () => {
      const character = createTestCharacter(world);
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      const expBar = characterPanel.element.querySelector('.exp-bar');
      expect(expBar).toBeTruthy();
      
      // Check experience display
      const characterDetails = characterPanel.element.querySelector('.character-details');
      expect(characterDetails?.textContent).toContain('50 / 200');
    });
  });

  describe('Action Buttons', () => {
    it('should render action buttons', () => {
      const character = createTestCharacter(world);
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      const levelUpBtn = characterPanel.element.querySelector('.level-up-btn');
      const jobChangeBtn = characterPanel.element.querySelector('.job-change-btn');
      const equipmentBtn = characterPanel.element.querySelector('.equipment-btn');
      const skillsBtn = characterPanel.element.querySelector('.skills-btn');
      
      expect(levelUpBtn).toBeTruthy();
      expect(jobChangeBtn).toBeTruthy();
      expect(equipmentBtn).toBeTruthy();
      expect(skillsBtn).toBeTruthy();
    });

    it('should emit level up event when level up button is clicked', () => {
      const character = createTestCharacter(world);
      const eventSpy = vi.spyOn(eventSystem, 'emit');
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character and click level up
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      const levelUpBtn = characterPanel.element.querySelector('.level-up-btn') as HTMLButtonElement;
      levelUpBtn.click();
      
      expect(eventSpy).toHaveBeenCalledWith('character:levelup', { character });
    });

    it('should emit UI show events for other panels', () => {
      const character = createTestCharacter(world);
      const eventSpy = vi.spyOn(eventSystem, 'emit');
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      // Test job change button
      const jobChangeBtn = characterPanel.element.querySelector('.job-change-btn') as HTMLButtonElement;
      jobChangeBtn.click();
      expect(eventSpy).toHaveBeenCalledWith('ui:show', { panel: 'job-change', character });
      
      // Test equipment button
      const equipmentBtn = characterPanel.element.querySelector('.equipment-btn') as HTMLButtonElement;
      equipmentBtn.click();
      expect(eventSpy).toHaveBeenCalledWith('ui:show', { panel: 'equipment', character });
      
      // Test skills button
      const skillsBtn = characterPanel.element.querySelector('.skills-btn') as HTMLButtonElement;
      skillsBtn.click();
      expect(eventSpy).toHaveBeenCalledWith('ui:show', { panel: 'skills', character });
    });
  });

  describe('Event Listeners', () => {
    it('should re-render when character events are emitted', () => {
      const renderSpy = vi.spyOn(characterPanel, 'render');
      
      characterPanel.show();
      
      eventSystem.emit(createEvent({ type: 'character:recruited' }));
      expect(renderSpy).toHaveBeenCalled();
      
      eventSystem.emit(createEvent({ type: 'character:updated' }));
      expect(renderSpy).toHaveBeenCalled();
      
      eventSystem.emit(createEvent({ type: 'character:levelup' }));
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should update character details when hunger changes for selected character', () => {
      const character = createTestCharacter(world);
      const renderDetailsSpy = vi.spyOn(characterPanel as any, 'renderCharacterDetails');
      
      characterPanel.show();
      characterPanel.render();
      
      // Select the character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      renderDetailsSpy.mockClear();
      
      // Emit hunger change event for the selected character
      eventSystem.emit(createEvent({ type: 'hunger:changed', characterId: character.id }));
      expect(renderDetailsSpy).toHaveBeenCalled();
    });

    it('should not update when hunger changes for a different character', () => {
      const character1 = createTestCharacter(world);
      const character2 = createTestCharacter(world);
      const renderDetailsSpy = vi.spyOn(characterPanel as any, 'renderCharacterDetails');
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character1
      const characterItems = characterPanel.element.querySelectorAll('.character-item');
      (characterItems[0] as HTMLElement).click();
      
      renderDetailsSpy.mockClear();
      
      // Emit hunger change event for character2 (not selected)
      eventSystem.emit(createEvent({ type: 'hunger:changed', characterId: character2.id }));
      expect(renderDetailsSpy).not.toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    it('should format job names correctly', () => {
      const character = createTestCharacter(world);
      
      // Character already has Warrior job from createTestCharacter
      
      characterPanel.show();
      characterPanel.render();
      
      const characterItem = characterPanel.element.querySelector('.character-item');
      expect(characterItem?.textContent).toContain('战士');
    });

    it('should format rarity names correctly', () => {
      const character = createTestCharacter(world, RarityType.Legendary);
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      const characterDetails = characterPanel.element.querySelector('.character-details');
      expect(characterDetails?.textContent).toContain('稀有度: 传说');
    });

    it('should format status text correctly', () => {
      const character = createTestCharacter(world);
      
      characterPanel.show();
      characterPanel.render();
      
      const characterItem = characterPanel.element.querySelector('.character-item');
      expect(characterItem?.textContent).toContain('可用');
    });
  });

  describe('Responsive Design', () => {
    it('should handle mobile layout', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      characterPanel.show();
      
      // Panel should still be functional on mobile
      const panel = characterPanel.element;
      expect(panel).toBeTruthy();
      expect(panel.style.width).toBe('800px'); // Fixed width for now
    });
  });

  describe('Hunger Progress Bar', () => {
    it('should render hunger progress bar when character has HungerComponent', () => {
      const character = createTestCharacter(world);
      
      // Add hunger component
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 75,
        maximum: 100
      };
      world.addComponent(character.id, HungerComponentType, hunger);
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      // Check hunger bar exists
      const hungerBarContainer = characterPanel.element.querySelector('.hunger-bar');
      expect(hungerBarContainer).toBeTruthy();
      
      // Check label
      const label = hungerBarContainer?.querySelector('label');
      expect(label?.textContent).toBe('饱腹度');
      
      // Check bar element
      const hungerBar = hungerBarContainer?.querySelector('.bar.hunger-bar') as HTMLElement;
      expect(hungerBar).toBeTruthy();
    });

    it('should display correct hunger values in text format', () => {
      const character = createTestCharacter(world);
      
      // Add hunger component with specific values
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 60,
        maximum: 100
      };
      world.addComponent(character.id, HungerComponentType, hunger);
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      // Check text display
      const hungerBarContainer = characterPanel.element.querySelector('.hunger-bar');
      const barText = hungerBarContainer?.querySelector('.bar-text');
      expect(barText?.textContent).toBe('60 / 100');
    });

    it('should calculate correct progress bar width percentage', () => {
      const character = createTestCharacter(world);
      
      // Add hunger component with 50% hunger
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 50,
        maximum: 100
      };
      world.addComponent(character.id, HungerComponentType, hunger);
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      // Check bar width
      const hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      expect(hungerBar.style.width).toBe('50%');
    });

    it('should position hunger bar after experience bar', () => {
      const character = createTestCharacter(world);
      
      // Add hunger component
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 80,
        maximum: 100
      };
      world.addComponent(character.id, HungerComponentType, hunger);
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      // Get status bars container
      const statusBars = characterPanel.element.querySelector('.status-bars');
      expect(statusBars).toBeTruthy();
      
      // Get all bar containers in order
      const barContainers = statusBars?.querySelectorAll('.status-bar, .exp-bar, .hunger-bar');
      expect(barContainers).toBeTruthy();
      expect(barContainers!.length).toBeGreaterThanOrEqual(4); // health, mana, exp, hunger
      
      // Find exp and hunger bars
      let expBarIndex = -1;
      let hungerBarIndex = -1;
      
      barContainers?.forEach((bar, index) => {
        if (bar.classList.contains('exp-bar')) {
          expBarIndex = index;
        }
        if (bar.classList.contains('hunger-bar')) {
          hungerBarIndex = index;
        }
      });
      
      // Hunger bar should come after exp bar
      expect(hungerBarIndex).toBeGreaterThan(expBarIndex);
    });

    it('should not render hunger bar when character lacks HungerComponent', () => {
      const character = createTestCharacter(world);
      // Don't add hunger component
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      // Check hunger bar does not exist
      const hungerBarContainer = characterPanel.element.querySelector('.hunger-bar');
      expect(hungerBarContainer).toBeNull();
    });

    it('should handle edge case of zero hunger', () => {
      const character = createTestCharacter(world);
      
      // Add hunger component with zero current
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 0,
        maximum: 100
      };
      world.addComponent(character.id, HungerComponentType, hunger);
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      // Check bar width is 0%
      const hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      expect(hungerBar.style.width).toBe('0%');
      
      // Check text display
      const hungerBarContainer = characterPanel.element.querySelector('.hunger-bar');
      const barText = hungerBarContainer?.querySelector('.bar-text');
      expect(barText?.textContent).toBe('0 / 100');
    });

    it('should handle edge case of full hunger', () => {
      const character = createTestCharacter(world);
      
      // Add hunger component with full hunger
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 100,
        maximum: 100
      };
      world.addComponent(character.id, HungerComponentType, hunger);
      
      characterPanel.show();
      characterPanel.render();
      
      // Select character
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      // Check bar width is 100%
      const hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      expect(hungerBar.style.width).toBe('100%');
      
      // Check text display
      const hungerBarContainer = characterPanel.element.querySelector('.hunger-bar');
      const barText = hungerBarContainer?.querySelector('.bar-text');
      expect(barText?.textContent).toBe('100 / 100');
    });
  });
});

// Helper function to create test character
function createTestCharacter(world: World, rarity: RarityType = RarityType.Common): Entity {
  const character = world.createEntity();
  
  // Add character info component
  const characterInfo: CharacterInfoComponent = {
    type: 'characterInfo',
    title: '测试称号',
    name: '测试角色',
    isSpecial: false,
    rarity: rarity,
    status: 'available' as any
  };
  world.addComponent(character.id, CharacterInfoComponentType, characterInfo);
  
  // Add attribute component
  const attributes: AttributeComponent = {
    type: 'attribute',
    strength: 10,
    agility: 8,
    wisdom: 12,
    technique: 9
  };
  world.addComponent(character.id, AttributeComponentType, attributes);
  
  // Add health component
  const health: HealthComponent = {
    type: 'health',
    current: 100,
    maximum: 100
  };
  world.addComponent(character.id, HealthComponentType, health);
  
  // Add mana component
  const mana = {
    type: 'mana' as const,
    current: 50,
    maximum: 50
  };
  world.addComponent(character.id, ManaComponentType, mana);
  
  // Add level component
  const level: LevelComponent = {
    type: 'level',
    level: 5,
    experience: 50,
    experienceToNext: 200
  };
  world.addComponent(character.id, LevelComponentType, level);
  
  // Add job component
  const job: JobComponent = {
    type: 'job',
    currentJob: JobType.Warrior, // Use a valid job type
    availableJobs: [JobType.Warrior],
    jobExperience: new Map()
  };
  world.addComponent(character.id, JobComponentType, job);
  
  // Add derived stats component
  const derivedStats = {
    type: 'derivedStats' as const,
    attack: 25,
    defense: 15,
    moveSpeed: 10,
    dodgeRate: 0.1,
    critRate: 0.05,
    critDamage: 1.5,
    resistance: 5,
    magicPower: 20,
    carryWeight: 50,
    hitRate: 0.9,
    expRate: 1.0,
    healthRegen: 1,
    manaRegen: 2,
    weight: 70,
    volume: 1
  };
  world.addComponent(character.id, DerivedStatsComponentType, derivedStats);
  
  return character;
}

/**
 * Property-Based Tests for Hunger System
 */
import * as fc from 'fast-check';

describe('Hunger System - Property-Based Tests', () => {
  let characterPanel: CharacterPanel;
  let uiManager: UIManager;
  let eventSystem: EventSystem;
  let world: World;
  let rootElement: HTMLElement;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="test-root"></div>';
    rootElement = document.getElementById('test-root')!;
    
    // Create instances
    eventSystem = new EventSystem();
    world = new World();
    uiManager = new UIManager(eventSystem, rootElement);
    characterPanel = new CharacterPanel(uiManager, eventSystem, world);
    
    // Register the panel
    uiManager.registerComponent(characterPanel);
  });

  afterEach(() => {
    uiManager.destroy();
    document.body.innerHTML = '';
  });

  /**
   * Property 3: UI Display Consistency
   * Validates: Requirements 3.1, 3.5
   * 
   * For any character with HungerComponent displayed in CharacterPanel,
   * the progress bar width percentage and text values should match the component data.
   */
  it('Property 3: UI display consistency - progress bar matches hunger data', () => {
    fc.assert(
      fc.property(
        // Generate random hunger values with reasonable precision
        fc.record({
          current: fc.integer({ min: 0, max: 100 }),
          maximum: fc.integer({ min: 1, max: 200 })
        }).filter(h => h.current <= h.maximum), // Ensure current <= maximum
        (hungerData) => {
          // Clean up any existing entities first
          const existingEntities = world.getAllEntities();
          existingEntities.forEach(entity => world.destroyEntity(entity.id));
          
          // Create test character
          const character = createTestCharacter(world);
          
          // Add hunger component with generated values
          const hunger: HungerComponent = {
            type: 'hunger',
            current: hungerData.current,
            maximum: hungerData.maximum
          };
          world.addComponent(character.id, HungerComponentType, hunger);
          
          // Render the panel
          characterPanel.show();
          characterPanel.render();
          
          // Select the character
          const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
          expect(characterItem).toBeTruthy();
          characterItem.click();
          
          // Get the rendered hunger bar - use more specific selector
          const hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
          expect(hungerBar).toBeTruthy();
          
          const hungerBarContainer = characterPanel.element.querySelector('.hunger-bar');
          const barText = hungerBarContainer?.querySelector('.bar-text');
          
          // Calculate expected percentage
          const expectedPercent = (hungerData.current / hungerData.maximum) * 100;
          
          // Verify progress bar width matches data
          const widthStyle = hungerBar.style.width;
          expect(widthStyle).toBeTruthy(); // Ensure width is set
          const actualWidth = parseFloat(widthStyle);
          expect(actualWidth).not.toBeNaN(); // Ensure it's a valid number
          expect(Math.abs(actualWidth - expectedPercent)).toBeLessThan(0.01); // Allow small floating point error
          
          // Verify text display matches data
          const expectedText = `${Math.floor(hungerData.current)} / ${Math.floor(hungerData.maximum)}`;
          expect(barText?.textContent).toBe(expectedText);
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design
    );
  });

  /**
   * Property 5: Progress Bar Position Ordering
   * Validates: Requirements 3.2, 3.3
   * 
   * For any character with HungerComponent displayed in CharacterPanel,
   * the hunger progress bar should be positioned after the experience bar
   * and before the affinity display in the DOM.
   */
  it('Property 5: Progress bar position ordering - hunger bar after exp, before affinity', () => {
    fc.assert(
      fc.property(
        // Generate random hunger values to ensure test works with various data
        fc.record({
          current: fc.integer({ min: 0, max: 100 }),
          maximum: fc.integer({ min: 1, max: 200 }),
          experience: fc.integer({ min: 0, max: 500 }),
          experienceToNext: fc.integer({ min: 100, max: 1000 })
        }).filter(data => data.current <= data.maximum && data.experience <= data.experienceToNext),
        (testData) => {
          // Clean up any existing entities first
          const existingEntities = world.getAllEntities();
          existingEntities.forEach(entity => world.destroyEntity(entity.id));
          
          // Create test character
          const character = createTestCharacter(world);
          
          // Update level component with random experience
          const level: LevelComponent = {
            type: 'level',
            level: 5,
            experience: testData.experience,
            experienceToNext: testData.experienceToNext
          };
          world.addComponent(character.id, LevelComponentType, level);
          
          // Add hunger component with generated values
          const hunger: HungerComponent = {
            type: 'hunger',
            current: testData.current,
            maximum: testData.maximum
          };
          world.addComponent(character.id, HungerComponentType, hunger);
          
          // Render the panel
          characterPanel.show();
          characterPanel.render();
          
          // Select the character
          const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
          expect(characterItem).toBeTruthy();
          characterItem.click();
          
          // Get the status bars container
          const statusBars = characterPanel.element.querySelector('.status-bars');
          expect(statusBars).toBeTruthy();
          
          // Get all child elements in the status bars container
          const children = Array.from(statusBars!.children);
          
          // Find indices of exp bar and hunger bar
          let expBarIndex = -1;
          let hungerBarIndex = -1;
          
          children.forEach((child, index) => {
            if (child.classList.contains('exp-bar')) {
              expBarIndex = index;
            }
            if (child.classList.contains('hunger-bar')) {
              hungerBarIndex = index;
            }
          });
          
          // Verify both bars exist
          expect(expBarIndex).toBeGreaterThanOrEqual(0);
          expect(hungerBarIndex).toBeGreaterThanOrEqual(0);
          
          // Verify hunger bar comes after exp bar
          expect(hungerBarIndex).toBeGreaterThan(expBarIndex);
          
          // Note: Affinity display is not yet implemented in the current UI,
          // so we only verify the hunger bar comes after exp bar.
          // When affinity is added, this test should be extended to verify
          // hunger bar comes before affinity display.
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design
    );
  });
});
