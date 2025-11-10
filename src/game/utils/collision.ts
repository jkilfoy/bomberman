import { WorldCoordinate } from '../../core/GridSystem';
import { Direction } from './direction';

export interface Hitbox {
  width: number;
  height: number;
}

export interface Rectangle extends Hitbox {
  x: number;
  y: number;
}

const EPSILON = 0.5;

export function rectsIntersect(a: Rectangle, b: Rectangle): boolean {
  return !(
    a.x + a.width / 2 <= b.x - b.width / 2 ||
    a.x - a.width / 2 >= b.x + b.width / 2 ||
    a.y + a.height / 2 <= b.y - b.height / 2 ||
    a.y - a.height / 2 >= b.y + b.height / 2
  );
}

export function rectFromState(worldPosition: WorldCoordinate, hitbox: Hitbox): Rectangle {
  return {
    x: worldPosition.x,
    y: worldPosition.y,
    width: hitbox.width,
    height: hitbox.height,
  };
}

export function getNearestNonIntersectingPosition(
  moving: Rectangle,
  obstacle: Rectangle,
  direction: Direction,
): WorldCoordinate {
  const horizontalOffset = (moving.width + obstacle.width) / 2 + EPSILON;
  const verticalOffset = (moving.height + obstacle.height) / 2 + EPSILON;

  const resolvedDirection = direction === Direction.NONE ? inferDirection(moving, obstacle) : direction;

  switch (resolvedDirection) {
    case Direction.LEFT:
      return { x: obstacle.x + horizontalOffset, y: moving.y };
    case Direction.RIGHT:
      return { x: obstacle.x - horizontalOffset, y: moving.y };
    case Direction.UP:
      return { x: moving.x, y: obstacle.y + verticalOffset };
    case Direction.DOWN:
      return { x: moving.x, y: obstacle.y - verticalOffset };
    default:
      return { x: moving.x, y: moving.y };
  }
}

function inferDirection(moving: Rectangle, obstacle: Rectangle): Direction {
  const dx = moving.x - obstacle.x;
  const dy = moving.y - obstacle.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Direction.LEFT : Direction.RIGHT;
  }
  if (Math.abs(dy) > 0) {
    return dy > 0 ? Direction.UP : Direction.DOWN;
  }
  return Direction.RIGHT;
}
