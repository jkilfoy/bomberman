import { BaseEntity, EntityProps } from '../../core/BaseEntity';
import { GridSystem, WorldCoordinate } from '../../core/GridSystem';
import { PlayerSnapshot } from '../state/GameState';
import { Direction, directionToVector } from '../utils/direction';

export interface PlayerEntityProps extends EntityProps<PlayerSnapshot> {
  grid: GridSystem;
}

export class PlayerEntity extends BaseEntity<PlayerSnapshot> {
  private grid: GridSystem;
  private movementIntent: Direction = Direction.NONE;
  private ignoredBombId?: string | undefined;
  private invincibilityTimer = 0;
  private readonly invincibilityDuration = 1000;

  constructor(props: PlayerEntityProps) {
    super(props);
    this.grid = props.grid;
  }

  setMovementIntent(direction: Direction) {
    this.movementIntent = direction;
  }

  clearMovementIntent() {
    this.movementIntent = Direction.NONE;
  }

  canDropBomb() {
    return this.state.activeBombs < this.state.bombLimit && this.state.alive;
  }

  onBombPlaced(bombId: string) {
    this.patchState({ activeBombs: this.state.activeBombs + 1 });
    this.ignoredBombId = bombId;
  }

  onBombDetonated(bombId: string) {
    this.patchState({ activeBombs: Math.max(0, this.state.activeBombs - 1) });
    if (this.ignoredBombId === bombId) {
      this.ignoredBombId = undefined;
    }
  }

  setAlive(alive: boolean) {
    this.patchState({ alive });
  }

  isIgnoringBomb(bombId: string) {
    return this.ignoredBombId === bombId;
  }

  getIgnoredBombId() {
    return this.ignoredBombId;
  }

  clearIgnoredBomb() {
    this.ignoredBombId = undefined;
  }

  update(deltaMs: number) {
    if (this.invincibilityTimer > 0) {
      this.invincibilityTimer = Math.max(0, this.invincibilityTimer - deltaMs);
      if (this.invincibilityTimer === 0 && this.state.status.invincible) {
        this.updateStatus({ invincible: false });
      }
    }

    if (!this.state.alive) {
      return;
    }

    const movement = directionToVector(this.movementIntent);
    if (movement.x === 0 && movement.y === 0) {
      if (this.state.velocity.x !== 0 || this.state.velocity.y !== 0) {
        this.patchState({ velocity: { x: 0, y: 0 } });
      }
      return;
    }

    const distance = (deltaMs / 1000) * this.state.speed;
    const worldPosition = {
      x: this.state.worldPosition.x + movement.x * distance,
      y: this.state.worldPosition.y + movement.y * distance,
    };

    const clamped = this.grid.clampWorldPosition(worldPosition, this.state.hitbox);

    this.patchState({
      worldPosition: clamped,
      gridPosition: this.grid.worldToGrid(clamped),
      velocity: { x: movement.x * this.state.speed, y: movement.y * this.state.speed },
      facing: this.movementIntent,
    });
  }

  setWorldPosition(worldPosition: WorldCoordinate) {
    const clamped = this.grid.clampWorldPosition(worldPosition, this.state.hitbox);
    this.patchState({
      worldPosition: clamped,
      gridPosition: this.grid.worldToGrid(clamped),
    });
  }


  // =======================
  // Apply Powerups
  // =======================
  
  applySpeedBoost(amount: number) {
    this.patchState({ speed: this.state.speed + amount });
  }

  applyBombLimitIncrease(amount: number) {
    this.patchState({ bombLimit: this.state.bombLimit + amount });
  }

  applyExplosionRangeIncrease(amount: number) {
    this.patchState({ explosionRange: this.state.explosionRange + amount });
  }

  public grantShield() {
    if (this.state.status.shielded) return;
    this.updateStatus({ shielded: true });
  }

  applyDamage(): boolean {
    if (!this.state.alive) return false;
    if (this.state.status.invincible) return false;

    if (this.state.status.shielded) {
      this.consumeShield();
      return false;
    }

    this.setAlive(false);
    return true;
  }

  private consumeShield() {
    this.updateStatus({ shielded: false });
    this.invincibilityTimer = this.invincibilityDuration;
    this.updateStatus({ invincible: true });
  }

  private updateStatus(partial: Partial<PlayerSnapshot['status']>) {
    this.patchState({
      status: {
        ...this.state.status,
        ...partial,
      },
    });
  }
}
