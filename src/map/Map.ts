export interface Map {
    rows: number
    cols: number
    grid: Array<Array<CellType>>
    get(row: number, col: number): CellType
}

export enum CellType {
    WALL,           // an indestructible obstacle
    BOX,            // a destructible obstacle that may drop powerups
    EMPTY,          // an empty cell
}