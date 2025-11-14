import type { Server, Socket } from 'socket.io';
import { GameMode } from '../../src/core/GameConfig';
import { GameEngine, GameEngineOptions } from '../../src/game/GameEngine';
import { GameUpdateMessage, PlayerInputMessage } from '../../src/game/net/types';
import { GameStateSnapshot } from '../../src/game/state/GameState';
import type { LobbyEntry } from '../lobby/LobbyManager';
import type { MatchPlayerInfo } from './types';

import { MinPriorityQueue } from '@datastructures-js/priority-queue';
import { Direction } from '../../src/game/utils/direction';


interface PlayerInputBuffer {
  lastProcessedSeq: number;
  pendingInputs: MinPriorityQueue<ReceivedPlayerInputMessage>;
}

interface ReceivedPlayerInputMessage extends PlayerInputMessage {
  receivedAt: number;
}

const MATCH_TICK_INTERVAL = 1000 / 60;
const MATCH_DURATION_MS = 2 * 60 * 1000;
const INPUT_TIMEOUT_MS = 100; // Time to wait before skipping missing inputs

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

  // Keep a buffer of each player's inputs in case they come in the wrong order
  // Keyed by playerId
  private playerInputBuffers: Record<string, PlayerInputBuffer> = {};

  constructor(
    private readonly io: Server,
    private readonly id: string,
    private readonly players: LobbyEntry[],
    private readonly roster: MatchPlayerInfo[],
    private readonly onEnded?: (matchId: string) => void,
  ) {
    this.engine = new GameEngine(this.buildOptions());
    this.setupPlayerInputBuffers();
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

  private setupPlayerInputBuffers() {
    this.players.forEach((entry) => { // todo : verify this exists 
      this.playerInputBuffers[entry.playerId] = {
        lastProcessedSeq: 0,
        pendingInputs: new MinPriorityQueue<ReceivedPlayerInputMessage>(
          (msg) => msg.sequence
        )
      };
    });
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
    const inputHandler = (msg: PlayerInputMessage) => this.onPlayerInput(msg);
    const disconnectHandler = () => this.onPlayerDisconnect(playerId);
    this.socketHandlers.set(socket.id, { input: inputHandler, disconnect: disconnectHandler });
    socket.on('player:input', inputHandler);
    socket.once('disconnect', disconnectHandler);

    this.sendInitialSnapshot(playerId, socket);
  }


  /** Handles incoming player input messages */
  onPlayerInput(msg: PlayerInputMessage) {
    const { playerId, sequence, input } = msg;
    const buffer = this.playerInputBuffers[playerId];

    // Tag message with received timestamp
    const receivedMsg: ReceivedPlayerInputMessage = {
      ...msg,
      receivedAt: Date.now(),
    };

    // Drop inputs earlier than the last processed input
    if (sequence <= buffer.lastProcessedSeq) return;

    // If later inputs arrive first, buffer them
    if (sequence > buffer.lastProcessedSeq + 1) {
      buffer.pendingInputs.enqueue(receivedMsg);
      console.debug(`Buffered input seq=${sequence} (missing ${buffer.lastProcessedSeq + 1}–${sequence - 1})`);
      return;
    }

    // Otherwise, process immediately
    this.processInput(receivedMsg);

    // Process buffered inputs in case any can now be applied
    this.processBufferedInputs(playerId);
  }


  /** Processes any buffered inputs for a player */
  processBufferedInputs(playerId: string) {
    const buffer = this.playerInputBuffers[playerId];

    // Sanity check: Make sure queue contains no old inputs
    let front = buffer.pendingInputs.front();
    while (front && front.sequence <= buffer.lastProcessedSeq) {
      buffer.pendingInputs.dequeue();
      front = buffer.pendingInputs.front();
    }

    // Process any buffered inputs that immediately follow the last processed input
    while (front && front.sequence === buffer.lastProcessedSeq + 1) {
      const nextInput = buffer.pendingInputs.dequeue()!;
      this.processInput(nextInput);
      front = buffer.pendingInputs.front();
    }
  }

  /** Passes player input to the game engine */
  processInput(inputMsg: ReceivedPlayerInputMessage) {
    
    // Pass the input to the game engine
    this.engine.enqueueInput(inputMsg.input); // todo error handling ?

    // Update the last processed sequence for this player
    const buffer = this.playerInputBuffers[inputMsg.playerId];
    buffer.lastProcessedSeq = inputMsg.sequence; 
  }


  /**
   * Player input can be stalled if packets are received out of order or simply lost.
   * After a certain amount of time, we should stop waiting for missing inputs and process
   * the next available ones, simulating no-op inputs for the missing sequences.
   */
  resolveStalledPlayerInputs() {
    const now = Date.now();

    Object.entries(this.playerInputBuffers).forEach(([playerId, buffer]) => {
      
      const { lastProcessedSeq, pendingInputs } = buffer;

      // Move to next player if there are no pending inputs
      if (pendingInputs.isEmpty()) return;

      // Get the earliest unresolved buffered input
      const oldestBuffered = pendingInputs.front()!;

      // If it is too old, simulate no-op inputs for the missing sequences then resolve it
      const age = now - oldestBuffered.receivedAt;
      if (age > INPUT_TIMEOUT_MS) {
        
        for (let seq = lastProcessedSeq + 1; seq < oldestBuffered.sequence; seq++) {
          this.processInput(this.makeNoOpInput(playerId, seq, now));
        }

        this.processBufferedInputs(playerId);
      }
    })
  }

  makeNoOpInput(playerId: string, seq: number, now: number): ReceivedPlayerInputMessage {
    return {
      playerId,
      sequence: seq,
      sentAt: 0,
      receivedAt: now,
      input: {
        playerId,
        direction: Direction.NONE,
        bomb: false,
      },
      
    };
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

      // Process buffered inputs for all players before advancing
      this.resolveStalledPlayerInputs()

      // Advance the game engine
      this.engine.advance();

      // Get the snapshot delta and send to clients
      const delta = this.engine.getSnapshotDelta();

      if (delta == null) return;
      if (!this.initialSnapshotSent) return;  // todo : why is this guard here?

      const snapshot = this.engine.getSnapshot();
      const update: GameUpdateMessage = {
        tick: snapshot.tick,
        timestamp: snapshot.timestamp,
        delta,
        playerInputSequence: this.getCurrentPlayerInputSequences()
      };

      this.io.to(this.roomName).emit('game:update', update);
      this.evaluateEndConditions(snapshot);
    
    }, MATCH_TICK_INTERVAL);
  }

  getCurrentPlayerInputSequences(): Record<string, number> {
    const sequences: Record<string, number> = {};
    for (const playerId in this.playerInputBuffers) { // todo : loop syntax?
      sequences[playerId] = this.playerInputBuffers[playerId].lastProcessedSeq;
    }
    return sequences;
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