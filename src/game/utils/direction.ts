export enum Direction {
  NONE = 'NONE',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  UP = 'UP',
  DOWN = 'DOWN',
}

export interface MovementVector {
  x: number;
  y: number;
}

export function directionToVector(direction: Direction): MovementVector {
  switch (direction) {
    case Direction.LEFT:
      return { x: -1, y: 0 };
    case Direction.RIGHT:
      return { x: 1, y: 0 };
    case Direction.UP:
      return { x: 0, y: -1 };
    case Direction.DOWN:
      return { x: 0, y: 1 };
    default:
      return { x: 0, y: 0 };
  }
}
