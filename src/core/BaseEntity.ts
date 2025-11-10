import { EntitySnapshot } from '../game/state/GameState';

export interface EntityProps<TState extends EntitySnapshot> {
  state: TState;
}

/**
 * Rendering-agnostic base class shared by the simulation on both client
 * and server. Subclasses mutate their internal state during `update`.
 */
export abstract class BaseEntity<TState extends EntitySnapshot> {
  protected state: TState;

  constructor(props: EntityProps<TState>) {
    this.state = props.state;
  }

  get id() {
    return this.state.id;
  }

  getSnapshot(): TState {
    return this.state;
  }

  protected patchState(patch: Partial<TState>) {
    this.state = { ...this.state, ...patch } as TState;
  }

  update(_deltaMs: number): void {
    // Default entities are static.
  }
}
