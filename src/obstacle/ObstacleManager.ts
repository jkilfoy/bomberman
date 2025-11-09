// ObstacleManager.ts
import { EntityManager } from "../core/EntityManager";
import { GridCoordinate } from "../core/GridSystem";
import { CellType, Map } from "../map/Map";
import { Obstacle, ObstacleProperties, ObstacleType } from "./Obstacle";

export class ObstacleManager extends EntityManager<Obstacle> {

    public powerupSpawnChance = 0.4
  
    spawn(coords: GridCoordinate, type: ObstacleType, width?: number, height?: number): Obstacle {
        const props: ObstacleProperties = {
            context: this.context,
            gridCoordinates: coords,
            type: type,
            width: width,
            height: height
        }

        const obstacle = new Obstacle(props)
        this.entities.push(obstacle)
        return obstacle
    }

    /** Breaks an obstacle, removing it from the game and potentially spawning a powerup */
    break(obstacle: Obstacle) {
        if (!obstacle.isBreakable()) return 

        this.remove(obstacle)
        
        if (Math.random() < this.powerupSpawnChance) {
            this.context.powerUpManager?.spawn(obstacle.getGridCoordinates())
        }
    }

    initializeObstacles(map: Map) {

        // Initializes obstacles according to the map's layout
        for (let row = 0; row < this.context.grid.height; row++) {
            for (let col = 0; col < this.context.grid.width; col++) {
                
                // console.log(if r)
                const cellType = map.get(row, col)
                if (cellType === CellType.EMPTY) 
                    continue;

                const coords = {row: row, col: col}
                const obstacleType = cellType === CellType.BOX ? ObstacleType.breakable : ObstacleType.unbreakable
                this.spawn(coords, obstacleType)
            }
        }          

        // Add walls outside the grid as obstacles
        const worldWidth = this.context.grid.width * this.context.grid.cellSize
        const worldHeight = this.context.grid.width * this.context.grid.cellSize
        const wallThickness = 100

        // Top wall
        this.spawn(
            {col: this.context.grid.width / 2, row: -1.3},
            ObstacleType.unbreakable,
            worldWidth, wallThickness
        )
       
        // Bottom wall
        this.spawn(
            {col: this.context.grid.width / 2, row: this.context.grid.height + 0.3},
            ObstacleType.unbreakable,
            worldWidth, wallThickness
        )

        // Left wall
        this.spawn(
            {col: -1.3, row: this.context.grid.height / 2},
            ObstacleType.unbreakable,
            wallThickness, worldHeight
        )

        // Right wall
        this.spawn(
            {col: this.context.grid.width + 0.3, row: this.context.grid.height / 2},
            ObstacleType.unbreakable,
            wallThickness, worldHeight
        )
    }
}