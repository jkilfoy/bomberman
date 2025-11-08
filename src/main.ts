import Phaser from 'phaser'
import GameScene from './scenes/GameScene.js'
import MenuScene from './scenes/MenuScene.js'

const config = {
  type: Phaser.AUTO,
  width: 13*64,
  height: 11*64,
  backgroundColor: '#222',
  scene: [MenuScene, GameScene]
}

new Phaser.Game(config)