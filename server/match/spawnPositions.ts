import { GridCoordinate } from '../../src/core/GridSystem';

export const MATCH_SPAWNS: GridCoordinate[] = [
  { col: 0, row: 0 },
  { col: 12, row: 0 },
  { col: 0, row: 10 },
  { col: 12, row: 10 },
];

export function getSpawnForIndex(idx: number): GridCoordinate {
  return MATCH_SPAWNS[idx % MATCH_SPAWNS.length];
}
