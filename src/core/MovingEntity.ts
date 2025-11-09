import { Rectangle } from "../collision/Rectangle";
import { Direction } from "../util/util";
import { BaseEntity } from "./BaseEntity";
import { WorldCoordinate } from "./GridSystem";

/**
 * An Entity that moves. At any time, the direction of its movement is given by its direction.
 */
export abstract class MovingEntity<
    T extends Phaser.GameObjects.Image
> extends BaseEntity<T> {

    /** The direction in which this entity is currently moving */
    public direction: Direction = Direction.NONE

    // Override for entities that move
    getDirection(): Direction {
        return this.direction
    }

    // todo refactor
    getRect(): Rectangle {
        const {x, y} = this.getWorldCoordinates()
        return {
            x: x,
            y: y,
            width: this.gameObject.displayWidth,
            height: this.gameObject.displayHeight
        }
    }

}