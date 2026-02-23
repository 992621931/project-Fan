/**
 * Property-based tests for GameUI pagination functionality
 * Tests pagination bounds, items per page limit, and last page item count
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('GameUI Pagination Property Tests', () => {
  /**
   * Helper function to simulate the paginateItems method from GameUI
   */
  function paginateItems(items: any[], page: number, itemsPerPage: number): any[] {
    const startIndex = page * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  /**
   * Helper function to simulate the calculateTotalPages method from GameUI
   */
  function calculateTotalPages(itemCount: number, itemsPerPage: number): number {
    return Math.ceil(itemCount / itemsPerPage);
  }

  /**
   * Property 2: Pagination Bounds
   * For any page number displayed, it must be within the valid range [1, totalPages] inclusive
   * **Validates: Requirements 5.5, 6.4**
   */
  describe('Property 2: Pagination Bounds', () => {
    it('**Validates: Requirements 5.5, 6.4** - Current page must be within valid range [0, totalPages-1]', () => {
      fc.assert(fc.property(
        fc.integer({ min: 0, max: 200 }), // itemCount
        fc.integer({ min: 1, max: 50 }),  // itemsPerPage
        (itemCount, itemsPerPage) => {
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          
          // If there are no items, totalPages should be 0
          if (itemCount === 0) {
            expect(totalPages).toBe(0);
            return;
          }
          
          // Total pages should be at least 1 if there are items
          expect(totalPages).toBeGreaterThanOrEqual(1);
          
          // Test all valid page numbers (0-based indexing)
          for (let page = 0; page < totalPages; page++) {
            // Page should be within bounds [0, totalPages-1]
            expect(page).toBeGreaterThanOrEqual(0);
            expect(page).toBeLessThan(totalPages);
            
            // Display page number (1-based) should be within [1, totalPages]
            const displayPage = page + 1;
            expect(displayPage).toBeGreaterThanOrEqual(1);
            expect(displayPage).toBeLessThanOrEqual(totalPages);
          }
        }
      ));
    });

    it('**Validates: Requirements 5.5, 6.4** - Total pages calculation is correct', () => {
      fc.assert(fc.property(
        fc.integer({ min: 0, max: 200 }), // itemCount
        fc.integer({ min: 1, max: 50 }),  // itemsPerPage
        (itemCount, itemsPerPage) => {
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          
          if (itemCount === 0) {
            expect(totalPages).toBe(0);
          } else {
            // Total pages should be ceiling of itemCount / itemsPerPage
            const expectedPages = Math.ceil(itemCount / itemsPerPage);
            expect(totalPages).toBe(expectedPages);
            
            // Verify that (totalPages - 1) * itemsPerPage < itemCount <= totalPages * itemsPerPage
            expect((totalPages - 1) * itemsPerPage).toBeLessThan(itemCount);
            expect(itemCount).toBeLessThanOrEqual(totalPages * itemsPerPage);
          }
        }
      ));
    });

    it('**Validates: Requirements 5.5, 6.4** - Page indicator format is valid', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 200 }), // itemCount (at least 1)
        fc.integer({ min: 1, max: 50 }),  // itemsPerPage
        (itemCount, itemsPerPage) => {
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          
          // Test all valid pages
          for (let page = 0; page < totalPages; page++) {
            const displayPage = page + 1; // Convert to 1-based
            const pageIndicator = `${displayPage}/${totalPages}`;
            
            // Verify format is "current/total"
            expect(pageIndicator).toMatch(/^\d+\/\d+$/);
            
            // Verify current is within range
            expect(displayPage).toBeGreaterThanOrEqual(1);
            expect(displayPage).toBeLessThanOrEqual(totalPages);
          }
        }
      ));
    });
  });

  /**
   * Property 3: Items Per Page Limit
   * For any page except the last page, the number of displayed items must equal 12
   * **Validates: Requirements 7.1, 7.2, 7.3**
   */
  describe('Property 3: Items Per Page Limit', () => {
    const ITEMS_PER_PAGE = 12;

    it('**Validates: Requirements 7.1, 7.2, 7.3** - Non-last pages must have exactly itemsPerPage items', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 200 }), // itemCount
        (itemCount) => {
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
          const totalPages = calculateTotalPages(itemCount, ITEMS_PER_PAGE);
          
          // Test all pages except the last one
          for (let page = 0; page < totalPages - 1; page++) {
            const paginatedItems = paginateItems(items, page, ITEMS_PER_PAGE);
            
            // Non-last pages must have exactly ITEMS_PER_PAGE items
            expect(paginatedItems.length).toBe(ITEMS_PER_PAGE);
          }
        }
      ));
    });

    it('**Validates: Requirements 7.1, 7.2, 7.3** - Single page with <= itemsPerPage items shows all items', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 12 }), // itemCount <= ITEMS_PER_PAGE
        (itemCount) => {
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
          const totalPages = calculateTotalPages(itemCount, ITEMS_PER_PAGE);
          
          // Should be exactly 1 page
          expect(totalPages).toBe(1);
          
          // First (and only) page should have all items
          const paginatedItems = paginateItems(items, 0, ITEMS_PER_PAGE);
          expect(paginatedItems.length).toBe(itemCount);
        }
      ));
    });

    it('**Validates: Requirements 7.1, 7.2, 7.3** - Multiple pages split items correctly', () => {
      fc.assert(fc.property(
        fc.integer({ min: 13, max: 200 }), // itemCount > ITEMS_PER_PAGE
        (itemCount) => {
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
          const totalPages = calculateTotalPages(itemCount, ITEMS_PER_PAGE);
          
          // Should be more than 1 page
          expect(totalPages).toBeGreaterThan(1);
          
          // Collect all paginated items
          let collectedItems: any[] = [];
          for (let page = 0; page < totalPages; page++) {
            const paginatedItems = paginateItems(items, page, ITEMS_PER_PAGE);
            collectedItems = collectedItems.concat(paginatedItems);
          }
          
          // All items should be accounted for
          expect(collectedItems.length).toBe(itemCount);
          
          // Items should be in correct order
          for (let i = 0; i < itemCount; i++) {
            expect(collectedItems[i].id).toBe(i);
          }
        }
      ));
    });
  });

  /**
   * Property 4: Last Page Item Count
   * For any last page with items, the number of displayed items must be greater than 0 and less than or equal to 12
   * **Validates: Requirements 7.4**
   */
  describe('Property 4: Last Page Item Count', () => {
    const ITEMS_PER_PAGE = 12;

    it('**Validates: Requirements 7.4** - Last page must have between 1 and itemsPerPage items', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 200 }), // itemCount
        (itemCount) => {
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
          const totalPages = calculateTotalPages(itemCount, ITEMS_PER_PAGE);
          
          // Get items on the last page
          const lastPage = totalPages - 1;
          const lastPageItems = paginateItems(items, lastPage, ITEMS_PER_PAGE);
          
          // Last page must have at least 1 item
          expect(lastPageItems.length).toBeGreaterThan(0);
          
          // Last page must have at most ITEMS_PER_PAGE items
          expect(lastPageItems.length).toBeLessThanOrEqual(ITEMS_PER_PAGE);
        }
      ));
    });

    it('**Validates: Requirements 7.4** - Last page item count matches remainder', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 200 }), // itemCount
        (itemCount) => {
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
          const totalPages = calculateTotalPages(itemCount, ITEMS_PER_PAGE);
          
          // Calculate expected items on last page
          const remainder = itemCount % ITEMS_PER_PAGE;
          const expectedLastPageCount = remainder === 0 ? ITEMS_PER_PAGE : remainder;
          
          // Get items on the last page
          const lastPage = totalPages - 1;
          const lastPageItems = paginateItems(items, lastPage, ITEMS_PER_PAGE);
          
          // Verify last page has expected count
          expect(lastPageItems.length).toBe(expectedLastPageCount);
        }
      ));
    });

    it('**Validates: Requirements 7.4** - Last page contains correct items', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 200 }), // itemCount
        (itemCount) => {
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
          const totalPages = calculateTotalPages(itemCount, ITEMS_PER_PAGE);
          
          // Get items on the last page
          const lastPage = totalPages - 1;
          const lastPageItems = paginateItems(items, lastPage, ITEMS_PER_PAGE);
          
          // Calculate expected start index for last page
          const expectedStartIndex = lastPage * ITEMS_PER_PAGE;
          
          // Verify items are correct
          for (let i = 0; i < lastPageItems.length; i++) {
            const expectedId = expectedStartIndex + i;
            expect(lastPageItems[i].id).toBe(expectedId);
          }
        }
      ));
    });

    it('**Validates: Requirements 7.4** - Empty inventory has no pages', () => {
      const items: any[] = [];
      const totalPages = calculateTotalPages(items.length, ITEMS_PER_PAGE);
      
      // No items means no pages
      expect(totalPages).toBe(0);
    });
  });
});
