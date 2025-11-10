import { BaseEntity, EntityProps } from '../../core/BaseEntity';
import { ExplosionSnapshot } from '../state/GameState';

export class ExplosionEntity extends BaseEntity<ExplosionSnapshot> {
  constructor(props: EntityProps<ExplosionSnapshot>) {
    super(props);
  }

  update(deltaMs: number) {
    this.patchState({ expiresAt: this.state.expiresAt - deltaMs });
  }

  isExpired() {
    return this.state.expiresAt <= 0;
  }

  deactivate() {
    if (this.state.lethal) {
      this.patchState({ lethal: false });
    }
  }
}
