import { Player } from "../player/Player"
import Game from "../scenes/Game"

export interface BombProperties {
    col: number           // column of the bomb
    row: number           // row of the bomb
    radius: number          // radius of the bomb sprite 

    player: Player          // the player who own the bomb

    timerDuration?: number  // the time before bomb detonate
    range?: number          // explosive range of the bomb
    color?: number          // color of the bomb sprite
}

export class Bomb {
    public sprite: Phaser.GameObjects.Arc
    public range: number
    public timerDuration: number
    public detonated = false;
    public player: Player
    private game: Game

    constructor(game: Game, props: BombProperties) {
        this.game = game;
        this.player = props.player
        this.sprite = game.add.circle(
            game.getX(props.col), 
            game.getY(props.row), 
            props.radius, 
            props.color ?? 0x4444ff)

        this.range = props.range ?? 1;
        this.timerDuration = props.timerDuration ?? 3000
    }

    detonate() {
        if (!this.detonated) {
            this.sprite.destroy()
        }
    }

    getColumn(): number {
        if (this.detonated) return -1
        return this.game.getColumn(this.sprite.x)
    }

    getRow(): number {
        if (this.detonated) return -1
        return this.game.getRow(this.sprite.y) 
    }
}