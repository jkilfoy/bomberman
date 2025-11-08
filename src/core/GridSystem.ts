export interface GridCoordinate {
    col: number
    row: number
}

export interface WorldCoordinate {
    x: number
    y: number
}

/**
 * This class encapsulates data regarding the grid of the game
 * It also as exposes helper methods to convert between scene x/y coordinates and grid col/row coordinates 
 * 
 */
export class GridSystem {
  readonly cellSize: number;
  readonly width: number;
  readonly height: number;

  constructor(gridWidth: number, gridHeight: number, cellSize: number) {
    this.width = gridWidth;
    this.height = gridHeight;
    this.cellSize = cellSize;
  }

  /** Convert grid coordinates (col,row) to world coordinates (x,y) 
   * Returns the (x,y) coordinate at the center of (col,row) */
  gridToWorld(coords: GridCoordinate): WorldCoordinate {
    return {
      x: coords.col * this.cellSize + this.cellSize / 2,
      y: coords.row * this.cellSize + this.cellSize / 2,
    };
  }

  /** Convert world coordinates (x,y) to grid coordinates (col,row) */
  worldToGrid(coords: WorldCoordinate): GridCoordinate {
    return {
      col: Math.floor(coords.x / this.cellSize),
      row: Math.floor(coords.y / this.cellSize),
    };
  }

  /** Whether a grid position is within the playable area */
  isValidCell(coords: GridCoordinate) {
    return (
      coords.col >= 0 &&
      coords.row >= 0 &&
      coords.col < this.width &&
      coords.row < this.height
    );
  }
}