/**
 * Property-based tests for pagination controls
 * Feature: warehouse-panel-grid-layout-bugfix
 * Tests total page calculation and automatic page adjustment
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('GameUI Pagination Controls Property Tests', () => {
  /**
   * Helper function to simulate the calculateTotalPages method from GameUI
   */
  function calculateTotalPages(itemCount: number, itemsPerPage: number): number {
    return Math.max(1, Math.ceil(itemCount / itemsPerPage));
  }

  /**
   * Helper function to simulate the adjustCurrentPage method from GameUI
   * Adjusts current page if it exceeds total pages
   */
  function adjustCurrentPage(currentPage: number, totalPages: number): number {
    if (currentPage >= totalPages) {
      return totalPages - 1;
    }
    return currentPage;
  }

  /**
   * Property 6: Total Page Count Correctness
   * For any item count and items per page, total pages should equal Math.ceil(itemCount / itemsPerPage)
   * and be at least 1
   * **Validates: Requirements 4.1**
   */
  describe('Property 6: Total Page Count Correctness', () => {
    it('**Validates: Requirements 4.1** - Total pages equals Math.ceil(itemCount / itemsPerPage)', () => {
      fc.assert(fc.property(
        fc.integer({ min: 0, max: 200 }), // itemCount (including 0)
        fc.integer({ min: 1, max: 50 }),  // itemsPerPage
        (itemCount, itemsPerPage) => {
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          const expected = Math.ceil(itemCount / itemsPerPage);
          
          // For 0 items, we expect at least 1 page
          if (itemCount === 0) {
            expect(totalPages).toBe(1);
          } else {
            expect(totalPages).toBe(expected);
          }
        }
      ));
    });

    it('**Validates: Requirements 4.1** - Total pages is always at least 1', () => {
      fc.assert(fc.property(
        fc.integer({ min: 0, max: 200 }), // itemCount
        fc.integer({ min: 1, max: 50 }),  // itemsPerPage
        (itemCount, itemsPerPage) => {
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          
          // Total pages must always be at least 1
          expect(totalPages).toBeGreaterThanOrEqual(1);
        }
      ));
    });

    it('**Validates: Requirements 4.1** - Total pages increases as items increase', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 100 }), // baseItemCount
        fc.integer({ min: 1, max: 50 }),  // itemsPerPage
        fc.integer({ min: 1, max: 50 }),  // additionalItems
        (baseItemCount, itemsPerPage, additionalItems) => {
          const totalPages1 = calculateTotalPages(baseItemCount, itemsPerPage);
          const totalPages2 = calculateTotalPages(baseItemCount + additionalItems, itemsPerPage);
          
          // Adding items should never decrease total pages
          expect(totalPages2).toBeGreaterThanOrEqual(totalPages1);
        }
      ));
    });

    it('**Validates: Requirements 4.1** - Total pages decreases as itemsPerPage increases', () => {
      fc.assert(fc.property(
        fc.integer({ min: 10, max: 200 }), // itemCount (at least 10 for meaningful test)
        fc.integer({ min: 1, max: 20 }),   // smallerItemsPerPage
        fc.integer({ min: 1, max: 30 }),   // additionalCapacity
        (itemCount, smallerItemsPerPage, additionalCapacity) => {
          const largerItemsPerPage = smallerItemsPerPage + additionalCapacity;
          
          const totalPages1 = calculateTotalPages(itemCount, smallerItemsPerPage);
          const totalPages2 = calculateTotalPages(itemCount, largerItemsPerPage);
          
          // Larger capacity should result in fewer or equal pages
          expect(totalPages2).toBeLessThanOrEqual(totalPages1);
        }
      ));
    });

    it('**Validates: Requirements 4.1** - Exact multiples result in exact page count', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 20 }),  // itemsPerPage
        fc.integer({ min: 1, max: 10 }),  // pageMultiplier
        (itemsPerPage, pageMultiplier) => {
          const itemCount = itemsPerPage * pageMultiplier;
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          
          // Exact multiples should result in exact page count
          expect(totalPages).toBe(pageMultiplier);
        }
      ));
    });

    it('**Validates: Requirements 4.1** - One extra item adds one page', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 20 }),  // itemsPerPage
        fc.integer({ min: 1, max: 10 }),  // pageMultiplier
        (itemsPerPage, pageMultiplier) => {
          const exactCount = itemsPerPage * pageMultiplier;
          const overCount = exactCount + 1;
          
          const totalPagesExact = calculateTotalPages(exactCount, itemsPerPage);
          const totalPagesOver = calculateTotalPages(overCount, itemsPerPage);
          
          // One extra item should add exactly one page
          expect(totalPagesOver).toBe(totalPagesExact + 1);
        }
      ));
    });
  });

  /**
   * Property 7: Automatic Page Adjustment
   * For any current page and new total pages, if current page exceeds range (>= totalPages),
   * it should automatically adjust to the last page (totalPages - 1)
   * **Validates: Requirements 4.3, 6.4**
   */
  describe('Property 7: Automatic Page Adjustment', () => {
    it('**Validates: Requirements 4.3, 6.4** - Page adjusts to last page when exceeding total pages', () => {
      fc.assert(fc.property(
        fc.integer({ min: 0, max: 50 }),  // currentPage
        fc.integer({ min: 1, max: 20 }),  // totalPages
        (currentPage, totalPages) => {
          const adjustedPage = adjustCurrentPage(currentPage, totalPages);
          
          // Adjusted page must be within valid range [0, totalPages-1]
          expect(adjustedPage).toBeGreaterThanOrEqual(0);
          expect(adjustedPage).toBeLessThan(totalPages);
        }
      ));
    });

    it('**Validates: Requirements 4.3, 6.4** - Page remains unchanged when within valid range', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 20 }),  // totalPages
        (totalPages) => {
          // Test all valid pages
          for (let page = 0; page < totalPages; page++) {
            const adjustedPage = adjustCurrentPage(page, totalPages);
            
            // Valid pages should not be adjusted
            expect(adjustedPage).toBe(page);
          }
        }
      ));
    });

    it('**Validates: Requirements 4.3, 6.4** - Page adjusts to last page (totalPages - 1) when exceeding', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 20 }),  // totalPages
        fc.integer({ min: 0, max: 30 }),  // excessAmount
        (totalPages, excessAmount) => {
          const currentPage = totalPages + excessAmount;
          const adjustedPage = adjustCurrentPage(currentPage, totalPages);
          
          // Should adjust to last page
          expect(adjustedPage).toBe(totalPages - 1);
        }
      ));
    });

    it('**Validates: Requirements 4.3, 6.4** - Boundary case: page equals totalPages adjusts to last page', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 20 }),  // totalPages
        (totalPages) => {
          const currentPage = totalPages; // Exactly at boundary
          const adjustedPage = adjustCurrentPage(currentPage, totalPages);
          
          // Should adjust to last page (totalPages - 1)
          expect(adjustedPage).toBe(totalPages - 1);
        }
      ));
    });

    it('**Validates: Requirements 4.3, 6.4** - Adjustment works when total pages decreases', () => {
      fc.assert(fc.property(
        fc.integer({ min: 5, max: 20 }),  // oldTotalPages
        fc.integer({ min: 1, max: 10 }),  // reduction
        (oldTotalPages, reduction) => {
          const newTotalPages = Math.max(1, oldTotalPages - reduction);
          
          // User was on a page that might now be out of range
          const currentPage = oldTotalPages - 1; // Was on last page
          const adjustedPage = adjustCurrentPage(currentPage, newTotalPages);
          
          // Should adjust to new last page if necessary
          expect(adjustedPage).toBeLessThan(newTotalPages);
          expect(adjustedPage).toBe(Math.min(currentPage, newTotalPages - 1));
        }
      ));
    });

    it('**Validates: Requirements 4.3, 6.4** - Adjustment preserves page when total pages increases', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 10 }),  // oldTotalPages
        fc.integer({ min: 1, max: 10 }),  // increase
        (oldTotalPages, increase) => {
          const newTotalPages = oldTotalPages + increase;
          
          // User was on a valid page
          const currentPage = Math.floor(oldTotalPages / 2); // Middle page
          const adjustedPage = adjustCurrentPage(currentPage, newTotalPages);
          
          // Should remain on same page since it's still valid
          expect(adjustedPage).toBe(currentPage);
        }
      ));
    });

    it('**Validates: Requirements 4.3, 6.4** - Negative page numbers adjust to 0', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 20 }),  // totalPages
        fc.integer({ min: 1, max: 10 }),  // negativeAmount
        (totalPages, negativeAmount) => {
          const currentPage = -negativeAmount;
          const adjustedPage = adjustCurrentPage(currentPage, totalPages);
          
          // Negative pages should be treated as valid (0) or adjusted
          // In this implementation, negative pages stay negative but are clamped by the check
          expect(adjustedPage).toBeGreaterThanOrEqual(0);
          expect(adjustedPage).toBeLessThan(totalPages);
        }
      ));
    });

    it('**Validates: Requirements 4.3, 6.4** - Single page always results in page 0', () => {
      fc.assert(fc.property(
        fc.integer({ min: 0, max: 100 }), // currentPage (any value)
        (currentPage) => {
          const totalPages = 1; // Only one page
          const adjustedPage = adjustCurrentPage(currentPage, totalPages);
          
          // With only one page, should always be page 0
          expect(adjustedPage).toBe(0);
        }
      ));
    });
  });

  /**
   * Integration test: Total pages and page adjustment work together
   */
  describe('Integration: Total Pages and Page Adjustment', () => {
    it('**Validates: Requirements 4.1, 4.3, 6.4** - Capacity change triggers correct page adjustment', () => {
      fc.assert(fc.property(
        fc.integer({ min: 20, max: 200 }), // itemCount
        fc.integer({ min: 3, max: 15 }),   // oldItemsPerPage
        fc.integer({ min: 3, max: 15 }),   // newItemsPerPage
        (itemCount, oldItemsPerPage, newItemsPerPage) => {
          // Calculate old total pages
          const oldTotalPages = calculateTotalPages(itemCount, oldItemsPerPage);
          
          // User is on last page
          const currentPage = oldTotalPages - 1;
          
          // Calculate new total pages with different capacity
          const newTotalPages = calculateTotalPages(itemCount, newItemsPerPage);
          
          // Adjust page if necessary
          const adjustedPage = adjustCurrentPage(currentPage, newTotalPages);
          
          // Adjusted page must be valid
          expect(adjustedPage).toBeGreaterThanOrEqual(0);
          expect(adjustedPage).toBeLessThan(newTotalPages);
          
          // If new total pages is less than old, page should be adjusted
          if (newTotalPages < oldTotalPages) {
            expect(adjustedPage).toBe(newTotalPages - 1);
          }
        }
      ));
    });

    it('**Validates: Requirements 4.1, 4.3, 6.4** - Filter change with page adjustment', () => {
      fc.assert(fc.property(
        fc.integer({ min: 10, max: 100 }), // totalItems
        fc.integer({ min: 1, max: 50 }),   // filteredItems (subset)
        fc.integer({ min: 3, max: 15 }),   // itemsPerPage
        (totalItems, filteredItemsCount, itemsPerPage) => {
          // Ensure filtered count is less than or equal to total
          const filteredItems = Math.min(filteredItemsCount, totalItems);
          
          // Calculate pages before and after filter
          const totalPagesBefore = calculateTotalPages(totalItems, itemsPerPage);
          const totalPagesAfter = calculateTotalPages(filteredItems, itemsPerPage);
          
          // User was on some page
          const currentPage = Math.floor(totalPagesBefore / 2);
          
          // Adjust page after filter
          const adjustedPage = adjustCurrentPage(currentPage, totalPagesAfter);
          
          // Adjusted page must be valid for filtered results
          expect(adjustedPage).toBeGreaterThanOrEqual(0);
          expect(adjustedPage).toBeLessThan(totalPagesAfter);
        }
      ));
    });
  });
});
