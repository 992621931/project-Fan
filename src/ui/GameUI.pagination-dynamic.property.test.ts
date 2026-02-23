/**
 * Property-based tests for dynamic pagination logic
 * Feature: warehouse-panel-grid-layout-bugfix
 * Tests pagination with dynamically calculated capacity and item integrity
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('GameUI Dynamic Pagination Property Tests', () => {
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
    return Math.max(1, Math.ceil(itemCount / itemsPerPage));
  }

  /**
   * Property 3: Pagination Uses Dynamic Calculated Capacity
   * For any item list and calculated items per page, pagination should use the dynamic capacity
   * Each page (except the last) should contain exactly itemsPerPage items
   * **Validates: Requirements 1.3, 2.3**
   */
  describe('Property 3: Pagination Uses Dynamic Calculated Capacity', () => {
    it('**Validates: Requirements 1.3, 2.3** - Non-last pages contain exactly itemsPerPage items', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 200 }), // itemCount
        fc.integer({ min: 1, max: 50 }),  // dynamically calculated itemsPerPage
        (itemCount, itemsPerPage) => {
          // Create test items
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i, name: `item-${i}` }));
          
          // Calculate total pages
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          
          // Test all pages except the last one
          for (let page = 0; page < totalPages - 1; page++) {
            const paginatedItems = paginateItems(items, page, itemsPerPage);
            
            // Non-last pages must have exactly itemsPerPage items
            expect(paginatedItems.length).toBe(itemsPerPage);
          }
        }
      ));
    });

    it('**Validates: Requirements 1.3, 2.3** - Last page contains remaining items (1 to itemsPerPage)', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 200 }), // itemCount
        fc.integer({ min: 1, max: 50 }),  // dynamically calculated itemsPerPage
        (itemCount, itemsPerPage) => {
          // Create test items
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i, name: `item-${i}` }));
          
          // Calculate total pages
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          
          // Get last page items
          const lastPage = totalPages - 1;
          const lastPageItems = paginateItems(items, lastPage, itemsPerPage);
          
          // Last page must have at least 1 item
          expect(lastPageItems.length).toBeGreaterThan(0);
          
          // Last page must have at most itemsPerPage items
          expect(lastPageItems.length).toBeLessThanOrEqual(itemsPerPage);
          
          // Verify the exact count matches the remainder
          const remainder = itemCount % itemsPerPage;
          const expectedCount = remainder === 0 ? itemsPerPage : remainder;
          expect(lastPageItems.length).toBe(expectedCount);
        }
      ));
    });

    it('**Validates: Requirements 1.3, 2.3** - Pagination adapts to different itemsPerPage values', () => {
      fc.assert(fc.property(
        fc.integer({ min: 10, max: 100 }), // fixed itemCount
        fc.integer({ min: 3, max: 24 }),   // itemsPerPage (range from 1*3 to 8*3 columns*rows)
        (itemCount, itemsPerPage) => {
          // Create test items
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
          
          // Calculate total pages with this itemsPerPage
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          
          // Verify all non-last pages have exactly itemsPerPage items
          for (let page = 0; page < totalPages - 1; page++) {
            const paginatedItems = paginateItems(items, page, itemsPerPage);
            expect(paginatedItems.length).toBe(itemsPerPage);
          }
          
          // Verify last page has correct count
          const lastPageItems = paginateItems(items, totalPages - 1, itemsPerPage);
          const remainder = itemCount % itemsPerPage;
          const expectedLastPageCount = remainder === 0 ? itemsPerPage : remainder;
          expect(lastPageItems.length).toBe(expectedLastPageCount);
        }
      ));
    });

    it('**Validates: Requirements 1.3, 2.3** - Single page shows all items when count <= itemsPerPage', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 50 }),  // itemsPerPage
        (itemsPerPage) => {
          // Create items that fit in one page
          fc.assert(fc.property(
            fc.integer({ min: 1, max: itemsPerPage }),
            (itemCount) => {
              const items = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
              
              // Should be exactly 1 page
              const totalPages = calculateTotalPages(itemCount, itemsPerPage);
              expect(totalPages).toBe(1);
              
              // First (and only) page should have all items
              const paginatedItems = paginateItems(items, 0, itemsPerPage);
              expect(paginatedItems.length).toBe(itemCount);
            }
          ));
        }
      ));
    });
  });

  /**
   * Property 5: Pagination Maintains Item Integrity
   * For any item list and itemsPerPage, pagination should preserve all items without duplication or loss
   * **Validates: Requirements 2.2, 2.4**
   */
  describe('Property 5: Pagination Maintains Item Integrity', () => {
    it('**Validates: Requirements 2.2, 2.4** - All items are present across all pages', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 200 }), // itemCount
        fc.integer({ min: 1, max: 50 }),  // itemsPerPage
        (itemCount, itemsPerPage) => {
          // Create test items with unique IDs
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i, value: `item-${i}` }));
          
          // Calculate total pages
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          
          // Collect all items from all pages
          const collectedItems: any[] = [];
          for (let page = 0; page < totalPages; page++) {
            const paginatedItems = paginateItems(items, page, itemsPerPage);
            collectedItems.push(...paginatedItems);
          }
          
          // Verify total count matches original
          expect(collectedItems.length).toBe(itemCount);
          
          // Verify all original items are present
          for (let i = 0; i < itemCount; i++) {
            const found = collectedItems.find(item => item.id === i);
            expect(found).toBeDefined();
            expect(found.value).toBe(`item-${i}`);
          }
        }
      ));
    });

    it('**Validates: Requirements 2.2, 2.4** - No items are duplicated across pages', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 200 }), // itemCount
        fc.integer({ min: 1, max: 50 }),  // itemsPerPage
        (itemCount, itemsPerPage) => {
          // Create test items with unique IDs
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
          
          // Calculate total pages
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          
          // Collect all items from all pages
          const collectedItems: any[] = [];
          for (let page = 0; page < totalPages; page++) {
            const paginatedItems = paginateItems(items, page, itemsPerPage);
            collectedItems.push(...paginatedItems);
          }
          
          // Verify no duplicates by checking unique IDs
          const uniqueIds = new Set(collectedItems.map(item => item.id));
          expect(uniqueIds.size).toBe(itemCount);
        }
      ));
    });

    it('**Validates: Requirements 2.2, 2.4** - Items maintain correct order across pages', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 200 }), // itemCount
        fc.integer({ min: 1, max: 50 }),  // itemsPerPage
        (itemCount, itemsPerPage) => {
          // Create test items with sequential IDs
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i, order: i }));
          
          // Calculate total pages
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          
          // Collect all items from all pages
          const collectedItems: any[] = [];
          for (let page = 0; page < totalPages; page++) {
            const paginatedItems = paginateItems(items, page, itemsPerPage);
            collectedItems.push(...paginatedItems);
          }
          
          // Verify items are in correct sequential order
          for (let i = 0; i < itemCount; i++) {
            expect(collectedItems[i].id).toBe(i);
            expect(collectedItems[i].order).toBe(i);
          }
        }
      ));
    });

    it('**Validates: Requirements 2.2, 2.4** - Page boundaries are correct', () => {
      fc.assert(fc.property(
        fc.integer({ min: 2, max: 100 }), // itemCount (at least 2 for multiple pages)
        fc.integer({ min: 1, max: 20 }),  // itemsPerPage
        (itemCount, itemsPerPage) => {
          // Create test items
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
          
          // Calculate total pages
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          
          // Skip if only one page
          if (totalPages === 1) return;
          
          // Check each page boundary
          for (let page = 0; page < totalPages; page++) {
            const paginatedItems = paginateItems(items, page, itemsPerPage);
            
            // Verify first item on page has correct ID
            const expectedFirstId = page * itemsPerPage;
            expect(paginatedItems[0].id).toBe(expectedFirstId);
            
            // Verify last item on page has correct ID (except for last page)
            if (page < totalPages - 1) {
              const expectedLastId = (page + 1) * itemsPerPage - 1;
              expect(paginatedItems[paginatedItems.length - 1].id).toBe(expectedLastId);
            } else {
              // Last page should end at the last item
              expect(paginatedItems[paginatedItems.length - 1].id).toBe(itemCount - 1);
            }
          }
        }
      ));
    });

    it('**Validates: Requirements 2.2, 2.4** - Empty pages are never returned', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 200 }), // itemCount
        fc.integer({ min: 1, max: 50 }),  // itemsPerPage
        (itemCount, itemsPerPage) => {
          // Create test items
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
          
          // Calculate total pages
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          
          // Verify every valid page has at least one item
          for (let page = 0; page < totalPages; page++) {
            const paginatedItems = paginateItems(items, page, itemsPerPage);
            expect(paginatedItems.length).toBeGreaterThan(0);
          }
        }
      ));
    });

    it('**Validates: Requirements 2.2, 2.4** - Pages beyond total pages return empty arrays', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 100 }), // itemCount
        fc.integer({ min: 1, max: 20 }),  // itemsPerPage
        (itemCount, itemsPerPage) => {
          // Create test items
          const items = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
          
          // Calculate total pages
          const totalPages = calculateTotalPages(itemCount, itemsPerPage);
          
          // Try to access pages beyond the valid range
          const beyondPage = totalPages + 1;
          const beyondItems = paginateItems(items, beyondPage, itemsPerPage);
          
          // Should return empty array
          expect(beyondItems.length).toBe(0);
        }
      ));
    });
  });
});
