import { PlayerInput } from "../game/state/PlayerInput"
import { Direction } from "../game/utils/direction"

export abstract class Controller {
  abstract left: { isDown(): boolean }
  abstract right: { isDown(): boolean }
  abstract up: { isDown(): boolean }
  abstract down: { isDown(): boolean }
  abstract bomb: { justPressed(): boolean }
  abstract direction: { get(): Direction}  

  getInput(): PlayerInput {
    return {
      playerId: "",  // to be filled in by caller // todo right approach?
      direction: this.determineDirection(),   
      bomb: this.bomb.justPressed(),
    }
  }

  determineDirection(): Direction {
    if (this.left.isDown())         return Direction.LEFT
    else if (this.right.isDown())   return Direction.RIGHT
    else if (this.up.isDown())      return Direction.UP
    else if (this.down.isDown())    return Direction.DOWN
    
    return Direction.NONE
  }
}
