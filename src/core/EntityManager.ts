import { BaseEntity } from "./BaseEntity";
import { GameContext } from "./GameContext";

export abstract class EntityManager<T extends BaseEntity<any>> {
    protected entities: T[] = [];

    constructor(protected context: GameContext) {
        // console.log(context)
        this.subscribeToEvents()
    }

    /** Spawn and track a new entity */
    abstract spawn(...args: any[]): T;

    /** Remove and destroy an existing entity */
    remove(entity: T) {
        entity.destroy()
        this.entities = this.entities.filter(e => e !== entity)
    }

    /** Override to subscribe to all events this manager should care about */
    subscribeToEvents() {}

    /** Basic update logic: update each entity sequentially */
    update(time: number, delta: number) {
        for (const e of this.entities) {
            e.update(time, delta);
        }
    }

    /** Destroy this manager. To be called at the end of Manager's lifecycle.
     * Be sure to unsubscribe from any events this manager subscribed to */ 
    destroy() {
        this.destroyAll()
    }

    /** Destroys all entities */
    destroyAll() {
        for (const e of this.entities) e.destroy();
        this.entities = [];
    }

    /** Get all entities (for CollisionManager, etc.) */
    getAll(): readonly T[] {
        return this.entities;
    }
}