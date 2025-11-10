import { BaseEntity, EntityProps } from '../../core/BaseEntity';
import { BombSnapshot } from '../state/GameState';

export class BombEntity extends BaseEntity<BombSnapshot> {
  constructor(props: EntityProps<BombSnapshot>) {
    super(props);
  }

  update(deltaMs: number) {
    if (this.state.detonated) return;

    const fuse = this.state.fuse - deltaMs;
    this.patchState({ fuse });
  }

  shouldDetonate() {
    return !this.state.detonated && this.state.fuse <= 0;
  }

  markDetonated() {
    if (!this.state.detonated) {
      this.patchState({ detonated: true, fuse: 0 });
    }
  }
}
