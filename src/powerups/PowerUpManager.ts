import { Player } from "../player/Player"
import Game from "../scenes/Game"
import { getRand } from "../util/util"
import { PowerUp, PowerUpProps } from "./PowerUp"

export enum PowerUpType {
    SpeedUp = 'speedUp', 
    RangeUp = 'rangeUp',
    BombsUp = 'bombsUp', 
    Shield = 'shield'
}

export interface PowerUpData {
    type: PowerUpType
    text: string,
    color: string,
    colorCode: number
}

/**
 * Utility object for fetching powerup data
 */
export const powerupData: {[key: string] : PowerUpData} = {
    speedUp: {
        type: PowerUpType.SpeedUp,
        text: '+Speed!',
        color: '#00ffcc',
        colorCode: 0x00ffcc
    },
    rangeUp: {
        type: PowerUpType.RangeUp,
        text: '+Range!',
        color: '#ffcc00',
        colorCode: 0xffcc00
    },
    bombsUp: {
        type: PowerUpType.BombsUp,
        text: '+Bomb!',
        color: '#cc00ff',
        colorCode: 0xcc00ff
    },
    shield: {
        type: PowerUpType.Shield,
        text: 'Shield!',
        color: '#ccff00',
        colorCode: 0xccff00
    },
}

export class PowerUpManager {

    public speedIncrease: number = 1.2

    public powerups: Array<PowerUp> = []

    private game: Game

    constructor(game: Game) {
        this.game = game
    }

    spawnPowerUp(col: number, row: number) {
        const type = getRand(Object.values(PowerUpType))
        const props: PowerUpProps = {
            col: col,
            row: row,
            data: powerupData[type]
        }

        const pu = new PowerUp(this.game, props)
    
        this.powerups.push(pu)

        return pu
    }

    getPowerUp(player: Player, pu: PowerUp) {

        // Apply effect of powerup
        switch(pu.type) {
            case PowerUpType.SpeedUp:
                player.speed *= this.speedIncrease
                break
            case PowerUpType.RangeUp:
                player.explosionRange += 1
                break
            case PowerUpType.BombsUp:
                player.bombLimit += 1
                break
            case PowerUpType.Shield:
                player.acquireShield()
                break
        }
        
        this.game.showFloatingText(this.game.getX(player.getColumn()), this.game.getY(player.getRow()), pu.text, pu.color)
        // todo : fix "texture key already in use" bug
        //this.textures.generate('spark', { data: ['1'], pixelWidth: 2, pixelHeight: 2 });
        // const sparkle = this.game.add.particles(0, 0, 'spark', {
        //     x: this.player.x,
        //     y: this.player.y,
        //     lifespan: 500,
        //     speed: { min: 50, max: 100 },
        //     scale: { start: 0.5, end: 0 },
        //     quantity: 10,
        //     tint: powerup.colorCode
        // })
        // this.time.delayedCall(500, () => sparkle.destroy())

        // Remove power-up
        pu.destroy()
        this.powerups = this.powerups.filter(p => p !== pu)
    }

    update() {
        // manage powerups
    }

    




}