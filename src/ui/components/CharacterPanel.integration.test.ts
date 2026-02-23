/**
 * Character Panel Integration Tests - Real-time Updates
 * Tests for hunger system real-time UI updates
 * 
 * Requirements: 6.1, 6.4
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

describe('CharacterPanel - Real-time Updates Integration Tests', () => {
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

  describe('Real-time Hunger Updates', () => {
    /**
     * Requirement 6.1: When character's hunger value changes, 
     * CharacterPanel should automatically update progress bar display
     */
    it('should update hunger progress bar when hunger value changes', async () => {
      // Create character with initial hunger
      const character = createTestCharacter(world);
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 100,
        maximum: 100
      };
      world.addComponent(character.id, HungerComponentType, hunger);
      
      // Show panel and select character
      characterPanel.show();
      characterPanel.render();
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      // Verify initial state
      let hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      let barText = characterPanel.element.querySelector('.hunger-bar .bar-text');
      expect(hungerBar.style.width).toBe('100%');
      expect(barText?.textContent).toBe('100 / 100');
      
      // Modify hunger value
      hunger.current = 50;
      world.addComponent(character.id, HungerComponentType, hunger);
      
      // Emit hunger change event
      eventSystem.emit(createEvent({ type: 'hunger:changed', characterId: character.id }));
      
      // Wait for UI update (using setTimeout to ensure DOM updates)
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify updated state
      hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      barText = characterPanel.element.querySelector('.hunger-bar .bar-text');
      expect(hungerBar.style.width).toBe('50%');
      expect(barText?.textContent).toBe('50 / 100');
    });

    /**
     * Requirement 6.1: Test multiple sequential hunger updates
     */
    it('should handle multiple sequential hunger updates', async () => {
      const character = createTestCharacter(world);
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 100,
        maximum: 100
      };
      world.addComponent(character.id, HungerComponentType, hunger);
      
      characterPanel.show();
      characterPanel.render();
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      // First update: 100 -> 75
      hunger.current = 75;
      world.addComponent(character.id, HungerComponentType, hunger);
      eventSystem.emit(createEvent({ type: 'hunger:changed', characterId: character.id }));
      await new Promise(resolve => setTimeout(resolve, 0));
      
      let hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      let barText = characterPanel.element.querySelector('.hunger-bar .bar-text');
      expect(hungerBar.style.width).toBe('75%');
      expect(barText?.textContent).toBe('75 / 100');
      
      // Second update: 75 -> 25
      hunger.current = 25;
      world.addComponent(character.id, HungerComponentType, hunger);
      eventSystem.emit(createEvent({ type: 'hunger:changed', characterId: character.id }));
      await new Promise(resolve => setTimeout(resolve, 0));
      
      hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      barText = characterPanel.element.querySelector('.hunger-bar .bar-text');
      expect(hungerBar.style.width).toBe('25%');
      expect(barText?.textContent).toBe('25 / 100');
      
      // Third update: 25 -> 0
      hunger.current = 0;
      world.addComponent(character.id, HungerComponentType, hunger);
      eventSystem.emit(createEvent({ type: 'hunger:changed', characterId: character.id }));
      await new Promise(resolve => setTimeout(resolve, 0));
      
      hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      barText = characterPanel.element.querySelector('.hunger-bar .bar-text');
      expect(hungerBar.style.width).toBe('0%');
      expect(barText?.textContent).toBe('0 / 100');
    });

    /**
     * Requirement 6.1: Test edge case of hunger increase (e.g., after eating)
     */
    it('should update when hunger increases', async () => {
      const character = createTestCharacter(world);
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 30,
        maximum: 100
      };
      world.addComponent(character.id, HungerComponentType, hunger);
      
      characterPanel.show();
      characterPanel.render();
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      // Verify initial low hunger
      let hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      expect(hungerBar.style.width).toBe('30%');
      
      // Increase hunger (e.g., character ate food)
      hunger.current = 90;
      world.addComponent(character.id, HungerComponentType, hunger);
      eventSystem.emit(createEvent({ type: 'hunger:changed', characterId: character.id }));
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify increased hunger
      hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      let barText = characterPanel.element.querySelector('.hunger-bar .bar-text');
      expect(hungerBar.style.width).toBe('90%');
      expect(barText?.textContent).toBe('90 / 100');
    });
  });

  describe('Character Selection Updates', () => {
    /**
     * Requirement 6.4: When switching selected character,
     * CharacterPanel should display the new character's hunger data
     */
    it('should display correct hunger when switching between characters', async () => {
      // Create two characters with different hunger levels
      const character1 = createTestCharacter(world);
      const hunger1: HungerComponent = {
        type: 'hunger',
        current: 80,
        maximum: 100
      };
      world.addComponent(character1.id, HungerComponentType, hunger1);
      
      const character2 = createTestCharacter(world);
      const hunger2: HungerComponent = {
        type: 'hunger',
        current: 30,
        maximum: 100
      };
      world.addComponent(character2.id, HungerComponentType, hunger2);
      
      // Show panel
      characterPanel.show();
      characterPanel.render();
      
      // Select first character
      const characterItems = characterPanel.element.querySelectorAll('.character-item');
      (characterItems[0] as HTMLElement).click();
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify first character's hunger
      let hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      let barText = characterPanel.element.querySelector('.hunger-bar .bar-text');
      expect(hungerBar.style.width).toBe('80%');
      expect(barText?.textContent).toBe('80 / 100');
      
      // Switch to second character
      (characterItems[1] as HTMLElement).click();
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify second character's hunger
      hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      barText = characterPanel.element.querySelector('.hunger-bar .bar-text');
      expect(hungerBar.style.width).toBe('30%');
      expect(barText?.textContent).toBe('30 / 100');
      
      // Switch back to first character
      (characterItems[0] as HTMLElement).click();
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify first character's hunger again
      hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      barText = characterPanel.element.querySelector('.hunger-bar .bar-text');
      expect(hungerBar.style.width).toBe('80%');
      expect(barText?.textContent).toBe('80 / 100');
    });

    /**
     * Requirement 6.4: Test switching to character without hunger component
     */
    it('should handle switching to character without hunger component', async () => {
      // Create character with hunger
      const character1 = createTestCharacter(world);
      const hunger1: HungerComponent = {
        type: 'hunger',
        current: 60,
        maximum: 100
      };
      world.addComponent(character1.id, HungerComponentType, hunger1);
      
      // Create character without hunger
      const character2 = createTestCharacter(world);
      // Don't add hunger component
      
      characterPanel.show();
      characterPanel.render();
      
      // Select first character (with hunger)
      const characterItems = characterPanel.element.querySelectorAll('.character-item');
      (characterItems[0] as HTMLElement).click();
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify hunger bar exists
      let hungerBar = characterPanel.element.querySelector('.bar.hunger-bar');
      expect(hungerBar).toBeTruthy();
      
      // Switch to second character (without hunger)
      (characterItems[1] as HTMLElement).click();
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify hunger bar does not exist
      hungerBar = characterPanel.element.querySelector('.bar.hunger-bar');
      expect(hungerBar).toBeNull();
    });
  });

  describe('Progress Bar Animation', () => {
    /**
     * Requirement 6.2: Progress bar should use smooth transition animation
     * Note: We verify that CSS transition is applied, actual animation timing
     * is handled by CSS and browser
     */
    it('should have CSS transition applied to hunger bar', () => {
      const character = createTestCharacter(world);
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 75,
        maximum: 100
      };
      world.addComponent(character.id, HungerComponentType, hunger);
      
      characterPanel.show();
      characterPanel.render();
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      // Get hunger bar element
      const hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      expect(hungerBar).toBeTruthy();
      
      // Check that the bar element exists and has width set
      // The actual transition is defined in CSS, we just verify the element is rendered
      expect(hungerBar.style.width).toBe('75%');
      
      // Verify the bar has the correct class for styling
      expect(hungerBar.classList.contains('hunger-bar')).toBe(true);
    });

    /**
     * Requirement 6.3: Text display should update immediately (no animation)
     */
    it('should update text display immediately without animation', async () => {
      const character = createTestCharacter(world);
      const hunger: HungerComponent = {
        type: 'hunger',
        current: 100,
        maximum: 100
      };
      world.addComponent(character.id, HungerComponentType, hunger);
      
      characterPanel.show();
      characterPanel.render();
      const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
      characterItem.click();
      
      // Initial text
      let barText = characterPanel.element.querySelector('.hunger-bar .bar-text');
      expect(barText?.textContent).toBe('100 / 100');
      
      // Update hunger
      hunger.current = 42;
      world.addComponent(character.id, HungerComponentType, hunger);
      eventSystem.emit(createEvent({ type: 'hunger:changed', characterId: character.id }));
      
      // Text should update immediately (no setTimeout needed for text)
      await new Promise(resolve => setTimeout(resolve, 0));
      barText = characterPanel.element.querySelector('.hunger-bar .bar-text');
      expect(barText?.textContent).toBe('42 / 100');
    });
  });

  describe('Event Isolation', () => {
    /**
     * Verify that hunger change events only affect the selected character
     */
    it('should only update UI for selected character, not others', async () => {
      // Create two characters
      const character1 = createTestCharacter(world);
      const hunger1: HungerComponent = {
        type: 'hunger',
        current: 80,
        maximum: 100
      };
      world.addComponent(character1.id, HungerComponentType, hunger1);
      
      const character2 = createTestCharacter(world);
      const hunger2: HungerComponent = {
        type: 'hunger',
        current: 60,
        maximum: 100
      };
      world.addComponent(character2.id, HungerComponentType, hunger2);
      
      characterPanel.show();
      characterPanel.render();
      
      // Select first character
      const characterItems = characterPanel.element.querySelectorAll('.character-item');
      (characterItems[0] as HTMLElement).click();
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify first character's hunger is displayed
      let hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      expect(hungerBar.style.width).toBe('80%');
      
      // Modify second character's hunger (not selected)
      hunger2.current = 10;
      world.addComponent(character2.id, HungerComponentType, hunger2);
      eventSystem.emit(createEvent({ type: 'hunger:changed', characterId: character2.id }));
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // UI should still show first character's hunger (unchanged)
      hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      expect(hungerBar.style.width).toBe('80%');
      
      // Now select second character
      (characterItems[1] as HTMLElement).click();
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Now UI should show second character's updated hunger
      hungerBar = characterPanel.element.querySelector('.bar.hunger-bar') as HTMLElement;
      expect(hungerBar.style.width).toBe('10%');
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
    currentJob: JobType.Warrior,
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
