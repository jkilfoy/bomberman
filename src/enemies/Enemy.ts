import Game from "../scenes/Game"

export class Enemy {

    public sprite: Phaser.GameObjects.Image

    public alive: boolean = true
    public speed: number = 100
    public direction: {x: number, y: number} = { x: 0, y: 0 }
    public changeDirTimer = 0

    constructor(private game: Game, public col: number, public row: number) {
        this.sprite = game.add.image(
            game.getX(col), 
            game.getY(row), 
            'cone')
        this.sprite.setScale(0.14)
    }

    changeDirection() {
        // Reset change direction timer
        this.changeDirTimer = Phaser.Math.Between(600, 2500)

        // Pick a random direction: up, down, left, right
        const dirs = [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 }
        ]
        this.direction = Phaser.Utils.Array.GetRandom(dirs)
    }

    destroy() {
        this.sprite.destroy()
    }
}