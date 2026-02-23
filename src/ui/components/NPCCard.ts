/**
 * NPC Card Component - Displays NPC information in a simplified format
 */

import { NPCData } from '../../game/systems/NPCSystem';

export class NPCCard {
  private container: HTMLDivElement;
  private npcData: NPCData;
  private onClickCallback?: (npcData: NPCData) => void;
  private avatarContainer: HTMLDivElement | null = null;
  private redDot: HTMLSpanElement | null = null;

  constructor(npcData: NPCData, onClickCallback?: (npcData: NPCData) => void) {
    this.npcData = npcData;
    this.onClickCallback = onClickCallback;
    this.container = this.createCard();
  }

  private createCard(): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'npc-card';
    card.style.cssText = `
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      transition: all 0.3s ease;
      text-align: center;
      gap: 8px;
    `;

    // Avatar wrapper (for positioning red dot outside of avatar)
    const avatarWrapper = document.createElement('div');
    avatarWrapper.style.cssText = `
      position: relative;
      width: 75px;
      height: 75px;
    `;

    // Avatar container (75px = 100px * 0.75)
    const avatarContainer = document.createElement('div');
    avatarContainer.style.cssText = `
      width: 75px;
      height: 75px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 37.5px;
      border: 2px solid white;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.2);
      transition: transform 0.3s ease;
      overflow: hidden;
    `;
    this.avatarContainer = avatarWrapper; // Store wrapper instead for red dot positioning
    
    // Check if emoji is an image path or actual emoji
    if (this.npcData.emoji.includes('.png') || this.npcData.emoji.includes('.jpg')) {
      // Use image
      const avatarImg = document.createElement('img');
      avatarImg.src = this.npcData.emoji;
      avatarImg.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;
      avatarContainer.appendChild(avatarImg);
    } else {
      // Use emoji text
      avatarContainer.textContent = this.npcData.emoji;
    }

    avatarWrapper.appendChild(avatarContainer);

    // Name (with title if available)
    const name = document.createElement('div');
    name.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      color: #fff;
      text-shadow: 
        -0.5px -0.5px 0 #000,
        0.5px -0.5px 0 #000,
        -0.5px 0.5px 0 #000,
        0.5px 0.5px 0 #000;
    `;
    name.textContent = this.npcData.title ? `${this.npcData.title}${this.npcData.name}` : this.npcData.name;

    // Assemble card
    card.appendChild(avatarWrapper);
    card.appendChild(name);

    // Hover effect
    card.addEventListener('mouseenter', () => {
      avatarContainer.style.transform = 'scale(1.1)';
    });

    card.addEventListener('mouseleave', () => {
      avatarContainer.style.transform = 'scale(1)';
    });

    // Click to show details in action panel
    card.addEventListener('click', () => {
      if (this.onClickCallback) {
        this.onClickCallback(this.npcData);
      }
    });

    return card;
  }

  public getElement(): HTMLDivElement {
    return this.container;
  }

  public updateData(npcData: NPCData): void {
    this.npcData = npcData;
    
    // Update the card content without replacing the container element
    // This preserves any positioning styles applied to the container
    
    // Clear existing content
    this.container.innerHTML = '';
    
    // Recreate the card content
    // Avatar wrapper (for positioning red dot outside of avatar)
    const avatarWrapper = document.createElement('div');
    avatarWrapper.style.cssText = `
      position: relative;
      width: 75px;
      height: 75px;
    `;

    // Avatar container (75px = 100px * 0.75)
    const avatarContainer = document.createElement('div');
    avatarContainer.style.cssText = `
      width: 75px;
      height: 75px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 37.5px;
      border: 2px solid white;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.2);
      transition: transform 0.3s ease;
      overflow: hidden;
    `;
    this.avatarContainer = avatarWrapper; // Store wrapper instead for red dot positioning
    
    // Check if emoji is an image path or actual emoji
    if (this.npcData.emoji.includes('.png') || this.npcData.emoji.includes('.jpg')) {
      // Use image
      const avatarImg = document.createElement('img');
      avatarImg.src = this.npcData.emoji;
      avatarImg.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;
      avatarContainer.appendChild(avatarImg);
    } else {
      // Use emoji text
      avatarContainer.textContent = this.npcData.emoji;
    }

    avatarWrapper.appendChild(avatarContainer);

    // Name (with title if available)
    const name = document.createElement('div');
    name.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      color: #fff;
      text-shadow: 
        -0.5px -0.5px 0 #000,
        0.5px -0.5px 0 #000,
        -0.5px 0.5px 0 #000,
        0.5px 0.5px 0 #000;
    `;
    name.textContent = this.npcData.title ? `${this.npcData.title}${this.npcData.name}` : this.npcData.name;

    // Assemble card
    this.container.appendChild(avatarWrapper);
    this.container.appendChild(name);

    // Hover effect
    this.container.addEventListener('mouseenter', () => {
      avatarContainer.style.transform = 'scale(1.1)';
    });

    this.container.addEventListener('mouseleave', () => {
      avatarContainer.style.transform = 'scale(1)';
    });

    // Click to show details in action panel
    this.container.addEventListener('click', () => {
      if (this.onClickCallback) {
        this.onClickCallback(this.npcData);
      }
    });
  }

  public showRedDot(): void {
    if (!this.avatarContainer) return;
    
    // Remove existing red dot if any
    if (this.redDot) {
      this.redDot.remove();
    }
    
    // Create new red dot
    this.redDot = document.createElement('span');
    this.redDot.className = 'npc-avatar-red-dot';
    this.redDot.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: 16px;
      height: 16px;
      background: #dc3545;
      border-radius: 50%;
      border: 2px solid white;
      animation: pulse 1.5s infinite;
      z-index: 100;
      pointer-events: none;
    `;
    this.avatarContainer.appendChild(this.redDot);
  }

  public hideRedDot(): void {
    if (this.redDot) {
      this.redDot.remove();
      this.redDot = null;
    }
  }

  /**
   * Show emoji feedback above the avatar based on affinity change
   * @param affinityChange - The change in affinity (positive, negative, or zero)
   */
  public showEmojiFeedback(affinityChange: number): void {
    if (!this.avatarContainer) return;

    // Determine which emoji to show
    let emoji = '🤔'; // Default for no change
    if (affinityChange >= 1) {
      emoji = '😊'; // Happy for significant positive change (1 or more)
    } else if (affinityChange > 0 && affinityChange < 1) {
      emoji = '🤔'; // Thinking for small positive change (0.1-0.9)
    } else if (affinityChange < 0) {
      emoji = '🙄'; // Eye roll for negative change
    }

    // Create emoji feedback element
    const emojiFeedback = document.createElement('div');
    emojiFeedback.className = 'npc-emoji-feedback';
    emojiFeedback.textContent = emoji;
    emojiFeedback.style.cssText = `
      position: absolute;
      top: -40px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 48px;
      z-index: 1000;
      pointer-events: none;
      animation: emojiFadeInOut 3s ease-out forwards;
    `;

    // Add animation keyframes if not already added
    if (!document.querySelector('style[data-emoji-feedback-animation]')) {
      const style = document.createElement('style');
      style.setAttribute('data-emoji-feedback-animation', 'true');
      style.textContent = `
        @keyframes emojiFadeInOut {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(10px) scale(0.5);
          }
          15% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1.2);
          }
          25% {
            transform: translateX(-50%) translateY(0) scale(1);
          }
          85% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px) scale(0.8);
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Add emoji to avatar container
    this.avatarContainer.appendChild(emojiFeedback);

    // Remove after animation completes (3 seconds)
    setTimeout(() => {
      if (emojiFeedback.parentNode) {
        emojiFeedback.parentNode.removeChild(emojiFeedback);
      }
    }, 3000);
  }
}
