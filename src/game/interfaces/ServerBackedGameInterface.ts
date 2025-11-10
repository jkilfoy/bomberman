import { GameInterface, GameStateListener } from '../GameInterface';
import { GameStateSnapshot } from '../state/GameState';
import { PlayerInput } from '../state/PlayerInput';

/**
 * Placeholder server-backed implementation. The networking layer will plug in
 * Socket.IO (or similar) to stream authoritative state snapshots.
 */
export class ServerBackedGameInterface implements GameInterface {
  constructor(
    private readonly socketFactory: () => Promise<any>,
  ) {}

  getCurrentState(): GameStateSnapshot {
    throw new Error('ServerBackedGameInterface not connected yet.');
  }

  subscribeUpdates(_listener: GameStateListener) {
    // TODO: wire up to socket events and return unsubscribe handler.
    return () => {};
  }

  enqueueInput(_input: PlayerInput) {
    // TODO: send input to server once sockets are available.
  }

  applyInput(input: PlayerInput) {
    this.enqueueInput(input);
  }
}
