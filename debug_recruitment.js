// Debug recruitment issue
const { CharacterRecruitmentSystem } = require('./src/game/systems/CharacterRecruitmentSystem.ts');
const { EntityManager } = require('./src/ecs/EntityManager.ts');
const { ComponentManager } = require('./src/ecs/ComponentManager.ts');
const { EventSystem } = require('./src/ecs/EventSystem.ts');
const { CurrencyComponentType } = require('./src/game/components/SystemComponents.ts');
const { DEFAULT_CURRENCY } = require('./src/game/types/CurrencyTypes.ts');

const componentManager = new ComponentManager();
const entityManager = new EntityManager(componentManager);
const eventSystem = new EventSystem();

const recruitmentSystem = new CharacterRecruitmentSystem();
recruitmentSystem.initialize(entityManager, componentManager, eventSystem);

// Create a test player
const playerEntity = entityManager.createEntity();
const playerId = playerEntity.id;

const currency = {
  type: 'currency',
  amounts: { ...DEFAULT_CURRENCY, gold: 10000 },
  transactionHistory: []
};

componentManager.addComponent(playerId, CurrencyComponentType, currency);

// Try to recruit
console.log('Attempting recruitment...');
const result = recruitmentSystem.recruitWithGold(playerId);
console.log('Result:', result);