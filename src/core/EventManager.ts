// EventManager.ts
import Phaser from 'phaser';

export class EventManager extends Phaser.Events.EventEmitter {
  private static instance: EventManager;

  private constructor() {
    super();
  }

  static getInstance(): EventManager {
    if (!EventManager.instance) {
      EventManager.instance = new EventManager();
    }
    return EventManager.instance;
  }
}

// Export a singleton instance for convenience
export const GameEvents = EventManager.getInstance();