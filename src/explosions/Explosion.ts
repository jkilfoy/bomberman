import { BaseEntity, EntityProperties } from "../core/BaseEntity";
import { GridCoordinate } from "../core/GridSystem";

export interface ExplosionProperties extends EntityProperties {
    gridCoordinates: GridCoordinate
}

export class Explosion extends BaseEntity<Phaser.GameObjects.Rectangle> {

    public isActive: boolean    // determines whether the explosion sprite should kill/destroy 
                                // destructible sprites it collides with 
    public timer: number        // countdown to when the explosion should be destroyed

    constructor(props: ExplosionProperties) {
        const {x, y} = props.context.grid.gridToWorld(props.gridCoordinates)
        let sprite = props.context.scene.add.rectangle(
            x,
            y,
            props.context.grid.cellSize * 0.9, //todo magic constant
            props.context.grid.cellSize * 0.9,
            0xff4400 // brown/orange color
        )
        sprite.alpha = 0.8
        
        super(props, sprite) 

        this.isActive = true
        this.timer = 0
    }

    update(time: number, delta: number) {
        this.timer += delta
    }
}