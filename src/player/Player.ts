import { Bomb } from "../bombs/Bomb";
import type { Character } from "../characters/Characters";
import { BaseEntity, EntityProperties } from "../core/BaseEntity";
import { GameMode } from "../core/GameConfig";
import { GridCoordinate } from "../core/GridSystem";
import type { Controller } from "../input/Controller";
import { Direction, rectsIntersect } from "../util/util";


export interface PlayerProperties extends EntityProperties {
    gridCoordinates: GridCoordinate
    character: Character
    controller: Controller
}

export class Player extends BaseEntity<Phaser.GameObjects.Image> {
    
    // Manager compositions
    public character: Character
    public controller: Controller

    // Gameobject data
    public speed: number 
    public alive: boolean = true
    public invincible: boolean = false

    public shield: boolean = false
    public shieldSprite: Phaser.GameObjects.Arc | undefined

    public activeBombs: number = 0
    public bombLimit: number = 1
    public explosionRange: number
    public bombTimerDuration: number = 3000 

    // Keeps track of the bomb a player is on so it is not considered during collision detection
    public currentBomb: Bomb | undefined

    constructor(props: PlayerProperties) {
        const {x, y} = props.context.grid.gridToWorld(props.gridCoordinates)
        let sprite = props.context.scene.add.image(
            x, 
            y, 
            props.character.key).setScale(props.character.scale)

        super(props, sprite)        

        this.character = props.character
        this.controller = props.controller
        
        this.speed = 200
        this.explosionRange = 1   
    }


    update(time: number, delta: number) {

        if (!this.alive) return

        // Drop Bomb
        if (this.controller.bomb.justPressed()) {
            this.dropBomb()
        }

        // Move
        let moveX = 0
        let moveY = 0

        switch(this.controller.direction.get()) {
            case Direction.LEFT:
                moveX = -1
                break
            case Direction.RIGHT:
                moveX = 1
                break
            case Direction.UP:
                moveY = -1
                break
            case Direction.DOWN:
                moveY = 1
                break
        }

        this.gameObject.x += moveX * this.speed * (delta / 1000)
        this.gameObject.y += moveY * this.speed * (delta / 1000)

        // Move shield alongside player
        if (this.shieldSprite != null) {
            this.shieldSprite.setPosition(this.gameObject.x, this.gameObject.y)
        }

        // -- Bomb obstacle activation 
        // If player moved off their bomb cell, activate that bomb as an obstacle
        if (this.currentBomb && !rectsIntersect(this.gameObject, this.currentBomb.getGameObject())) {
            this.currentBomb = undefined
        }
        


        // // todo : who should be responsible for collision detection and repositioning
        // // Collision detection for player
        // for (const obj of this.game.obstacles) {
        //     const objRect = getRect(obj)
        //     const playerRect = getRect(this.gameObject)

        //     if (rectsIntersect(playerRect, objRect)) {
        //         // Collision → push player outside of the object
        //         const newPosition = getNearestNonintersectingPosition(playerRect, objRect, getDirection(moveX, moveY))
        //         this.sprite.x = newPosition.x
        //         this.sprite.y = newPosition.y
        //         break
        //     }
        // }

        

        

        // for (const pu of [...this.game.powerupManager.powerups]) {
        //     const puRect = getRect(pu.sprite)
        //     if (rectsIntersect(getRect(this.sprite), puRect)) {
        //         this.game.powerupManager.getPowerUp(this, pu)
        //     }
        // }
        
    }

    canDropBomb() {
        // Cannot drop bomb if player has reached bomb limit
        if (this.activeBombs >= this.bombLimit) return false

        // Cannot drop bomb if BombManager says a bomb is already present
        return this.context.bombManager?.canDropBomb(this)
    }

    /** Emits an event to try and drop a bomb
     *  Should be denied if their cell is ineligible for a bomb */
    dropBomb() {
        if (!this.canDropBomb()) return

        this.currentBomb = this.context.bombManager?.playerDropBomb(this)
        this.activeBombs += 1
    }
    

    bombDetonated(bomb: Bomb) {
        this.activeBombs -= 1
        if (this.currentBomb === bomb) {
            this.currentBomb = undefined
        }
    }

    acquireShield() {
        if (!this.shield) {
            this.shield = true
            this.shieldSprite = this.context.scene.add.circle(
                this.gameObject.x, this.gameObject.y, this.gameObject.displayHeight/2, 0xccff00, 0.7   // todo : shield color
            )
        }
    }

    consumeShield() {
      if (!this.shield) return

      this.invincible = true
      this.shield = false;
      this.shieldSprite?.destroy();
      this.shieldSprite = undefined;
      this.context.scene.time.delayedCall(1000, () => {
        this.invincible = false
      })
    }


    die() {
        // in practise mode, no death. Same if player invincible
        if (this.context.config.mode === GameMode.practise  || this.invincible) 
            return

        // if shielded, use shield instead
        if (this.shield) {
            this.consumeShield()
            return
        }

        // Kill player
        this.alive = false
        this.gameObject.setTint(0xff0000)

        // Shake camera
        this.context.scene.cameras.main.shake(300, 0.02)
        this.context.scene.add.text(this.gameObject.x - 40, this.gameObject.y - 50, '💀 You Died!', {
            fontSize: 28,
            color: '#ff4444',
            fontStyle: 'bold'
        })
        
        // Restart game after short delay
        this.context.scene.time.delayedCall(2000, () => {
            this.context.scene.scene.start('Menu')
        })
    }

}