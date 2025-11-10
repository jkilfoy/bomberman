export interface GridCoordinate {
  col: number;
  row: number;
}

export interface WorldCoordinate {
  x: number;
  y: number;
}

export interface BoundingSize {
  width: number;
  height: number;
}

/**
 * Utility for converting between grid and world space.
 * Rendering systems can use this without depending on Phaser specifics.
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

  gridToWorld(coords: GridCoordinate): WorldCoordinate {
    return {
      x: coords.col * this.cellSize + this.cellSize / 2,
      y: coords.row * this.cellSize + this.cellSize / 2,
    };
  }

  worldToGrid(coords: WorldCoordinate): GridCoordinate {
    return {
      col: Math.floor(coords.x / this.cellSize),
      row: Math.floor(coords.y / this.cellSize),
    };
  }

  isValidCell(coords: GridCoordinate) {
    return (
      coords.col >= 0 &&
      coords.row >= 0 &&
      coords.col < this.width &&
      coords.row < this.height
    );
  }

  getWorldBounds(size?: BoundingSize) {
    const halfWidth = size ? size.width / 2 : 0;
    const halfHeight = size ? size.height / 2 : 0;

    return {
      minX: halfWidth,
      maxX: this.width * this.cellSize - halfWidth,
      minY: halfHeight,
      maxY: this.height * this.cellSize - halfHeight,
    };
  }

  clampWorldPosition(position: WorldCoordinate, size?: BoundingSize): WorldCoordinate {
    const bounds = this.getWorldBounds(size);
    return {
      x: Math.min(Math.max(position.x, bounds.minX), bounds.maxX),
      y: Math.min(Math.max(position.y, bounds.minY), bounds.maxY),
    };
  }
}
