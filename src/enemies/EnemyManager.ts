
import { EntityManager } from "../core/EntityManager"
import { GridCoordinate } from "../core/GridSystem"
import GameScene from "../scenes/GameScene"
import { getRect, rectsIntersect } from "../util/util"
import { Enemy, EnemyProperties } from "./Enemy"

export class EnemyManager extends EntityManager<Enemy> {

    subscribeToEvents(): void {
        this.context.events.on('enemy:death', this.handleEnemyDeath, this)
    }
    

    spawn(coords: GridCoordinate): Enemy {
        const props: EnemyProperties = {
            context: this.context,
            gridCoordinates: coords
        }

        const enemy = new Enemy(props)
        this.entities.push(enemy)
        return enemy
    }


    handleEnemyDeath(enemy: Enemy) {
        this.remove(enemy)
    }
    

    destroy() {
        this.context.events.off('enemy:death', this.handleEnemyDeath, this)
        this.destroyAll()
    }
}