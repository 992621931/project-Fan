# Design Document: Affinity Dialogue System

## Overview

The Affinity Dialogue System extends the existing game with an interactive conversation mechanic that allows players to build relationships with NPCs through meaningful dialogue choices. The system integrates with the existing AffinitySystem to track relationship progression and provides a rich, branching dialogue experience tailored to each character's profession and personality.

The system consists of three main components:
1. **DialogueSystem** - Core logic for managing dialogue trees, tracking conversation history, and processing affinity effects
2. **DialogueModal** - UI component for displaying conversations and response options
3. **Extended Dialogue Data Format** - JSON structure supporting conversation trees with branching options

## Architecture

### System Integration

```
┌─────────────────────────────────────────────────────────────┐
│                        Game World                            │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │ CharacterPanel   │────────▶│ DialogueModal    │         │
│  │ (Talk Button)    │         │ (UI Display)     │         │
│  └──────────────────┘         └────────┬─────────┘         │
│                                         │                    │
│                                         ▼                    │
│                              ┌──────────────────┐           │
│                              │ DialogueSystem   │           │
│                              │ (Core Logic)     │           │
│                              └────────┬─────────┘           │
│                                       │                      │
│                    ┌──────────────────┼──────────────────┐  │
│                    ▼                  ▼                  ▼  │
│          ┌─────────────────┐  ┌─────────────┐  ┌──────────┐│
│          │ AffinitySystem  │  │ EventSystem │  │ DataLoader││
│          │ (Relationship)  │  │ (Events)    │  │ (JSON)    ││
│          └─────────────────┘  └────────