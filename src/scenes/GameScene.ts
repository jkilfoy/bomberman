import { BombManager } from "../bombs/BombManager"
import characters, { Character } from "../characters/Characters"
import { CollisionManager } from "../collision/CollisionManager"
import { GameEvents } from "../core/EventManager"
import { GameConfig } from "../core/GameConfig"
import { GameContext } from "../core/GameContext"
import { GridSystem } from "../core/GridSystem"
import { TextService } from "../core/TextService"
import { EnemyManager } from "../enemies/EnemyManager"
import ExplosionManager from "../explosions/ExplosionManager"
import KeyboardController from "../input/KeyboardController"
import { BasicMap } from "../map/BasicMap"
import { Map } from "../map/Map"
import { ObstacleManager } from "../obstacle/ObstacleManager"
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

  // Text Service
  public textService!: TextService



    constructor() {
      super('GameScene')
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
      Object.values(characters).forEach(char => {
            this.load.image(char.key, char.path)
        })
      this.load.image('cone',  'src/assets/traffic_cone.png')
    }
  
    create() {

      // Create game context to pass to managers/entities
      this.context = new GameContext(this.config, this, GameEvents, new GridSystem(13, 11, 64));

      // Make map
      this.map = new BasicMap(this.context.grid.height, this.context.grid.width) 

      // Draw grid
      this.drawGrid()


      //-------------------------------
      // Create and register managers
      //-------------------------------

      // Obstacles
      this.obstacleManager = new ObstacleManager(this.context)
      this.obstacleManager.initializeObstacles(this.map)
      this.context.obstacleManager = this.obstacleManager
      

      // Players
      const controller = new KeyboardController(this)

      this.playerManager = new PlayerManager(this.context)
      this.context.playerManager = this.playerManager

      this.playerManager.spawn({col: 0, row: 0}, this.selectedCharacter, controller)
      
      // Enemies
      this.enemyManager = new EnemyManager(this.context)
      this.context.enemyManager = this.enemyManager
      this.enemyManager.spawn({col: this.context.grid.width - 1, row: 0})


      // Bombs && Explosions
      this.bombManager = new BombManager(this.context)
      this.context.bombManager = this.bombManager

      this.explosionManager = new ExplosionManager(this.context)
      this.context.explosionManager = this.explosionManager

      // PowerUps
      this.powerupManager = new PowerUpManager(this.context)
      this.context.powerUpManager = this.powerupManager


      /// Manager Collisions
      this.collisionManager = new CollisionManager(this.context)


      // Text Service
      this.textService = new TextService(this.context)
      this.context.textService = this.textService
    }

    // --------------------
    // DRAWING / SETUP
    // --------------------
  
    drawGrid() {
      const g = this.add.graphics()
      g.lineStyle(1, 0x555555, 1)
  
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



    // --------------
    // UPDATE LOOP
    // ---------------
  
    update(time, delta) {

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
        activeExplosions: this.explosionManager.getActiveExplosions()
      })

      // update collisions (they are only active for the frame of their explosion)
      this.explosionManager.update(time, delta)
    }

  }