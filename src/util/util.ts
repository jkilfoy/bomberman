// Utility functions for common game logic

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

export function getDirection(moveX, moveY) {
    return moveX === -1 ? DIRECTIONS.LEFT
                : moveX === 1 ? DIRECTIONS.RIGHT
                : moveY === -1 ? DIRECTIONS.UP
                : moveY === 1 ? DIRECTIONS.DOWN
                : DIRECTIONS.NONE
}

/**
 * Returns the nearest {x, y} position where r1 would not intersect with r2,
 * provided the direction of attempted movement 
 */
export function getNearestNonintersectingPosition(r1, r2, direction) {
    if (!rectsIntersect(r1, r2)) return r1;
    const result = {x: r1.x, y: r1.y}
    switch(direction) {
        case DIRECTIONS.LEFT:
            result.x = r2.x + (r2.width + r1.width)/2 + 1
            break
        case DIRECTIONS.RIGHT:
            result.x = r2.x - (r2.width + r1.width)/2 - 1
            break 
        case DIRECTIONS.UP: 
            result.y = r2.y + (r2.height + r1.height)/2 + 1
            break
        case DIRECTIONS.DOWN: 
            result.y = r2.y - (r2.height + r1.height)/2 - 1
            break
    }
    return result;
}

export const DIRECTIONS = {NONE: 0, LEFT: 1, RIGHT: 2, UP: 3, DOWN: 4}


/**
 * Randomly selects an item from a list
 */
export function getRand(list) {
  return list[Math.floor(Math.random() * list.length)]
}