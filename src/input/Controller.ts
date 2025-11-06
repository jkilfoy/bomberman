export interface Controller {
  left: { isDown(): boolean }
  right: { isDown(): boolean }
  up: { isDown(): boolean }
  down: { isDown(): boolean }
  bomb: { justPressed(): boolean }
}