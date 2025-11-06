import { BombManager } from "../bombs/BombManager"
import characters, { Character } from "../characters/Characters"
import { EnemyManager } from "../enemies/EnemyManager"
import KeyboardController from "../input/KeyboardController"
import { BasicMap } from "../map/BasicMap"
import { CellType, Map } from "../map/Map"
import { Player } from "../player/Player"
import { PowerUpManager } from "../powerups/PowerUpManager"

type PositionedGameObject = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Arc

export default class Game extends Phaser.Scene {

  // Game Config
  public selectedCharacter!: Character
  public mode: string = 'practise'

  // Grid configuration
  public cellSize = 64
  public gridWidth = 13
  public gridHeight = 11
  public walls!: {left: number, right: number, top: number, bottom: number}
  public map!: Map

  // Obstacles for collision detection
  public obstacles: Array<PositionedGameObject> = []

  // Bomb config 
  public bombManager!: BombManager
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
  public player!: Player



    constructor() {
      super('Game')
    }


    init(data) {
      if (data && data.selectedCharacter) {
        this.selectedCharacter = data.selectedCharacter
      } else {
        this.selectedCharacter = characters['eric'] // default to Eric
      }
      if (data && data.mode) {
        this.mode = data.mode
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

      const controller = new KeyboardController(this)
      this.player = new Player(this, this.selectedCharacter, controller, this.cellSize / 2, this.cellSize * 10.5) //todo : fix x, y params

      // Wall boundaries (computed once)
      this.walls = {
        left: 0,
        top: 0,
        right: this.gridWidth * this.cellSize,
        bottom: this.gridHeight * this.cellSize
      }

      // Obstacle placement
      this.map = new BasicMap(this.gridHeight, this.gridWidth) 
      this.drawGrid()
      this.drawObstacles()

      // Enemies
      //todo
      this.enemyManager = new EnemyManager(this)

      // Bomb Data
      this.bombManager = new BombManager(this)

      // PowerUp Manager
      this.powerupManager = new PowerUpManager(this)
    }


    removeObstacle(obj: PositionedGameObject) {
      this.obstacles = this.obstacles.filter(o => o !== obj)
    }



    // --------------------
    // DRAWING / SETUP
    // --------------------
  
    drawGrid() {
      const g = this.add.graphics()
      g.lineStyle(1, 0x999999, 1)
  
      // Draw vertical lines
      for (let x = 0; x <= this.gridWidth; x++) {
        g.moveTo(x * this.cellSize, 0)
        g.lineTo(x * this.cellSize, this.gridHeight * this.cellSize)
      }
  
      // Draw horizontal lines
      for (let y = 0; y <= this.gridHeight; y++) {
        g.moveTo(0, y * this.cellSize)
        g.lineTo(this.gridWidth * this.cellSize, y * this.cellSize)
      }
  
      g.strokePath()
    }


    drawObstacles() {
      for (let row = 0; row < this.gridHeight; row++) {
        for (let col = 0; col < this.gridWidth; col++) {

          switch(this.map.get(row, col)) {

            case CellType.WALL:
              const wall = this.add.rectangle(
                  col * this.cellSize + this.cellSize / 2,
                  row * this.cellSize + this.cellSize / 2,
                  this.cellSize * 0.9,
                  this.cellSize * 0.9,
                  0x999999
              )
              wall.setStrokeStyle(2, 0x555555)
              wall.type = 'indestructible'
              this.obstacles.push(wall)
              break
            
            
            
            case CellType.BOX:
              const box = this.add.rectangle(
                  col * this.cellSize + this.cellSize / 2,
                  row * this.cellSize + this.cellSize / 2,
                  this.cellSize * 0.9,
                  this.cellSize * 0.9,
                  0xcc8844 // brown/orange color
              )
              box.setStrokeStyle(2, 0x553311)
              box.type = 'box'
              this.obstacles.push(box)
              break
            
            case CellType.PLAYER:
            case CellType.EMPTY:
          }
        }
      }

      // Add walls outside grid as obstacles
      const worldWidth = this.gridWidth * this.cellSize
      const worldHeight = this.gridHeight * this.cellSize
      const wallThickness = 100

      const walls = [
        this.add.rectangle(worldWidth / 2, -wallThickness / 2, worldWidth, wallThickness, 0x333333), // top
        this.add.rectangle(worldWidth / 2, worldHeight + wallThickness / 2, worldWidth, wallThickness, 0x333333), // bottom
        this.add.rectangle(-wallThickness / 2, worldHeight / 2, wallThickness, worldHeight, 0x333333), // left
        this.add.rectangle(worldWidth + wallThickness / 2, worldHeight / 2, wallThickness, worldHeight, 0x333333) // right
      ]

      for (const wall of walls) {
        wall.setStrokeStyle(2, 0x111111)
        wall.type = 'indestructible'
        this.obstacles.push(wall)
      }
    }

    spawnPowerUp(col: number, row: number) {
      this.powerupManager.spawnPowerUp(col, row)
    }

    // --------------
    // UPDATE LOOP
    // ---------------
    isKeyPressed(...keys) {
      return keys.some(key => key.isDown)
    }
  
    update(time, delta) {
      this.player.update(time, delta)
      this.enemyManager.update(time, delta)
    }

    handlePlayerDeath(player: Player) {
      player.die()
    }

    killEnemy(enemy) {
      this.enemyManager.killEnemy(enemy)
    }


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


    /**
     * Return the grid cell column/row based on input x/y coordinate
     */
    getColumn(x: number): number {
        return Math.floor(x / this.cellSize)
    }
    getRow(y: number): number {
        return Math.floor(y / this.cellSize)
    }

    /**
     * Returns the x/y coordinate of the center of a cell at given col/row
     */
    getX(col: number): number {
        return (col + 0.5) * (this.cellSize)
    }
    getY(row: number): number {
        return (row + 0.5) * (this.cellSize)
    }

  }