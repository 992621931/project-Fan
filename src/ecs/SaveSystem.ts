/**
 * SaveSystem - Handles serialization and deserialization of ECS world state
 * Enhanced with cloud storage support, data compression, and error recovery
 */

import { World } from './World';
import { Entity, EntityId } from './Entity';
import { IComponent } from './Component';
import { validateHunger } from '../game/utils/HungerValidation';
import { HungerComponent } from '../game/components/CharacterComponents';

export interface SerializedComponent {
  type: string;
  data: any;
}

export interface SerializedEntity {
  id: EntityId;
  components: SerializedComponent[];
}

export interface SerializedWorld {
  entities: SerializedEntity[];
  nextEntityId: EntityId;
  version: string;
  timestamp: number;
  checksum?: string;
}

export interface SaveMetadata {
  version: string;
  timestamp: number;
  size: number;
  compressed: boolean;
  checksum: string;
}

export interface SaveOptions {
  compress?: boolean;
  includeMetadata?: boolean;
  validateChecksum?: boolean;
}

export interface CloudStorageProvider {
  save(key: string, data: string, metadata?: SaveMetadata): Promise<boolean>;
  load(key: string): Promise<string | null>;
  delete(key: string): Promise<boolean>;
  list(): Promise<string[]>;
}

export class SaveSystem {
  private static readonly SAVE_VERSION = '1.0.0';
  private static readonly MAX_BACKUP_COUNT = 5;
  private static cloudProvider: CloudStorageProvider | null = null;

  /**
   * Set cloud storage provider
   */
  public static setCloudProvider(provider: CloudStorageProvider): void {
    this.cloudProvider = provider;
  }

  /**
   * Serialize the world state to a JSON-compatible object
   */
  public static serialize(world: World, options: SaveOptions = {}): SerializedWorld {
    const entities = world.getAllEntities();
    const serializedEntities: SerializedEntity[] = [];
    
    for (const entity of entities) {
      const components = world['componentManager'].getEntityComponents(entity.id);
      const serializedComponents: SerializedComponent[] = [];
      
      for (const component of components) {
        try {
          serializedComponents.push({
            type: component.type,
            data: this.serializeComponent(component),
          });
        } catch (error) {
          console.warn(`Failed to serialize component ${component.type} for entity ${entity.id}:`, error);
          // Continue with other components instead of failing completely
        }
      }
      
      serializedEntities.push({
        id: entity.id,
        components: serializedComponents,
      });
    }
    
    const serializedWorld: SerializedWorld = {
      entities: serializedEntities,
      nextEntityId: Entity.getNextId(),
      version: this.SAVE_VERSION,
      timestamp: Date.now(),
    };

    if (options.includeMetadata) {
      serializedWorld.checksum = this.calculateChecksum(serializedWorld);
    }
    
    return serializedWorld;
  }
  
  /**
   * Deserialize a world state from a JSON-compatible object
   */
  public static deserialize(data: SerializedWorld, options: SaveOptions = {}): World {
    // Validate version compatibility
    if (data.version && !this.isVersionCompatible(data.version)) {
      throw new Error(`Incompatible save version: ${data.version}. Current version: ${this.SAVE_VERSION}`);
    }

    // Validate checksum if present and requested
    if (options.validateChecksum && data.checksum) {
      const calculatedChecksum = this.calculateChecksum(data);
      if (calculatedChecksum !== data.checksum) {
        throw new Error('Save data checksum validation failed. Data may be corrupted.');
      }
    }

    const world = new World();
    
    // Reset entity ID counter
    Entity.resetIdCounter();
    
    // Recreate entities with their original IDs
    for (const serializedEntity of data.entities) {
      try {
        // Create entity with the specific ID
        const entity = world.createEntity(serializedEntity.id);
        
        // Add components to this entity
        for (const serializedComponent of serializedEntity.components) {
          try {
            const component = this.deserializeComponent(serializedComponent);
            if (component) {
              const componentType = { name: serializedComponent.type };
              world['componentManager'].addComponent(entity.id, componentType as any, component);
            }
          } catch (error) {
            console.warn(`Failed to deserialize component ${serializedComponent.type} for entity ${entity.id}:`, error);
            // Continue with other components
          }
        }

        // Backward compatibility: Add missing HungerComponent to character entities
        // Requirement 5.4: Initialize default hunger values for old saves
        this.ensureHungerComponent(entity.id, serializedEntity, world);
      } catch (error) {
        console.warn(`Failed to deserialize entity ${serializedEntity.id}:`, error);
        // Continue with other entities
      }
    }
    
    // Set the next entity ID to match the saved state
    Entity.resetIdCounter();
    while (Entity.getNextId() < data.nextEntityId) {
      new Entity();
    }
    
    return world;
  }

  /**
   * Ensure character entities have HungerComponent for backward compatibility
   * Requirement 5.4: Initialize default hunger values for old saves
   */
  private static ensureHungerComponent(entityId: EntityId, serializedEntity: SerializedEntity, world: World): void {
    // Check if this is a character entity (has characterInfo component)
    const hasCharacterInfo = serializedEntity.components.some(c => c.type === 'characterInfo');
    if (!hasCharacterInfo) {
      return; // Not a character entity, skip
    }

    // Check if HungerComponent already exists
    const hasHunger = serializedEntity.components.some(c => c.type === 'hunger');
    if (hasHunger) {
      return; // Already has hunger component, no need to add
    }

    // Add default HungerComponent for backward compatibility
    // Initialize with 0 hunger (hungry state)
    // Requirement 7.1, 7.2, 7.3, 7.4: Validate hunger values
    try {
      const validatedHunger = validateHunger({
        type: 'hunger',
        current: 0,
        maximum: 100
      });
      
      const hungerComponent: any = {
        type: 'hunger',
        current: validatedHunger.current,
        maximum: validatedHunger.maximum
      };
      
      const componentType = { name: 'hunger' };
      world['componentManager'].addComponent(entityId, componentType as any, hungerComponent);
      
      console.log(`Added default HungerComponent to character entity ${entityId} (old save compatibility)`);
    } catch (error) {
      console.warn(`Failed to add HungerComponent to entity ${entityId}:`, error);
    }
  }
  
  /**
   * Serialize a component to a plain object
   */
  private static serializeComponent(component: IComponent): any {
    // Create a plain object copy of the component
    const serialized: any = {};
    
    for (const key in component) {
      if (component.hasOwnProperty(key) && key !== 'type') {
        const value = (component as any)[key];
        
        // Handle different data types
        if (typeof value === 'object' && value !== null) {
          if (value instanceof Map) {
            // Convert Map to array of key-value pairs
            serialized[key] = { __type: 'Map', data: Array.from(value.entries()) };
          } else if (value instanceof Set) {
            // Convert Set to array
            serialized[key] = { __type: 'Set', data: Array.from(value) };
          } else if (Array.isArray(value)) {
            // Arrays are already serializable
            serialized[key] = value;
          } else {
            // Plain objects (including affix data)
            try {
              serialized[key] = { ...value };
            } catch (error) {
              console.warn(`Failed to serialize property ${key}:`, error);
              serialized[key] = null;
            }
          }
        } else {
          // Primitive values
          serialized[key] = value;
        }
      }
    }
    
    return serialized;
  }
  
  /**
   * Deserialize a component from a plain object
   */
  private static deserializeComponent(serialized: SerializedComponent): IComponent | null {
    try {
      // Create a basic component object
      const component: any = {
        type: serialized.type,
      };
      
      // Restore component data
      for (const key in serialized.data) {
        const value = serialized.data[key];
        
        // Handle different data types
        if (typeof value === 'object' && value !== null && value.__type) {
          if (value.__type === 'Map') {
            component[key] = new Map(value.data);
          } else if (value.__type === 'Set') {
            component[key] = new Set(value.data);
          }
        } else if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0]) && value[0].length === 2) {
          // Legacy: Might be a Map serialized as array of key-value pairs
          component[key] = new Map(value);
        } else if (Array.isArray(value)) {
          // Regular array or Set serialized as array
          component[key] = value;
        } else if (typeof value === 'object' && value !== null) {
          // Plain object (including affix data)
          try {
            // Validate affix data if this is an affix field
            if (key === 'affix' && serialized.type === 'equipment') {
              // Validate required affix fields
              if (this.isValidAffixData(value)) {
                component[key] = value;
              } else {
                console.warn('Invalid affix data detected, skipping affix restoration');
                component[key] = undefined;
              }
            } else {
              component[key] = value;
            }
          } catch (error) {
            console.warn(`Failed to deserialize property ${key}:`, error);
            component[key] = undefined;
          }
        } else {
          // Primitive or plain object
          component[key] = value;
        }
      }
      
      // Requirement 7.1, 7.2, 7.3, 7.4: Validate hunger component values after deserialization
      if (serialized.type === 'hunger') {
        const validated = validateHunger(component as HungerComponent);
        component.current = validated.current;
        component.maximum = validated.maximum;
      }
      
      return component as IComponent;
    } catch (error) {
      console.error('Failed to deserialize component:', error);
      return null;
    }
  }

  /**
   * Validate affix data structure
   */
  private static isValidAffixData(affix: any): boolean {
    if (!affix || typeof affix !== 'object') {
      return false;
    }
    
    // Check required fields
    const hasRequiredFields = 
      typeof affix.type === 'string' &&
      typeof affix.rarity === 'number' &&
      typeof affix.displayName === 'string' &&
      typeof affix.value === 'number' &&
      typeof affix.isPercentage === 'boolean';
    
    if (!hasRequiredFields) {
      return false;
    }
    
    // Validate rarity is within valid range (0-3 for Common, Rare, Epic, Legendary)
    if (affix.rarity < 0 || affix.rarity > 3) {
      return false;
    }
    
    // Validate value is a finite number
    if (!isFinite(affix.value)) {
      return false;
    }
    
    return true;
  }

  /**
   * Compress data using simple string compression
   */
  private static compressData(data: string): string {
    // Simple compression using JSON minification and basic string compression
    // In a real implementation, you might use libraries like pako for gzip compression
    try {
      const minified = JSON.stringify(JSON.parse(data));
      return btoa(minified); // Base64 encoding as simple compression
    } catch (error) {
      console.warn('Failed to compress data:', error);
      return data;
    }
  }

  /**
   * Decompress data
   */
  private static decompressData(compressedData: string): string {
    try {
      return atob(compressedData); // Base64 decoding
    } catch (error) {
      console.warn('Failed to decompress data:', error);
      return compressedData;
    }
  }

  /**
   * Calculate checksum for data integrity
   */
  private static calculateChecksum(data: SerializedWorld): string {
    // Simple checksum calculation
    const dataString = JSON.stringify({
      entities: data.entities,
      nextEntityId: data.nextEntityId,
      version: data.version
    });
    
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Check if save version is compatible
   */
  private static isVersionCompatible(version: string): boolean {
    const [major, minor] = version.split('.').map(Number);
    const [currentMajor, currentMinor] = this.SAVE_VERSION.split('.').map(Number);
    
    // Compatible if major version matches and minor version is not newer
    return major === currentMajor && minor <= currentMinor;
  }
  
  /**
   * Save world state to localStorage with backup management
   */
  public static saveToLocalStorage(world: World, key: string = 'gameState', options: SaveOptions = {}): boolean {
    try {
      const serialized = this.serialize(world, { ...options, includeMetadata: true });
      let dataString = JSON.stringify(serialized);
      
      if (options.compress) {
        dataString = this.compressData(dataString);
      }

      // Create backup of existing save
      this.createBackup(key);
      
      // Save new data
      localStorage.setItem(key, dataString);
      localStorage.setItem(`${key}_metadata`, JSON.stringify({
        version: serialized.version,
        timestamp: serialized.timestamp,
        size: dataString.length,
        compressed: options.compress || false,
        checksum: serialized.checksum || ''
      }));
      
      return true;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      return false;
    }
  }
  
  /**
   * Load world state from localStorage with error recovery
   */
  public static loadFromLocalStorage(key: string = 'gameState', options: SaveOptions = {}): World | null {
    try {
      const dataString = localStorage.getItem(key);
      if (!dataString) {
        return null;
      }

      const metadata = this.getMetadata(key);
      let decompressedData = dataString;
      
      if (metadata?.compressed) {
        decompressedData = this.decompressData(dataString);
      }
      
      const serialized = JSON.parse(decompressedData) as SerializedWorld;
      return this.deserialize(serialized, options);
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      
      // Try to recover from backup
      const recoveredWorld = this.recoverFromBackup(key, options);
      if (recoveredWorld) {
        console.log('Successfully recovered from backup');
        return recoveredWorld;
      }
      
      return null;
    }
  }

  /**
   * Save to cloud storage
   */
  public static async saveToCloud(world: World, key: string, options: SaveOptions = {}): Promise<boolean> {
    if (!this.cloudProvider) {
      console.warn('No cloud storage provider configured');
      return false;
    }

    try {
      const serialized = this.serialize(world, { ...options, includeMetadata: true });
      let dataString = JSON.stringify(serialized);
      
      if (options.compress) {
        dataString = this.compressData(dataString);
      }

      const metadata: SaveMetadata = {
        version: serialized.version!,
        timestamp: serialized.timestamp,
        size: dataString.length,
        compressed: options.compress || false,
        checksum: serialized.checksum || ''
      };

      return await this.cloudProvider.save(key, dataString, metadata);
    } catch (error) {
      console.error('Failed to save to cloud:', error);
      return false;
    }
  }

  /**
   * Load from cloud storage
   */
  public static async loadFromCloud(key: string, options: SaveOptions = {}): Promise<World | null> {
    if (!this.cloudProvider) {
      console.warn('No cloud storage provider configured');
      return null;
    }

    try {
      const dataString = await this.cloudProvider.load(key);
      if (!dataString) {
        return null;
      }

      // Try to decompress if it looks like compressed data
      let decompressedData = dataString;
      try {
        // Check if it's base64 encoded (our compression format)
        if (/^[A-Za-z0-9+/]*={0,2}$/.test(dataString)) {
          decompressedData = this.decompressData(dataString);
        }
      } catch {
        // If decompression fails, use original data
        decompressedData = dataString;
      }
      
      const serialized = JSON.parse(decompressedData) as SerializedWorld;
      return this.deserialize(serialized, options);
    } catch (error) {
      console.error('Failed to load from cloud:', error);
      return null;
    }
  }

  /**
   * Create backup of existing save
   */
  private static createBackup(key: string): void {
    try {
      const existingData = localStorage.getItem(key);
      if (existingData) {
        const timestamp = Date.now();
        localStorage.setItem(`${key}_backup_${timestamp}`, existingData);
        
        // Clean up old backups
        this.cleanupOldBackups(key);
      }
    } catch (error) {
      console.warn('Failed to create backup:', error);
    }
  }

  /**
   * Clean up old backup files
   */
  private static cleanupOldBackups(key: string): void {
    try {
      const backupKeys: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.startsWith(`${key}_backup_`)) {
          backupKeys.push(storageKey);
        }
      }
      
      // Sort by timestamp (newest first)
      backupKeys.sort((a, b) => {
        const timestampA = parseInt(a.split('_').pop() || '0');
        const timestampB = parseInt(b.split('_').pop() || '0');
        return timestampB - timestampA;
      });
      
      // Remove old backups beyond the limit
      for (let i = this.MAX_BACKUP_COUNT; i < backupKeys.length; i++) {
        localStorage.removeItem(backupKeys[i]);
      }
    } catch (error) {
      console.warn('Failed to cleanup old backups:', error);
    }
  }

  /**
   * Recover from backup
   */
  private static recoverFromBackup(key: string, options: SaveOptions = {}): World | null {
    try {
      const backupKeys: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.startsWith(`${key}_backup_`)) {
          backupKeys.push(storageKey);
        }
      }
      
      // Sort by timestamp (newest first)
      backupKeys.sort((a, b) => {
        const timestampA = parseInt(a.split('_').pop() || '0');
        const timestampB = parseInt(b.split('_').pop() || '0');
        return timestampB - timestampA;
      });
      
      // Try to load from the most recent backup
      for (const backupKey of backupKeys) {
        try {
          const backupData = localStorage.getItem(backupKey);
          if (backupData) {
            const serialized = JSON.parse(backupData) as SerializedWorld;
            return this.deserialize(serialized, options);
          }
        } catch (error) {
          console.warn(`Failed to recover from backup ${backupKey}:`, error);
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to recover from backup:', error);
      return null;
    }
  }

  /**
   * Get save metadata
   */
  private static getMetadata(key: string): SaveMetadata | null {
    try {
      const metadataString = localStorage.getItem(`${key}_metadata`);
      if (metadataString) {
        return JSON.parse(metadataString) as SaveMetadata;
      }
      return null;
    } catch (error) {
      console.warn('Failed to get metadata:', error);
      return null;
    }
  }

  /**
   * Validate save data integrity
   */
  public static validateSaveData(key: string): boolean {
    try {
      const dataString = localStorage.getItem(key);
      if (!dataString) return false;

      const metadata = this.getMetadata(key);
      if (!metadata) return true; // No metadata means no validation needed

      let decompressedData = dataString;
      if (metadata.compressed) {
        decompressedData = this.decompressData(dataString);
      }

      const serialized = JSON.parse(decompressedData) as SerializedWorld;
      
      if (metadata.checksum) {
        const calculatedChecksum = this.calculateChecksum(serialized);
        return calculatedChecksum === metadata.checksum;
      }

      return true;
    } catch (error) {
      console.error('Failed to validate save data:', error);
      return false;
    }
  }

  /**
   * Get list of available saves
   */
  public static getAvailableSaves(): string[] {
    const saves: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.includes('_backup_') && !key.includes('_metadata')) {
        // Check if it has corresponding metadata or looks like save data
        const metadata = this.getMetadata(key);
        if (metadata || this.looksLikeSaveData(key)) {
          saves.push(key);
        }
      }
    }
    
    return saves;
  }

  /**
   * Check if a key looks like save data
   */
  private static looksLikeSaveData(key: string): boolean {
    try {
      const data = localStorage.getItem(key);
      if (!data) return false;
      
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === 'object' && 
             ('entities' in parsed || 'nextEntityId' in parsed);
    } catch {
      return false;
    }
  }

  /**
   * Delete save data and its backups
   */
  public static deleteSave(key: string): boolean {
    try {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_metadata`);
      
      // Remove all backups
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.startsWith(`${key}_backup_`)) {
          keysToRemove.push(storageKey);
        }
      }
      
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      return true;
    } catch (error) {
      console.error('Failed to delete save:', error);
      return false;
    }
  }
}