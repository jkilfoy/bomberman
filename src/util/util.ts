// Utility functions for common game logic

import { GridCoordinate, WorldCoordinate } from "../core/GridSystem";

/**
 * Returns a simplified rectangle object from a Phaser GameObject
 * (assumes it has x, y, width, and height properties)
 */
export function getRect(obj) {
  if (obj == null) return null;
  return {
    x: obj.x,
    y: obj.y,
    width: obj.displayWidth ?? obj.width ?? 0,
    height: obj.displayHeight ?? obj.height ?? 0
  }
}

/**
 * Checks whether two rectangle-like objects intersect
 * (each object must have x, y, width, and height)
 */
export function rectsIntersect(r1, r2) {
  return r1 != null && r2 != null && !(
    r1.x + r1.width / 2 <= r2.x - r2.width / 2 ||
    r1.x - r1.width / 2 >= r2.x + r2.width / 2 ||
    r1.y + r1.height / 2 <= r2.y - r2.height / 2 ||
    r1.y - r1.height / 2 >= r2.y + r2.height / 2
  )
}


/**
 * Returns the nearest {x, y} position where r1 would not intersect with r2,
 * provided the direction of attempted movement 
 */
export function getNearestNonintersectingPosition(r1, r2, direction: Direction): WorldCoordinate {
    if (!rectsIntersect(r1, r2)) return r1;
    const result = {x: r1.x, y: r1.y}
    switch(direction) {
        case Direction.LEFT:
            result.x = r2.x + (r2.width + r1.width)/2 + 1
            break
        case Direction.RIGHT:
            result.x = r2.x - (r2.width + r1.width)/2 - 1
            break 
        case Direction.UP: 
            result.y = r2.y + (r2.height + r1.height)/2 + 1
            break
        case Direction.DOWN: 
            result.y = r2.y - (r2.height + r1.height)/2 - 1
            break
    }
    return result;
}

export enum Direction {
    NONE = 'NONE', LEFT = 'LEFT', RIGHT = 'RIGHT', UP = 'UP', DOWN = 'DOWN'
}

export function getMoveIndicators(dir: Direction): {moveX: number, moveY: number} {
    switch(dir) {
      case Direction.LEFT:
          return {moveX: -1, moveY: 0}
        
      case Direction.RIGHT:
          return {moveX: 1, moveY: 0}

      case Direction.UP:
          return {moveX: 0, moveY: -1}

      case Direction.DOWN:
          return {moveX: 0, moveY: 1}

      case Direction.NONE:
          return {moveX: 0, moveY: 0}
    }
}


/**
 * Randomly selects an item from a list
 */
export function getRand(list) {
  return list[Math.floor(Math.random() * list.length)]
}

export function sameCoordinates(c1: GridCoordinate, c2: GridCoordinate) {
    return c1.row === c2.row && c1.col === c2.col
}