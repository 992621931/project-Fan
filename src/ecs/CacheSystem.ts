/**
 * CacheSystem - Caching system for performance optimization
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheConfig {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  cleanupInterval?: number; // Cleanup interval in milliseconds
}

export class Cache<K, V> {
  private cache: Map<K, CacheEntry<V>> = new Map();
  private maxSize: number;
  private ttl: number;
  private cleanupInterval: number;
  private cleanupTimer: NodeJS.Timeout | null = null;
  
  // Statistics
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(config: CacheConfig = {}) {
    this.maxSize = config.maxSize || 1000;
    this.ttl = config.ttl || 5 * 60 * 1000; // 5 minutes default
    this.cleanupInterval = config.cleanupInterval || 60 * 1000; // 1 minute default

    // Start cleanup timer
    this.startCleanup();
  }

  /**
   * Get a value from the cache
   */
  public get(key: K): V | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    this.hits++;

    return entry.value;
  }

  /**
   * Set a value in the cache
   */
  public set(key: K, value: V): void {
    const now = Date.now();
    
    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<V> = {
      value,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if a key exists in the cache
   */
  public has(key: K): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from the cache
   */
  public delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear the entire cache
   */
  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get cache size
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  public getStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    evictions: number;
    hitRate: number;
    memoryUsage: number;
  } {
    const totalRequests = this.hits + this.misses;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: K | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.cache.delete(oldestKey);
      this.evictions++;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: K[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  public stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Estimate memory usage (rough approximation)
   */
  private estimateMemoryUsage(): number {
    // This is a rough estimate - in a real implementation you might want more accurate measurement
    return this.cache.size * 100; // Assume ~100 bytes per entry on average
  }

  /**
   * Update cache configuration
   */
  public updateConfig(config: Partial<CacheConfig>): void {
    if (config.maxSize !== undefined) {
      this.maxSize = config.maxSize;
      
      // Evict entries if cache is now too large
      while (this.cache.size > this.maxSize) {
        this.evictLRU();
      }
    }

    if (config.ttl !== undefined) {
      this.ttl = config.ttl;
    }

    if (config.cleanupInterval !== undefined) {
      this.cleanupInterval = config.cleanupInterval;
      this.startCleanup(); // Restart with new interval
    }
  }
}

/**
 * Global cache manager
 */
export class CacheManager {
  private caches: Map<string, Cache<any, any>> = new Map();

  /**
   * Create or get a cache
   */
  public getCache<K, V>(name: string, config?: CacheConfig): Cache<K, V> {
    let cache = this.caches.get(name);
    
    if (!cache) {
      cache = new Cache<K, V>(config);
      this.caches.set(name, cache);
    }
    
    return cache;
  }

  /**
   * Remove a cache
   */
  public removeCache(name: string): boolean {
    const cache = this.caches.get(name);
    
    if (cache) {
      cache.stopCleanup();
      cache.clear();
      this.caches.delete(name);
      return true;
    }
    
    return false;
  }

  /**
   * Get all cache names
   */
  public getCacheNames(): string[] {
    return Array.from(this.caches.keys());
  }

  /**
   * Get statistics for all caches
   */
  public getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, cache] of this.caches.entries()) {
      stats[name] = cache.getStats();
    }
    
    return stats;
  }

  /**
   * Clear all caches
   */
  public clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.stopCleanup();
      cache.clear();
    }
    this.caches.clear();
  }
}