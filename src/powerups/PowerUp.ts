import Game from "../scenes/Game"
import { PowerUpData, PowerUpType } from "./PowerUpManager"

export interface PowerUpProps {
    col: number          
    row: number
    data: PowerUpData 
}

export class PowerUp {

    public sprite: Phaser.GameObjects.Arc

    public col: number
    public row: number
    public type: PowerUpType
    public text: string
    public color: string

    constructor(private game: Game, props: PowerUpProps) {
        this.sprite = game.add.circle(game.getX(props.col), game.getY(props.row), game.cellSize * 0.25, props.data.colorCode)
        this.col = props.col
        this.row = props.row
        this.type = props.data.type
        this.text = props.data.text
        this.color = props.data.color
    }

    destroy() {
        this.sprite.destroy()
    }

}



