import { Direction } from "../util/util";
import { BaseEntity } from "./BaseEntity";

/**
 * An Entity that moves. At any time, the direction of its movement is given by its direction.
 */
export abstract class MovingEntity<
    T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & {width: number, height: number}
> extends BaseEntity<T> {

    /** The direction in which this entity is currently moving */
    public direction: Direction = Direction.NONE

    // Override for entities that move
    getDirection(): Direction {
        return this.direction
    }

}