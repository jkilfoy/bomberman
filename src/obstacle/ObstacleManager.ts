// ObstacleManager.ts
import { EntityManager } from "../core/EntityManager";
import { GridCoordinate } from "../core/GridSystem";
import { CellType, Map } from "../map/Map";
import { Obstacle, ObstacleProperties, ObstacleType } from "./Obstacle";

export class ObstacleManager extends EntityManager<Obstacle> {
  
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

    // todo : move to parent?
    destroyObstacle(obstacle: Obstacle) {
        obstacle.destroy()
        this.entities = this.entities.filter(o => o !== obstacle)
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
                const obstacleType = cellType === CellType.BOX ? ObstacleType.destructible : ObstacleType.indestructible
                this.spawn(coords, obstacleType)
            }
        }          

        // Add walls outside the grid as obstacles
        const worldWidth = this.context.grid.width * this.context.grid.cellSize
        const worldHeight = this.context.grid.width * this.context.grid.cellSize
        const wallThickness = 100

        // Top wall
        this.spawn(
            {col: this.context.grid.width / 2, row: -2},
            ObstacleType.indestructible,
            worldWidth, wallThickness
        )
       
        // Bottom wall
        this.spawn(
            {col: this.context.grid.width / 2, row: this.context.grid.height + 1},
            ObstacleType.indestructible,
            worldWidth, wallThickness
        )

        // Left wall
        this.spawn(
            {col: -2, row: this.context.grid.height / 2},
            ObstacleType.indestructible,
            wallThickness, worldHeight
        )

        // Right wall
        this.spawn(
            {col: this.context.grid.width + 1, row: this.context.grid.height / 2},
            ObstacleType.indestructible,
            wallThickness, worldHeight
        )
    }
}