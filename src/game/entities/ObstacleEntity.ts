import { BaseEntity, EntityProps } from '../../core/BaseEntity';
import { ObstacleSnapshot } from '../state/GameState';

export class ObstacleEntity extends BaseEntity<ObstacleSnapshot> {
  constructor(props: EntityProps<ObstacleSnapshot>) {
    super(props);
  }
}
