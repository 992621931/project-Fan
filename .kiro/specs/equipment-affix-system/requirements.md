# Requirements Document: Equipment Affix System

## Introduction

This document specifies the requirements for an equipment affix system that assigns random secondary stats (affixes) to equipment when crafted. The system provides four rarity tiers of affixes (Common, Rare, Mythic, Legendary) with different stat ranges and probabilities based on equipment rarity.

## Glossary

- **Affix**: A secondary stat bonus applied to equipment, providing additional attribute bonuses beyond the equipment's base stats
- **Affix_Pool**: The collection of all available affixes organized by rarity tier
- **Equipment_Rarity**: The quality tier of equipment (Common, Rare, Mythic, Legendary)
- **Affix_Rarity**: The quality tier of an affix (Common, Rare, Mythic, Legendary)
- **Stat_Range**: The minimum and maximum values for an affix's stat bonus
- **Affix_Selector**: The system component that selects an affix based on probability distribution
- **Equipment_Crafting_System**: The existing system that creates equipment items
- **Rarity_Tier**: A quality classification level (Common, Rare, Mythic, Legendary)

## Requirements

### Requirement 1: Affix Pool Definition

**User Story:** As a game designer, I want to define a comprehensive pool of affixes organized by rarity, so that equipment can receive varied and balanced secondary stats.

#### Acceptance Criteria

1. THE Affix_Pool SHALL contain exactly 18 distinct affix types across all rarity tiers
2. THE Affix_Pool SHALL define Common affixes with stat ranges: Strength +1~5, Agility +1~5, Wisdom +1~5, Skill +1~5, Attack +1~5, Defense +1~3, Crit Rate +1~4%, Crit Damage +1~4%, Dodge Rate +1~4%, Move Speed +1~10, Magic Power +1~5, Carry Weight +5~10, Resistance +1~5, Experience Rate +1~5%, HP Regen +0.1~0.5, MP Regen +0.1~1.0, Body Weight +1~5, Body Size +1~5
3. THE Affix_Pool SHALL define Rare affixes with stat ranges: Strength +1~10, Agility +1~10, Wisdom +1~10, Skill +1~10, Attack +1~10, Defense +1~6, Crit Rate +1~8%, Crit Damage +1~8%, Dodge Rate +1~8%, Move Speed +1~15, Magic Power +1~10, Resistance +1~10, Experience Rate +1~10%, HP Regen +0.1~1.0, MP Regen +0.1~1.5, Body Weight +1~10, Body Size +1~10
4. THE Affix_Pool SHALL define Mythic affixes with stat ranges: Strength +1~15, Agility +1~15, Wisdom +1~15, Skill +1~15, Attack +1~15, Defense +1~9, Crit Rate +1~12%, Crit Damage +1~12%, Dodge Rate +1~12%, Move Speed +1~20, Magic Power +1~15, Resistance +1~15, Experience Rate +1~15%, HP Regen +0.1~1.5, MP Regen +0.1~2.0, Body Weight +1~15, Body Size +1~15
5. THE Affix_Pool SHALL define Legendary affixes with stat ranges: Strength +5~20, Agility +5~20, Wisdom +5~20, Skill +5~20, Attack +5~20, Defense +3~12, Crit Rate +4~16%, Crit Damage +4~16%, Dodge Rate +4~16%, Move Speed +5~30, Magic Power +5~20, Resistance +5~20, Experience Rate +5~20%, HP Regen +0.5~2.0, MP Regen +0.6~3.0, Body Weight +5~20, Body Size +5~20
6. THE Affix_Pool SHALL exclude Carry Weight affixes from Rare, Mythic, and Legendary tiers

### Requirement 2: Affix Selection by Equipment Rarity

**User Story:** As a player, I want equipment rarity to influence the quality of affixes I receive, so that higher rarity equipment provides better secondary stats.

#### Acceptance Criteria

1. WHEN Common equipment is crafted, THE Affix_Selector SHALL select Common affixes with 90% probability and Rare affixes with 10% probability
2. WHEN Rare equipment is crafted, THE Affix_Selector SHALL select Common affixes with 50% probability, Rare affixes with 40% probability, and Mythic affixes with 10% probability
3. WHEN Mythic equipment is crafted, THE Affix_Selector SHALL select Common affixes with 15% probability, Rare affixes with 50% probability, Mythic affixes with 30% probability, and Legendary affixes with 5% probability
4. WHEN Legendary equipment is crafted, THE Affix_Selector SHALL select Common affixes with 5% probability, Rare affixes with 15% probability, Mythic affixes with 50% probability, and Legendary affixes with 30% probability
5. THE Affix_Selector SHALL ensure the sum of probabilities for each equipment rarity equals 100%

### Requirement 3: Affix Value Generation

**User Story:** As a player, I want affix values to vary within their defined ranges, so that each piece of equipment feels unique.

#### Acceptance Criteria

1. WHEN an affix is selected, THE Affix_Selector SHALL generate a random value within the affix's defined stat range
2. WHEN generating integer stat values, THE Affix_Selector SHALL produce whole numbers within the inclusive range
3. WHEN generating percentage stat values, THE Affix_Selector SHALL produce values with up to one decimal place precision
4. WHEN generating decimal stat values for regeneration, THE Affix_Selector SHALL produce values with up to one decimal place precision
5. THE Affix_Selector SHALL ensure generated values never exceed the maximum or fall below the minimum of the stat range

### Requirement 4: Equipment Crafting Integration

**User Story:** As a developer, I want affixes to be automatically assigned during equipment crafting, so that the system integrates seamlessly with existing gameplay.

#### Acceptance Criteria

1. WHEN equipment is successfully crafted through the Equipment_Crafting_System, THE Affix_Selector SHALL assign exactly one affix to the equipment
2. WHEN affix assignment occurs, THE Affix_Selector SHALL use the equipment's rarity to determine affix probability distribution
3. WHEN affix assignment fails, THE Equipment_Crafting_System SHALL handle the error gracefully and continue equipment creation without an affix
4. THE Affix_Selector SHALL complete affix assignment before the Equipment_Crafting_System returns the crafted equipment

### Requirement 5: Affix Display and Visualization

**User Story:** As a player, I want to see affixes displayed with colored outlines matching their rarity, so that I can quickly identify affix quality.

#### Acceptance Criteria

1. WHEN displaying an affix, THE system SHALL render the affix text with a colored outline corresponding to its rarity tier
2. WHEN displaying a Common affix, THE system SHALL use the Common rarity color scheme
3. WHEN displaying a Rare affix, THE system SHALL use the Rare rarity color scheme
4. WHEN displaying a Mythic affix, THE system SHALL use the Mythic rarity color scheme
5. WHEN displaying a Legendary affix, THE system SHALL use the Legendary rarity color scheme
6. THE system SHALL display the affix name and value together in the equipment tooltip or description

### Requirement 6: Affix Data Persistence

**User Story:** As a player, I want my equipment affixes to be saved, so that they persist across game sessions.

#### Acceptance Criteria

1. WHEN equipment with an affix is saved, THE system SHALL serialize the affix type, rarity, and value
2. WHEN equipment is loaded from save data, THE system SHALL restore the affix with its original type, rarity, and value
3. WHEN save data contains invalid affix data, THE system SHALL handle the error gracefully and load the equipment without an affix
4. THE system SHALL ensure affix data integrity during serialization and deserialization

### Requirement 7: Affix Type Distribution

**User Story:** As a game designer, I want all affix types within a rarity tier to have equal selection probability, so that no single stat dominates equipment bonuses.

#### Acceptance Criteria

1. WHEN selecting an affix from a rarity tier, THE Affix_Selector SHALL give each affix type within that tier equal probability
2. THE Affix_Selector SHALL ensure uniform distribution across all 18 affix types for Common tier
3. THE Affix_Selector SHALL ensure uniform distribution across all 17 affix types for Rare tier (excluding Carry Weight)
4. THE Affix_Selector SHALL ensure uniform distribution across all 17 affix types for Mythic tier (excluding Carry Weight)
5. THE Affix_Selector SHALL ensure uniform distribution across all 17 affix types for Legendary tier (excluding Carry Weight)
