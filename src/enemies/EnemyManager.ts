
import Game from "../scenes/Game"
import { getRect, rectsIntersect } from "../util/util"
import { Enemy } from "./Enemy"

export class EnemyManager {

    public enemies: Array<Enemy> = []

    constructor(private game: Game) {
        this.game = game
    }

    update(time, delta) {
        this.enemies.forEach(enemy => {

            // Kill player if enemy collides with player
            const playerRect = getRect(this.game.player.sprite)
            const enemyRect = getRect(enemy.sprite)    

            if (rectsIntersect(playerRect, enemyRect)) {
                this.game.player.die()
            }

            // Change direction sporadically
            enemy.changeDirTimer -= delta
            if (enemy.changeDirTimer <= 0) {
                enemy.changeDirection()
            }

            // Move enemy
            const enemyX = enemy.sprite.x + enemy.direction.x * enemy.speed * (delta / 1000)
            const enemyY = enemy.sprite.y + enemy.direction.y * enemy.speed * (delta / 1000)
            const newRect = {
                x: enemyX,
                y: enemyY,
                width: enemy.sprite.displayWidth,
                height: enemy.sprite.displayHeight
            }

            // Handle collision with walls/obstacles
            let colliding = false
            for (const obj of this.game.obstacles) {
                const objRect = {       
                    x: obj.x,
                    y: obj.y,
                    width: obj.width,
                    height: obj.height
                }
                if (rectsIntersect(newRect, objRect)) {
                    colliding = true
                    break
                }
            }

            // Apply move only if not colliding
            if (!colliding) {
                enemy.sprite.x = enemyX
                enemy.sprite.y = enemyY
            } else {
            // Bounce off / change direction immediately
                enemy.changeDirTimer = 0
            }
        })
    }

    killEnemy(enemy: Enemy) {
        enemy.sprite.setTint(0xff0000)
        enemy.alive = false
        const deathtext = this.game.add.text(enemy.sprite.x - 40, enemy.sprite.y - 50, '💥 Killed!', {
            fontSize: 28,
            color: '#ff4444',
            fontStyle: 'bold'
        })
        
        this.game.tweens.add({
            targets: enemy,
            angle: 180,
            y: enemy.sprite.y,
            x: enemy.sprite.x, 
            alpha: 0,
            duration: 1200,
            delay: 100,
            ease: 'Quartic.easeOut',
            onComplete: () => {
                enemy.destroy()
                deathtext.destroy()
                this.enemies.filter(o => o !== enemy)
            }
        })
    }
}