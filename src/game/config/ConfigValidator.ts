/**
 * Configuration validator
 * Provides validation functions for game configuration data
 */

import {
  ExclusiveSkillConfig,
  OtherworldCharacterConfig,
  ProjectileConfig,
  DamageFormulaConfig,
  InitialStateConfig,
  SkillConfig,
  JobConfig,
} from './ConfigTypes';

/**
 * Validation error
 */
export interface ValidationError {
  type: 'missing_field' | 'invalid_value' | 'missing_reference' | 'invalid_type';
  path: string;
  message: string;
  expected?: any;
  actual?: any;
}

/**
 * Validate exclusive skill configuration
 */
export function validateExclusiveSkill(skill: any): ValidationError[] {
  const errors: ValidationError[] = [];
  const basePath = `exclusiveSkills[${skill?.id || 'unknown'}]`;

  // Validate required fields
  if (!skill.id) {
    errors.push({
      type: 'missing_field',
      path: `${basePath}.id`,
      message: 'Missing required field: id',
    });
  }

  if (!skill.name) {
    errors.push({
      type: 'missing_field',
      path: `${basePath}.name`,
      message: 'Missing required field: name',
    });
  }

  if (skill.type !== 'exclusive') {
    errors.push({
      type: 'invalid_value',
      path: `${basePath}.type`,
      message: 'Type must be "exclusive"',
      expected: 'exclusive',
      actual: skill.type,
    });
  }

  if (!skill.icon) {
    errors.push({
      type: 'missing_field',
      path: `${basePath}.icon`,
      message: 'Missing required field: icon',
    });
  }

  if (!skill.tags || !Array.isArray(skill.tags)) {
    errors.push({
      type: 'missing_field',
      path: `${basePath}.tags`,
      message: 'Missing required field: tags (must be an array)',
    });
  }

  if (!skill.description) {
    errors.push({
      type: 'missing_field',
      path: `${basePath}.description`,
      message: 'Missing required field: description',
    });
  }

  // Validate optional projectile config
  if (skill.projectile) {
    errors.push(...validateProjectileConfig(skill.projectile, `${basePath}.projectile`));
  }

  // Validate optional damage formula
  if (skill.damageFormula) {
    errors.push(...validateDamageFormula(skill.damageFormula, `${basePath}.damageFormula`));
  }

  return errors;
}

/**
 * Validate projectile configuration
 */
export function validateProjectileConfig(projectile: any, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!projectile.image) {
    errors.push({
      type: 'missing_field',
      path: `${path}.image`,
      message: 'Missing required field: image',
    });
  }

  if (typeof projectile.speed !== 'number' || projectile.speed <= 0) {
    errors.push({
      type: 'invalid_value',
      path: `${path}.speed`,
      message: 'Speed must be greater than 0',
      expected: '> 0',
      actual: projectile.speed,
    });
  }

  if (typeof projectile.lifetime !== 'number' || projectile.lifetime <= 0) {
    errors.push({
      type: 'invalid_value',
      path: `${path}.lifetime`,
      message: 'Lifetime must be greater than 0',
      expected: '> 0',
      actual: projectile.lifetime,
    });
  }

  if (!projectile.directions || !Array.isArray(projectile.directions)) {
    errors.push({
      type: 'missing_field',
      path: `${path}.directions`,
      message: 'Missing required field: directions (must be an array)',
    });
  }

  if (typeof projectile.rotateWithDirection !== 'boolean') {
    errors.push({
      type: 'missing_field',
      path: `${path}.rotateWithDirection`,
      message: 'Missing required field: rotateWithDirection (must be a boolean)',
    });
  }

  if (!projectile.collisionBehavior) {
    errors.push({
      type: 'missing_field',
      path: `${path}.collisionBehavior`,
      message: 'Missing required field: collisionBehavior',
    });
  }

  return errors;
}

/**
 * Validate damage formula configuration
 */
export function validateDamageFormula(formula: any, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof formula.baseDamage !== 'number' || formula.baseDamage < 0) {
    errors.push({
      type: 'invalid_value',
      path: `${path}.baseDamage`,
      message: 'Base damage must be greater than or equal to 0',
      expected: '>= 0',
      actual: formula.baseDamage,
    });
  }

  if (typeof formula.attackScaling !== 'number' || formula.attackScaling <= 0) {
    errors.push({
      type: 'invalid_value',
      path: `${path}.attackScaling`,
      message: 'Attack scaling must be greater than 0',
      expected: '> 0',
      actual: formula.attackScaling,
    });
  }

  if (!formula.attributeType) {
    errors.push({
      type: 'missing_field',
      path: `${path}.attributeType`,
      message: 'Missing required field: attributeType',
    });
  }

  return errors;
}

/**
 * Validate otherworld character configuration
 */
export function validateOtherworldCharacter(character: any): ValidationError[] {
  const errors: ValidationError[] = [];
  const basePath = `otherworldCharacters[${character?.id || 'unknown'}]`;

  // Validate required fields
  if (!character.id) {
    errors.push({
      type: 'missing_field',
      path: `${basePath}.id`,
      message: 'Missing required field: id',
    });
  }

  if (!character.name) {
    errors.push({
      type: 'missing_field',
      path: `${basePath}.name`,
      message: 'Missing required field: name',
    });
  }

  if (!character.characterTypes || !Array.isArray(character.characterTypes)) {
    errors.push({
      type: 'missing_field',
      path: `${basePath}.characterTypes`,
      message: 'Missing required field: characterTypes (must be an array)',
    });
  }

  if (!character.portrait) {
    errors.push({
      type: 'missing_field',
      path: `${basePath}.portrait`,
      message: 'Missing required field: portrait',
    });
  }

  if (!character.initialState) {
    errors.push({
      type: 'missing_field',
      path: `${basePath}.initialState`,
      message: 'Missing required field: initialState',
    });
  } else {
    errors.push(...validateInitialState(character.initialState, `${basePath}.initialState`));
  }

  if (!character.baseAttributes) {
    errors.push({
      type: 'missing_field',
      path: `${basePath}.baseAttributes`,
      message: 'Missing required field: baseAttributes',
    });
  } else {
    // Validate base attributes
    const attrs = character.baseAttributes;
    if (typeof attrs.strength !== 'number' || attrs.strength < 0) {
      errors.push({
        type: 'invalid_value',
        path: `${basePath}.baseAttributes.strength`,
        message: 'Strength must be greater than or equal to 0',
        expected: '>= 0',
        actual: attrs.strength,
      });
    }
    if (typeof attrs.agility !== 'number' || attrs.agility < 0) {
      errors.push({
        type: 'invalid_value',
        path: `${basePath}.baseAttributes.agility`,
        message: 'Agility must be greater than or equal to 0',
        expected: '>= 0',
        actual: attrs.agility,
      });
    }
    if (typeof attrs.wisdom !== 'number' || attrs.wisdom < 0) {
      errors.push({
        type: 'invalid_value',
        path: `${basePath}.baseAttributes.wisdom`,
        message: 'Wisdom must be greater than or equal to 0',
        expected: '>= 0',
        actual: attrs.wisdom,
      });
    }
    if (typeof attrs.technique !== 'number' || attrs.technique < 0) {
      errors.push({
        type: 'invalid_value',
        path: `${basePath}.baseAttributes.technique`,
        message: 'Technique must be greater than or equal to 0',
        expected: '>= 0',
        actual: attrs.technique,
      });
    }
  }

  if (!character.startingJob) {
    errors.push({
      type: 'missing_field',
      path: `${basePath}.startingJob`,
      message: 'Missing required field: startingJob',
    });
  }

  if (!character.initialSkills) {
    errors.push({
      type: 'missing_field',
      path: `${basePath}.initialSkills`,
      message: 'Missing required field: initialSkills',
    });
  } else {
    if (!Array.isArray(character.initialSkills.passive)) {
      errors.push({
        type: 'missing_field',
        path: `${basePath}.initialSkills.passive`,
        message: 'Missing required field: passive (must be an array)',
      });
    }
    if (!Array.isArray(character.initialSkills.active)) {
      errors.push({
        type: 'missing_field',
        path: `${basePath}.initialSkills.active`,
        message: 'Missing required field: active (must be an array)',
      });
    }
  }

  return errors;
}

/**
 * Validate initial state configuration
 */
export function validateInitialState(state: any, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof state.level !== 'number' || state.level <= 0) {
    errors.push({
      type: 'invalid_value',
      path: `${path}.level`,
      message: 'Level must be greater than 0',
      expected: '> 0',
      actual: state.level,
    });
  }

  if (typeof state.maxHealth !== 'number' || state.maxHealth <= 0) {
    errors.push({
      type: 'invalid_value',
      path: `${path}.maxHealth`,
      message: 'Max health must be greater than 0',
      expected: '> 0',
      actual: state.maxHealth,
    });
  }

  if (typeof state.maxMana !== 'number' || state.maxMana <= 0) {
    errors.push({
      type: 'invalid_value',
      path: `${path}.maxMana`,
      message: 'Max mana must be greater than 0',
      expected: '> 0',
      actual: state.maxMana,
    });
  }

  if (typeof state.maxHunger !== 'number' || state.maxHunger <= 0) {
    errors.push({
      type: 'invalid_value',
      path: `${path}.maxHunger`,
      message: 'Max hunger must be greater than 0',
      expected: '> 0',
      actual: state.maxHunger,
    });
  }

  return errors;
}

/**
 * Validate skill references in character configuration
 */
export function validateSkillReferences(
  character: OtherworldCharacterConfig,
  allSkills: SkillConfig[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const basePath = `otherworldCharacters[${character.id}]`;
  const skillIds = new Set(allSkills.map(skill => skill.id));

  // Validate passive skill references
  if (character.initialSkills.passive) {
    character.initialSkills.passive.forEach((skillId, index) => {
      if (!skillIds.has(skillId)) {
        errors.push({
          type: 'missing_reference',
          path: `${basePath}.initialSkills.passive[${index}]`,
          message: `Referenced skill "${skillId}" does not exist in skill configuration`,
          expected: 'valid skill ID',
          actual: skillId,
        });
      }
    });
  }

  // Validate active skill references
  if (character.initialSkills.active) {
    character.initialSkills.active.forEach((skillId, index) => {
      if (!skillIds.has(skillId)) {
        errors.push({
          type: 'missing_reference',
          path: `${basePath}.initialSkills.active[${index}]`,
          message: `Referenced skill "${skillId}" does not exist in skill configuration`,
          expected: 'valid skill ID',
          actual: skillId,
        });
      }
    });
  }

  return errors;
}

/**
 * Validate job reference in character configuration
 */
export function validateJobReference(
  character: OtherworldCharacterConfig,
  allJobs: JobConfig[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const basePath = `otherworldCharacters[${character.id}]`;
  const jobIds = new Set(allJobs.map(job => job.id));

  if (character.startingJob && character.startingJob !== 'none' && !jobIds.has(character.startingJob)) {
    errors.push({
      type: 'missing_reference',
      path: `${basePath}.startingJob`,
      message: `Referenced job "${character.startingJob}" does not exist in job configuration`,
      expected: 'valid job ID',
      actual: character.startingJob,
    });
  }

  return errors;
}
