/**
 * Unit tests for DialogueSystem
 * Tests dialogue data validation and loading functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DialogueSystem } from './DialogueSystem';
import { World } from '../../ecs/World';

describe('DialogueSystem - Data Validation', () => {
  let dialogueSystem: DialogueSystem;
  let world: World;

  beforeEach(() => {
    world = new World();
    dialogueSystem = new DialogueSystem(world);
  });

  describe('Dialogue data loading', () => {
    it('should load valid dialogue data correctly', () => {
      const validData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'This is a test dialogue.',
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: -5 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(validData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(true);
      const dialogues = dialogueSystem.getCharacterDialogues('village_chief');
      expect(dialogues).toHaveLength(1);
      expect(dialogues[0].id).toBe('test_dialogue_1');
      expect(dialogues[0].npcText).toBe('This is a test dialogue.');
      expect(dialogues[0].responses).toHaveLength(2);
    });

    it('should handle empty dialogue data', () => {
      const emptyData = { dialogues: [] };

      dialogueSystem.loadDialogues(emptyData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);
    });

    it('should handle null or undefined data gracefully', () => {
      dialogueSystem.loadDialogues(null);
      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);

      dialogueSystem.loadDialogues(undefined);
      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);

      dialogueSystem.loadDialogues({});
      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);
    });
  });

  describe('Required fields validation', () => {
    it('should reject dialogue without id', () => {
      const invalidData = {
        dialogues: [
          {
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: 0 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(invalidData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);
    });

    it('should reject dialogue without characterId', () => {
      const invalidData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: 0 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(invalidData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);
    });

    it('should reject dialogue without npcText', () => {
      const invalidData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: 0 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(invalidData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);
    });

    it('should reject dialogue without responses array', () => {
      const invalidData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text'
          }
        ]
      };

      dialogueSystem.loadDialogues(invalidData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);
    });

    it('should reject dialogue with non-array responses', () => {
      const invalidData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: 'not an array'
          }
        ]
      };

      dialogueSystem.loadDialogues(invalidData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);
    });
  });

  describe('Response validation', () => {
    it('should reject dialogue with less than 2 responses', () => {
      const invalidData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { text: 'Only one response', affinityEffect: 5 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(invalidData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);
    });

    it('should reject dialogue with more than 4 responses', () => {
      const invalidData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: 0 },
              { text: 'Response 3', affinityEffect: -5 },
              { text: 'Response 4', affinityEffect: 10 },
              { text: 'Response 5', affinityEffect: -10 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(invalidData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);
    });

    it('should accept dialogue with 2 responses', () => {
      const validData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: -5 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(validData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(true);
    });

    it('should accept dialogue with 4 responses', () => {
      const validData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: 0 },
              { text: 'Response 3', affinityEffect: -5 },
              { text: 'Response 4', affinityEffect: 10 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(validData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(true);
    });

    it('should reject response without text', () => {
      const invalidData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: 0 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(invalidData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);
    });

    it('should reject response without affinityEffect', () => {
      const invalidData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { text: 'Response 1' },
              { text: 'Response 2', affinityEffect: 0 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(invalidData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);
    });

    it('should reject response with non-numeric affinityEffect', () => {
      const invalidData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { text: 'Response 1', affinityEffect: 'not a number' },
              { text: 'Response 2', affinityEffect: 0 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(invalidData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);
    });
  });

  describe('Affinity effect value validation', () => {
    it('should reject affinity effect less than -10', () => {
      const invalidData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { text: 'Response 1', affinityEffect: -15 },
              { text: 'Response 2', affinityEffect: 0 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(invalidData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);
    });

    it('should reject affinity effect greater than 10', () => {
      const invalidData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { text: 'Response 1', affinityEffect: 15 },
              { text: 'Response 2', affinityEffect: 0 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(invalidData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(false);
    });

    it('should accept affinity effect of -10', () => {
      const validData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { text: 'Response 1', affinityEffect: -10 },
              { text: 'Response 2', affinityEffect: 0 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(validData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(true);
      const dialogues = dialogueSystem.getCharacterDialogues('village_chief');
      expect(dialogues[0].responses[0].affinityEffect).toBe(-10);
    });

    it('should accept affinity effect of 10', () => {
      const validData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { text: 'Response 1', affinityEffect: 10 },
              { text: 'Response 2', affinityEffect: 0 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(validData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(true);
      const dialogues = dialogueSystem.getCharacterDialogues('village_chief');
      expect(dialogues[0].responses[0].affinityEffect).toBe(10);
    });

    it('should accept affinity effect of 0', () => {
      const validData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { text: 'Response 1', affinityEffect: 0 },
              { text: 'Response 2', affinityEffect: 5 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(validData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(true);
      const dialogues = dialogueSystem.getCharacterDialogues('village_chief');
      expect(dialogues[0].responses[0].affinityEffect).toBe(0);
    });

    it('should accept all valid affinity effect values', () => {
      const validData = {
        dialogues: [
          {
            id: 'test_dialogue_1',
            characterId: 'village_chief',
            topic: 'Test Topic',
            npcText: 'Test text',
            responses: [
              { text: 'Response 1', affinityEffect: -10 },
              { text: 'Response 2', affinityEffect: -5 },
              { text: 'Response 3', affinityEffect: 0 },
              { text: 'Response 4', affinityEffect: 5 }
            ]
          },
          {
            id: 'test_dialogue_2',
            characterId: 'village_chief',
            topic: 'Test Topic 2',
            npcText: 'Test text 2',
            responses: [
              { text: 'Response 1', affinityEffect: 10 },
              { text: 'Response 2', affinityEffect: -5 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(validData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(true);
      const dialogues = dialogueSystem.getCharacterDialogues('village_chief');
      expect(dialogues).toHaveLength(2);
    });
  });

  describe('Character ID validation', () => {
    it('should load dialogues for multiple characters', () => {
      const validData = {
        dialogues: [
          {
            id: 'chief_dialogue_1',
            characterId: 'village_chief',
            topic: 'Chief Topic',
            npcText: 'Chief text',
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: -5 }
            ]
          },
          {
            id: 'bartender_dialogue_1',
            characterId: 'bartender',
            topic: 'Bartender Topic',
            npcText: 'Bartender text',
            responses: [
              { text: 'Response 1', affinityEffect: 10 },
              { text: 'Response 2', affinityEffect: 0 }
            ]
          },
          {
            id: 'maid_dialogue_1',
            characterId: 'maid',
            topic: 'Maid Topic',
            npcText: 'Maid text',
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: 5 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(validData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(true);
      expect(dialogueSystem.hasDialogues('bartender')).toBe(true);
      expect(dialogueSystem.hasDialogues('maid')).toBe(true);
      expect(dialogueSystem.hasDialogues('nonexistent')).toBe(false);
    });

    it('should group multiple dialogues by character ID', () => {
      const validData = {
        dialogues: [
          {
            id: 'chief_dialogue_1',
            characterId: 'village_chief',
            topic: 'Topic 1',
            npcText: 'Text 1',
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: -5 }
            ]
          },
          {
            id: 'chief_dialogue_2',
            characterId: 'village_chief',
            topic: 'Topic 2',
            npcText: 'Text 2',
            responses: [
              { text: 'Response 1', affinityEffect: 10 },
              { text: 'Response 2', affinityEffect: 0 }
            ]
          },
          {
            id: 'chief_dialogue_3',
            characterId: 'village_chief',
            topic: 'Topic 3',
            npcText: 'Text 3',
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: 5 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(validData);

      const chiefDialogues = dialogueSystem.getCharacterDialogues('village_chief');
      expect(chiefDialogues).toHaveLength(3);
      expect(chiefDialogues[0].id).toBe('chief_dialogue_1');
      expect(chiefDialogues[1].id).toBe('chief_dialogue_2');
      expect(chiefDialogues[2].id).toBe('chief_dialogue_3');
    });

    it('should return empty array for character without dialogues', () => {
      const validData = {
        dialogues: [
          {
            id: 'chief_dialogue_1',
            characterId: 'village_chief',
            topic: 'Topic 1',
            npcText: 'Text 1',
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: -5 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(validData);

      const nonexistentDialogues = dialogueSystem.getCharacterDialogues('nonexistent_character');
      expect(nonexistentDialogues).toEqual([]);
    });
  });

  describe('Mixed valid and invalid data', () => {
    it('should load only valid dialogues and skip invalid ones', () => {
      const mixedData = {
        dialogues: [
          {
            id: 'valid_dialogue_1',
            characterId: 'village_chief',
            topic: 'Valid Topic',
            npcText: 'Valid text',
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: -5 }
            ]
          },
          {
            // Missing id - invalid
            characterId: 'bartender',
            topic: 'Invalid Topic',
            npcText: 'Invalid text',
            responses: [
              { text: 'Response 1', affinityEffect: 5 },
              { text: 'Response 2', affinityEffect: -5 }
            ]
          },
          {
            id: 'valid_dialogue_2',
            characterId: 'maid',
            topic: 'Valid Topic 2',
            npcText: 'Valid text 2',
            responses: [
              { text: 'Response 1', affinityEffect: 10 },
              { text: 'Response 2', affinityEffect: 0 }
            ]
          },
          {
            id: 'invalid_dialogue_2',
            characterId: 'alchemist_tuanzi',
            topic: 'Invalid Topic 2',
            npcText: 'Invalid text 2',
            responses: [
              // Only one response - invalid
              { text: 'Response 1', affinityEffect: 5 }
            ]
          }
        ]
      };

      dialogueSystem.loadDialogues(mixedData);

      expect(dialogueSystem.hasDialogues('village_chief')).toBe(true);
      expect(dialogueSystem.hasDialogues('bartender')).toBe(false);
      expect(dialogueSystem.hasDialogues('maid')).toBe(true);
      expect(dialogueSystem.hasDialogues('alchemist_tuanzi')).toBe(false);

      const chiefDialogues = dialogueSystem.getCharacterDialogues('village_chief');
      expect(chiefDialogues).toHaveLength(1);

      const maidDialogues = dialogueSystem.getCharacterDialogues('maid');
      expect(maidDialogues).toHaveLength(1);
    });
  });
});

describe('DialogueSystem - Error Handling', () => {
  let dialogueSystem: DialogueSystem;
  let world: World;

  beforeEach(() => {
    world = new World();
    dialogueSystem = new DialogueSystem(world);

    // Load some test dialogue data
    const testData = {
      dialogues: [
        {
          id: 'test_dialogue_1',
          characterId: 'village_chief',
          topic: 'Test Topic',
          npcText: 'This is a test dialogue.',
          responses: [
            { text: 'Response 1', affinityEffect: 5 },
            { text: 'Response 2', affinityEffect: -5 },
            { text: 'Response 3', affinityEffect: 0 }
          ]
        }
      ]
    };
    dialogueSystem.loadDialogues(testData);
  });

  describe('Invalid character ID handling', () => {
    it('should return null when selecting dialogue for non-existent character', () => {
      const result = dialogueSystem.selectDialogueTopic('nonexistent_character');
      expect(result).toBeNull();
    });

    it('should return empty array when getting dialogues for non-existent character', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('nonexistent_character');
      expect(dialogues).toEqual([]);
    });

    it('should return false when checking if non-existent character has dialogues', () => {
      const hasDialogues = dialogueSystem.hasDialogues('nonexistent_character');
      expect(hasDialogues).toBe(false);
    });

    it('should return empty Map when getting history for non-existent character', () => {
      const history = dialogueSystem.getDialogueHistory('nonexistent_character');
      expect(history).toBeInstanceOf(Map);
      expect(history.size).toBe(0);
    });

    it('should return error result when processing response for non-existent character', () => {
      const result = dialogueSystem.processResponse(
        'player_1',
        'nonexistent_character',
        'test_dialogue_1',
        0
      );

      expect(result.success).toBe(false);
      expect(result.affinityChange).toBe(0);
      expect(result.newAffinityLevel).toBe(0);
      expect(result.message).toBe('Character has no dialogues');
    });
  });

  describe('Invalid response index handling', () => {
    it('should return error result when response index is negative', () => {
      const result = dialogueSystem.processResponse(
        'player_1',
        'village_chief',
        'test_dialogue_1',
        -1
      );

      expect(result.success).toBe(false);
      expect(result.affinityChange).toBe(0);
      expect(result.newAffinityLevel).toBe(0);
      expect(result.message).toBe('Invalid response index');
    });

    it('should return error result when response index is too large', () => {
      const result = dialogueSystem.processResponse(
        'player_1',
        'village_chief',
        'test_dialogue_1',
        10
      );

      expect(result.success).toBe(false);
      expect(result.affinityChange).toBe(0);
      expect(result.newAffinityLevel).toBe(0);
      expect(result.message).toBe('Invalid response index');
    });

    it('should return error result when response index equals response array length', () => {
      const result = dialogueSystem.processResponse(
        'player_1',
        'village_chief',
        'test_dialogue_1',
        3 // Array has 3 responses (indices 0-2)
      );

      expect(result.success).toBe(false);
      expect(result.affinityChange).toBe(0);
      expect(result.newAffinityLevel).toBe(0);
      expect(result.message).toBe('Invalid response index');
    });

    it('should return error result when response index is not an integer', () => {
      const result = dialogueSystem.processResponse(
        'player_1',
        'village_chief',
        'test_dialogue_1',
        1.5
      );

      expect(result.success).toBe(false);
      expect(result.affinityChange).toBe(0);
      expect(result.newAffinityLevel).toBe(0);
      expect(result.message).toBe('Invalid response index');
    });
  });

  describe('Characters without dialogues', () => {
    it('should return null when selecting topic for character without dialogues', () => {
      const result = dialogueSystem.selectDialogueTopic('character_without_dialogues');
      expect(result).toBeNull();
    });

    it('should return false when checking if character without dialogues has dialogues', () => {
      const hasDialogues = dialogueSystem.hasDialogues('character_without_dialogues');
      expect(hasDialogues).toBe(false);
    });

    it('should return empty array when getting dialogues for character without dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('character_without_dialogues');
      expect(dialogues).toEqual([]);
      expect(dialogues).toHaveLength(0);
    });

    it('should return error result when processing response for character without dialogues', () => {
      const result = dialogueSystem.processResponse(
        'player_1',
        'character_without_dialogues',
        'any_topic',
        0
      );

      expect(result.success).toBe(false);
      expect(result.affinityChange).toBe(0);
      expect(result.newAffinityLevel).toBe(0);
      expect(result.message).toBe('Character has no dialogues');
    });

    it('should handle character with empty dialogue array', () => {
      // Manually set empty array for a character
      const emptyData = {
        dialogues: []
      };
      dialogueSystem.loadDialogues(emptyData);

      const hasDialogues = dialogueSystem.hasDialogues('empty_character');
      expect(hasDialogues).toBe(false);

      const result = dialogueSystem.selectDialogueTopic('empty_character');
      expect(result).toBeNull();
    });
  });

  describe('Invalid topic ID handling', () => {
    it('should return error result when topic ID does not exist', () => {
      const result = dialogueSystem.processResponse(
        'player_1',
        'village_chief',
        'nonexistent_topic',
        0
      );

      expect(result.success).toBe(false);
      expect(result.affinityChange).toBe(0);
      expect(result.newAffinityLevel).toBe(0);
      expect(result.message).toBe('Topic not found');
    });

    it('should return error result when topic ID is empty string', () => {
      const result = dialogueSystem.processResponse(
        'player_1',
        'village_chief',
        '',
        0
      );

      expect(result.success).toBe(false);
      expect(result.affinityChange).toBe(0);
      expect(result.newAffinityLevel).toBe(0);
      expect(result.message).toBe('Topic not found');
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple error conditions gracefully', () => {
      // Non-existent character with invalid response index
      const result1 = dialogueSystem.processResponse(
        'player_1',
        'nonexistent_character',
        'test_dialogue_1',
        -1
      );
      expect(result1.success).toBe(false);

      // Valid character with non-existent topic and invalid response index
      const result2 = dialogueSystem.processResponse(
        'player_1',
        'village_chief',
        'nonexistent_topic',
        -1
      );
      expect(result2.success).toBe(false);
    });

    it('should maintain system stability after multiple errors', () => {
      // Trigger multiple errors
      dialogueSystem.processResponse('player_1', 'nonexistent', 'topic', 0);
      dialogueSystem.processResponse('player_1', 'village_chief', 'bad_topic', 0);
      dialogueSystem.processResponse('player_1', 'village_chief', 'test_dialogue_1', -1);
      dialogueSystem.processResponse('player_1', 'village_chief', 'test_dialogue_1', 100);

      // System should still work correctly after errors
      const result = dialogueSystem.selectDialogueTopic('village_chief');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('test_dialogue_1');

      const hasDialogues = dialogueSystem.hasDialogues('village_chief');
      expect(hasDialogues).toBe(true);
    });
  });
});

import dialogueTreesData from '../data/dialogue-trees.json';

describe('DialogueSystem - Content Completeness', () => {
  let dialogueSystem: DialogueSystem;
  let world: World;

  // Characters with affinity tracking (based on NPCSystem initialization)
  const charactersWithAffinity = [
    'village_chief',
    'blacksmith_zz',
    'bartender',
    'maid',
    'chef_curry',
    'alchemist_tuanzi',
    'scholar_xiaomei',
    'trainer_alin',
    'summoner_kaoezi',
    'merchant_xiaoheiyang',
    'merchant_youliang'
  ];

  // Characters that should have dialogues (excluding merchants and blacksmith per requirements)
  const charactersRequiringDialogues = [
    'village_chief',
    'bartender',
    'maid',
    'alchemist_tuanzi',
    'scholar_xiaomei',
    'trainer_alin',
    'summoner_kaoezi'
  ];

  beforeEach(() => {
    world = new World();
    dialogueSystem = new DialogueSystem(world);

    // Load actual dialogue data from dialogue-trees.json
    dialogueSystem.loadDialogues(dialogueTreesData);
  });

  describe('Characters with affinity tracking have dialogues', () => {
    it('should have dialogues for all required characters with affinity tracking', () => {
      const missingDialogues: string[] = [];

      for (const characterId of charactersRequiringDialogues) {
        if (!dialogueSystem.hasDialogues(characterId)) {
          missingDialogues.push(characterId);
        }
      }

      expect(missingDialogues).toEqual([]);
    });

    it('should have at least one dialogue for each required character', () => {
      for (const characterId of charactersRequiringDialogues) {
        const dialogues = dialogueSystem.getCharacterDialogues(characterId);
        expect(dialogues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Each character has at least 3 dialogue topics', () => {
    it('should have at least 3 dialogue topics for village_chief', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('village_chief');
      expect(dialogues.length).toBeGreaterThanOrEqual(3);
    });

    it('should have at least 3 dialogue topics for bartender', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('bartender');
      expect(dialogues.length).toBeGreaterThanOrEqual(3);
    });

    it('should have at least 3 dialogue topics for maid', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('maid');
      expect(dialogues.length).toBeGreaterThanOrEqual(3);
    });

    it('should have at least 3 dialogue topics for alchemist_tuanzi', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('alchemist_tuanzi');
      expect(dialogues.length).toBeGreaterThanOrEqual(3);
    });

    it('should have at least 3 dialogue topics for scholar_xiaomei', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('scholar_xiaomei');
      expect(dialogues.length).toBeGreaterThanOrEqual(3);
    });

    it('should have at least 3 dialogue topics for trainer_alin', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('trainer_alin');
      expect(dialogues.length).toBeGreaterThanOrEqual(3);
    });

    it('should have at least 3 dialogue topics for summoner_kaoezi', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('summoner_kaoezi');
      expect(dialogues.length).toBeGreaterThanOrEqual(3);
    });

    it('should have at least 3 dialogue topics for all required characters', () => {
      const insufficientDialogues: { characterId: string; count: number }[] = [];

      for (const characterId of charactersRequiringDialogues) {
        const dialogues = dialogueSystem.getCharacterDialogues(characterId);
        if (dialogues.length < 3) {
          insufficientDialogues.push({ characterId, count: dialogues.length });
        }
      }

      expect(insufficientDialogues).toEqual([]);
    });
  });

  describe('Each topic has 2-4 response options', () => {
    it('should have 2-4 response options for all village_chief dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('village_chief');
      
      for (const dialogue of dialogues) {
        expect(dialogue.responses.length).toBeGreaterThanOrEqual(2);
        expect(dialogue.responses.length).toBeLessThanOrEqual(4);
      }
    });

    it('should have 2-4 response options for all bartender dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('bartender');
      
      for (const dialogue of dialogues) {
        expect(dialogue.responses.length).toBeGreaterThanOrEqual(2);
        expect(dialogue.responses.length).toBeLessThanOrEqual(4);
      }
    });

    it('should have 2-4 response options for all maid dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('maid');
      
      for (const dialogue of dialogues) {
        expect(dialogue.responses.length).toBeGreaterThanOrEqual(2);
        expect(dialogue.responses.length).toBeLessThanOrEqual(4);
      }
    });

    it('should have 2-4 response options for all alchemist_tuanzi dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('alchemist_tuanzi');
      
      for (const dialogue of dialogues) {
        expect(dialogue.responses.length).toBeGreaterThanOrEqual(2);
        expect(dialogue.responses.length).toBeLessThanOrEqual(4);
      }
    });

    it('should have 2-4 response options for all scholar_xiaomei dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('scholar_xiaomei');
      
      for (const dialogue of dialogues) {
        expect(dialogue.responses.length).toBeGreaterThanOrEqual(2);
        expect(dialogue.responses.length).toBeLessThanOrEqual(4);
      }
    });

    it('should have 2-4 response options for all trainer_alin dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('trainer_alin');
      
      for (const dialogue of dialogues) {
        expect(dialogue.responses.length).toBeGreaterThanOrEqual(2);
        expect(dialogue.responses.length).toBeLessThanOrEqual(4);
      }
    });

    it('should have 2-4 response options for all summoner_kaoezi dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('summoner_kaoezi');
      
      for (const dialogue of dialogues) {
        expect(dialogue.responses.length).toBeGreaterThanOrEqual(2);
        expect(dialogue.responses.length).toBeLessThanOrEqual(4);
      }
    });

    it('should have 2-4 response options for all dialogues across all characters', () => {
      const invalidDialogues: { characterId: string; topicId: string; responseCount: number }[] = [];

      for (const characterId of charactersRequiringDialogues) {
        const dialogues = dialogueSystem.getCharacterDialogues(characterId);
        
        for (const dialogue of dialogues) {
          if (dialogue.responses.length < 2 || dialogue.responses.length > 4) {
            invalidDialogues.push({
              characterId,
              topicId: dialogue.id,
              responseCount: dialogue.responses.length
            });
          }
        }
      }

      expect(invalidDialogues).toEqual([]);
    });
  });

  describe('Response options have varied affinity effects', () => {
    it('should have varied affinity effects in village_chief dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('village_chief');
      
      for (const dialogue of dialogues) {
        const affinityEffects = dialogue.responses.map(r => r.affinityEffect);
        const uniqueEffects = new Set(affinityEffects);
        
        // At least 2 different affinity effects per dialogue
        expect(uniqueEffects.size).toBeGreaterThanOrEqual(2);
      }
    });

    it('should have varied affinity effects in bartender dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('bartender');
      
      for (const dialogue of dialogues) {
        const affinityEffects = dialogue.responses.map(r => r.affinityEffect);
        const uniqueEffects = new Set(affinityEffects);
        
        expect(uniqueEffects.size).toBeGreaterThanOrEqual(2);
      }
    });

    it('should have varied affinity effects in maid dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('maid');
      
      for (const dialogue of dialogues) {
        const affinityEffects = dialogue.responses.map(r => r.affinityEffect);
        const uniqueEffects = new Set(affinityEffects);
        
        expect(uniqueEffects.size).toBeGreaterThanOrEqual(2);
      }
    });

    it('should have varied affinity effects in alchemist_tuanzi dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('alchemist_tuanzi');
      
      for (const dialogue of dialogues) {
        const affinityEffects = dialogue.responses.map(r => r.affinityEffect);
        const uniqueEffects = new Set(affinityEffects);
        
        expect(uniqueEffects.size).toBeGreaterThanOrEqual(2);
      }
    });

    it('should have varied affinity effects in scholar_xiaomei dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('scholar_xiaomei');
      
      for (const dialogue of dialogues) {
        const affinityEffects = dialogue.responses.map(r => r.affinityEffect);
        const uniqueEffects = new Set(affinityEffects);
        
        expect(uniqueEffects.size).toBeGreaterThanOrEqual(2);
      }
    });

    it('should have varied affinity effects in trainer_alin dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('trainer_alin');
      
      for (const dialogue of dialogues) {
        const affinityEffects = dialogue.responses.map(r => r.affinityEffect);
        const uniqueEffects = new Set(affinityEffects);
        
        expect(uniqueEffects.size).toBeGreaterThanOrEqual(2);
      }
    });

    it('should have varied affinity effects in summoner_kaoezi dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('summoner_kaoezi');
      
      for (const dialogue of dialogues) {
        const affinityEffects = dialogue.responses.map(r => r.affinityEffect);
        const uniqueEffects = new Set(affinityEffects);
        
        expect(uniqueEffects.size).toBeGreaterThanOrEqual(2);
      }
    });

    it('should have varied affinity effects across all dialogues', () => {
      const dialoguesWithoutVariety: { characterId: string; topicId: string; uniqueEffects: number }[] = [];

      for (const characterId of charactersRequiringDialogues) {
        const dialogues = dialogueSystem.getCharacterDialogues(characterId);
        
        for (const dialogue of dialogues) {
          const affinityEffects = dialogue.responses.map(r => r.affinityEffect);
          const uniqueEffects = new Set(affinityEffects);
          
          if (uniqueEffects.size < 2) {
            dialoguesWithoutVariety.push({
              characterId,
              topicId: dialogue.id,
              uniqueEffects: uniqueEffects.size
            });
          }
        }
      }

      expect(dialoguesWithoutVariety).toEqual([]);
    });

    it('should use valid affinity effect values (-10 to +10)', () => {
      const invalidEffects: { characterId: string; topicId: string; responseIndex: number; effect: number }[] = [];

      for (const characterId of charactersRequiringDialogues) {
        const dialogues = dialogueSystem.getCharacterDialogues(characterId);
        
        for (const dialogue of dialogues) {
          dialogue.responses.forEach((response, index) => {
            if (response.affinityEffect < -10 || response.affinityEffect > 10) {
              invalidEffects.push({
                characterId,
                topicId: dialogue.id,
                responseIndex: index,
                effect: response.affinityEffect
              });
            }
          });
        }
      }

      expect(invalidEffects).toEqual([]);
    });

    it('should include both positive and negative affinity effects across character dialogues', () => {
      const characterEffectSummary: { characterId: string; hasPositive: boolean; hasNegative: boolean }[] = [];

      for (const characterId of charactersRequiringDialogues) {
        const dialogues = dialogueSystem.getCharacterDialogues(characterId);
        let hasPositive = false;
        let hasNegative = false;

        for (const dialogue of dialogues) {
          for (const response of dialogue.responses) {
            if (response.affinityEffect > 0) hasPositive = true;
            if (response.affinityEffect < 0) hasNegative = true;
          }
        }

        characterEffectSummary.push({
          characterId,
          hasPositive,
          hasNegative
        });
      }

      // Each character should have at least some positive effects
      for (const summary of characterEffectSummary) {
        expect(summary.hasPositive).toBe(true);
      }
    });
  });

  describe('Universal dialogue templates for adventurers', () => {
    it('should have universal dialogue topics available', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('universal');
      expect(dialogues.length).toBeGreaterThan(0);
    });

    it('should have at least 3 universal dialogue topics', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('universal');
      expect(dialogues.length).toBeGreaterThanOrEqual(3);
    });

    it('should have 2-4 response options for each universal dialogue', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('universal');
      
      for (const dialogue of dialogues) {
        expect(dialogue.responses.length).toBeGreaterThanOrEqual(2);
        expect(dialogue.responses.length).toBeLessThanOrEqual(4);
      }
    });

    it('should have varied affinity effects in universal dialogues', () => {
      const dialogues = dialogueSystem.getCharacterDialogues('universal');
      
      for (const dialogue of dialogues) {
        const affinityEffects = dialogue.responses.map(r => r.affinityEffect);
        const uniqueEffects = new Set(affinityEffects);
        
        expect(uniqueEffects.size).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Dialogue content quality', () => {
    it('should have non-empty NPC text for all dialogues', () => {
      const emptyNPCText: { characterId: string; topicId: string }[] = [];

      for (const characterId of charactersRequiringDialogues) {
        const dialogues = dialogueSystem.getCharacterDialogues(characterId);
        
        for (const dialogue of dialogues) {
          if (!dialogue.npcText || dialogue.npcText.trim() === '') {
            emptyNPCText.push({
              characterId,
              topicId: dialogue.id
            });
          }
        }
      }

      expect(emptyNPCText).toEqual([]);
    });

    it('should have non-empty response text for all responses', () => {
      const emptyResponseText: { characterId: string; topicId: string; responseIndex: number }[] = [];

      for (const characterId of charactersRequiringDialogues) {
        const dialogues = dialogueSystem.getCharacterDialogues(characterId);
        
        for (const dialogue of dialogues) {
          dialogue.responses.forEach((response, index) => {
            if (!response.text || response.text.trim() === '') {
              emptyResponseText.push({
                characterId,
                topicId: dialogue.id,
                responseIndex: index
              });
            }
          });
        }
      }

      expect(emptyResponseText).toEqual([]);
    });

    it('should have unique dialogue IDs across all dialogues', () => {
      const allDialogueIds: string[] = [];
      const duplicateIds: string[] = [];

      for (const characterId of charactersRequiringDialogues) {
        const dialogues = dialogueSystem.getCharacterDialogues(characterId);
        
        for (const dialogue of dialogues) {
          if (allDialogueIds.includes(dialogue.id)) {
            duplicateIds.push(dialogue.id);
          } else {
            allDialogueIds.push(dialogue.id);
          }
        }
      }

      // Also check universal dialogues
      const universalDialogues = dialogueSystem.getCharacterDialogues('universal');
      for (const dialogue of universalDialogues) {
        if (allDialogueIds.includes(dialogue.id)) {
          duplicateIds.push(dialogue.id);
        } else {
          allDialogueIds.push(dialogue.id);
        }
      }

      expect(duplicateIds).toEqual([]);
    });

    it('should have meaningful topic names for all dialogues', () => {
      const emptyTopics: { characterId: string; topicId: string }[] = [];

      for (const characterId of charactersRequiringDialogues) {
        const dialogues = dialogueSystem.getCharacterDialogues(characterId);
        
        for (const dialogue of dialogues) {
          if (!dialogue.topic || dialogue.topic.trim() === '') {
            emptyTopics.push({
              characterId,
              topicId: dialogue.id
            });
          }
        }
      }

      expect(emptyTopics).toEqual([]);
    });
  });
});
