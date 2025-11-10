export enum CellType {
  WALL = 'WALL',
  BOX = 'BOX',
  EMPTY = 'EMPTY',
}

export interface MapCell {
  row: number;
  col: number;
  type: CellType;
}

export interface GameMap {
  rows: number;
  cols: number;
  grid: CellType[][];
  get(row: number, col: number): CellType;
}
