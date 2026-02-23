# Requirements Document: Character Equipment System (角色装备系统)

## Introduction

This document specifies the requirements for a character equipment management system that allows players to equip adventurer characters with weapons, armor, and other items. The system provides equipment slot interaction, warehouse panel filtering, equipment assignment, and real-time attribute calculation based on equipped items.

## Glossary

- **Equipment_System**: The system responsible for managing character equipment slots, equipment assignment, and attribute calculations
- **Equipment_Slot**: One of four slots on a character (weapon, armor, off-hand, miscellaneous) that can hold equipment items
- **Warehouse_Panel**: A UI panel that displays available equipment items from the player's inventory
- **Equipment_Item**: An item with an equipmentType field that can be assigned to an equipment slot
- **Affix**: A stat bonus provided by equipment, either mainAffix (primary) or subAffix (secondary)
- **Attribute_Calculator**: The component that computes character stats based on equipped items
- **Character**: An adventurer entity with equipment slots and attributes
- **ItemSystem**: The existing system that manages inventory items

## Requirements

### Requirement 1: Equipment Slot Structure

**User Story:** As a developer, I want each character to have four equipment slots, so that characters can equip different types of items.

#### Acceptance Criteria

1. THE Equipment_System SHALL provide four equipment slots per character: weapon, armor, off-hand, and miscellaneous
2. WHEN a character is created, THE Equipment_System SHALL initialize all four equipment slots as empty
3. THE Equipment_System SHALL store the equipped item reference for each slot
4. THE Equipment_System SHALL maintain the association between slot type and equipped item

### Requirement 2: Equipment Slot UI Interaction

**User Story:** As a player, I want to click on equipment slots, so that I can view and select equipment to assign.

#### Acceptance Criteria

1. THE Equipment_System SHALL render all four equipment slots as clickable UI elements
2. WHEN a player clicks an equipment slot, THE Equipment_System SHALL open the Warehouse_Panel
3. WHEN the Warehouse_Panel opens, THE Equipment_System SHALL pass the clicked slot type to the panel
4. THE Equipment_System SHALL display the Warehouse_Panel in the center of the scene
5. WHEN an equipment slot contains an item, THE Equipment_System SHALL display the item's visual representation in the slot

### Requirement 3: Warehouse Panel Filtering

**User Story:** As a player, I want the warehouse panel to show only relevant equipment for the selected slot, so that I can quickly find appropriate items.

#### Acceptance Criteria

1. WHEN the weapon slot is clicked, THE Warehouse_Panel SHALL display only items where equipmentType equals "weapon"
2. WHEN the armor slot is clicked, THE Warehouse_Panel SHALL display only items where equipmentType equals "armor"
3. WHEN the off-hand slot is clicked, THE Warehouse_Panel SHALL display only items where equipmentType equals "offhand"
4. WHEN the miscellaneous slot is clicked, THE Warehouse_Panel SHALL display only items where equipmentType equals "misc"
5. THE Warehouse_Panel SHALL retrieve items from the ItemSystem inventory

### Requirement 4: Equipment Assignment

**User Story:** As a player, I want to click on equipment items in the warehouse panel to equip them, so that my character gains the equipment's bonuses.

#### Acceptance Criteria

1. WHEN a player clicks an equipment item in the Warehouse_Panel, THE Equipment_System SHALL assign that item to the corresponding equipment slot
2. WHEN equipment is assigned to a slot, THE Equipment_System SHALL store the item reference in the slot
3. WHEN equipment is assigned, THE Attribute_Calculator SHALL apply the equipment's mainAffix bonuses to the character
4. WHEN equipment is assigned, THE Attribute_Calculator SHALL apply all subAffix bonuses to the character
5. WHEN equipment is assigned to an occupied slot, THE Equipment_System SHALL replace the previous equipment
6. WHEN equipment is replaced, THE Equipment_System SHALL remove the previous equipment's bonuses before applying new bonuses

### Requirement 5: Attribute Calculation

**User Story:** As a player, I want my character's stats to update when I equip items, so that I can see the impact of equipment choices.

#### Acceptance Criteria

1. THE Attribute_Calculator SHALL read mainAffix and subAffixes from equipped items
2. THE Attribute_Calculator SHALL apply attribute bonuses from affixes to character stats
3. THE Attribute_Calculator SHALL support all affix types including: attack, defense, HP, MP, crit rate, and experience rate
4. WHEN equipment changes, THE Attribute_Calculator SHALL recalculate character attributes immediately
5. THE Attribute_Calculator SHALL maintain base character attributes separate from equipment bonuses

### Requirement 6: Equipment Removal

**User Story:** As a player, I want to unequip items from my character, so that I can swap equipment or remove unwanted items.

#### Acceptance Criteria

1. THE Equipment_System SHALL provide a mechanism to unequip items from equipment slots
2. WHEN equipment is removed from a slot, THE Equipment_System SHALL set the slot to empty
3. WHEN equipment is removed, THE Attribute_Calculator SHALL remove all attribute bonuses from that equipment
4. WHEN equipment is removed, THE Attribute_Calculator SHALL recalculate character attributes immediately
5. THE Equipment_System SHALL maintain character attributes correctly after equipment removal

### Requirement 7: Real-Time Attribute Updates

**User Story:** As a player, I want to see my character's stats update immediately when equipment changes, so that I can make informed decisions.

#### Acceptance Criteria

1. WHEN equipment is assigned to a slot, THE Equipment_System SHALL trigger attribute recalculation before closing the Warehouse_Panel
2. WHEN equipment is removed from a slot, THE Equipment_System SHALL trigger attribute recalculation immediately
3. WHEN equipment is replaced in a slot, THE Equipment_System SHALL recalculate attributes in a single operation
4. THE Equipment_System SHALL emit events when equipment changes occur
5. THE Equipment_System SHALL update the character UI to reflect new attribute values

### Requirement 8: Equipment Slot Visual Feedback

**User Story:** As a player, I want to see which items are equipped on my character, so that I can understand my current equipment configuration.

#### Acceptance Criteria

1. WHEN an equipment slot is empty, THE Equipment_System SHALL display a placeholder or empty state visual
2. WHEN an equipment slot contains an item, THE Equipment_System SHALL display the item's icon or sprite
3. THE Equipment_System SHALL visually distinguish between empty and occupied equipment slots
4. WHEN hovering over an equipped item, THE Equipment_System SHALL display item details including affixes
5. THE Equipment_System SHALL update slot visuals immediately when equipment changes

### Requirement 9: Integration with Existing Systems

**User Story:** As a developer, I want the equipment system to integrate with existing game systems, so that equipment functionality works seamlessly with the rest of the game.

#### Acceptance Criteria

1. THE Equipment_System SHALL retrieve equipment items from the ItemSystem
2. THE Equipment_System SHALL use the existing affix data structure from item-prefabs.json
3. THE Equipment_System SHALL integrate with the existing Warehouse_Panel UI component
4. THE Equipment_System SHALL work with the existing character data structure
5. THE Equipment_System SHALL emit events that other systems can subscribe to for equipment changes
