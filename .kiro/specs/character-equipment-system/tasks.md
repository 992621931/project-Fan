# Implementation Plan: Character Equipment System (角色装备系统)

## Overview

This implementation plan breaks down the character equipment system into discrete coding tasks. The system will enable players to equip items to character slots, filter equipment in a warehouse panel, and see real-time attribute updates. The implementation builds incrementally, with testing integrated throughout.

## Tasks

- [x] 1. Create EquipmentSystem core class and data structures
  - Create `src/game/systems/EquipmentSystem.ts` with the EquipmentSystem class
  - Implement core methods: `equipItem()`, `unequipItem()`, `canEquipItem()`, `getEquippedItem()`
  - Add equipment slot validation logic
  - Integrate with existing EquipmentSlotsComponent from SystemComponents.ts
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 1.1 Write property test for equipment slot structure
  - **Property 1: Equipment slot structure completeness**
  - **Validates: Requirements 1.1**

- [x] 1.2 Write property test for equipment slot initialization
  - **Property 2: Equipment slot initialization**
  - **Validates: Requirements 1.2**

- [x] 1.3 Write property test for slot-item association
  - **Property 3: Equipment slot-item association integrity**
  - **Validates: Requirements 1.4**

- [x] 1.4 Write property test for item reference storage
  - **Property 4: Item reference storage**
  - **Validates: Requirements 1.3**

- [x] 2. Implement equipment assignment and replacement logic
  - [x] 2.1 Implement `equipItem()` method with validation
    - Validate item type matches slot type
    - Handle item instance retrieval from ItemSystem
    - Store item reference in EquipmentSlotsComponent
    - Emit equipment_changed event
    - _Requirements: 4.1, 4.2_
  
  - [x] 2.2 Implement equipment replacement logic
    - Check if slot is occupied
    - Remove old equipment bonuses before adding new
    - Update slot with new item reference
    - _Requirements: 4.5, 4.6_
  
  - [x] 2.3 Write property test for equipment assignment
    - **Property 10: Equipment assignment**
    - **Validates: Requirements 4.1**
  
  - [x] 2.4 Write property test for equipment replacement
    - **Property 11: Equipment replacement**
    - **Property 12: Bonus removal before replacement**
    - **Validates: Requirements 4.5, 4.6**

- [x] 3. Implement equipment removal functionality
  - [x] 3.1 Implement `unequipItem()` method
    - Set slot to null
    - Remove equipment bonuses
    - Emit equipment_changed event
    - Return item to inventory (if needed)
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 3.2 Write property test for equipment unequip
    - **Property 18: Equipment unequip functionality**
    - **Property 19: Bonus removal on unequip**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 4. Checkpoint - Ensure core equipment operations work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Enhance AttributeSystem for equipment bonuses
  - [x] 5.1 Implement `calculateEquipmentBonuses()` method
    - Read equipped items from EquipmentSlotsComponent
    - Retrieve item data from ItemSystem
    - Parse mainStat and subStats affixes
    - Calculate total bonuses for each attribute
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 5.2 Update `updateDerivedStats()` to apply equipment bonuses
    - Call calculateEquipmentBonuses()
    - Add equipment bonuses to base stats
    - Maintain separation between base and equipment bonuses
    - _Requirements: 5.4, 5.5_
  
  - [x] 5.3 Add equipment change event handler
    - Subscribe to equipment_changed events
    - Trigger immediate attribute recalculation
    - _Requirements: 5.4, 7.2_
  
  - [x] 5.4 Write property test for affix application
    - **Property 13: Affix application to character stats**
    - **Property 14: Affix data reading**
    - **Validates: Requirements 4.3, 4.4, 5.1, 5.2**
  
  - [x] 5.5 Write property test for multiple affix types
    - **Property 15: Multiple affix type support**
    - **Validates: Requirements 5.3**
  
  - [x] 5.6 Write property test for immediate recalculation
    - **Property 16: Immediate attribute recalculation on equipment change**
    - **Validates: Requirements 5.4, 6.4, 7.2**
  
  - [x] 5.7 Write property test for base attribute preservation
    - **Property 17: Base attribute preservation**
    - **Validates: Requirements 5.5**

- [x] 6. Create equipment slot UI components
  - [x] 6.1 Create EquipmentSlotUI component
    - Create `src/ui/components/EquipmentSlotUI.ts`
    - Render 4 clickable equipment slots (weapon, armor, offhand, misc)
    - Display equipped item icons/sprites
    - Show empty state for unoccupied slots
    - Add click handlers for each slot
    - _Requirements: 2.1, 2.5, 8.1, 8.2_
  
  - [x] 6.2 Implement equipment slot visual feedback
    - Distinguish empty vs occupied slots visually
    - Update slot visuals on equipment change
    - Add hover tooltips showing item details and affixes
    - _Requirements: 8.3, 8.4, 8.5_
  
  - [x] 6.3 Write unit test for equipment slot rendering
    - Test that all 4 slots render correctly
    - Test empty state display
    - Test equipped item display

- [x] 7. Implement warehouse panel filtering
  - [x] 7.1 Add equipment type filtering to warehouse panel
    - Modify existing warehouse panel to accept slot type parameter
    - Filter items by equipmentSlot field matching clicked slot
    - Display only matching equipment items
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 7.2 Implement warehouse panel opening on slot click
    - Connect equipment slot click to warehouse panel
    - Pass slot type to warehouse panel
    - Center warehouse panel in scene
    - _Requirements: 2.2, 2.3, 2.4_
  
  - [x] 7.3 Add item selection handler in warehouse panel
    - Handle item click in warehouse panel
    - Call EquipmentSystem.equipItem() with selected item
    - Close warehouse panel after selection
    - _Requirements: 4.1_
  
  - [x] 7.4 Write property test for warehouse filtering
    - **Property 8: Warehouse filtering by equipment type**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  
  - [x] 7.5 Write property test for warehouse item source
    - **Property 9: Warehouse item source**
    - **Validates: Requirements 3.5**
  
  - [x] 7.6 Write property test for slot click behavior
    - **Property 5: Warehouse panel opening on slot click**
    - **Property 6: Slot type propagation to warehouse panel**
    - **Validates: Requirements 2.2, 2.3**

- [x] 8. Checkpoint - Ensure UI integration works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement real-time UI updates
  - [x] 9.1 Add event listeners for equipment changes
    - Subscribe to equipment_changed events in UI components
    - Update equipment slot visuals on event
    - Update character attribute display on event
    - _Requirements: 7.4, 7.5_
  
  - [x] 9.2 Implement attribute display synchronization
    - Ensure UI displays match calculated attributes
    - Update immediately on equipment change
    - _Requirements: 7.5, 8.5_
  
  - [x] 9.3 Write property test for event emission
    - **Property 21: Equipment change event emission**
    - **Validates: Requirements 7.4, 9.5**
  
  - [x] 9.4 Write property test for UI synchronization
    - **Property 22: UI attribute value synchronization**
    - **Property 25: Visual update on equipment change**
    - **Validates: Requirements 7.5, 8.5**

- [x] 10. Add error handling and validation
  - [x] 10.1 Implement equipment validation
    - Validate item type matches slot type
    - Check item exists in ItemSystem
    - Verify character has required components
    - Return descriptive error messages
    - _Requirements: 9.1, 9.2, 9.4_
  
  - [x] 10.2 Add error handling for missing data
    - Handle missing affix data gracefully
    - Handle invalid affix values
    - Handle unknown attribute types
    - Log warnings for recoverable errors
  
  - [x] 10.3 Write unit tests for error conditions
    - Test invalid item type to slot
    - Test missing item
    - Test missing character components
    - Test missing affix data

- [x] 11. Integration testing and polish
  - [x] 11.1 Test complete equipment workflow
    - Test: click slot → warehouse opens → select item → equip → stats update → UI refresh
    - Verify all systems communicate correctly
    - _Requirements: All_
  
  - [x] 11.2 Write property test for attribute correctness after replacement
    - **Property 20: Attribute correctness after replacement**
    - **Validates: Requirements 7.3**
  
  - [x] 11.3 Write property test for system integration
    - **Property 26: Equipment item retrieval from ItemSystem**
    - **Property 27: Affix data structure compatibility**
    - **Property 28: Character data structure compatibility**
    - **Validates: Requirements 9.1, 9.2, 9.4**
  
  - [x] 11.4 Add visual polish and feedback
    - Add animations for equipment changes
    - Add sound effects (if applicable)
    - Improve tooltip styling
    - Add loading states if needed

- [-] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript with the existing ECS architecture
- Equipment items use the existing affix system from item-prefabs.json
- Integration with ItemSystem, AttributeSystem, and UI components is required
