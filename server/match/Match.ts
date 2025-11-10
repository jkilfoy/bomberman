import type { Server } from 'socket.io';
import { GameEngine, GameEngineOptions } from '../../src/game/GameEngine';
import { GameMode } from '../../src/core/GameConfig';
import type { LobbyEntry } from '../lobby/LobbyManager';
import { PlayerInputMessage, GameUpdateMessage } from '../../src/game/net/types';
import { GameStateSnapshot } from '../../src/game/state/GameState';

const MATCH_TICK_INTERVAL = 1000 / 60;
const MATCH_DURATION_MS = 2 * 60 * 1000;

/**
 * Class representing a game match. Handles game state, player inputs, and communication with clients.
 */
export class Match {
  private engine: GameEngine;

  // This handles the match tick updates
  private tickHandle?: NodeJS.Timeout;

  // Maps socket IDs to their input handlers for easy removal on match end
  private socketHandlers = new Map<string, { input: (msg: PlayerInputMessage) => void; disconnect: () => void }>();
  private startTime = Date.now();
  private finished = false;

  constructor(
    private readonly io: Server,
    private readonly id: string,
    private readonly players: LobbyEntry[],
    private readonly onEnded?: (matchId: string) => void,
  ) {
    this.engine = new GameEngine(this.buildOptions(players));
    this.attachSockets();
    this.sendInitialSnapshot();
    this.startTickLoop();
  }

  private buildOptions(players: LobbyEntry[]): GameEngineOptions {
    return {
      config: {
        mode: GameMode.arena,
        gridWidth: 13,        // todo : fix magic constants
        gridHeight: 11,
        cellSize: 64,
        tickIntervalMs: MATCH_TICK_INTERVAL,
      },
      initialPlayers: players.map((entry, idx) => ({
        id: entry.playerId,
        characterKey: entry.characterKey,
        name: entry.playerId,
        spawn: { col: idx % 2 === 0 ? 0 : 12, row: idx < 2 ? 0 : 10 },   // todo : move magic logic
      })),
    };
  }

  /**
   * Attaches socket event listeners for player inputs.
   */
  private attachSockets() {
    this.players.forEach((entry) => {
      if (!entry.socket) {
        console.error('Socket does not exist on player: ', entry, this);
        return;
      } 
      entry.socket.join(this.roomName);
      const inputHandler = (message: PlayerInputMessage) => {
        if (message.playerId !== entry.playerId) return;
        this.engine.enqueueInput(message.input);
      };
      const disconnectHandler = () => this.onPlayerDisconnect(entry.playerId);
      this.socketHandlers.set(entry.socket.id, { input: inputHandler, disconnect: disconnectHandler });
      entry.socket.on('player:input', inputHandler);
      entry.socket.once('disconnect', disconnectHandler);
    });
  }

  private sendInitialSnapshot() {
    const snapshot = this.engine.getSnapshot();
    const update: GameUpdateMessage = {
      tick: snapshot.tick,
      timestamp: snapshot.timestamp,
      fullSnapshot: true,
      snapshot,
    };
    this.io.to(this.roomName).emit('game:update', update);
  }

  private get roomName() {
    return `match:${this.id}`;
  }

  // Main Match tick loop
  // Starts the game tick loop. This advances the engine and sends updates to clients at each tick.
  private startTickLoop() {
    this.tickHandle = setInterval(() => {
      this.engine.advance();
      const delta = this.engine.getSnapshotDelta();
      if (delta == null) return;
      const snapshot = this.engine.getSnapshot();
      const update: GameUpdateMessage = {
        tick: snapshot.tick,
        timestamp: snapshot.timestamp,
        delta,
      };
      this.io.to(this.roomName).emit('game:update', update);
      this.evaluateEndConditions(snapshot);
    }, MATCH_TICK_INTERVAL);
  }

  private evaluateEndConditions(snapshot: GameStateSnapshot) {
    const alivePlayers = Object.values(snapshot.players).filter((p) => p.alive).length;
    if (alivePlayers <= 1) {
      this.endMatch(alivePlayers === 1 ? 'winner' : 'all-dead');
      return;
    }

    const elapsed = Date.now() - this.startTime;
    if (elapsed >= MATCH_DURATION_MS) {
      this.endMatch('timeout');
    }
  }

  private onPlayerDisconnect(playerId: string) {
    this.engine.removePlayer(playerId);
    const snapshot = this.engine.getSnapshot();
    this.evaluateEndConditions(snapshot);
  }


  // Ends the match, cleans up resources, and notifies clients. 
  endMatch(reason: string) {
    if (this.finished) return;
    this.finished = true;
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.io.to(this.roomName).emit('match:end', { matchId: this.id, reason });
    this.players.forEach((entry) => {
      if (!entry.socket) return;
      const handlers = this.socketHandlers.get(entry.socket.id);
      if (handlers) {
        entry.socket.off('player:input', handlers.input);
        entry.socket.off('disconnect', handlers.disconnect);
      }
      entry.socket.leave(this.roomName);
    });
    this.socketHandlers.clear();
    this.onEnded?.(this.id);
    console.log(`[Match.endMatch] Match ${this.id} ended: ${reason}`);
  }
}
