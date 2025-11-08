import { BombManager } from "../bombs/BombManager";
import { PowerUpManager } from "../powerups/PowerUpManager";
import { GameConfig } from "./GameConfig";
import { GridSystem } from "./GridSystem";



/**
 * Context object so that various game entities/managers have access to game data
 */
export class GameContext {
    constructor(
        public config: GameConfig,
        public scene: Phaser.Scene, 
        public events: Phaser.Events.EventEmitter,
        public grid: GridSystem
    ) { }

    // Managers are to be registered after the GameContext is created 
    bombManager?: BombManager   
    powerUpManager?: PowerUpManager
    // todo : audio manager, floating text registering etc
}
