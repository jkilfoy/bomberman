import Phaser from 'phaser'
import { Controller } from './Controller'

export default class KeyboardController implements Controller {
  private scene: Phaser.Scene
  private keys: Record<string, Phaser.Input.Keyboard.Key>

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // Register relevant keys
    const input = scene.input.keyboard
    if (input == null) throw Error("Cannot create Keyboard Controller; input is null")

    this.keys = {
      left: input.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: input.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up: input.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: input.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      bomb: input.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    }
  }

  get left()  { return { isDown: () => this.keys.left.isDown } }
  get right() { return { isDown: () => this.keys.right.isDown } }
  get up()    { return { isDown: () => this.keys.up.isDown } }
  get down()  { return { isDown: () => this.keys.down.isDown } }

  get bomb() {
    return {
      justPressed: () => Phaser.Input.Keyboard.JustDown(this.keys.bomb)
    }
  }
}