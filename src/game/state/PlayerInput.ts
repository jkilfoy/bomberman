import { Direction } from '../utils/direction';

export interface PlayerInput {
  playerId: string;

  // movement state — continuous booleans
  direction: Direction

  // discrete actions — fire on this input only when true
  bomb: boolean;

  // client timestamp (for latency measurement, optional)
  // clientTime: number;
}