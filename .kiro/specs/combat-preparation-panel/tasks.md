# Implementation Plan: Combat Preparation Panel

## Overview

This implementation plan breaks down the Combat Preparation Panel feature into discrete coding tasks. The approach is to first create the UI component structure, then integrate it with the stage switching flow, implement the dining functionality, implement the inventory management functionality, and finally wire everything together with proper validation and testing.

## Tasks

- [x] 1. Create PreparationPanel component class structure
  - Create new file `src/ui/components/PreparationPanel.ts`
  - Define PreparationPanel class extending BaseUIComponent
  - Add properties for overlay, panel container, tabs, and callbacks
  - Implement constructor with GameUI reference and onStartBattle callback
  - Implement basic show() and close() methods with modal overlay
  - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7_

- [ ]* 1.1 Write unit tests for PreparationPanel structure
  - Test panel creation and DOM structure
  - Test show() displays modal overlay
  - Test close() removes modal overlay
  - _Requirements: 3.1, 3.5_

- [ ] 2. Implement tab navigation system
  - [x] 2.1 Create tab navigation UI with two tabs
    - Add tab buttons for "用餐" and "整理携带物"
    - Add content containers for each tab
    - Implement switchTab() method to toggle between tabs
    - Set dining tab as default active tab
    - _Requirements: 3.2, 3.3, 3.4, 6.6_

  - [x] 2.2 Implement tab switching logic
    - Hide inactive tab content when switching
    - Show active tab content
    - Update tab button visual states
    - Preserve tab state when switching
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [ ]* 2.3 Write unit tests for tab navigation
    - Test default tab is dining
    - Test switching to inventory tab
    - Test switching back to dining tab
    - Test only one tab visible at a time
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

- [ ] 3. Implement dining page functionality
  - [x] 3.1 Create renderDiningPage() method
    - Display all characters in party slots
    - Show character portraits, names, and hunger bars
    - Display available food items from inventory
    - Filter inventory for items with hungerRestore property
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 3.2 Implement feedCharacter() method
    - Validate character hunger is not at maximum
    - Calculate new hunger value (capped at maximum)
    - Update character's HungerComponent
    - Remove food item from inventory
    - Refresh dining page display
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 3.3 Write property test for hunger restoration
    - **Property 3: Hunger Restoration Bounds**
    - **Validates: Requirements 4.5, 4.7**
    - Generate random characters with random hunger values
    - Generate random food items with random hungerRestore values
    - Feed character and verify hunger increases correctly and never exceeds maximum

  - [ ]* 3.4 Write property test for inventory consistency
    - **Property 5: Inventory Consistency After Feeding**
    - **Validates: Requirements 4.6**
    - Generate random inventory with food items
    - Feed character and verify food quantity decreases by 1
    - Verify item removed if quantity reaches 0

  - [ ]* 3.5 Write unit tests for dining page
    - Test feeding character with hunger at 50/100 with food restoring 30
    - Test feeding character with hunger at 90/100 with food restoring 30 (caps at 100)
    - Test preventing feeding character with hunger at 100/100
    - Test food item removed after feeding
    - _Requirements: 4.5, 4.6, 4.7_

- [ ] 4. Implement inventory management page functionality
  - [x] 4.1 Create renderInventoryPage() method
    - Display team bag contents with item cards
    - Display main inventory items
    - Show current weight and maximum weight
    - Display weight progress bar
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 4.2 Implement transferToTeamBag() method
    - Check if transfer would exceed weight limit
    - If allowed, add item to team bag via LootSystem
    - Remove item from main inventory
    - Update weight displays
    - Show warning if weight limit exceeded
    - _Requirements: 5.4, 5.6, 5.7_

  - [x] 4.3 Implement transferFromTeamBag() method
    - Remove item from team bag via LootSystem
    - Add item to main inventory
    - Update weight displays
    - _Requirements: 5.5, 5.7, 5.8_

  - [ ]* 4.4 Write property test for weight limit enforcement
    - **Property 4: Team Bag Weight Limit Enforcement**
    - **Validates: Requirements 5.6**
    - Generate random team bag states with random weights
    - Generate random items with random weights
    - Attempt transfer and verify blocked if would exceed limit
    - Verify team bag unchanged when transfer blocked

  - [ ]* 4.5 Write unit tests for inventory management
    - Test transferring item when weight allows
    - Test preventing transfer when weight would exceed limit
    - Test transferring item from team bag to inventory
    - Test weight display updates after transfer
    - _Requirements: 5.4, 5.5, 5.6, 5.7_

- [ ] 5. Implement start battle validation and action
  - [x] 5.1 Create validateParty() method
    - Check if party has at least one character
    - Return true if valid, false if empty
    - _Requirements: 8.2, 8.3_

  - [x] 5.2 Implement handleStartBattle() method
    - Call validateParty() to check party
    - If invalid, show warning "编队中没有角色，无法开始战斗"
    - If valid, call onStartBattle callback
    - Close preparation panel
    - _Requirements: 7.1, 8.1, 8.2_

  - [ ]* 5.3 Write unit tests for start battle validation
    - Test starting battle with 0 characters shows warning
    - Test starting battle with 1 character succeeds
    - Test starting battle with characters at low hunger succeeds
    - Test starting battle with empty team bag succeeds
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 6. Checkpoint - Ensure PreparationPanel component is complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Integrate PreparationPanel with GameUI stage switching
  - [x] 7.1 Add PreparationPanel property to GameUI class
    - Add `private preparationPanel: PreparationPanel | null = null`
    - Add `private battlePaused: boolean = false`
    - Import PreparationPanel class
    - _Requirements: 2.1_

  - [x] 7.2 Modify initializeBattleScene() to defer spawning
    - Rename existing method to initializeBattleSceneWithoutSpawning()
    - Remove calls to startEnemySpawning(), startResourceNodeSpawning(), startLootSystemUpdate()
    - Keep all other initialization logic
    - _Requirements: 2.1, 2.4_

  - [x] 7.3 Create showPreparationPanel() method in GameUI
    - Set battlePaused to true
    - Create new PreparationPanel instance
    - Pass onPreparationComplete callback
    - Call preparationPanel.show()
    - _Requirements: 1.3, 2.1_

  - [x] 7.4 Create onPreparationComplete() method in GameUI
    - Set battlePaused to false
    - Call startEnemySpawning()
    - Call battleSystem.startResourceNodeSpawning()
    - Call startLootSystemUpdate()
    - Set preparationPanel to null
    - _Requirements: 2.3, 7.2, 7.3_

  - [x] 7.5 Modify loadExplorationPanel() to show preparation panel
    - After calling initializeBattleSceneWithoutSpawning()
    - Check if current stage is combat stage using isCombatStage()
    - If combat stage, call showPreparationPanel()
    - If non-combat stage, call onPreparationComplete() to start normally
    - _Requirements: 1.1, 1.4, 1.5_

  - [ ]* 7.6 Write integration tests for stage switching flow
    - Test switching to grassland shows preparation panel
    - Test switching to forest shows preparation panel
    - Test switching to cave shows preparation panel
    - Test switching to village does not show preparation panel
    - Test enemies do not spawn while panel is open
    - Test enemies spawn after panel closes
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.3_

- [ ] 8. Add food item hungerRestore properties to items data
  - [x] 8.1 Update items.json with hungerRestore values
    - Add hungerRestore property to dish items (e.g., 20-80 based on rarity)
    - Add hungerRestore property to edible material items (e.g., 5-15)
    - Ensure all food items have appropriate restoration values
    - _Requirements: 4.5_

  - [ ]* 8.2 Write unit tests for food item properties
    - Test all dish items have hungerRestore property
    - Test hungerRestore values are positive integers
    - _Requirements: 4.5_

- [ ] 9. Implement data persistence for preparation changes
  - [x] 9.1 Verify HungerComponent updates persist
    - Ensure feedCharacter() updates the actual component data
    - Verify changes are reflected in NPCSystem
    - Test that hunger values persist after panel closes
    - _Requirements: 10.1, 10.5_

  - [x] 9.2 Verify team bag and inventory updates persist
    - Ensure transfers update LootSystem and InventorySystem
    - Verify changes are reflected in game state
    - Test that inventory changes persist after panel closes
    - _Requirements: 10.2, 10.3, 10.5_

  - [ ]* 9.3 Write property test for data persistence
    - **Property 9: Data Persistence Through Preparation**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.5**
    - Generate random preparation actions (feeding, transfers)
    - Apply actions and close panel
    - Verify all changes persisted in game state

- [ ] 10. Add styling and visual polish
  - [x] 10.1 Style preparation panel modal
    - Add semi-transparent dark overlay (rgba(0, 0, 0, 0.7))
    - Center panel container with max-width 800px
    - Add white background with border-radius and box-shadow
    - Add padding and proper spacing
    - _Requirements: 3.6, 3.7, 9.1_

  - [x] 10.2 Style tab navigation
    - Style tab buttons with hover effects
    - Highlight active tab with different background color
    - Add smooth transitions for tab switching
    - _Requirements: 6.4, 9.6_

  - [x] 10.3 Style dining page elements
    - Display character cards in grid layout
    - Style hunger progress bars with orange/brown color
    - Display food items in grid with item cards
    - Add hover effects on food items
    - _Requirements: 9.2, 9.3, 9.5_

  - [x] 10.4 Style inventory page elements
    - Display team bag and inventory in side-by-side layout
    - Style weight progress bar with color gradient
    - Add hover effects on item cards
    - Style transfer buttons
    - _Requirements: 9.5_

  - [x] 10.5 Style start battle button
    - Position at bottom center of panel
    - Use prominent color (e.g., green for start)
    - Add hover and active states
    - Make button large and easy to click
    - _Requirements: 3.5, 9.5_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: component → integration → polish
