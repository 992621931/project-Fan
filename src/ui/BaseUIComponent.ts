/**
 * Base UI Component - Abstract base class for all UI components
 */

import { UIComponent, UIManager } from './UIManager';
import { EventSystem } from '../ecs/EventSystem';

export abstract class BaseUIComponent implements UIComponent {
  public readonly id: string;
  public element: HTMLElement;
  public visible: boolean = false;
  
  protected uiManager: UIManager;
  protected eventSystem: EventSystem;

  constructor(id: string, uiManager: UIManager, eventSystem: EventSystem) {
    this.id = id;
    this.uiManager = uiManager;
    this.eventSystem = eventSystem;
    this.element = this.createElement();
    this.element.classList.add('hidden'); // Hide by default
    this.setupEventListeners();
  }

  protected abstract createElement(): HTMLElement;
  
  public abstract render(): void;

  public show(): void {
    this.visible = true;
    this.element.classList.remove('hidden');
    this.element.classList.add('visible');
    this.render();
    this.onShow();
  }

  public hide(): void {
    this.visible = false;
    this.element.classList.remove('visible');
    this.element.classList.add('hidden');
    this.onHide();
  }

  public destroy(): void {
    this.onDestroy();
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  protected setupEventListeners(): void {
    // Override in subclasses to add specific event listeners
  }

  protected onShow(): void {
    // Override in subclasses for show logic
  }

  protected onHide(): void {
    // Override in subclasses for hide logic
  }

  protected onDestroy(): void {
    // Override in subclasses for cleanup logic
  }

  protected createButton(text: string, onClick: () => void, className: string = ''): HTMLButtonElement {
    return this.uiManager.createButton(text, onClick, className);
  }

  protected createInput(type: string = 'text', placeholder: string = '', className: string = ''): HTMLInputElement {
    return this.uiManager.createInput(type, placeholder, className);
  }

  protected createPanel(className: string = ''): HTMLDivElement {
    return this.uiManager.createPanel(className);
  }

  protected showNotification(message: string, type: 'success' | 'warning' | 'error' = 'success'): void {
    this.uiManager.showNotification(message, type);
  }

  protected formatRarity(rarity: number): string {
    const rarityClasses = ['rarity-common', 'rarity-rare', 'rarity-epic', 'rarity-legendary'];
    return rarityClasses[rarity] || 'rarity-common';
  }

  protected formatCurrency(amount: number): string {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toString();
  }

  protected createElement_div(className: string = '', innerHTML: string = ''): HTMLDivElement {
    const div = document.createElement('div');
    if (className) div.className = className;
    if (innerHTML) div.innerHTML = innerHTML;
    return div;
  }

  protected createElement_span(className: string = '', textContent: string = ''): HTMLSpanElement {
    const span = document.createElement('span');
    if (className) span.className = className;
    if (textContent) span.textContent = textContent;
    return span;
  }

  protected createElement_h2(className: string = '', textContent: string = ''): HTMLHeadingElement {
    const h2 = document.createElement('h2');
    if (className) h2.className = className;
    if (textContent) h2.textContent = textContent;
    return h2;
  }

  protected createElement_h3(className: string = '', textContent: string = ''): HTMLHeadingElement {
    const h3 = document.createElement('h3');
    if (className) h3.className = className;
    if (textContent) h3.textContent = textContent;
    return h3;
  }

  protected createElement_ul(className: string = ''): HTMLUListElement {
    const ul = document.createElement('ul');
    if (className) ul.className = className;
    return ul;
  }

  protected createElement_li(className: string = '', innerHTML: string = ''): HTMLLIElement {
    const li = document.createElement('li');
    if (className) li.className = className;
    if (innerHTML) li.innerHTML = innerHTML;
    return li;
  }
}