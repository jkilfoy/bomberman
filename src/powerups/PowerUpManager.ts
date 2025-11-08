import { EntityManager } from "../core/EntityManager"
import { GridCoordinate } from "../core/GridSystem"
import { Player } from "../player/Player"
import { getRand } from "../util/util"
import { PowerUp, PowerUpProperties } from "./PowerUp"

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

export class PowerUpManager extends EntityManager<PowerUp> {
    
    
    public speedIncrease: number = 1.2


    spawn(coords: GridCoordinate, type?: PowerUpType): PowerUp {
        
        type = type || this.pickRandomType()

        const props: PowerUpProperties = {
            context: this.context,
            gridCoordinates: coords,
            data: powerupData[type]
        }

        const powerUp = new PowerUp(props)
        this.entities.push(powerUp)
        return powerUp
    }

    pickRandomType(): PowerUpType {
        return getRand(Object.values(PowerUpType))
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

        this.context.textService?.showFloatingText(pu.getWorldCoordinates(), pu.text, pu.color)

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
        this.remove(pu)
    }


}