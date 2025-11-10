export enum GameMode {
  practise = 'practise',
  arena = 'arena',
}

export interface GameConfig {
  mode: GameMode;
  gridWidth: number;
  gridHeight: number;
  cellSize: number;
  tickIntervalMs?: number;
}

export const DEFAULT_TICK_INTERVAL = 1000 / 60;
