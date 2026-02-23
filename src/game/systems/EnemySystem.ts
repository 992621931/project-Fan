/**
 * EnemySystem - Manages enemy spawning, behavior, and data
 */

import { World } from '../../ecs/World';
import { NPCData } from './NPCSystem';
import enemiesData from '../data/enemies.json';

export interface EnemyData extends NPCData {
  weight: number;
  size: number;
  skills: string[];
  drops: string[];
  templateId?: string;
}

export interface EnemyTemplate {
  id: string;
  name: string;
  type: string;
  emoji: string;
  level: number;
  maxHP: number;
  maxMP: number;
  attack: number;
  defense: number;
  moveSpeed: number;
  weight: number;
  size: number;
  skills: string[];
  drops: string[];
}

export class EnemySystem {
  private world: World;
  private enemyTemplates: Map<string, EnemyTemplate> = new Map();
  private spawnedEnemies: Map<string, EnemyData> = new Map();
  private enemyCounter: number = 0;

  constructor(world: World) {
    this.world = world;
    this.loadEnemyTemplates();
  }

  /**
   * Load enemy templates from imported data
   */
  private loadEnemyTemplates(): void {
    try {
      const data = enemiesData as { enemies: EnemyTemplate[] };
      
      data.enemies.forEach((template: EnemyTemplate) => {
        this.enemyTemplates.set(template.id, template);
      });
      
      console.log(`[EnemySystem] Loaded ${this.enemyTemplates.size} enemy templates`);
    } catch (error) {
      console.error('[EnemySystem] Failed to load enemy templates:', error);
    }
  }

  /**
   * Create an enemy instance from a template
   */
  public createEnemy(templateId: string): EnemyData | null {
    const template = this.enemyTemplates.get(templateId);
    if (!template) {
      console.error(`[EnemySystem] Enemy template not found: ${templateId}`);
      return null;
    }

    this.enemyCounter++;
    const enemyId = `enemy_${this.enemyCounter}_${Date.now()}`;

    const enemy: EnemyData = {
      id: enemyId,
      name: template.name,
      title: '',
      emoji: template.emoji,
      type: 'Enemy',
      level: template.level,
      currentHP: template.maxHP,
      maxHP: template.maxHP,
      currentMP: 0, // Enemies start with 0 MP
      maxMP: template.maxMP,
      currentEXP: 0,
      maxEXP: 100,
      attack: template.attack,
      defense: template.defense,
      moveSpeed: template.moveSpeed,
      hpRegen: 0, // Enemies don't regenerate HP by default
      mpRegen: 0, // Enemies don't regenerate MP by default
      job: 'Enemy',
      weight: template.weight,
      size: template.size,
      skills: [...template.skills],
      drops: [...template.drops],
      equipment: [],
      // Primary attributes (default values for enemies)
      strength: 10,
      agility: 10,
      wisdom: 10,
      skill: 10,
      // Secondary attributes
      dodgeRate: 0,
      critRate: 0,
      critDamage: 75,
      resistance: 0,
      magicPower: 0,
      carryWeight: 100,
      accuracy: 100,
      expRate: 100,
      volume: template.size,
      affinity: 0
    };

    this.spawnedEnemies.set(enemyId, enemy);
    enemy.templateId = templateId;
    console.log(`[EnemySystem] Created enemy: ${enemy.name} (${enemyId}) from template ${templateId}`);

    return enemy;
  }

  /**
   * Create a random enemy from available templates
   */
  public createRandomEnemy(): EnemyData | null {
    const templateIds = Array.from(this.enemyTemplates.keys());
    if (templateIds.length === 0) {
      console.error('[EnemySystem] No enemy templates available');
      return null;
    }

    const randomId = templateIds[Math.floor(Math.random() * templateIds.length)];
    return this.createEnemy(randomId);
  }

  /**
   * Get an enemy by ID
   */
  public getEnemy(enemyId: string): EnemyData | undefined {
    return this.spawnedEnemies.get(enemyId);
  }

  /**
   * Get all spawned enemies
   */
  public getAllEnemies(): EnemyData[] {
    return Array.from(this.spawnedEnemies.values());
  }

  /**
   * Remove an enemy (when defeated)
   */
  public removeEnemy(enemyId: string): void {
    const enemy = this.spawnedEnemies.get(enemyId);
    if (enemy) {
      this.spawnedEnemies.delete(enemyId);
      console.log(`[EnemySystem] Removed enemy: ${enemy.name} (${enemyId})`);
    }
  }

  /**
   * Clear all spawned enemies
   */
  public clearAllEnemies(): void {
    this.spawnedEnemies.clear();
    console.log('[EnemySystem] Cleared all enemies');
  }

  /**
   * Get all enemy template IDs
   */
  public getEnemyTemplateIds(): string[] {
    return Array.from(this.enemyTemplates.keys());
  }

  /**
   * Get an enemy template by ID
   */
  public getEnemyTemplate(templateId: string): EnemyTemplate | undefined {
    return this.enemyTemplates.get(templateId);
  }

  /**
   * Get all enemy templates
   */
  public getAllEnemyTemplates(): EnemyTemplate[] {
    return Array.from(this.enemyTemplates.values());
  }

  /**
   * Damage an enemy
   */
  public damageEnemy(enemyId: string, damage: number): boolean {
    const enemy = this.spawnedEnemies.get(enemyId);
    if (!enemy) return false;

    enemy.currentHP = Math.max(0, enemy.currentHP - damage);
    
    // Check if enemy is defeated
    if (enemy.currentHP <= 0) {
      console.log(`[EnemySystem] Enemy defeated: ${enemy.name} (${enemyId})`);
      return true; // Enemy is defeated
    }

    return false; // Enemy is still alive
  }

  /**
   * Heal an enemy
   */
  public healEnemy(enemyId: string, amount: number): void {
    const enemy = this.spawnedEnemies.get(enemyId);
    if (!enemy) return;

    enemy.currentHP = Math.min(enemy.maxHP, enemy.currentHP + amount);
  }
}
