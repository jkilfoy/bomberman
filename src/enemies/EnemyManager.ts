
import { EntityManager } from "../core/EntityManager"
import { GridCoordinate } from "../core/GridSystem"
import { Enemy, EnemyProperties } from "./Enemy"

export class EnemyManager extends EntityManager<Enemy> {

    subscribeToEvents(): void {
        this.context.events.on('enemy:death', this.kill, this)
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

    kill(enemy: Enemy) {
        const killed = enemy.die()
        if (killed) {
            this.remove(enemy)
        }
    }
    

    destroy() {
        this.context.events.off('enemy:death', this.kill, this)
        this.destroyAll()
    }
}