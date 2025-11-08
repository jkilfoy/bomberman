import { BombManager } from "../bombs/BombManager";
import { EnemyManager } from "../enemies/EnemyManager";
import ExplosionManager from "../explosions/ExplosionManager";
import { ObstacleManager } from "../obstacle/ObstacleManager";
import { PlayerManager } from "../player/PlayerManager";
import { PowerUpManager } from "../powerups/PowerUpManager";
import { GameConfig } from "./GameConfig";
import { GridSystem } from "./GridSystem";
import { TextService } from "./TextService";



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
    playerManager?: PlayerManager
    enemyManager?: EnemyManager

    obstacleManager?: ObstacleManager
    bombManager?: BombManager
    explosionManager?: ExplosionManager
    powerUpManager?: PowerUpManager

    textService?: TextService
    // todo : audio manager, floating text registering etc
}
