import { GameEngine, GameEngineOptions } from '../GameEngine';
import { GameInterface, GameStateListener } from '../GameInterface';
import { GameStateSnapshot } from '../state/GameState';
import { PlayerInput } from '../state/PlayerInput';

export class LocalGameInterface implements GameInterface {
  private engine: GameEngine;
  private snapshot: GameStateSnapshot;
  private listeners = new Set<GameStateListener>();

  constructor(options: GameEngineOptions) {
    this.engine = new GameEngine(options);
    this.snapshot = this.engine.getSnapshot();
  }

  getCurrentState(): GameStateSnapshot {
    return this.snapshot;
  }

  subscribeUpdates(listener: GameStateListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  enqueueInput(input: PlayerInput) {
    this.engine.enqueueInput(input);
  }

  applyInput(input: PlayerInput) {
    this.enqueueInput(input);
  }

  advance(deltaMs?: number) {
    this.engine.advance(deltaMs);
    this.snapshot = this.engine.getSnapshot();
    this.emit();
  }

  private emit() {
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
}
