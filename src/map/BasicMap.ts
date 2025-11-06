import { CellType, Map } from "./Map";


export class BasicMap implements Map {
    public rows: number
    public cols: number
    public grid: Array<Array<CellType>>

    get(row: number, col: number): CellType {
        return this.grid[row][col]
    }

    constructor(rows: number, cols: number, grid?: Array<Array<CellType>>) {
        this.rows = rows
        this.cols = cols
        if (grid) {
            this.grid = grid
        } else {
            this.grid = this.makeBasicGrid()
        }
    }

    /**
     * Makes a basic grid. 
     * Every cell of even row and even column admits an unbreakable obstacle
     * Some cells are forced to be empty
     * Every other cell could be empty or spawn a breakable box
     */
    makeBasicGrid(): Array<Array<CellType>>  {
        let grid: Array<Array<CellType>> = []
        for (let row = 0; row < this.rows; row++) {
            grid.push([])
            for (let col = 0; col < this.cols; col++) {
                if (this.isEvenCell(row, col)) {
                    grid[row].push(CellType.WALL)   
                }
                else if (this.isCellForcedEmpty(row, col)) {
                    grid[row].push(CellType.EMPTY)
                } 
                else {
                    grid[row].push(this.getRandomCellType())
                }
            }
        }
        return grid
    }

    /**
     * Determines if the cell at index (col, row) is even (indexed by 0)
     * @returns 
     */
    isEvenCell(row: number, col: number) {
        return (row+1) % 2 == 0 && (col+1) % 2 == 0
    }

    /**
     * Forces some cells to be empty for player placement
     */
    isCellForcedEmpty(row: number, col: number) {
        return (row === 0 && col === 0) || (row === 1 && col === 0) || (row === 0 && col === 1)
            || (row === this.rows - 1 && col === 0) || (row === this.rows - 2 && col === 0) || (row === this.rows - 1 && col === 1)
            || (row === 0 && col === this.cols - 1) || (row === 1 && col === this.cols - 1) || (row === 0 && col === this.cols - 2)
            || (row === this.rows - 1 && col === this.cols - 1) || (row === this.rows - 2 && col === this.cols - 1) || (row === this.rows - 1 && col === this.cols - 2)
    }


    /**
     * 
     */
    getRandomCellType() {
        let rand = Math.random();
        if (rand < 0.9) {
            return CellType.BOX
        } else {
            return CellType.EMPTY
        }
    }




}