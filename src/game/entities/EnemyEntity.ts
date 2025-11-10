import { BaseEntity, EntityProps } from '../../core/BaseEntity';
import { GridSystem, WorldCoordinate } from '../../core/GridSystem';
import { EnemySnapshot } from '../state/GameState';

export interface EnemyEntityProps extends EntityProps<EnemySnapshot> {
  grid: GridSystem;
}

export class EnemyEntity extends BaseEntity<EnemySnapshot> {
  private grid: GridSystem;

  constructor(props: EnemyEntityProps) {
    super(props);
    this.grid = props.grid;
  }

  update(deltaMs: number) {
    // TODO: reintroduce AI logic.
    super.update(deltaMs);
  }

  setAlive(alive: boolean) {
    this.patchState({ alive });
  }

  setWorldPosition(worldPosition: WorldCoordinate) {
    const clamped = this.grid.clampWorldPosition(worldPosition, this.state.hitbox);
    this.patchState({
      worldPosition: clamped,
      gridPosition: this.grid.worldToGrid(clamped),
    });
  }
}
