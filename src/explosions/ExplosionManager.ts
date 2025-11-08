import { GridFactory } from "matter";
import { EntityManager } from "../core/EntityManager";
import { GridCoordinate } from "../core/GridSystem";
import { Explosion, ExplosionProperties } from "./Explosion";


export default class ExplosionManager extends EntityManager<Explosion> {

    public destroyTime: number = 1_000  // the length of time before an explosion should be destroyed
    
    spawn(coords: GridCoordinate): Explosion {
        const props: ExplosionProperties = {
            context: this.context,
            gridCoordinates: coords
        }

        const explosion = new Explosion(props)
        this.entities.push(explosion)
        return explosion
    }

    update(time: number, delta: number) {
        for (const ex of this.entities) {
            // explosions should only be active during their first frame
            if (ex.isActive) {
                ex.isActive = false
            }

            // increment timer on each explosion
            ex.update(time, delta)

            // remove explosions that have finishes their timer
            if (ex.timer >= this.destroyTime) {
                ex.destroy()
                this.entities = this.entities.filter(o => o !== ex)
            }
        }
    }

    getActiveExplosions(): Explosion[] {
        return this.entities.filter(ex => ex.isActive)
    }

}