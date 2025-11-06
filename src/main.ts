import Phaser from 'phaser'
import Game from './scenes/Game.js'
import Menu from './scenes/Menu.js'

const config = {
  type: Phaser.AUTO,
  width: 832,
  height: 11*64,
  backgroundColor: '#222',
  scene: [Menu, Game]
}

new Phaser.Game(config)