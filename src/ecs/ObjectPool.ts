/**
 * ObjectPool - Generic object pool for performance optimization
 */

export interface IPoolable {
  reset(): void;
}

export class ObjectPool<T extends IPoolable> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn?: (obj: T) => void;
  private maxSize: number;
  private created: number = 0;
  private borrowed: number = 0;
  private returned: number = 0;

  constructor(
    createFn: () => T,
    initialSize: number = 10,
    maxSize: number = 100,
    resetFn?: (obj: T) => void
  ) {
    this.createFn = createFn;
    this.maxSize = maxSize;
    this.resetFn = resetFn;

    // Pre-populate the pool
    for (let i = 0; i < initialSize; i++) {
      const obj = this.createFn();
      this.pool.push(obj);
      this.created++;
    }
  }

  /**
   * Get an object from the pool
   */
  public acquire(): T {
    let obj: T;

    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else {
      obj = this.createFn();
      this.created++;
    }

    this.borrowed++;
    return obj;
  }

  /**
   * Return an object to the pool
   */
  public release(obj: T): void {
    if (this.pool.length >= this.maxSize) {
      // Pool is full, don't store the object
      return;
    }

    // Reset the object
    if (this.resetFn) {
      this.resetFn(obj);
    } else {
      obj.reset();
    }

    this.pool.push(obj);
    this.returned++;
  }

  /**
   * Get pool statistics
   */
  public getStats(): {
    poolSize: number;
    maxSize: number;
    created: number;
    borrowed: number;
    returned: number;
    efficiency: number;
  } {
    return {
      poolSize: this.pool.length,
      maxSize: this.maxSize,
      created: this.created,
      borrowed: this.borrowed,
      returned: this.returned,
      efficiency: this.borrowed > 0 ? (this.returned / this.borrowed) * 100 : 0,
    };
  }

  /**
   * Clear the pool
   */
  public clear(): void {
    this.pool.length = 0;
    this.created = 0;
    this.borrowed = 0;
    this.returned = 0;
  }

  /**
   * Resize the pool
   */
  public resize(newMaxSize: number): void {
    this.maxSize = newMaxSize;
    
    // Trim pool if it's larger than new max size
    if (this.pool.length > newMaxSize) {
      this.pool.length = newMaxSize;
    }
  }
}

/**
 * Pool manager for managing multiple object pools
 */
export class PoolManager {
  private pools: Map<string, ObjectPool<any>> = new Map();

  /**
   * Register a new pool
   */
  public registerPool<T extends IPoolable>(
    name: string,
    createFn: () => T,
    initialSize: number = 10,
    maxSize: number = 100,
    resetFn?: (obj: T) => void
  ): ObjectPool<T> {
    if (this.pools.has(name)) {
      throw new Error(`Pool '${name}' already exists`);
    }

    const pool = new ObjectPool(createFn, initialSize, maxSize, resetFn);
    this.pools.set(name, pool);
    return pool;
  }

  /**
   * Get a pool by name
   */
  public getPool<T extends IPoolable>(name: string): ObjectPool<T> | null {
    return this.pools.get(name) || null;
  }

  /**
   * Remove a pool
   */
  public removePool(name: string): boolean {
    const pool = this.pools.get(name);
    if (pool) {
      pool.clear();
      this.pools.delete(name);
      return true;
    }
    return false;
  }

  /**
   * Get all pool names
   */
  public getPoolNames(): string[] {
    return Array.from(this.pools.keys());
  }

  /**
   * Get statistics for all pools
   */
  public getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, pool] of this.pools.entries()) {
      stats[name] = pool.getStats();
    }
    
    return stats;
  }

  /**
   * Clear all pools
   */
  public clearAll(): void {
    for (const pool of this.pools.values()) {
      pool.clear();
    }
    this.pools.clear();
  }
}