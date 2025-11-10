import { GridCoordinate } from '../../src/core/GridSystem';

export interface MatchPlayerInfo {
  playerId: string;
  characterKey: string;
  name: string;
  spawn: GridCoordinate;
}
