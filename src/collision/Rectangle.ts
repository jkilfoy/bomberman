
/** Utility interface encapsulates a rectangle */
export interface Rectangle {
    x: number
    y: number
    width: number
    height: number
}

/**
 * Checks whether two rectangle-like objects intersect
 * (each object must have x, y, width, and height)
 */
export function rectsIntersect(r1: Rectangle, r2: Rectangle) {
    return r1 != null && r2 != null && !(
        r1.x + r1.width / 2 <= r2.x - r2.width / 2 ||
        r1.x - r1.width / 2 >= r2.x + r2.width / 2 ||
        r1.y + r1.height / 2 <= r2.y - r2.height / 2 ||
        r1.y - r1.height / 2 >= r2.y + r2.height / 2
    )
}