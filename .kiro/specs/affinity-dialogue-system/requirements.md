# Requirements Document

## Introduction

The Affinity Dialogue System enables players to interact with NPCs through conversations that affect relationship levels. Characters with affinity tracking can engage in dialogue where player responses influence the affinity value positively, negatively, or neutrally. Each character has profession-specific dialogue content, with adventurer characters featuring more universal conversation topics.

## Glossary

- **Affinity_System**: The existing system that tracks relationship levels between the player and NPCs
- **Character_Detail_Panel**: The UI panel displaying character information and stats
- **Dialogue_Tree**: A structured conversation with branching response options
- **Response_Option**: A player-selectable dialogue choice with an associated affinity effect
- **Affinity_Effect**: The numerical change to affinity value resulting from a response choice (+10, +5, 0, -5, -10)
- **Conversation_Topic**: A distinct dialogue scenario or subject matter for a character
- **Dialogue_Modal**: The UI component that displays NPC dialogue and player response options
- **Character_Prefab**: A predefined character template with associated dialogue content
- **Profession_Specific_Dialogue**: Conversation content tailored to a character's occupation or role
- **Universal_Dialogue**: Generic conversation topics applicable to adventurer characters

## Requirements

### Requirement 1: Dialogue System Access

**User Story:** As a player, I want to initiate conversations with NPCs who have affinity tracking, so that I can build relationships through dialogue.

#### Acceptance Criteria

1. WHEN a character has affinity tracking enabled, THE Character_Detail_Panel SHALL display a "Talk" button
2. WHEN the player clicks the "Talk" button, THE Dialogue_Modal SHALL open with a conversation topic for that character
3. WHEN a character does not have affinity tracking, THE Character_Detail_Panel SHALL NOT display a "Talk" button
4. WHEN the Dialogue_Modal opens, THE system SHALL select an appropriate conversation topic based on dialogue history

### Requirement 2: Dialogue Content Structure

**User Story:** As a player, I want to see rich dialogue content with multiple response options, so that I can make meaningful choices in conversations.

#### Acceptance Criteria

1. WHEN a dialogue is displayed, THE Dialogue_Modal SHALL show the NPC's dialogue text
2. WHEN a dialogue is displayed, THE Dialogue_Modal SHALL present 2-4 player response options
3. WHEN displaying response options, THE system SHALL include options with varying affinity effects (+10, +5, 0, -5, -10)
4. WHEN a player selects a response option, THE system SHALL process the affinity effect before closing the dialogue
5. THE system SHALL support multiple conversation topics per character

### Requirement 3: Affinity Effect Processing

**User Story:** As a player, I want my dialogue choices to affect character affinity, so that I can see the consequences of my responses.

#### Acceptance Criteria

1. WHEN a player selects a response option, THE Affinity_System SHALL modify the character's affinity by the specified effect value
2. WHEN affinity changes, THE system SHALL display visual feedback indicating the change direction and magnitude
3. WHEN affinity reaches minimum or maximum bounds, THE Affinity_System SHALL clamp the value appropriately
4. WHEN affinity changes, THE system SHALL emit an event for UI updates

### Requirement 4: Profession-Specific Dialogue Content

**User Story:** As a content designer, I want each character to have dialogue that fits their profession, so that conversations feel authentic and immersive.

#### Acceptance Criteria

1. WHEN creating dialogue for non-adventurer characters, THE dialogue content SHALL reference their specific profession or role
2. WHEN creating dialogue for the village chief, THE dialogue content SHALL relate to village leadership and governance
3. WHEN creating dialogue for the bartender, THE dialogue content SHALL relate to tavern operations and local gossip
4. WHEN creating dialogue for specialized NPCs (alchemist, scholar, trainer, summoner, maid), THE dialogue content SHALL relate to their specific expertise
5. THE system SHALL store at least 3-5 conversation topics per character

### Requirement 5: Universal Adventurer Dialogue

**User Story:** As a content designer, I want adventurer characters to have generic dialogue options, so that they can be used flexibly across different contexts.

#### Acceptance Criteria

1. WHEN creating dialogue for adventurer characters, THE dialogue content SHALL use universal topics applicable to any adventurer
2. WHEN creating dialogue for adventurer characters, THE dialogue content SHALL include topics like combat experiences, exploration, and general life philosophy
3. THE system SHALL allow adventurer dialogue templates to be reused across multiple adventurer characters

### Requirement 6: Dialogue History Tracking

**User Story:** As a player, I want to experience variety in conversations, so that repeated interactions don't feel repetitive.

#### Acceptance Criteria

1. WHEN a player completes a dialogue, THE system SHALL record which conversation topic was used
2. WHEN selecting a conversation topic, THE system SHALL prioritize topics the player has not seen recently
3. WHEN all topics have been seen, THE system SHALL allow topics to repeat
4. THE system SHALL persist dialogue history across game sessions

### Requirement 7: Dialogue Data Format

**User Story:** As a developer, I want a structured data format for dialogues, so that content can be easily created and maintained.

#### Acceptance Criteria

1. THE system SHALL extend the existing dialogues.json format to support conversation trees
2. WHEN defining a dialogue, THE data format SHALL include: dialogue ID, character ID, NPC text, and response options array
3. WHEN defining a response option, THE data format SHALL include: option text and affinity effect value
4. THE data format SHALL support multiple dialogues per character
5. THE system SHALL validate dialogue data on load

### Requirement 8: Visual Feedback for Affinity Changes

**User Story:** As a player, I want to see when my affinity with a character changes, so that I understand the impact of my choices.

#### Acceptance Criteria

1. WHEN affinity increases, THE system SHALL display a positive indicator (e.g., "+5", "+10") with appropriate styling
2. WHEN affinity decreases, THE system SHALL display a negative indicator (e.g., "-5", "-10") with appropriate styling
3. WHEN affinity remains neutral, THE system SHALL display a neutral indicator (e.g., "0") or no change message
4. THE visual feedback SHALL appear near the character portrait or affinity display
5. THE visual feedback SHALL automatically dismiss after 2-3 seconds

### Requirement 9: Dialogue Modal UI

**User Story:** As a player, I want a clear and intuitive dialogue interface, so that I can easily read conversations and select responses.

#### Acceptance Criteria

1. WHEN the Dialogue_Modal opens, THE system SHALL display the character's name and portrait
2. WHEN displaying NPC dialogue, THE text SHALL be clearly readable with appropriate formatting
3. WHEN displaying response options, THE system SHALL present them as clickable buttons or list items
4. WHEN hovering over a response option, THE system SHALL provide visual feedback
5. THE Dialogue_Modal SHALL include a close button to exit without selecting a response
6. WHEN a response is selected, THE Dialogue_Modal SHALL close after processing the affinity effect

### Requirement 10: Integration with Existing Systems

**User Story:** As a developer, I want the dialogue system to integrate seamlessly with existing game systems, so that it works cohesively with the rest of the game.

#### Acceptance Criteria

1. WHEN processing affinity changes, THE system SHALL use the existing AffinitySystem methods
2. WHEN loading character data, THE system SHALL reference the existing characters.json structure
3. WHEN loading dialogue data, THE system SHALL extend the existing dialogues.json file
4. THE system SHALL emit events compatible with the existing EventSystem
5. THE Dialogue_Modal SHALL follow the existing UI component patterns and styling
