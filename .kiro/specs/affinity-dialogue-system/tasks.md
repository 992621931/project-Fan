# Implementation Plan: Affinity Dialogue System

## Overview

This implementation plan breaks down the Affinity Dialogue System into discrete coding tasks. The system will be built incrementally, starting with the data structure and core DialogueSystem logic, then adding the DialogueModal UI component, and finally integrating with the CharacterPanel. Each task builds on previous work to ensure continuous validation.

## Tasks

- [x] 1. Extend dialogue data structure to support conversation trees
  - [x] 1.1 Design extended dialogue JSON format
    - Extend existing `dialogues.json` to support conversation trees
    - Define structure: dialogue ID, character ID, topic, NPC text, response options array
    - Each response option includes: text, affinity effect value (-10, -5, 0, +5, +10)
    - Support multiple conversation topics per character
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 1.2 Create sample dialogue data for initial characters
    - Add 3-5 conversation topics for village_chief (profession-specific: governance, village matters)
    - Add 3-5 conversation topics for bartender (profession-specific: tavern, gossip)
    - Add 3-5 conversation topics for maid (profession-specific: service, hospitality)
    - Add 3-5 conversation topics for adventurer (universal: combat, exploration, philosophy)
    - Add 3-5 conversation topics for alchemist_tuanzi (profession-specific: alchemy, potions)
    - Each topic includes 2-4 response options with varying affinity effects
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3_

  - [x] 1.3 Write unit tests for dialogue data validation
    - Test that dialogue data loads correctly
    - Test that all required fields are present
    - Test that affinity effect values are within valid range
    - Test that character IDs reference existing characters
    - _Requirements: 7.5_

- [x] 2. Implement DialogueSystem core logic
  - [x] 2.1 Create DialogueSystem class and interfaces
    - Create `src/game/systems/DialogueSystem.ts`
    - Define interfaces: DialogueTopic, ResponseOption, DialogueHistory, DialogueResult
    - Extend System class with required components
    - Initialize dialogue storage using Map<string, DialogueTopic[]>
    - Initialize dialogue history storage using Map<EntityId, Map<string, number>>
    - _Requirements: 2.1, 2.2, 6.1_

  - [x] 2.2 Implement dialogue loading from JSON
    - Create `loadDialogues(dialoguesData: any): void` method
    - Parse extended dialogue JSON format
    - Populate dialogues Map with conversation topics
    - Validate dialogue structure during loading
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 2.3 Write property test for dialogue structure validation
    - **Property 1: Dialogue Structure Validation**
    - For any loaded dialogue topic, it must contain valid character ID, topic ID, NPC text, and 2-4 response options
    - **Validates: Requirements 7.2, 7.3, 7.4**

  - [x] 2.4 Implement dialogue topic selection logic
    - Create `selectDialogueTopic(characterId: EntityId): DialogueTopic | null` method
    - Query dialogue history for the character
    - Prioritize topics not recently seen
    - Return null if character has no dialogues
    - _Requirements: 1.4, 6.2, 6.3_

  - [x] 2.5 Write property test for topic selection variety
    - **Property 2: Topic Selection Prioritizes Unseen Topics**
    - For any character with multiple topics, if some topics have not been seen, selectDialogueTopic should never return a recently seen topic
    - **Validates: Requirements 6.2**

  - [x] 2.6 Implement response processing logic
    - Create `processResponse(playerId: EntityId, characterId: EntityId, topicId: string, responseIndex: number): DialogueResult` method
    - Validate response index is within bounds
    - Get affinity effect from selected response option
    - Call AffinitySystem.interact() or create new method for dialogue affinity changes
    - Record dialogue topic in history
    - Emit 'dialogue:completed' event with affinity change
    - Return result with success status and affinity change
    - _Requirements: 2.4, 3.1, 3.2, 3.3, 3.4, 6.1_

  - [x] 2.7 Write property test for affinity effect application
    - **Property 3: Response Affinity Effect Applied Correctly**
    - For any valid response selection, the character's affinity should change by exactly the response's affinity effect value
    - **Validates: Requirements 3.1, 3.2**

  - [x] 2.8 Write property test for dialogue history tracking
    - **Property 4: Dialogue History Persistence**
    - For any completed dialogue, querying the history should reflect that the topic was used
    - **Validates: Requirements 6.1, 6.4**

  - [x] 2.9 Implement helper methods
    - Create `getCharacterDialogues(characterId: EntityId): DialogueTopic[]` method
    - Create `hasDialogues(characterId: EntityId): boolean` method
    - Create `getDialogueHistory(characterId: EntityId): Map<string, number>` method
    - _Requirements: 1.1, 1.3_

  - [x] 2.10 Write unit tests for error handling
    - Test invalid character ID handling
    - Test invalid response index handling
    - Test characters without dialogues
    - _Requirements: 1.3_

- [x] 3. Checkpoint - Ensure DialogueSystem tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement DialogueModal UI component
  - [x] 4.1 Create DialogueModal class extending BaseUIComponent
    - Create `src/ui/components/DialogueModal.ts`
    - Set up modal structure with overlay, modal container, and close button
    - Create sections: character header (name + portrait), NPC dialogue text, response options area
    - Initialize component references
    - Add modal styling (centered, overlay background, appropriate z-index)
    - _Requirements: 9.1, 9.2, 9.5_

  - [x] 4.2 Implement character header rendering
    - Create `renderCharacterHeader(characterId: EntityId): void` method
    - Display character name from CharacterComponent
    - Display character portrait/icon
    - Apply appropriate styling
    - _Requirements: 9.1_

  - [x] 4.3 Implement NPC dialogue text rendering
    - Create `renderNPCDialogue(dialogueText: string): void` method
    - Display dialogue text with clear formatting
    - Ensure text is readable with appropriate font size and line height
    - _Requirements: 2.1, 9.2_

  - [x] 4.4 Implement response options rendering
    - Create `renderResponseOptions(options: ResponseOption[]): void` method
    - Render each option as a clickable button or list item
    - Add hover effects for visual feedback
    - Attach click handlers to each option
    - _Requirements: 2.2, 2.3, 9.3, 9.4_

  - [x] 4.5 Write property test for response option rendering
    - **Property 5: All Response Options Rendered**
    - For any dialogue topic with N response options, the modal should render exactly N clickable elements
    - **Validates: Requirements 2.2, 9.3**

  - [x] 4.6 Implement modal open/close logic
    - Create `open(characterId: EntityId, topic: DialogueTopic): void` method
    - Create `close(): void` method
    - Query DialogueSystem for dialogue topic
    - Render all modal sections when opening
    - Clear modal content when closing
    - Add/remove modal from DOM appropriately
    - _Requirements: 1.2, 9.5, 9.6_

  - [x] 4.7 Implement response selection handling
    - Create `handleResponseClick(responseIndex: number): void` method
    - Call DialogueSystem.processResponse()
    - Display affinity change feedback
    - Close modal after processing
    - Emit UI update events
    - _Requirements: 2.4, 3.1, 3.4, 9.6_

  - [x] 4.8 Implement affinity change visual feedback
    - Create `showAffinityFeedback(affinityChange: number): void` method
    - Display positive indicator for positive changes ("+5", "+10") with green styling
    - Display negative indicator for negative changes ("-5", "-10") with red styling
    - Display neutral indicator for zero change ("0") or no message
    - Position feedback near character portrait
    - Auto-dismiss after 2-3 seconds
    - _Requirements: 3.2, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 4.9 Write property test for affinity feedback display
    - **Property 6: Affinity Feedback Matches Change Direction**
    - For any affinity change, positive changes should display with positive styling, negative with negative styling, and zero with neutral styling
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [x] 4.10 Write unit tests for DialogueModal rendering
    - Test modal opens with correct character and dialogue
    - Test response options render correctly
    - Test modal closes after response selection
    - Test affinity feedback displays correctly
    - _Requirements: 9.1, 9.2, 9.3, 9.6_

- [x] 5. Checkpoint - Ensure DialogueModal tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integrate DialogueModal with CharacterPanel
  - [x] 6.1 Add "Talk" button to CharacterPanel
    - Modify `renderCharacterDetails()` method in CharacterPanel
    - Add "Talk" button to character details section
    - Show button only when character has affinity tracking enabled
    - Show button only when character has dialogues available
    - Position button appropriately in the UI
    - _Requirements: 1.1, 1.3_

  - [x] 6.2 Write property test for Talk button visibility
    - **Property 7: Talk Button Visibility Based on Affinity and Dialogues**
    - For any character with affinity tracking and dialogues, the Talk button should be visible; otherwise it should not be visible
    - **Validates: Requirements 1.1, 1.3**

  - [x] 6.3 Implement Talk button click handler
    - Create `handleTalkClick(characterId: EntityId): void` method in CharacterPanel
    - Query DialogueSystem for a dialogue topic
    - Open DialogueModal with selected topic
    - Handle case where no topics are available
    - _Requirements: 1.2, 1.4_

  - [x] 6.4 Register DialogueSystem with World
    - Add DialogueSystem to the game's system registry in main initialization
    - Ensure DialogueSystem initializes with dialogue data
    - Load extended dialogues from JSON file during initialization
    - _Requirements: 10.1, 10.3_

  - [x] 6.5 Set up event listeners for UI updates
    - Listen for 'dialogue:completed' events in CharacterPanel
    - Listen for 'affinity:changed' events to refresh character details
    - Ensure CharacterPanel updates affinity display after dialogue
    - _Requirements: 3.4, 10.4_

  - [x] 6.6 Write integration tests
    - Test CharacterPanel shows Talk button for appropriate characters
    - Test clicking Talk button opens DialogueModal
    - Test DialogueModal communicates correctly with DialogueSystem
    - Test affinity changes are reflected in CharacterPanel
    - Test dialogue history persists across sessions
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 7. Add dialogue content for remaining characters
  - [x] 7.1 Create dialogue topics for scholar_xiaomei
    - Add 3-5 profession-specific topics (research, knowledge, ancient texts)
    - Each topic with 2-4 response options and varying affinity effects
    - _Requirements: 4.4, 5.1_

  - [x] 7.2 Create dialogue topics for trainer_alin
    - Add 3-5 profession-specific topics (training, combat techniques, discipline)
    - Each topic with 2-4 response options and varying affinity effects
    - _Requirements: 4.4, 5.1_

  - [x] 7.3 Create dialogue topics for summoner_kaoezi
    - Add 3-5 profession-specific topics (summoning, magical creatures, rituals)
    - Each topic with 2-4 response options and varying affinity effects
    - _Requirements: 4.4, 5.1_

  - [x] 7.4 Create universal dialogue templates for additional adventurers
    - Create reusable dialogue topics applicable to any adventurer
    - Topics include: combat experiences, exploration stories, life philosophy, equipment preferences
    - Each topic with 2-4 response options and varying affinity effects
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 7.5 Write unit tests for dialogue content completeness
    - Test that all characters with affinity tracking have dialogues
    - Test that each character has at least 3 dialogue topics
    - Test that each topic has 2-4 response options
    - Test that response options have varied affinity effects
    - _Requirements: 2.5, 4.5, 5.3_

- [x] 8. Final checkpoint - End-to-end validation
  - Ensure all tests pass, ask the user if questions arise.
  - Verify Talk button appears for characters with affinity tracking
  - Verify clicking Talk button opens DialogueModal with appropriate content
  - Verify response selection affects character affinity correctly
  - Verify affinity change feedback displays correctly
  - Verify dialogue history prevents immediate topic repetition
  - Verify visual consistency with existing UI components

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation integrates with existing AffinitySystem and follows existing UI patterns
- TypeScript is used throughout, matching the existing codebase
- Dialogue content should be culturally appropriate and match character personalities
- The system is designed to be extensible for future dialogue content additions
