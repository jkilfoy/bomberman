import { BaseEntity, EntityProperties } from "../core/BaseEntity"
import { GridCoordinate } from "../core/GridSystem"
import GameScene from "../scenes/GameScene"

export interface EnemyProperties extends EntityProperties {
    gridCoordinates: GridCoordinate  // the starting coordinte of the enemy
} 

export class Enemy extends BaseEntity<Phaser.GameObjects.Image> {

    public alive: boolean = true
    public speed: number = 100
    public direction: {x: number, y: number} = { x: 0, y: 0 }
    public changeDirTimer = 0

    constructor(props: EnemyProperties) {
        const {x, y} = props.context.grid.gridToWorld(props.gridCoordinates)
        let sprite = props.context.scene.add.image(
            x,
            y,
            'cone')
        sprite.setScale(0.14)

        super(props, sprite)
    }

    // todo : give enemy movement controller for AI
    update(time: number, delta: number) {
        if (!this.alive) return

        // Sporadically change movement
        this.changeDirTimer -= delta
        if (this.changeDirTimer <= 0) {
            this.changeDirection()
        }
        
        // Move enemy
        this.gameObject.x += this.direction.x * this.speed * (delta / 1000)
        this.gameObject.y += this.direction.y * this.speed * (delta / 1000)
    }

    changeDirection() {
        // Pick a random direction: up, down, left, right
        const dirs = [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 }
        ]
        this.direction = Phaser.Utils.Array.GetRandom(dirs)

        // Reset change direction timer
        this.changeDirTimer = Phaser.Math.Between(600, 2500)
    }

    die() {
        this.alive = false
        this.gameObject.setTint(0xff0000)  // tint it red

        // todo : text service
        const deathtext = this.context.scene.add.text(this.gameObject.x - 40, this.gameObject.y - 50, '💥 Killed!', {
            fontSize: 28,
            color: '#ff4444',
            fontStyle: 'bold'
        })
        
        this.context.scene.tweens.add({
            targets: this,
            angle: 180,
            y: this.gameObject.y,
            x: this.gameObject.x, 
            alpha: 0,
            duration: 1200,
            delay: 100,
            ease: 'Quartic.easeOut',
            onComplete: () => {
                deathtext.destroy()
                this.context.events.emit('enemy:death', this)
            }
        })
    }
}