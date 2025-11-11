import { io, Socket } from 'socket.io-client';
import { GameInterface, GameStateListener } from '../GameInterface';
import { GameEngine, GameEngineOptions } from '../GameEngine';
import { GameStateSnapshot } from '../state/GameState';
import { PlayerInput } from '../state/PlayerInput';
import { PlayerInputMessage, GameUpdateMessage } from '../net/types';

interface PredictionEntry {
  tick: number;
  input: PlayerInput;
}

interface ServerBackedOptions {
  socketUrl: string;
  socket?: Socket;
  playerId: string;
  matchId?: string;
  engineOptions: GameEngineOptions;
  smoothingThreshold?: number;
  smoothingFactor?: number; // 0..1
  onMatchEnd?: (payload: { matchId: string; reason: string }) => void;
}

export class ServerBackedGameInterface implements GameInterface {
  private socket: Socket | null = null;
  private ownsSocket = false;
  private engine: GameEngine;
  private latestAuthoritativeSnapshot: GameStateSnapshot | null = null;
  private listeners = new Set<GameStateListener>();
  private predictionBuffer: PredictionEntry[] = [];
  private currentTick = 0;
  private connected = false;
  private localSnapshot: GameStateSnapshot | null = null;

  private readonly smoothingThreshold: number;
  private readonly smoothingFactor: number;

  constructor(private readonly options: ServerBackedOptions, private initialSnapshot?: GameStateSnapshot) {
    this.engine = new GameEngine(options.engineOptions);
    this.latestAuthoritativeSnapshot = initialSnapshot || null;
    this.localSnapshot = initialSnapshot || null;
    this.smoothingThreshold = options.smoothingThreshold ?? 12;
    this.smoothingFactor = options.smoothingFactor ?? 0.2;
    this.setupSocket();
  }

  /**
   * Sets up the socket connection and event listeners for receiving game updates
   */
  private setupSocket() {
    if (this.options.socket) {
      this.connected = true;
      this.socket = this.options.socket;
    } else {
      this.socket = io(this.options.socketUrl, {
        transports: ['websocket'],
      });
      this.ownsSocket = true;
    }

    this.socket.on('connect', () => {
      this.connected = true;
      this.socket?.emit('match:join', { matchId: this.options.matchId, playerId: this.options.playerId });
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this.predictionBuffer = [];
    });

    this.socket.on('game:update', (message: GameUpdateMessage) => {
      console.log("Handling game update message:", message);
      this.handleGameUpdate(message);
    });
    
    this.socket.on('match:end', (payload: { matchId: string; reason: string }) => {
      if (this.options.matchId && payload.matchId !== this.options.matchId) return;
      this.options.onMatchEnd?.(payload);
    });
  }

  private handleGameUpdate(message: GameUpdateMessage) {
    if (message.fullSnapshot && message.snapshot) {
      this.latestAuthoritativeSnapshot = message.snapshot;
      this.engine.loadSnapshot(message.snapshot);
      this.localSnapshot = message.snapshot;
      this.predictionBuffer = [];
      this.emitSnapshot();
      return;
    }

    if (!this.latestAuthoritativeSnapshot || !message.delta) return;

    this.latestAuthoritativeSnapshot = GameEngine.applySnapshotDelta(
      this.latestAuthoritativeSnapshot,
      message.delta,
    );

    this.engine.loadSnapshot(this.latestAuthoritativeSnapshot);
    this.replayPredictedInputs(message.tick);
    this.correctPrediction();
    this.emitSnapshot();
  }

  private replayPredictedInputs(serverTick: number) {
    if (!this.latestAuthoritativeSnapshot) return;
    this.engine.loadSnapshot(this.latestAuthoritativeSnapshot);
    const pendingInputs = this.predictionBuffer.filter((entry) => entry.tick > serverTick);
    this.predictionBuffer = pendingInputs;
    pendingInputs.forEach((entry) => {
      this.engine.enqueueInput(entry.input);
    });
    this.engine.advance();
    this.localSnapshot = this.engine.getSnapshot();
  }

  private correctPrediction() {
    if (!this.latestAuthoritativeSnapshot || !this.localSnapshot) return;

    const corrected = { ...this.localSnapshot, players: { ...this.localSnapshot.players } };
    Object.entries(corrected.players).forEach(([id, player]) => {
      const authoritative = this.latestAuthoritativeSnapshot!.players[id];
      if (!authoritative) return;
      const dx = authoritative.worldPosition.x - player.worldPosition.x;
      const dy = authoritative.worldPosition.y - player.worldPosition.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq > this.smoothingThreshold * this.smoothingThreshold) {
        player.worldPosition = { ...authoritative.worldPosition };
      } else {
        player.worldPosition = {
          x: player.worldPosition.x + dx * this.smoothingFactor,
          y: player.worldPosition.y + dy * this.smoothingFactor,
        };
      }
    });

    this.localSnapshot = corrected;
  }

  private emitSnapshot() {
    if (!this.localSnapshot) return;
    this.listeners.forEach((listener) => listener(this.localSnapshot!));
  }

  getCurrentState(): GameStateSnapshot {
    if (this.localSnapshot) return this.localSnapshot;
    return this.engine.getSnapshot();
  }

  subscribeUpdates(listener: GameStateListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  enqueueInput(input: PlayerInput) {
    console.log("Enqueueing input locally:", input);
    const tick = ++this.currentTick;
    this.engine.enqueueInput(input);
    this.predictionBuffer.push({ tick, input });
    this.localSnapshot = this.engine.getSnapshot();
    this.emitSnapshot();

    if (this.socket && this.connected) {
      console.log("Enqueuing input:", input);
      const message: PlayerInputMessage = {
        playerId: this.options.playerId,
        input,
        tick,
        sentAt: Date.now(),
      };
      console.log("message: " , message);
      this.socket.emit('player:input', { ...message, matchId: this.options.matchId });
    }
  }

  applyInput(input: PlayerInput) {
    this.enqueueInput(input);
  }

  destroy() {
    if (this.ownsSocket) {
      this.socket?.disconnect();
    }
    this.listeners.clear();
  }
}
