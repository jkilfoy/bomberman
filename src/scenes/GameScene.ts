import { BombManager } from "../bombs/BombManager"
import characters, { Character } from "../characters/Characters"
import { CollisionManager } from "../core/CollisionManager"
import { GameEvents } from "../core/EventManager"
import { GameConfig } from "../core/GameConfig"
import { GameContext } from "../core/GameContext"
import { GridCoordinate, GridSystem } from "../core/GridSystem"
import { EnemyManager } from "../enemies/EnemyManager"
import ExplosionManager from "../explosions/ExplosionManager"
import KeyboardController from "../input/KeyboardController"
import { BasicMap } from "../map/BasicMap"
import { CellType, Map } from "../map/Map"
import { ObstacleManager } from "../obstacle/ObstacleManager"
import { Player } from "../player/Player"
import { PlayerManager } from "../player/PlayerManager"
import { PowerUpManager } from "../powerups/PowerUpManager"

type PositionedGameObject = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Arc

export default class GameScene extends Phaser.Scene {

  // Game Config
  public config!: GameConfig
  public context!: GameContext
  public selectedCharacter!: Character
  public mode: string = 'practise'

  // Grid configuration
  public cellSize = 64
  public walls!: {left: number, right: number, top: number, bottom: number}
  public map!: Map

  // Obstacles 
  public obstacleManager!: ObstacleManager

  // Bombs 
  public bombManager!: BombManager
  public explosionManager!: ExplosionManager
  public bombTimerDuration = 3000 // milliseconds before explosion
  public fireDuration = 500        // fire lifetime in ms

  // Powerups
  public powerupManager!: PowerUpManager
  public powerups = []
  public baseSpeed = 200
  public speedIncrease = 1.2
  public powerupChance = 0.8

  // Enemies
  public enemyManager!: EnemyManager

  // Player
  public playerManager!: PlayerManager

  // Collisions
  public collisionManager!: CollisionManager



    constructor() {
      super('Game')
    }


    init(data) {
      if (data && data.selectedCharacter) {
        this.selectedCharacter = data.selectedCharacter
      } else {
        this.selectedCharacter = characters['eric'] // default to Eric
      }
      
      this.config = {
        mode: data.mode
      }
    }

  
    preload() {
      this.load.image('luffy', 'src/assets/luffy.png')
      this.load.image('sanji', 'src/assets/sanji.png')
      this.load.image('zoro', 'src/assets/zoro.png')
      this.load.image('eric', 'src/assets/eric.png')
      this.load.image('cone',  'src/assets/traffic_cone.png')
    }
  
    create() {


      // Create game context to pass to managers/entities
      this.context = {
        config: this.config,
        scene: this,
        grid: new GridSystem(15, 13, 64),
        events: GameEvents,
      };

      // Create controllers
      const controller = new KeyboardController(this)
      // todo spawn player in player manager
      // this.player = new Player(this, this.selectedCharacter, controller, this.cellSize / 2, this.cellSize * 10.5) //todo : fix x, y params
      this.playerManager = new PlayerManager(this.context)
      this.playerManager.spawn({col: 0, row: 0}, this.selectedCharacter, controller)



      // Create and register managers
      this.enemyManager = new EnemyManager(this.context)

      // Bomb Manager
      this.bombManager = new BombManager(this.context)
      this.context.bombManager = this.bombManager

      this.explosionManager = new ExplosionManager(this.context)

      // PowerUp Manager
      this.powerupManager = new PowerUpManager(this.context)
      this.context.powerUpManager = this.powerupManager

      // Obstacle Manager
      this.obstacleManager = new ObstacleManager(this.context)

      // Draw map
      this.map = new BasicMap(this.context.grid.height, this.context.grid.width) 
      this.obstacleManager.initializeObstacles(this.map)

      // Collision Manager
      this.collisionManager = new CollisionManager(this.context)

      this.drawGrid() // todo : should be before obstacles?
    }

    // --------------------
    // DRAWING / SETUP
    // --------------------
  
    drawGrid() {
      const g = this.add.graphics()
      g.lineStyle(1, 0x999999, 1)
  
      // Draw vertical lines
      for (let x = 0; x <= this.context.grid.width; x++) {
        g.moveTo(x * this.cellSize, 0)
        g.lineTo(x * this.cellSize, this.context.grid.height * this.cellSize)
      }
  
      // Draw horizontal lines
      for (let y = 0; y <= this.context.grid.height; y++) {
        g.moveTo(0, y * this.cellSize)
        g.lineTo(this.context.grid.width * this.cellSize, y * this.cellSize)
      }
  
      g.strokePath()
    }


    spawnPowerUp(coords: GridCoordinate) {
      this.powerupManager.spawn(coords)
    }

    // --------------
    // UPDATE LOOP
    // ---------------
    isKeyPressed(...keys) {
      return keys.some(key => key.isDown)
    }
  
    update(time, delta) {

      console.log(this.children.list.length);

      // update each manager
      this.bombManager.update(time, delta)
      this.playerManager.update(time, delta)
      this.enemyManager.update(time, delta)

      // process collisions and emit corresponding events
      this.collisionManager.update({
        players: this.playerManager.getAll(),
        enemies: this.enemyManager.getAll(),
        obstacles: this.obstacleManager.getAll(),
        powerups: this.powerupManager.getAll(),
        bombs: this.bombManager.getAll(),
        explosions: this.explosionManager.getActiveExplosions()
      }) // todo

      // update collisions (they are only active for the frame of their explosion)
      this.explosionManager.update(time, delta)
    }

    handlePlayerDeath(player: Player) {
      player.die()
    }

    // killEnemy(enemy) {
    //   this.enemyManager.killEnemy(enemy)
    // }


    // todo : make service?
    /// Utility for showing floating text
    showFloatingText(x, y, text, color = '#ffffff') {
      const label = this.add.text(x, y, text, {
        fontFamily: 'Arial',
        fontSize: 24,
        color: color,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5)

      // Tween the text upward + fade out
      this.tweens.add({
        targets: label,
        y: y - 30,
        alpha: 0,
        duration: 1200,
        delay: 100,
        ease: 'Cubic.easeIn',
        onComplete: () => label.destroy()
      })
    }

  }