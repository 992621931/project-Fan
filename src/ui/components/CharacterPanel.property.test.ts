/**
 * CharacterPanel Property-Based Tests
 * Tests universal properties of the CharacterPanel component
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { CharacterPanel } from './CharacterPanel';
import { UIManager } from '../UIManager';
import { EventSystem } from '../../ecs/EventSystem';
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
  AffinityComponent,
  AffinityComponentType
} from '../../game/components/CharacterComponents';
import { RarityType } from '../../game/types/RarityTypes';
import { JobType } from '../../game/types/GameTypes';
import { DialogueSystem, DialogueTopic } from '../../game/systems/DialogueSystem';

describe('CharacterPanel - Property-Based Tests', () => {
  let characterPanel: CharacterPanel;
  let uiManager: UIManager;
  let eventSystem: EventSystem;
  let world: World;
  let dialogueSystem: DialogueSystem;
  let rootElement: HTMLElement;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="test-root"></div>';
    rootElement = document.getElementById('test-root')!;

    // Create instances
    eventSystem = new EventSystem();
    world = new World();
    uiManager = new UIManager(eventSystem, rootElement);

    // Create and register DialogueSystem
    dialogueSystem = new DialogueSystem(world);
    world.addSystem(dialogueSystem);

    characterPanel = new CharacterPanel(uiManager, eventSystem, world);

    // Register the panel
    uiManager.registerComponent(characterPanel);
  });

  afterEach(() => {
    uiManager.destroy();
    document.body.innerHTML = '';
  });

  /**
   * Property 7: Talk Button Visibility Based on Affinity and Dialogues
   * Validates: Requirements 1.1, 1.3
   *
   * For any character with affinity tracking and dialogues, the Talk button should be visible;
   * otherwise it should not be visible.
   */
  it('Property 7: Talk button visibility based on affinity and dialogues', () => {
    fc.assert(
      fc.property(
        // Generate test scenarios with different combinations
        fc.record({
          hasAffinity: fc.boolean(),
          hasDialogues: fc.boolean(),
          characterName: fc.string({ minLength: 1, maxLength: 20 }),
          characterTitle: fc.string({ minLength: 1, maxLength: 20 })
        }),
        (testData) => {
          // Clean up any existing entities
          const existingEntities = world.getAllEntities();
          existingEntities.forEach(entity => world.destroyEntity(entity.id));

          // Create test character
          const character = createTestCharacter(
            world,
            testData.characterName,
            testData.characterTitle
          );

          // Conditionally add AffinityComponent
          if (testData.hasAffinity) {
            const affinity: AffinityComponent = {
              type: 'affinity',
              relationships: new Map()
            };
            world.addComponent(character.id, AffinityComponentType, affinity);
          }

          // Conditionally add dialogues to DialogueSystem
          if (testData.hasDialogues) {
            const dialogueTopic: DialogueTopic = {
              id: `dialogue_${character.id}_1`,
              characterId: character.id,
              topic: 'Test Topic',
              npcText: 'Test dialogue text',
              responses: [
                { text: 'Response 1', affinityEffect: 5 },
                { text: 'Response 2', affinityEffect: -5 }
              ]
            };

            // Load dialogue into system
            dialogueSystem.loadDialogues({
              dialogues: [dialogueTopic]
            });
          }

          // Render the panel
          characterPanel.show();
          characterPanel.render();

          // Select the character
          const characterItem = characterPanel.element.querySelector('.character-item') as HTMLElement;
          if (characterItem) {
            characterItem.click();
          }

          // Check for Talk button
          const talkButton = characterPanel.element.querySelector('.talk-btn') as HTMLButtonElement;

          // Expected visibility: button should exist if and only if both conditions are met
          const shouldBeVisible = testData.hasAffinity && testData.hasDialogues;

          if (shouldBeVisible) {
            // Talk button should be visible
            expect(talkButton).toBeTruthy();
            expect(talkButton).not.toBeNull();
          } else {
            // Talk button should NOT be visible
            expect(talkButton).toBeNull();
          }
        }
      ),
      { numRuns: 50 } // Run 50 iterations to cover different combinations
    );
  });
});

/**
 * Helper function to create a test character with basic components
 */
function createTestCharacter(
  world: World,
  name: string = 'Test Character',
  title: string = 'Test Title',
  rarity: RarityType = RarityType.Common
): Entity {
  const character = world.createEntity();

  // Add character info component
  const characterInfo: CharacterInfoComponent = {
    type: 'characterInfo',
    title: title,
    name: name,
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
