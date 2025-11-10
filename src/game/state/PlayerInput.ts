import { Direction } from '../utils/direction';

export type PlayerInput =
  | {
      type: 'set_direction';
      playerId: string;
      direction: Direction;
      clientTime: number;
    }
  | {
      type: 'drop_bomb';
      playerId: string;
      clientTime: number;
    };
