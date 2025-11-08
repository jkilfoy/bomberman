import { BaseEntity, EntityProperties } from "../core/BaseEntity";
import { GridCoordinate } from "../core/GridSystem";

export interface ObstacleProperties extends EntityProperties {
    gridCoordinates: GridCoordinate      // todo : readonly ?
    type: ObstacleType
    
    width?: number | undefined      // optional width, defaults to cell size
    height?: number | undefined     // optional height, default to cell size
}

export enum ObstacleType {
    breakable, unbreakable
}


export class Obstacle extends BaseEntity<Phaser.GameObjects.Rectangle> {

    public type: ObstacleType

    constructor(props: ObstacleProperties) {
        const {x, y} = props.context.grid.gridToWorld(props.gridCoordinates)
        let sprite = props.context.scene.add.rectangle(
            x,
            y,
            props.width ?? props.context.grid.cellSize * 0.9, //todo magic constant
            props.height ?? props.context.grid.cellSize * 0.9,
            props.type === ObstacleType.breakable ? 0xcc8844 : 0x999999 // brown/orange color
        )
        sprite.setStrokeStyle(2, props.type === ObstacleType.breakable ? 0x553311 : 0x555555 )

        super(props, sprite)
        
        this.type = props.type
    }

    isBreakable(): boolean {
        return this.type === ObstacleType.breakable
    }


}