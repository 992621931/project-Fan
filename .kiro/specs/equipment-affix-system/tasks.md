# Implementation Plan: Equipment Affix System

## Overview

This implementation plan breaks down the Equipment Affix System into discrete coding tasks. The system will add random secondary stat bonuses (affixes) to equipment when crafted, with four rarity tiers and probability distributions based on equipment rarity. The implementation integrates with the existing EquipmentCraftingSystem and follows a test-driven approach with property-based testing.

## Tasks

- [x] 1. Create affix type definitions and interfaces
  - Create `src/game/types/AffixTypes.ts` with AffixType enum, AffixDefinition, AppliedAffix, AffixPoolConfig, and AffixProbabilityConfig interfaces
  - Define the AFFIX_PROBABILITY_CONFIG constant with probability distributions for each equipment rarity
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Create affix definitions data file
  - Create `src/game/data/affix-definitions.json` with complete affix pool
  - Define all 18 Common affixes with correct stat ranges (Strength +1~5, Agility +1~5, etc.)
  - Define all 17 Rare affixes with correct stat ranges (excluding Carry Weight)
  - Define all 17 Epic affixes with correct stat ranges (excluding Carry Weight)
  - Define all 17 Legendary affixes with correct stat ranges (excluding Carry Weight)
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 3. Implement AffixSelector service
  - [x] 3.1 Create `src/game/systems/AffixSelector.ts` with AffixSelector class
    - Implement constructor to load affix pool and probability configuration
    - Implement `selectAffix(equipmentRarity: RarityType): AppliedAffix` method
    - Implement `selectAffixRarity(equipmentRarity: RarityType): RarityType` private method using weighted random selection
    - Implement `selectAffixFromTier(affixRarity: RarityType): AffixDefinition` private method with uniform random selection
    - Implement `generateAffixValue(definition: AffixDefinition): number` private method respecting min/max and decimal precision
    - Add error handling for invalid equipment rarity, empty affix pools, and configuration loading failures
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 7.1_

  - [x] 3.2 Write property test for affix rarity probability distribution (Common equipment)
    - **Property 1: Affix rarity probability distribution for Common equipment**
    - **Validates: Requirements 2.1**

  - [x] 3.3 Write property test for affix rarity probability distribution (Rare equipment)
    - **Property 2: Affix rarity probability distribution for Rare equipment**
    - **Validates: Requirements 2.2**

  - [x] 3.4 Write property test for affix rarity probability distribution (Epic equipment)
    - **Property 3: Affix rarity probability distribution for Epic equipment**
    - **Validates: Requirements 2.3**

  - [x] 3.5 Write property test for affix rarity probability distribution (Legendary equipment)
    - **Property 4: Affix rarity probability distribution for Legendary equipment**
    - **Validates: Requirements 2.4**

  - [x] 3.6 Write property test for affix value within range
    - **Property 5: Affix value within range**
    - **Validates: Requirements 3.1, 3.5**

  - [x] 3.7 Write property test for integer affixes producing whole numbers
    - **Property 6: Integer affixes produce whole numbers**
    - **Validates: Requirements 3.2**

  - [x] 3.8 Write property test for decimal precision
    - **Property 7: Percentage and decimal affixes respect precision**
    - **Validates: Requirements 3.3, 3.4**

  - [x] 3.9 Write property test for uniform affix type distribution
    - **Property 13: Uniform affix type distribution within tier**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

  - [x] 3.10 Write unit tests for AffixSelector
    - Test probability configuration sum equals 100% for each equipment rarity
    - Test Carry Weight exclusion from Rare, Epic, and Legendary tiers
    - Test error handling for invalid equipment rarity
    - Test error handling for empty affix pool
    - _Requirements: 1.6, 2.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend EquipmentComponent to support affixes
  - Modify `src/game/components/ItemComponents.ts` to add optional `affix?: AppliedAffix` field to EquipmentComponent interface
  - _Requirements: 4.1_

- [x] 6. Integrate AffixSelector with EquipmentCraftingSystem
  - [x] 6.1 Modify `src/game/systems/EquipmentCraftingSystem.ts` to integrate affix assignment
    - Add AffixSelector instance to EquipmentCraftingSystem
    - Load affix definitions in initialize() method
    - Modify `completeCrafting()` method to call AffixSelector and assign affix to crafted equipment
    - Add error handling to continue equipment creation if affix assignment fails
    - Ensure affix is assigned before equipment is added to inventory
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.2 Write property test for equipment receiving exactly one affix
    - **Property 8: Equipment receives exactly one affix**
    - **Validates: Requirements 4.1**

  - [x] 6.3 Write property test for affix assignment timing
    - **Property 9: Affix assignment completes before equipment return**
    - **Validates: Requirements 4.4**

  - [x] 6.4 Write unit test for affix assignment error handling
    - Test equipment creation continues when affix assignment fails
    - _Requirements: 4.3_

- [x] 7. Implement affix display formatting
  - [x] 7.1 Create `src/game/utils/AffixFormatter.ts` with affix formatting utilities
    - Implement `formatAffixDisplay(affix: AppliedAffix): string` to format affix name and value
    - Implement `getAffixColorStyle(affixRarity: RarityType): string` to return CSS color style for affix rarity
    - Handle percentage formatting (append %)
    - Handle decimal precision (1 decimal place for regeneration and percentages)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 7.2 Write property test for affix display color
    - **Property 10: Affix display includes rarity color**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

  - [x] 7.3 Write property test for affix display content
    - **Property 11: Affix display includes name and value**
    - **Validates: Requirements 5.6**

  - [x] 7.4 Write unit tests for AffixFormatter
    - Test specific color mapping for each rarity tier
    - Test percentage formatting
    - Test decimal precision formatting
    - Test error handling for missing rarity color
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 8. Update UI to display affixes
  - Modify `src/ui/GameUI.ts` equipment tooltip rendering to include affix display
  - Use AffixFormatter to render affix with colored text outline
  - Display affix below equipment stats in tooltip
  - _Requirements: 5.1, 5.6_

- [x] 9. Implement affix serialization support
  - [x] 9.1 Update SaveSystem to handle affix serialization
    - Modify equipment serialization in `src/ecs/SaveSystem.ts` to include affix data (type, rarity, value)
    - Modify equipment deserialization to restore affix from save data
    - Add error handling for invalid affix data during deserialization
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 9.2 Write property test for affix serialization round-trip
    - **Property 12: Affix serialization round-trip**
    - **Validates: Requirements 6.1, 6.2, 6.4**

  - [x] 9.3 Write unit test for invalid affix data handling
    - Test equipment loads without affix when save data is corrupted
    - Test equipment loads without affix when affix type no longer exists
    - _Requirements: 6.3_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Integration testing and validation
  - [x] 11.1 Write integration tests for complete crafting flow
    - Test equipment crafting with affix assignment for each rarity tier
    - Test save/load cycle preserves affixes
    - Test UI displays affixes correctly
    - _Requirements: 4.1, 4.2, 5.1, 6.1, 6.2_

  - [x] 11.2 Manual validation
    - Verify affixes display with correct colors in game UI
    - Verify affix values are reasonable and within expected ranges
    - Verify save/load preserves affixes correctly

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests verify end-to-end functionality across systems
- The implementation follows TypeScript conventions matching the existing codebase
