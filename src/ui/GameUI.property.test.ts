/**
 * Property-based tests for GameUI
 * Feature: warehouse-panel-grid-layout-bugfix
 * Tests grid column calculation correctness
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { GameUI } from './GameUI';
import { EventSystem } from '../ecs/EventSystem';
import { World } from '../ecs/World';

describe('GameUI Property Tests - Grid Layout', () => {
  let gameUI: GameUI;
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
    gameUI = new GameUI(eventSystem, world, rootElement);
  });

  /**
   * Property 1: Grid Column Calculation Correctness
   * For any container width, the calculated columns should:
   * 1. Be within [1, 8] range
   * 2. Be the maximum number that can fit in the container width
   * 3. Account for item minimum width (120px) and gap (12px)
   * 4. Satisfy: columns * (120 + 12) - 12 <= containerWidth < (columns + 1) * (120 + 12) - 12 (when columns < 8)
   */
  describe('Property 1: Grid Column Calculation Correctness', () => {
    const containerWidthArb = fc.integer({ min: 0, max: 2000 });

    it('**Validates: Requirements 1.1, 3.1, 3.2, 3.3, 3.4** - Columns are always within [1, 8] range', () => {
      fc.assert(fc.property(containerWidthArb, (containerWidth) => {
        const columns = (gameUI as any).calculateGridColumns(containerWidth);
        
        // Verify columns are within valid range
        expect(columns).toBeGreaterThanOrEqual(1);
        expect(columns).toBeLessThanOrEqual(8);
      }));
    });

    it('**Validates: Requirements 1.1, 3.1, 3.2, 3.3, 3.4** - Columns calculation accounts for item width and gap', () => {
      fc.assert(fc.property(containerWidthArb, (containerWidth) => {
        const itemMinWidth = 120;
        const gap = 12;
        const columns = (gameUI as any).calculateGridColumns(containerWidth);
        
        // For invalid widths, should return default 4 columns
        if (containerWidth <= 0) {
          expect(columns).toBe(4);
          return;
        }
        
        // Calculate expected columns using the formula
        const expectedColumns = Math.floor((containerWidth + gap) / (itemMinWidth + gap));
        const clampedExpected = Math.max(1, Math.min(expectedColumns, 8));
        
        expect(columns).toBe(clampedExpected);
      }));
    });

    it('**Validates: Requirements 1.1, 3.1, 3.2, 3.3, 3.4** - Columns are maximum that can fit in container', () => {
      fc.assert(fc.property(containerWidthArb, (containerWidth) => {
        const itemMinWidth = 120;
        const gap = 12;
        const columns = (gameUI as any).calculateGridColumns(containerWidth);
        
        // Skip invalid widths (they return default 4 columns)
        if (containerWidth <= 0) {
          return;
        }
        
        // Calculate the total width needed for the calculated columns
        const totalWidthForColumns = columns * itemMinWidth + (columns - 1) * gap;
        
        // If the container is too small to fit even 1 column, the function returns 1 anyway (minimum)
        // In this case, we just verify that columns = 1
        if (containerWidth < itemMinWidth) {
          expect(columns).toBe(1);
          return;
        }
        
        // For containers that can fit at least 1 column, verify the columns fit
        expect(totalWidthForColumns).toBeLessThanOrEqual(containerWidth);
        
        // Verify that one more column would NOT fit (unless we're at the max of 8)
        if (columns < 8) {
          const totalWidthForOneMore = (columns + 1) * itemMinWidth + columns * gap;
          expect(totalWidthForOneMore).toBeGreaterThan(containerWidth);
        }
      }));
    });

    it('**Validates: Requirements 1.1, 3.1, 3.2, 3.3, 3.4** - Column calculation satisfies mathematical inequality', () => {
      fc.assert(fc.property(containerWidthArb, (containerWidth) => {
        const itemMinWidth = 120;
        const gap = 12;
        const columns = (gameUI as any).calculateGridColumns(containerWidth);
        
        // Skip invalid widths
        if (containerWidth <= 0) {
          return;
        }
        
        // If container is too small to fit even 1 column, function returns 1 anyway (minimum)
        if (containerWidth < itemMinWidth) {
          expect(columns).toBe(1);
          return;
        }
        
        // For columns < 8, verify the inequality:
        // columns * (itemMinWidth + gap) - gap <= containerWidth < (columns + 1) * (itemMinWidth + gap) - gap
        if (columns < 8) {
          const minWidth = columns * (itemMinWidth + gap) - gap;
          const maxWidth = (columns + 1) * (itemMinWidth + gap) - gap;
          
          expect(containerWidth).toBeGreaterThanOrEqual(minWidth);
          expect(containerWidth).toBeLessThan(maxWidth);
        } else {
          // For columns = 8, just verify it fits
          const minWidth = columns * (itemMinWidth + gap) - gap;
          expect(containerWidth).toBeGreaterThanOrEqual(minWidth);
        }
      }));
    });

    it('**Validates: Requirements 3.4** - Handles edge cases correctly', () => {
      // Test specific edge cases
      const edgeCases = [
        { width: 0, expected: 4 },      // Zero width -> default
        { width: -100, expected: 4 },   // Negative width -> default
        { width: 120, expected: 1 },    // Exactly 1 item
        { width: 132, expected: 1 },    // 1 item + gap
        { width: 252, expected: 2 },    // Exactly 2 items
        { width: 1200, expected: 8 },   // Many items -> capped at 8
        { width: 2000, expected: 8 },   // Very large -> capped at 8
      ];
      
      for (const { width, expected } of edgeCases) {
        const columns = (gameUI as any).calculateGridColumns(width);
        expect(columns).toBe(expected);
      }
    });
  });

  /**
   * Property 2: Items Per Page Calculation
   * For any number of columns, the items per page should equal columns * target rows (3 rows)
   */
  describe('Property 2: Items Per Page Calculation', () => {
    const columnsArb = fc.integer({ min: 1, max: 8 });

    it('**Validates: Requirements 1.2** - Items per page equals columns times target rows', () => {
      fc.assert(fc.property(columnsArb, (columns) => {
        const targetRows = 4;
        const itemsPerPage = (gameUI as any).calculateItemsPerPage(columns);
        
        // Verify items per page = columns * target rows
        expect(itemsPerPage).toBe(columns * targetRows);
      }));
    });

    it('**Validates: Requirements 1.2** - Items per page is always positive', () => {
      fc.assert(fc.property(columnsArb, (columns) => {
        const itemsPerPage = (gameUI as any).calculateItemsPerPage(columns);
        
        // Verify items per page is always positive
        expect(itemsPerPage).toBeGreaterThan(0);
      }));
    });

    it('**Validates: Requirements 1.2** - Items per page scales linearly with columns', () => {
      fc.assert(fc.property(columnsArb, (columns) => {
        const itemsPerPage = (gameUI as any).calculateItemsPerPage(columns);
        
        // If we double the columns, items per page should double
        if (columns * 2 <= 8) {
          const doubledItemsPerPage = (gameUI as any).calculateItemsPerPage(columns * 2);
          expect(doubledItemsPerPage).toBe(itemsPerPage * 2);
        }
      }));
    });

    it('**Validates: Requirements 1.2** - Items per page range is correct for valid column range', () => {
      fc.assert(fc.property(columnsArb, (columns) => {
        const itemsPerPage = (gameUI as any).calculateItemsPerPage(columns);
        
        // With columns in [1, 8] and target rows = 4, items per page should be in [4, 32]
        expect(itemsPerPage).toBeGreaterThanOrEqual(4);
        expect(itemsPerPage).toBeLessThanOrEqual(32);
      }));
    });
  });

  /**
   * Property 4: Column Change Triggers Capacity Update
   * For any initial columns and new columns, when columns change, 
   * items per page should be recalculated based on the new columns
   */
  describe('Property 4: Column Change Triggers Capacity Update', () => {
    const columnsArb = fc.integer({ min: 1, max: 8 });

    it('**Validates: Requirements 1.4, 6.2** - Items per page updates when columns change', () => {
      fc.assert(fc.property(columnsArb, columnsArb, (initialColumns, newColumns) => {
        const targetRows = 4;
        
        // Calculate initial items per page
        const initialItemsPerPage = (gameUI as any).calculateItemsPerPage(initialColumns);
        expect(initialItemsPerPage).toBe(initialColumns * targetRows);
        
        // Calculate new items per page after column change
        const newItemsPerPage = (gameUI as any).calculateItemsPerPage(newColumns);
        expect(newItemsPerPage).toBe(newColumns * targetRows);
        
        // If columns changed, items per page should also change (unless by coincidence they're equal)
        if (initialColumns !== newColumns) {
          expect(newItemsPerPage).not.toBe(initialItemsPerPage);
        } else {
          expect(newItemsPerPage).toBe(initialItemsPerPage);
        }
      }));
    });

    it('**Validates: Requirements 1.4, 6.2** - Capacity update maintains correct ratio', () => {
      fc.assert(fc.property(columnsArb, columnsArb, (initialColumns, newColumns) => {
        const targetRows = 4;
        
        const initialItemsPerPage = (gameUI as any).calculateItemsPerPage(initialColumns);
        const newItemsPerPage = (gameUI as any).calculateItemsPerPage(newColumns);
        
        // The ratio of items per page should equal the ratio of columns
        const columnsRatio = newColumns / initialColumns;
        const itemsPerPageRatio = newItemsPerPage / initialItemsPerPage;
        
        expect(itemsPerPageRatio).toBeCloseTo(columnsRatio, 5);
      }));
    });

    it('**Validates: Requirements 1.4, 6.2** - Capacity increases when columns increase', () => {
      fc.assert(fc.property(columnsArb, columnsArb, (initialColumns, newColumns) => {
        const initialItemsPerPage = (gameUI as any).calculateItemsPerPage(initialColumns);
        const newItemsPerPage = (gameUI as any).calculateItemsPerPage(newColumns);
        
        if (newColumns > initialColumns) {
          expect(newItemsPerPage).toBeGreaterThan(initialItemsPerPage);
        } else if (newColumns < initialColumns) {
          expect(newItemsPerPage).toBeLessThan(initialItemsPerPage);
        } else {
          expect(newItemsPerPage).toBe(initialItemsPerPage);
        }
      }));
    });

    it('**Validates: Requirements 1.4, 6.2** - Container width change triggers column recalculation', () => {
      fc.assert(fc.property(
        fc.integer({ min: 120, max: 2000 }),
        fc.integer({ min: 120, max: 2000 }),
        (initialWidth, newWidth) => {
          const initialColumns = (gameUI as any).calculateGridColumns(initialWidth);
          const newColumns = (gameUI as any).calculateGridColumns(newWidth);
          
          const initialItemsPerPage = (gameUI as any).calculateItemsPerPage(initialColumns);
          const newItemsPerPage = (gameUI as any).calculateItemsPerPage(newColumns);
          
          // If width change causes column change, items per page should also change
          if (initialColumns !== newColumns) {
            expect(newItemsPerPage).not.toBe(initialItemsPerPage);
          }
          
          // Both should still be valid
          expect(initialItemsPerPage).toBeGreaterThanOrEqual(4);
          expect(initialItemsPerPage).toBeLessThanOrEqual(32);
          expect(newItemsPerPage).toBeGreaterThanOrEqual(4);
          expect(newItemsPerPage).toBeLessThanOrEqual(32);
        }
      ));
    });
  });

  /**
   * Property 9: Filter State Preservation During Responsive Updates
   * For any responsive update (column change), the current filter type should remain unchanged
   */
  describe('Property 9: Filter State Preservation', () => {
    const filterTypeArb = fc.constantFrom('all', 'material', 'food', 'book', 'equipment', 'consumable');
    const containerWidthArb = fc.integer({ min: 120, max: 2000 });

    it('**Validates: Requirements 6.3** - Filter state persists across column changes', () => {
      fc.assert(fc.property(filterTypeArb, containerWidthArb, containerWidthArb, (filterType, initialWidth, newWidth) => {
        // Set initial filter state
        (gameUI as any).currentFilter = filterType;
        const initialFilter = (gameUI as any).currentFilter;
        
        // Simulate column change by calculating new columns
        const initialColumns = (gameUI as any).calculateGridColumns(initialWidth);
        const newColumns = (gameUI as any).calculateGridColumns(newWidth);
        
        // Update current columns (simulating what happens in resize observer)
        (gameUI as any).currentColumns = newColumns;
        
        // Filter state should remain unchanged
        const finalFilter = (gameUI as any).currentFilter;
        expect(finalFilter).toBe(initialFilter);
        expect(finalFilter).toBe(filterType);
      }));
    });

    it('**Validates: Requirements 6.3** - Filter state is independent of column calculation', () => {
      fc.assert(fc.property(filterTypeArb, containerWidthArb, (filterType, containerWidth) => {
        // Set filter state
        (gameUI as any).currentFilter = filterType;
        
        // Calculate columns (should not affect filter)
        const columns = (gameUI as any).calculateGridColumns(containerWidth);
        
        // Filter should remain unchanged
        expect((gameUI as any).currentFilter).toBe(filterType);
        
        // Calculate items per page (should not affect filter)
        const itemsPerPage = (gameUI as any).calculateItemsPerPage(columns);
        
        // Filter should still remain unchanged
        expect((gameUI as any).currentFilter).toBe(filterType);
      }));
    });

    it('**Validates: Requirements 6.3** - Multiple column changes preserve filter state', () => {
      fc.assert(fc.property(
        filterTypeArb,
        fc.array(fc.integer({ min: 120, max: 2000 }), { minLength: 2, maxLength: 10 }),
        (filterType, widths) => {
          // Set initial filter state
          (gameUI as any).currentFilter = filterType;
          
          // Simulate multiple column changes
          for (const width of widths) {
            const columns = (gameUI as any).calculateGridColumns(width);
            (gameUI as any).currentColumns = columns;
            (gameUI as any).currentItemsPerPage = (gameUI as any).calculateItemsPerPage(columns);
          }
          
          // Filter state should remain unchanged after all updates
          expect((gameUI as any).currentFilter).toBe(filterType);
        }
      ));
    });

    it('**Validates: Requirements 6.3** - Filter state preserved during capacity updates', () => {
      fc.assert(fc.property(
        filterTypeArb,
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 1, max: 8 }),
        (filterType, initialColumns, newColumns) => {
          // Set initial state
          (gameUI as any).currentFilter = filterType;
          (gameUI as any).currentColumns = initialColumns;
          (gameUI as any).currentItemsPerPage = (gameUI as any).calculateItemsPerPage(initialColumns);
          
          const filterBeforeUpdate = (gameUI as any).currentFilter;
          
          // Simulate column change and capacity update
          (gameUI as any).currentColumns = newColumns;
          (gameUI as any).currentItemsPerPage = (gameUI as any).calculateItemsPerPage(newColumns);
          
          const filterAfterUpdate = (gameUI as any).currentFilter;
          
          // Filter should remain unchanged
          expect(filterAfterUpdate).toBe(filterBeforeUpdate);
          expect(filterAfterUpdate).toBe(filterType);
        }
      ));
    });

    it('**Validates: Requirements 6.3** - All filter types are preserved correctly', () => {
      const allFilterTypes = ['all', 'material', 'food', 'book', 'equipment', 'consumable'];
      
      fc.assert(fc.property(containerWidthArb, containerWidthArb, (width1, width2) => {
        for (const filterType of allFilterTypes) {
          // Set filter
          (gameUI as any).currentFilter = filterType;
          
          // Simulate responsive updates
          const columns1 = (gameUI as any).calculateGridColumns(width1);
          (gameUI as any).currentColumns = columns1;
          
          const columns2 = (gameUI as any).calculateGridColumns(width2);
          (gameUI as any).currentColumns = columns2;
          
          // Verify filter is preserved
          expect((gameUI as any).currentFilter).toBe(filterType);
        }
      }));
    });
  });

});
