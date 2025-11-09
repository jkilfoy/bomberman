// CollisionManager.ts

import { Bomb } from "../bombs/Bomb";
import { BaseEntity } from "../core/BaseEntity";
import { GameContext } from "../core/GameContext";
import { MovingEntity } from "../core/MovingEntity";
import { Enemy } from "../enemies/Enemy";
import { Explosion } from "../explosions/Explosion";
import { Obstacle } from "../obstacle/Obstacle";
import { Player } from "../player/Player";
import { PowerUp } from "../powerups/PowerUp";
import { Direction } from "../util/util";
import { rectsIntersect } from "./Rectangle";

export class CollisionManager {
    constructor(private context: GameContext) { }

    update(entities: {
        players: readonly Player[];
        enemies: readonly Enemy[];
        obstacles: readonly Obstacle[];
        powerups: readonly PowerUp[];
        bombs: readonly Bomb[];
        activeExplosions: readonly Explosion[];
    }) {
        
        const { players, enemies, obstacles, powerups, bombs, activeExplosions: explosions } = entities;

        // --- Player Collisions ---
        for (const player of players) {
            if (!player.alive) continue;

            // Player vs obstacles
            for (const obstacle of obstacles) {
                if (this.overlaps(player, obstacle)) {
                    this.pushMoverBack(player, obstacle);
                }
            }

            // player vs bombs
            for (const bomb of bombs) {
                if (this.overlaps(player, bomb) && player.currentBomb !== bomb) {
                    this.pushMoverBack(player, bomb)
                }
            }

            // Player vs powerups
            for (const powerup of powerups) {
                if (this.overlaps(player, powerup)) {
                    this.context.powerUpManager?.getPowerUp(player, powerup)
                }
            }

            // Player vs enemies
            for (const enemy of enemies) {
                if (this.overlaps(player, enemy)) {
                    this.context.playerManager?.kill(player)
                }
            }
        }

        // --- Enemy Collisions ---
        for (const enemy of enemies) {
            for (const obstacle of obstacles) {
                if (this.overlaps(enemy, obstacle)) {
                    this.pushMoverBack(enemy, obstacle);
                    enemy.changeDirection();
                }
            }

            // enemy vs bombs
            for (const bomb of bombs) {
                if (this.overlaps(enemy, bomb)) {
                    this.pushMoverBack(enemy, bomb)
                }
            }
        }

        // --- Explosion Collisions ---
        for (const explosion of explosions) {

            // 💀 Kill player caught in explosion 
            for (const player of players) {
                if (this.overlaps(player, explosion)) {
                    this.context.playerManager?.kill(player)
                }
            }

            // ⚔️ Slay enemy if they're caught in the splosion
            for (const enemy of enemies) {
                if (this.overlaps(enemy, explosion)) {
                    this.context.enemyManager?.kill(enemy)
                }
            }

            // Break breakable obstacles caught in explosion
            for (const obstacle of obstacles) {
                if (obstacle.isBreakable() && this.overlaps(obstacle, explosion)) {
                    this.context.obstacleManager?.break(obstacle)
                }
            }
        }
    }

    // Basic AABB (axis-aligned bounding box) intersection
    private overlaps(a: BaseEntity<any>, b: BaseEntity<any>): boolean {
        return rectsIntersect(a.getRect(), b.getRect())
    }

    // Pushes entity out of overlap
    private pushMoverBack(moving: MovingEntity<any>, obstacle: BaseEntity<any>) {
        if (!this.overlaps(moving, obstacle)) return

        let r1 = moving.getRect()
        let r2 = obstacle.getRect() 
        switch(moving.getDirection()) {
            case Direction.LEFT:
                r1.x = r2.x + (r1.width + r2.width)/2 + 1
                break
            case Direction.RIGHT:
                r1.x = r2.x - (r1.width + r2.width)/2 - 1
                break 
            case Direction.UP: 
                r1.y = r2.y + (r1.height + r2.height)/2 + 1
                break
            case Direction.DOWN: 
                r1.y = r2.y - (r1.height + r2.height)/2 - 1
                break
        }

        moving.setWorldCoordinate({x: r1.x, y: r1.y})
    }
}