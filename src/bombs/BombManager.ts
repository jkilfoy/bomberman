// BombManager.ts

import { EntityManager } from "../core/EntityManager";
import { GameEvents } from "../core/EventManager";
import { GameContext } from "../core/GameContext";
import { GridCoordinate } from "../core/GridSystem";
import { ObstacleType } from "../obstacle/Obstacle";
import { Player } from "../player/Player";
import { sameCoordinates } from "../util/util";
import { Bomb, BombProperties } from "./Bomb";

const directions = [
    { dr: -1, dc: 0 }, // up
    { dr: 1, dc: 0 },  // down
    { dr: 0, dc: -1 }, // left
    { dr: 0, dc: 1 }   // right
]



export class BombManager extends EntityManager<Bomb> {

    constructor(context: GameContext) {
        super(context)
        GameEvents.on("bomb:spawn", this.spawn, this);
        GameEvents.on("bomb:detonate", this.detonate, this);
    }

    spawn(coords: GridCoordinate, range: number, timerDuration: number, player: Player): Bomb {
        const bombProperties: BombProperties = {
                context: this.context,
                gridCoordinate: coords,
                radius: this.context.grid.cellSize  * 0.3, // todo magic constant
                player: player ?? null, // todo : consider un-owned bombs 
                range: range,
                timerDuration: timerDuration,
                color: 0x4444ff
        } 

        const bomb = new Bomb(bombProperties);
        this.entities.push(bomb);
        return bomb
    }

    canDropBomb(player: Player) {
        const existing = this.entities.some(bomb => { 
            return player.getGridCoordinates() == bomb.getGridCoordinates() // todo : TEST
        })
        return !existing
    }

    playerDropBomb(player: Player): Bomb {
        return this.spawn(
            player.getGridCoordinates(), 
            player.explosionRange, 
            player.bombTimerDuration, 
            player
        )
    }

    destroy() {
        GameEvents.off("bomb:spawn", this.spawn, this);
        GameEvents.off("bomb:detonate", this.detonate, this);
        this.entities.forEach(b => b.destroy());
    }

    detonate(bomb: Bomb) {
        if (bomb.detonated) return // bomb has already detonated

        // Keep track of any bombs caught in this explosion
        let chainedReactions: Bomb[] = []
        
        // Explosion cells (center + 4 directions)
        let {col, row} = bomb.getGridCoordinates()
        const explosionCells: GridCoordinate[] = [{col, row}]

        // Determine explosion cells based on bomb's range and any blocking obstacles
        for (const { dr, dc } of directions) {
            for (let step = 1; step <= bomb.range; step++) {
                const cell = {
                    col: col + dc * step, 
                    row: row + dr * step
                    }

                if (!this.context.grid.isValidCell(cell)) 
                    break

                // Stop propagation if blocked by an indestructible object
                const blockingObstacle = this.context.obstacleManager?.find(obst => {
                    return  obst.type == ObstacleType.unbreakable 
                    &&  sameCoordinates(obst.getGridCoordinates(), cell) 
                    })
                if (blockingObstacle) break

                explosionCells.push(cell)

                // Stop if hits a destructible box (it’ll be destroyed but doesn’t spread further)
                const destructible = this.context.obstacleManager?.find(obst => {
                    return  obst.type == ObstacleType.breakable 
                    &&  sameCoordinates(obst.getGridCoordinates(), cell)
                    })
                if (destructible) break
            }
        }

        // cause explosion in each explosion cell
        for (const cell of explosionCells) {

            const existingBomb = this.find(bomb => sameCoordinates(bomb.getGridCoordinates(), cell))
            if (existingBomb) {
                chainedReactions.push(existingBomb)
            }

            this.context.explosionManager?.spawn(cell)
        }

        bomb.player.bombDetonated(bomb)
        this.remove(bomb)
        for (const chainedBomb of chainedReactions) {
            this.detonate(chainedBomb)
        }
    }

}