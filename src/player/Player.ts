import { Bomb } from "../bombs/Bomb";
import type { Character } from "../characters/Characters";
import type { Controller } from "../input/Controller";
import Game from "../scenes/Game";
import modes from "../util/modes";
import { getDirection, getNearestNonintersectingPosition, getRect, rectsIntersect } from "../util/util";

export class Player {

    // Manager compositions
    public character: Character
    public sprite: Phaser.GameObjects.Image
    public controller: Controller

    // Gameobject data
    public speed: number 
    public alive: boolean = true
    public invincible: boolean = false

    public shield: boolean = false
    public shieldSprite: Phaser.GameObjects.Arc | null = null

    public activeBombs: number = 0
    public bombLimit: number = 1
    public explosionRange: number
    public bombTimerDuration: number = 3000

    // Keeps track of the bomb a player is on so it is not considered during collision detection
    public currentBomb: Bomb | null = null
    

    private game: Game

    constructor(scene: Game, character: Character, controller: Controller, 
                x: number, y: number) {
        this.game = scene
        this.character = character
        this.controller = controller
        this.sprite = scene.add.image(x, y, character.key)
        this.sprite.setScale(character.scale)

        this.speed = 200
        this.explosionRange = 1
    }


    update(time: number, delta: number) {
        // Player Controls : movement and bomb dropping
        if (!this.alive) return

        let moveX = 0
        let moveY = 0

        if (this.controller.left.isDown()) moveX = -1
        else if (this.controller.right.isDown()) moveX = 1
        else if (this.controller.up.isDown()) moveY = -1
        else if (this.controller.down.isDown()) moveY = 1

        // Drop Bomb
        if (this.controller.bomb.justPressed()) {
            this.dropBomb()
        }

        // Move player
        const xIncrement = moveX * this.speed * (delta / 1000)
        const yIncrement = moveY * this.speed * (delta / 1000)
        this.sprite.x += xIncrement
        this.sprite.y += yIncrement

        // Collision detection for player
        for (const obj of this.game.obstacles) {
            const objRect = getRect(obj)
            const playerRect = getRect(this.sprite)

            if (rectsIntersect(playerRect, objRect)) {
                // Collision → push player outside of the object
                const newPosition = getNearestNonintersectingPosition(playerRect, objRect, getDirection(moveX, moveY))
                this.sprite.x = newPosition.x
                this.sprite.y = newPosition.y
                break
            }
        }

        // Move shield alongside player
        if (this.shieldSprite != null) {
            this.shieldSprite.setPosition(this.sprite.x, this.sprite.y)
        }

        // -- Bomb obstacle activation 
        // If player moved off their bomb cell, activate that bomb as an obstacle
        if (this.currentBomb && !rectsIntersect(getRect(this.sprite), this.currentBomb.sprite)) {
            this.game.obstacles.push(this.currentBomb.sprite)
            this.currentBomb = null
        }

        for (const pu of [...this.game.powerupManager.powerups]) {
            const puRect = getRect(pu.sprite)
            if (rectsIntersect(getRect(this.sprite), puRect)) {
                this.game.powerupManager.getPowerUp(this, pu)
            }
        }
        
    }

    canDropBomb() {
        // Cannot drop bomb if player has reached bomb limit
        if (this.activeBombs >= this.bombLimit) return false

        // Cannot drop bomb if bomb manager says no
        return this.game.bombManager.canDropBomb(this)
    }

    dropBomb() {
        if (!this.canDropBomb()) return

        this.currentBomb = this.game.bombManager.dropBomb(this);
        this.activeBombs += 1
    }

    

    bombDetonated(bomb: Bomb) {
        this.activeBombs -= 1
        if (this.currentBomb === bomb) {
            this.currentBomb = null
        }
    }

    acquireShield() {
        if (!this.shield) {
            this.shield = true
            this.shieldSprite = this.game.add.circle(this.sprite.x, this.sprite.y, this.sprite.displayHeight/2, 0xccff00, 0.7)   // todo : shield color
        }
    }

    consumeShield() {
      if (!this.shield) return

      this.invincible = true
      this.shield = false;
      this.shieldSprite?.destroy();
      this.shieldSprite = null;
      this.game.time.delayedCall(1000, () => {
        this.invincible = false
      })
    }


    die() {
        // in practise mode, no death. Same if player invincible
        if (this.game.mode === modes.practise || this.invincible) 
            return

        // if shielded, use shield instead
        if (this.shield) {
            this.consumeShield()
            return
        }

        // Kill player
        this.alive = false

        // Simple feedback for now
        this.game.cameras.main.shake(300, 0.02)
        this.game.add.text(this.sprite.x - 40, this.sprite.y - 50, '💀 You Died!', {
            fontSize: 28,
            color: '#ff4444',
            fontStyle: 'bold'
        })
        this.sprite.setTint(0xff0000)

        // Optional: Restart game after short delay
        this.game.time.delayedCall(2000, () => {
            this.game.scene.start('Menu')
        })
    }

    destroy() {
        this.sprite.destroy()
    }


    getColumn(): number {
        // console.log("player column : ", this.game.getColumn(this.sprite.x))
        return this.game.getColumn(this.sprite.x)
    }

    getRow(): number {
        // console.log("player row : ", this.game.getRow(this.sprite.y) )
        return this.game.getRow(this.sprite.y) 
    }



}