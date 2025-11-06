export interface Map {
    rows: number
    cols: number
    grid: Array<Array<CellType>>
    get(row: number, col: number): CellType
}

export enum CellType {
    PLAYER,         // a starting location for a player
    WALL,           // an obstacle that cannot be destroyed
    BOX,            // an obstacle that can be destroyed
    EMPTY,          // an empty cell which could potentially hold
}