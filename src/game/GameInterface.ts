import { GameStateSnapshot } from './state/GameState';
import { PlayerInput } from './state/PlayerInput';

export type GameStateListener = (state: GameStateSnapshot) => void;

export interface GameInterface {
  getCurrentState(): GameStateSnapshot;
  subscribeUpdates(listener: GameStateListener): () => void;
  enqueueInput(input: PlayerInput): void;
  applyInput(input: PlayerInput): void;
  advance?(deltaMs: number): void;
}
