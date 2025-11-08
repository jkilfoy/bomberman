import { BaseEntity, EntityProperties } from "../core/BaseEntity"
import { GridCoordinate } from "../core/GridSystem"
import GameScene from "../scenes/GameScene"
import { PowerUpData, PowerUpType } from "./PowerUpManager"

export interface PowerUpProperties extends EntityProperties {
    gridCoordinates: GridCoordinate
    data: PowerUpData 
}

export class PowerUp extends BaseEntity<Phaser.GameObjects.Arc> {

    public type: PowerUpType
    public text: string
    public color: string

    constructor(props: PowerUpProperties) {
        const {x, y} = props.context.grid.gridToWorld(props.gridCoordinates)

        let sprite = props.context.scene.add.circle(
            x, 
            y, 
            props.context.grid.cellSize * 0.25, 
            props.data.colorCode
        )

        super(props, sprite)

        // todo : consider removing data, putting attributes directly on props
        this.type = props.data.type   
        this.text = props.data.text
        this.color = props.data.color
    }

}

