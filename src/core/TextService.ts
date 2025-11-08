import { GameContext } from "./GameContext"
import { WorldCoordinate } from "./GridSystem"


export class TextService {

    constructor(private context: GameContext) { }

    /// Utility for showing floating text
    showFloatingText(coords: WorldCoordinate, text: string, color: string = '#ffffff') {
        const {x, y} = coords
        const label = this.context.scene.add.text(x, y, text, {
            fontFamily: 'Arial',
            fontSize: 24,
            color: color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5)

      // Tween the text upward + fade out
      this.context.scene.tweens.add({
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