/**
 * Party System - Manages party formation, validation, and exploration
 * Handles party creation, member management, and exploration state
 */

import { System } from '../../ecs/System';
import { EntityId } from '../../ecs/Entity';
import { ComponentType } from '../../ecs/Component';
import { 
  PartyComponent, 
  PartyComponentType, 
  PartyMemberComponent, 
  PartyMemberComponentType,
  ExplorationComponent,
  ExplorationComponentType,
  ExplorationStatus
} from '../components/PartyComponents';
import { 
  CharacterInfoComponent, 
  CharacterInfoComponentType,
  HealthComponent,
  HealthComponentType,
  LevelComponent,
  LevelComponentType
} from '../components/CharacterComponents';
import { FormationType, CharacterStatus } from '../types/GameTypes';

/**
 * Party validation result
 */
export interface PartyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Party creation options
 */
export interface PartyCreationOptions {
  members: EntityId[];
  leader?: EntityId;
  formation?: FormationType;
  maxSize?: number;
}

/**
 * Party System implementation
 */
export class PartySystem extends System {
  public readonly name = 'PartySystem';
  public readonly requiredComponents: ComponentType<any>[] = [PartyComponentType];

  private readonly DEFAULT_MAX_PARTY_SIZE = 4;
  private readonly MIN_PARTY_SIZE = 1;

  protected onInitialize(): void {
    // Listen for character status changes
    this.eventSystem.subscribe('character_status_changed', this.handleCharacterStatusChange.bind(this));
    this.eventSystem.subscribe('character_health_changed', this.handleCharacterHealthChange.bind(this));
  }

  public update(deltaTime: number): void {
    const parties = this.getEntities();
    
    for (const partyId of parties) {
      this.updatePartyStatus(partyId);
    }
  }

  /**
   * Create a new party with the specified members
   */
  public createParty(options: PartyCreationOptions): EntityId | null {
    const validation = this.validatePartyComposition(options.members);
    if (!validation.isValid) {
      console.warn('Party creation failed:', validation.errors);
      return null;
    }

    // Create party entity
    const partyId = this.entityManager.createEntity();
    
    // Determine leader
    const leader = options.leader && options.members.includes(options.leader) 
      ? options.leader 
      : options.members[0];

    // Create party component
    const partyComponent: PartyComponent = {
      type: 'party',
      members: [...options.members],
      leader,
      formation: options.formation || FormationType.Balanced,
      maxSize: options.maxSize || this.DEFAULT_MAX_PARTY_SIZE,
      isActive: false
    };

    this.componentManager.addComponent(partyId, PartyComponentType, partyComponent);

    // Add party member components to characters
    options.members.forEach((memberId, index) => {
      const memberComponent: PartyMemberComponent = {
        type: 'partyMember',
        partyId,
        position: index,
        isLeader: memberId === leader
      };
      
      this.componentManager.addComponent(memberId, PartyMemberComponentType, memberComponent);
      
      // Update character status
      this.updateCharacterStatus(memberId, CharacterStatus.Available);
    });

    this.eventSystem.emit('party_created', { partyId, members: options.members, leader });
    return partyId;
  }

  /**
   * Disband a party
   */
  public disbandParty(partyId: EntityId): boolean {
    const party = this.getComponent(partyId, PartyComponentType);
    if (!party) {
      return false;
    }

    // Remove party member components from characters
    for (const memberId of party.members) {
      this.componentManager.removeComponent(memberId, PartyMemberComponentType);
      this.updateCharacterStatus(memberId, CharacterStatus.Available);
    }

    // Remove party entity
    this.entityManager.destroyEntity(partyId);
    
    this.eventSystem.emit('party_disbanded', { partyId, members: party.members });
    return true;
  }

  /**
   * Add a member to an existing party
   */
  public addMember(partyId: EntityId, memberId: EntityId): boolean {
    const party = this.getComponent(partyId, PartyComponentType);
    if (!party) {
      return false;
    }

    // Check if party is full
    if (party.members.length >= party.maxSize) {
      return false;
    }

    // Check if character is already in this party
    if (party.members.includes(memberId)) {
      return false;
    }

    // Check if character is already in a different party
    const existingPartyMember = this.getComponent(memberId, PartyMemberComponentType);
    if (existingPartyMember && existingPartyMember.partyId !== partyId) {
      return false;
    }

    // Validate the new member individually (not the whole composition)
    const memberValidation = this.validateSingleMember(memberId);
    if (!memberValidation.isValid) {
      return false;
    }

    // Add member to party
    party.members.push(memberId);
    
    // Create party member component
    const memberComponent: PartyMemberComponent = {
      type: 'partyMember',
      partyId,
      position: party.members.length - 1,
      isLeader: false
    };
    
    this.componentManager.addComponent(memberId, PartyMemberComponentType, memberComponent);
    this.updateCharacterStatus(memberId, CharacterStatus.Available);

    this.eventSystem.emit('party_member_added', { partyId, memberId });
    return true;
  }

  /**
   * Remove a member from a party
   */
  public removeMember(partyId: EntityId, memberId: EntityId): boolean {
    const party = this.getComponent(partyId, PartyComponentType);
    if (!party) {
      return false;
    }

    const memberIndex = party.members.indexOf(memberId);
    if (memberIndex === -1) {
      return false;
    }

    // Remove member from party
    party.members.splice(memberIndex, 1);
    
    // Remove party member component
    this.componentManager.removeComponent(memberId, PartyMemberComponentType);
    this.updateCharacterStatus(memberId, CharacterStatus.Available);

    // If this was the leader, assign a new leader
    if (party.leader === memberId && party.members.length > 0) {
      party.leader = party.members[0];
      
      // Update leader status
      const newLeaderMember = this.getComponent(party.members[0], PartyMemberComponentType);
      if (newLeaderMember) {
        newLeaderMember.isLeader = true;
      }
    }

    // Update positions of remaining members
    party.members.forEach((id, index) => {
      const memberComponent = this.getComponent(id, PartyMemberComponentType);
      if (memberComponent) {
        memberComponent.position = index;
      }
    });

    // If party is now empty, disband it
    if (party.members.length === 0) {
      this.disbandParty(partyId);
    }

    this.eventSystem.emit('party_member_removed', { partyId, memberId });
    return true;
  }

  /**
   * Change party formation
   */
  public changeFormation(partyId: EntityId, formation: FormationType): boolean {
    const party = this.getComponent(partyId, PartyComponentType);
    if (!party) {
      return false;
    }

    party.formation = formation;
    this.eventSystem.emit('party_formation_changed', { partyId, formation });
    return true;
  }

  /**
   * Set party leader
   */
  public setLeader(partyId: EntityId, leaderId: EntityId): boolean {
    const party = this.getComponent(partyId, PartyComponentType);
    if (!party || !party.members.includes(leaderId)) {
      return false;
    }

    // Update old leader
    if (party.leader) {
      const oldLeaderMember = this.getComponent(party.leader, PartyMemberComponentType);
      if (oldLeaderMember) {
        oldLeaderMember.isLeader = false;
      }
    }

    // Update new leader
    party.leader = leaderId;
    const newLeaderMember = this.getComponent(leaderId, PartyMemberComponentType);
    if (newLeaderMember) {
      newLeaderMember.isLeader = true;
    }

    this.eventSystem.emit('party_leader_changed', { partyId, leaderId });
    return true;
  }

  /**
   * Validate party composition
   */
  public validatePartyComposition(members: EntityId[]): PartyValidationResult {
    const result: PartyValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check party size
    if (members.length < this.MIN_PARTY_SIZE) {
      result.isValid = false;
      result.errors.push(`Party must have at least ${this.MIN_PARTY_SIZE} member(s)`);
    }

    if (members.length > this.DEFAULT_MAX_PARTY_SIZE) {
      result.isValid = false;
      result.errors.push(`Party cannot have more than ${this.DEFAULT_MAX_PARTY_SIZE} members`);
    }

    // Check for duplicate members
    const uniqueMembers = new Set(members);
    if (uniqueMembers.size !== members.length) {
      result.isValid = false;
      result.errors.push('Party cannot have duplicate members');
    }

    // Check member availability and status
    for (const memberId of members) {
      const memberValidation = this.validateSingleMember(memberId);
      if (!memberValidation.isValid) {
        result.isValid = false;
        result.errors.push(...memberValidation.errors);
      }

      // Check if already in another party (for party creation, not member addition)
      const existingPartyMember = this.getComponent(memberId, PartyMemberComponentType);
      if (existingPartyMember) {
        const characterInfo = this.getComponent(memberId, CharacterInfoComponentType);
        result.isValid = false;
        result.errors.push(`Character ${characterInfo?.name || memberId} is already in another party`);
      }
    }

    // Add warnings for party composition
    if (members.length === 1) {
      result.warnings.push('Single-member parties are more vulnerable in combat');
    }

    return result;
  }

  /**
   * Validate a single member for party eligibility (without checking party membership)
   */
  private validateSingleMember(memberId: EntityId): PartyValidationResult {
    const result: PartyValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const characterInfo = this.getComponent(memberId, CharacterInfoComponentType);
    if (!characterInfo) {
      result.isValid = false;
      result.errors.push(`Character ${memberId} not found`);
      return result;
    }

    // Check if character is available
    if (characterInfo.status === CharacterStatus.Injured) {
      result.isValid = false;
      result.errors.push(`Character ${characterInfo.name} is injured and cannot join party`);
    } else if (characterInfo.status === CharacterStatus.Working) {
      result.isValid = false;
      result.errors.push(`Character ${characterInfo.name} is working and cannot join party`);
    } else if (characterInfo.status === CharacterStatus.Exploring) {
      result.isValid = false;
      result.errors.push(`Character ${characterInfo.name} is already exploring`);
    }

    // Check health
    const health = this.getComponent(memberId, HealthComponentType);
    if (health && health.current <= 0) {
      result.isValid = false;
      result.errors.push(`Character ${characterInfo.name} has no health and cannot join party`);
    }

    return result;
  }

  /**
   * Get party information
   */
  public getPartyInfo(partyId: EntityId): PartyComponent | null {
    return this.getComponent(partyId, PartyComponentType);
  }

  /**
   * Get all parties
   */
  public getAllParties(): EntityId[] {
    return this.getEntities();
  }

  /**
   * Find party by member
   */
  public findPartyByMember(memberId: EntityId): EntityId | null {
    const memberComponent = this.getComponent(memberId, PartyMemberComponentType);
    return memberComponent ? memberComponent.partyId : null;
  }

  /**
   * Update party status based on member conditions
   */
  private updatePartyStatus(partyId: EntityId): void {
    const party = this.getComponent(partyId, PartyComponentType);
    if (!party) return;

    // Check if any members are injured or unavailable
    let hasInjuredMembers = false;
    let allMembersAvailable = true;

    for (const memberId of party.members) {
      const characterInfo = this.getComponent(memberId, CharacterInfoComponentType);
      const health = this.getComponent(memberId, HealthComponentType);

      if (!characterInfo || !health) continue;

      if (health.current <= 0 || characterInfo.status === CharacterStatus.Injured) {
        hasInjuredMembers = true;
      }

      if (characterInfo.status !== CharacterStatus.Available && 
          characterInfo.status !== CharacterStatus.Exploring) {
        allMembersAvailable = false;
      }
    }

    // Update party active status
    if (hasInjuredMembers || !allMembersAvailable) {
      if (party.isActive) {
        party.isActive = false;
        this.eventSystem.emit('party_deactivated', { partyId, reason: 'member_unavailable' });
      }
    }
  }

  /**
   * Handle character status changes
   */
  private handleCharacterStatusChange(event: any): void {
    const { characterId, newStatus } = event;
    const partyId = this.findPartyByMember(characterId);
    
    if (partyId) {
      this.updatePartyStatus(partyId);
    }
  }

  /**
   * Handle character health changes
   */
  private handleCharacterHealthChange(event: any): void {
    const { characterId, newHealth } = event;
    const partyId = this.findPartyByMember(characterId);
    
    if (partyId) {
      this.updatePartyStatus(partyId);
      
      // If character health drops to 0, mark as injured
      if (newHealth <= 0) {
        this.updateCharacterStatus(characterId, CharacterStatus.Injured);
      }
    }
  }

  /**
   * Update character status
   */
  private updateCharacterStatus(characterId: EntityId, status: CharacterStatus): void {
    const characterInfo = this.getComponent(characterId, CharacterInfoComponentType);
    if (characterInfo) {
      const oldStatus = characterInfo.status;
      characterInfo.status = status;
      this.eventSystem.emit('character_status_changed', { 
        characterId, 
        oldStatus, 
        newStatus: status 
      });
    }
  }
}