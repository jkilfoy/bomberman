import type { Server, Socket } from 'socket.io';
import { GameEngine, GameEngineOptions } from '../../src/game/GameEngine';
import { GameMode } from '../../src/core/GameConfig';
import type { LobbyEntry } from '../lobby/LobbyManager';
import { PlayerInputMessage, GameUpdateMessage } from '../../src/game/net/types';
import { GameStateSnapshot } from '../../src/game/state/GameState';
import { getSpawnForIndex } from './spawnPositions';
import type { MatchPlayerInfo } from './types';

const MATCH_TICK_INTERVAL = 1000 / 60;
const MATCH_DURATION_MS = 2 * 60 * 1000;

/**
 * Class representing a game match. Handles game state, player inputs, and communication with clients.
 */
export class Match {
  private engine: GameEngine;

  private initialSnapshotSent = false;

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
    private readonly roster: MatchPlayerInfo[],
    private readonly onEnded?: (matchId: string) => void,
  ) {
    this.engine = new GameEngine(this.buildOptions());
    this.attachSockets();
    this.startTickLoop();
  }

  private buildOptions(): GameEngineOptions {
    return {
      config: {
        mode: GameMode.arena,
        gridWidth: 13,        // todo : fix magic constants
        gridHeight: 11,
        cellSize: 64,
        tickIntervalMs: MATCH_TICK_INTERVAL,
      },
      initialPlayers: this.roster.map((player) => ({
        id: player.playerId,
        characterKey: player.characterKey,
        name: player.name,
        spawn: player.spawn,
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
      this.registerSocket(entry.playerId, entry.socket, false);
    });
  }

  /**
   * Registers a socket for a player to handle input messages.
   */
  registerSocket(playerId: string, socket: Socket, sendSnapshot = true) {
    socket.join(this.roomName);
    const inputHandler = (message: PlayerInputMessage) => {
      if (message.playerId !== playerId) return;
      this.engine.enqueueInput(message.input);
    };
    const disconnectHandler = () => this.onPlayerDisconnect(playerId);
    this.socketHandlers.set(socket.id, { input: inputHandler, disconnect: disconnectHandler });
    socket.on('player:input', inputHandler);
    socket.once('disconnect', disconnectHandler);

    this.sendInitialSnapshot(playerId, socket);
  }

  private sendInitialSnapshot(playerId: string, socket: Socket) {
    socket.emit('match:start', { 
        matchId: this.id, 
        playerId: playerId, 
        roster: this.roster,
        initialSnapshot: this.engine.getSnapshot()
      });

    this.initialSnapshotSent = true;
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
      if (!this.initialSnapshotSent) return;
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

  forwardInput(message: PlayerInputMessage & { matchId?: string }) {
    const player = this.players.find((entry) => entry.playerId === message.playerId);
    if (!player) return;
    this.engine.enqueueInput(message.input);
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
