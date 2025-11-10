import { CellType, GameMap } from './Map';

export class BasicMap implements GameMap {
  public rows: number;
  public cols: number;
  public grid: CellType[][];

  constructor(rows: number, cols: number, seedGrid?: CellType[][]) {
    this.rows = rows;
    this.cols = cols;
    this.grid = seedGrid ?? this.makeBasicGrid();
  }

  get(row: number, col: number): CellType {
    return this.grid[row][col];
  }

  private makeBasicGrid() {
    const grid: CellType[][] = [];
    for (let row = 0; row < this.rows; row++) {
      grid.push([]);
      for (let col = 0; col < this.cols; col++) {
        if (this.isEvenCell(row, col)) {
          grid[row].push(CellType.WALL);
        } else if (this.isCellForcedEmpty(row, col)) {
          grid[row].push(CellType.EMPTY);
        } else {
          grid[row].push(this.getRandomCellType());
        }
      }
    }
    return grid;
  }

  private isEvenCell(row: number, col: number) {
    return (row + 1) % 2 === 0 && (col + 1) % 2 === 0;
  }


  private isCellForcedEmpty(row: number, col: number) {
    return (
      (row === 0 && col === 0) ||
      (row === 1 && col === 0) ||
      (row === 0 && col === 1) ||
      (row === this.rows - 1 && col === 0) ||
      (row === this.rows - 2 && col === 0) ||
      (row === this.rows - 1 && col === 1) ||
      (row === 0 && col === this.cols - 1) ||
      (row === 1 && col === this.cols - 1) ||
      (row === 0 && col === this.cols - 2) ||
      (row === this.rows - 1 && col === this.cols - 1) ||
      (row === this.rows - 2 && col === this.cols - 1) ||
      (row === this.rows - 1 && col === this.cols - 2)
    );
  }

  private getRandomCellType() {
    const rand = Math.random();
    return rand < 0.9 ? CellType.BOX : CellType.EMPTY;
  }
}
