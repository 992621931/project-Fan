/**
 * Configuration data loader
 * Handles loading, validation, and hot-reloading of game configuration files
 */

import { GameConfig, ConfigValidationResult, ConfigValidationError, ConfigValidationWarning } from './ConfigTypes';
import { RarityType } from '../types/RarityTypes';
import { JobType, ItemType, WorkType } from '../types/GameTypes';
import {
  validateExclusiveSkill,
  validateOtherworldCharacter,
  validateSkillReferences,
  validateJobReference,
  ValidationError,
} from './ConfigValidator';

/**
 * Configuration loader class
 */
export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: GameConfig | null = null;
  private configPath: string = '';
  private watchers: Map<string, () => void> = new Map();
  private lastLoadTime: number = 0;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * Load configuration from JSON file or object
   */
  public async loadConfig(source: string | object): Promise<GameConfig> {
    try {
      let configData: any;

      if (typeof source === 'string') {
        // Load from file path
        this.configPath = source;
        configData = await this.loadFromFile(source);
      } else {
        // Load from object
        configData = source;
      }

      // Validate configuration
      const validation = this.validateConfig(configData);
      if (!validation.valid) {
        console.error('[ConfigLoader] Configuration validation failed!');
        console.error('[ConfigLoader] Validation errors:', JSON.stringify(validation.errors, null, 2));
        throw new ConfigLoadError('Configuration validation failed', validation.errors);
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Configuration warnings:', validation.warnings);
      }

      this.config = configData as GameConfig;
      this.lastLoadTime = Date.now();

      // Notify watchers
      this.notifyWatchers();

      return this.config;
    } catch (error) {
      throw new ConfigLoadError(`Failed to load configuration: ${error}`, []);
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): GameConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Check if configuration is loaded
   */
  public isLoaded(): boolean {
    return this.config !== null;
  }

  /**
   * Get last load time
   */
  public getLastLoadTime(): number {
    return this.lastLoadTime;
  }

  /**
   * Add configuration change watcher
   */
  public addWatcher(id: string, callback: () => void): void {
    this.watchers.set(id, callback);
  }

  /**
   * Remove configuration change watcher
   */
  public removeWatcher(id: string): void {
    this.watchers.delete(id);
  }

  /**
   * Reload configuration (hot reload)
   */
  public async reloadConfig(): Promise<GameConfig> {
    if (!this.configPath) {
      throw new Error('Cannot reload: configuration was not loaded from file');
    }
    return this.loadConfig(this.configPath);
  }

  /**
   * Load configuration from file
   */
  private async loadFromFile(filePath: string): Promise<any> {
    try {
      // In a browser environment, we would use fetch
      // In Node.js, we would use fs.readFile
      // For now, we'll simulate file loading
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to load file ${filePath}: ${error}`);
    }
  }

  /**
   * Validate configuration data
   */
  private validateConfig(config: any): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Check required top-level fields
    const requiredFields = ['version', 'characters', 'items', 'recipes', 'dungeons', 'jobs', 'skills'];
    for (const field of requiredFields) {
      if (!config[field]) {
        errors.push({
          type: 'missing_field',
          path: field,
          message: `Required field '${field}' is missing`,
        });
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // Validate version
    if (typeof config.version !== 'string') {
      errors.push({
        type: 'invalid_type',
        path: 'version',
        message: 'Version must be a string',
        value: config.version,
      });
    }

    // Validate arrays
    this.validateArray(config.characters, 'characters', this.validateCharacter.bind(this), errors, warnings);
    this.validateArray(config.items, 'items', this.validateItem.bind(this), errors, warnings);
    this.validateArray(config.recipes, 'recipes', this.validateRecipe.bind(this), errors, warnings);
    this.validateArray(config.dungeons, 'dungeons', this.validateDungeon.bind(this), errors, warnings);
    this.validateArray(config.jobs, 'jobs', this.validateJob.bind(this), errors, warnings);
    this.validateArray(config.skills, 'skills', this.validateSkill.bind(this), errors, warnings);

    // Validate exclusive skills if present
    if (config.exclusiveSkills && Array.isArray(config.exclusiveSkills)) {
      config.exclusiveSkills.forEach((skill: any) => {
        const skillErrors = validateExclusiveSkill(skill);
        errors.push(...this.convertValidationErrors(skillErrors));
      });
    }

    // Validate otherworld characters if present
    if (config.otherworldCharacters && Array.isArray(config.otherworldCharacters)) {
      config.otherworldCharacters.forEach((character: any) => {
        const characterErrors = validateOtherworldCharacter(character);
        errors.push(...this.convertValidationErrors(characterErrors));
      });
    }

    // Check for duplicate IDs
    this.checkDuplicateIds(config.characters, 'characters', errors);
    this.checkDuplicateIds(config.items, 'items', errors);
    this.checkDuplicateIds(config.recipes, 'recipes', errors);
    this.checkDuplicateIds(config.dungeons, 'dungeons', errors);
    this.checkDuplicateIds(config.jobs, 'jobs', errors);
    this.checkDuplicateIds(config.skills, 'skills', errors);
    
    // Check duplicate IDs for new data types
    if (config.exclusiveSkills) {
      this.checkDuplicateIds(config.exclusiveSkills, 'exclusiveSkills', errors);
    }
    if (config.otherworldCharacters) {
      this.checkDuplicateIds(config.otherworldCharacters, 'otherworldCharacters', errors);
    }

    // Validate references
    this.validateReferences(config, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate array field
   */
  private validateArray(
    array: any[],
    fieldName: string,
    validator: (item: any, index: number) => { errors: ConfigValidationError[]; warnings: ConfigValidationWarning[] },
    errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[]
  ): void {
    if (!Array.isArray(array)) {
      errors.push({
        type: 'invalid_type',
        path: fieldName,
        message: `${fieldName} must be an array`,
        value: array,
      });
      return;
    }

    array.forEach((item, index) => {
      const result = validator(item, index);
      errors.push(...result.errors.map(e => ({ ...e, path: `${fieldName}[${index}].${e.path}` })));
      warnings.push(...result.warnings.map(w => ({ ...w, path: `${fieldName}[${index}].${w.path}` })));
    });
  }

  /**
   * Validate character configuration
   */
  private validateCharacter(character: any, index: number): { errors: ConfigValidationError[]; warnings: ConfigValidationWarning[] } {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Required fields
    const requiredFields = ['id', 'name', 'title', 'rarity', 'baseAttributes', 'startingJob'];
    for (const field of requiredFields) {
      if (character[field] === undefined) {
        errors.push({
          type: 'missing_field',
          path: field,
          message: `Required field '${field}' is missing`,
        });
      }
    }

    // Validate rarity
    if (character.rarity !== undefined && !Object.values(RarityType).includes(character.rarity)) {
      errors.push({
        type: 'invalid_value',
        path: 'rarity',
        message: 'Invalid rarity value',
        value: character.rarity,
      });
    }

    // Validate starting job
    if (character.startingJob !== undefined && !Object.values(JobType).includes(character.startingJob)) {
      errors.push({
        type: 'invalid_value',
        path: 'startingJob',
        message: 'Invalid starting job',
        value: character.startingJob,
      });
    }

    // Validate base attributes
    if (character.baseAttributes) {
      const requiredAttributes = ['strength', 'agility', 'wisdom', 'technique'];
      for (const attr of requiredAttributes) {
        if (typeof character.baseAttributes[attr] !== 'number' || character.baseAttributes[attr] < 0) {
          errors.push({
            type: 'invalid_value',
            path: `baseAttributes.${attr}`,
            message: `${attr} must be a non-negative number`,
            value: character.baseAttributes[attr],
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate item configuration
   */
  private validateItem(item: any, index: number): { errors: ConfigValidationError[]; warnings: ConfigValidationWarning[] } {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Required fields
    const requiredFields = ['id', 'name', 'type', 'rarity', 'stackSize', 'baseValue'];
    for (const field of requiredFields) {
      if (item[field] === undefined) {
        errors.push({
          type: 'missing_field',
          path: field,
          message: `Required field '${field}' is missing`,
        });
      }
    }

    // Validate type
    if (item.type !== undefined && !Object.values(ItemType).includes(item.type)) {
      errors.push({
        type: 'invalid_value',
        path: 'type',
        message: 'Invalid item type',
        value: item.type,
      });
    }

    // Validate rarity
    if (item.rarity !== undefined && !Object.values(RarityType).includes(item.rarity)) {
      errors.push({
        type: 'invalid_value',
        path: 'rarity',
        message: 'Invalid rarity value',
        value: item.rarity,
      });
    }

    // Validate numeric fields
    if (typeof item.stackSize !== 'number' || item.stackSize <= 0) {
      errors.push({
        type: 'invalid_value',
        path: 'stackSize',
        message: 'Stack size must be a positive number',
        value: item.stackSize,
      });
    }

    if (typeof item.baseValue !== 'number' || item.baseValue < 0) {
      errors.push({
        type: 'invalid_value',
        path: 'baseValue',
        message: 'Base value must be a non-negative number',
        value: item.baseValue,
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate recipe configuration
   */
  private validateRecipe(recipe: any, index: number): { errors: ConfigValidationError[]; warnings: ConfigValidationWarning[] } {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Required fields
    const requiredFields = ['id', 'name', 'type', 'materials', 'result'];
    for (const field of requiredFields) {
      if (recipe[field] === undefined) {
        errors.push({
          type: 'missing_field',
          path: field,
          message: `Required field '${field}' is missing`,
        });
      }
    }

    // Validate materials array
    if (Array.isArray(recipe.materials)) {
      recipe.materials.forEach((material: any, matIndex: number) => {
        if (!material.itemId || typeof material.quantity !== 'number') {
          errors.push({
            type: 'invalid_value',
            path: `materials[${matIndex}]`,
            message: 'Material must have itemId and quantity',
            value: material,
          });
        }
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate dungeon configuration
   */
  private validateDungeon(dungeon: any, index: number): { errors: ConfigValidationError[]; warnings: ConfigValidationWarning[] } {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Required fields
    const requiredFields = ['id', 'name', 'difficulty', 'encounters'];
    for (const field of requiredFields) {
      if (dungeon[field] === undefined) {
        errors.push({
          type: 'missing_field',
          path: field,
          message: `Required field '${field}' is missing`,
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate job configuration
   */
  private validateJob(job: any, index: number): { errors: ConfigValidationError[]; warnings: ConfigValidationWarning[] } {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Required fields
    const requiredFields = ['id', 'name', 'attributeGrowth'];
    for (const field of requiredFields) {
      if (job[field] === undefined) {
        errors.push({
          type: 'missing_field',
          path: field,
          message: `Required field '${field}' is missing`,
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate skill configuration
   */
  private validateSkill(skill: any, index: number): { errors: ConfigValidationError[]; warnings: ConfigValidationWarning[] } {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Required fields
    const requiredFields = ['id', 'name', 'type'];
    for (const field of requiredFields) {
      if (skill[field] === undefined) {
        errors.push({
          type: 'missing_field',
          path: field,
          message: `Required field '${field}' is missing`,
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Check for duplicate IDs in array
   */
  private checkDuplicateIds(array: any[], fieldName: string, errors: ConfigValidationError[]): void {
    const ids = new Set<string>();
    array.forEach((item, index) => {
      if (item.id) {
        if (ids.has(item.id)) {
          errors.push({
            type: 'duplicate_id',
            path: `${fieldName}[${index}].id`,
            message: `Duplicate ID '${item.id}' found`,
            value: item.id,
          });
        } else {
          ids.add(item.id);
        }
      }
    });
  }

  /**
   * Validate references between configuration objects
   */
  private validateReferences(config: any, errors: ConfigValidationError[], warnings: ConfigValidationWarning[]): void {
    // Create ID sets for reference validation
    const itemIds = new Set(config.items?.map((item: any) => item.id) || []);
    const skillIds = new Set(config.skills?.map((skill: any) => skill.id) || []);
    const jobIds = new Set(config.jobs?.map((job: any) => job.id) || []);

    // Add exclusive skills to skill IDs
    if (config.exclusiveSkills) {
      config.exclusiveSkills.forEach((skill: any) => {
        if (skill.id) skillIds.add(skill.id);
      });
    }

    // Validate recipe material references
    config.recipes?.forEach((recipe: any, recipeIndex: number) => {
      recipe.materials?.forEach((material: any, matIndex: number) => {
        if (material.itemId && !itemIds.has(material.itemId)) {
          errors.push({
            type: 'missing_reference',
            path: `recipes[${recipeIndex}].materials[${matIndex}].itemId`,
            message: `Referenced item '${material.itemId}' not found`,
            value: material.itemId,
          });
        }
      });

      if (recipe.result?.itemId && !itemIds.has(recipe.result.itemId)) {
        errors.push({
          type: 'missing_reference',
          path: `recipes[${recipeIndex}].result.itemId`,
          message: `Referenced item '${recipe.result.itemId}' not found`,
          value: recipe.result.itemId,
        });
      }
    });

    // Validate character job references
    config.characters?.forEach((character: any, charIndex: number) => {
      if (character.startingJob && !jobIds.has(character.startingJob)) {
        errors.push({
          type: 'missing_reference',
          path: `characters[${charIndex}].startingJob`,
          message: `Referenced job '${character.startingJob}' not found`,
          value: character.startingJob,
        });
      }
    });

    // Validate otherworld character references
    if (config.otherworldCharacters) {
      // Collect all skills (regular + exclusive)
      const allSkills = [...(config.skills || []), ...(config.exclusiveSkills || [])];
      const allJobs = config.jobs || [];

      config.otherworldCharacters.forEach((character: any) => {
        // Validate skill references
        const skillRefErrors = validateSkillReferences(character, allSkills);
        errors.push(...this.convertValidationErrors(skillRefErrors));

        // Validate job reference
        const jobRefErrors = validateJobReference(character, allJobs);
        errors.push(...this.convertValidationErrors(jobRefErrors));
      });
    }
  }

  /**
   * Notify all watchers of configuration changes
   */
  private notifyWatchers(): void {
    this.watchers.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Error in config watcher callback:', error);
      }
    });
  }

  /**
   * Convert ValidationError to ConfigValidationError
   */
  private convertValidationErrors(validationErrors: ValidationError[]): ConfigValidationError[] {
    return validationErrors.map(error => ({
      type: error.type as ConfigValidationError['type'],
      path: error.path,
      message: error.message,
      value: error.actual,
    }));
  }
}

/**
 * Configuration loading error
 */
export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly validationErrors: ConfigValidationError[]
  ) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

/**
 * Default configuration for development/testing
 */
export const DEFAULT_CONFIG: GameConfig = {
  version: '1.0.0',
  characters: [],
  items: [],
  recipes: [],
  dungeons: [],
  jobs: [],
  skills: [],
  achievements: [],
  shops: [],
  crops: [],
  exclusiveSkills: [],
  otherworldCharacters: [],
};