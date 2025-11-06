import { Player } from "../player/Player";
import Game from "../scenes/Game";
import { getRect, rectsIntersect } from "../util/util";
import { Bomb, BombProperties } from "./Bomb";

const directions = [
    { dr: -1, dc: 0 }, // up
    { dr: 1, dc: 0 },  // down
    { dr: 0, dc: -1 }, // left
    { dr: 0, dc: 1 }   // right
]

export class BombManager {

    public bombs: Array<Bomb> = []

    private game: Game

    constructor(game: Game) {
        this.game = game
    }

    canDropBomb(player: Player) {
        const existing = this.bombs.some(bomb => { 
            return bomb.getColumn() === player.getColumn() 
                && bomb.getRow() === player.getRow()
        })
        return !existing
    }

    dropBomb(player: Player) {
        const bombProperties: BombProperties = {
            col: player.getColumn(),
            row: player.getRow(),
            radius: this.game.cellSize * 0.3,
            player: player,
            range: player.explosionRange,
            timerDuration: player.bombTimerDuration,
            color: 0x4444ff
        } 

        // Create Bomb
        const bomb: Bomb = new Bomb(this.game, bombProperties)

        // Start countdown timer
        this.game.time.delayedCall(bomb.timerDuration, () => {
            this.detonate(bomb)
        })

        this.bombs.push(bomb)
        return bomb
    }

    detonate(bomb: Bomb) {
        if (!this.bombs.includes(bomb)) return // bomb doesn't exist // todo :how can this happen?
        
        this.bombs = this.bombs.filter(b => b !== bomb)
        this.game.obstacles = this.game.obstacles.filter(o => o !== bomb.sprite)
        bomb.player.bombDetonated(bomb)
        bomb.detonate()

        // Explosion cells (center + 4 directions)
        const explosionCells = [{ row: bomb.getRow(), col: bomb.getColumn() }]

        for (const { dr, dc } of directions) {
            for (let step = 1; step <= bomb.range; step++) {
                const r = bomb.getRow() + dr * step
                const c = bomb.getColumn() + dc * step
                if (r < 0 || r >= this.game.gridHeight || c < 0 || c >= this.game.gridWidth) break

                // Stop propagation if blocked by an indestructible object
                const blockingObstacle = this.game.obstacles.find(obj => {
                    const objCol = this.game.getColumn(obj.x)
                    const objRow = this.game.getColumn(obj.y)
                    return objCol === c && objRow === r && obj.type === 'indestructible'
                })
                if (blockingObstacle) break

                explosionCells.push({ row: r, col: c })

                // Stop if hits a destructible box (it’ll be destroyed but doesn’t spread further)
                const destructible = this.game.obstacles.find(obj => {
                    const objCol = this.game.getColumn(obj.x)
                    const objRow = this.game.getColumn(obj.y)
                    return objCol === c && objRow === r && obj.type === 'box'
                    })
                if (destructible) break
            }
        }

        // Spawn fire graphics in explosionCells
        for (const { row, col } of explosionCells) {
            const x = this.game.getX(col)
            const y = this.game.getY(row)
            const fire = this.game.add.rectangle(x, y, this.game.cellSize * 0.9, this.game.cellSize * 0.9, 0xff4400) // todo : magic cosntants
            fire.alpha = 0.8
            fire.type = 'fire'

            // 🔥 Chain Reaction: Detonate any bombs caught in the blast
            this.bombs.forEach(otherBomb => {
                if (otherBomb.getRow() === row && otherBomb.getColumn() === col) {
                    this.detonate(otherBomb)
                }
            })

            // 🧱 Destroy destructible boxes in the blast
            const destroyedBoxes = this.game.obstacles.filter(obj => {
                const objCol = this.game.getColumn(obj.x)
                const objRow = this.game.getRow(obj.y)
                
                return objCol === col && objRow === row && obj.type === 'box'
            })

            // 💀 Kill player if they're caught in the splosion
            if (rectsIntersect(getRect(bomb.player.sprite), getRect(fire))) {
                this.game.handlePlayerDeath(bomb.player)
            }

            // todo : enemy manager
            // ⚔️ Kill enemies if they're caught in the splosion
            // if (rectsIntersect(getRect(this.game.enemy), getRect(fire))) {
            //     this.game.killEnemy(this.game.enemy) // 
            // }

            for (const box of destroyedBoxes) {
                box.destroy()
                this.game.removeObstacle(box)
                this.game.spawnPowerUp(col, row)
            }

            // Remove fire after duration
            this.game.time.delayedCall(this.game.fireDuration, () => fire.destroy())
        }
    }

}