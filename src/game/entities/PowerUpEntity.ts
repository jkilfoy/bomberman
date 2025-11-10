import { BaseEntity, EntityProps } from '../../core/BaseEntity';
import { PowerUpSnapshot } from '../state/GameState';

export class PowerUpEntity extends BaseEntity<PowerUpSnapshot> {
  constructor(props: EntityProps<PowerUpSnapshot>) {
    super(props);
  }

  consume() {
    this.patchState({ available: false });
  }
}
