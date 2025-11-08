import { BaseEntity, EntityProperties } from "../core/BaseEntity"
import { GameContext } from "../core/GameContext"
import { GridCoordinate } from "../core/GridSystem"
import { Player } from "../player/Player"

export interface BombProperties extends EntityProperties {
    gridCoordinate: GridCoordinate    // grid coordinates of the bomb
    radius: number          // radius of the bomb sprite 

    player: Player          // the player who owns the bomb

    timerDuration?: number  // the time before bomb detonate
    range?: number          // explosive range of the bomb
    color?: number          // color of the bomb sprite
}

export class Bomb extends BaseEntity<Phaser.GameObjects.Arc> {
    
    public range: number
    public timerDuration: number
    public detonated = false;
    public player: Player // come back to this

    constructor(props: BombProperties) {
        const {x, y} = props.context.grid.gridToWorld(props.gridCoordinate)
        let sprite = props.context.scene.add.circle(
                x, 
                y, 
                props.radius, 
                props.color ?? 0x4444ff)

        super(props, sprite)

        this.player = props.player
        this.range = props.range ?? 1;
        this.timerDuration = props.timerDuration ?? 3000
    }

    detonate() {
        if (!this.detonated) {
            this.gameObject.destroy() // todo : emit event?
        }
    }
}