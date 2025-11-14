import { io, Socket } from 'socket.io-client';
import { GameInterface, GameStateListener } from '../GameInterface';
import { GameEngine, GameEngineOptions } from '../GameEngine';
import { GameStateSnapshot } from '../state/GameState';
import { PlayerInput } from '../state/PlayerInput';
import { PlayerInputMessage, GameUpdateMessage, GameDelta } from '../net/types';

/**
 * Client-side prediction + server reconciliation implementation.
 *
 * Goals of this refactor:
 *  - Clear separation of concerns (networking, prediction, reconciliation, state exposure)
 *  - Remove redundant state and dead code
 *  - Safer snapshot handling (immutability)
 *  - Basic tick reconciliation and a small hold-back buffer to smooth jitter
 */

// ---- Types ---------------------------------------------------------------

interface PlayerInputEntry {
  sequence: number;     // sequence number of this input
  input: PlayerInput;
}

export interface SmoothingConfig {
  /** Squared distance threshold at which we snap (in pixels). */
  threshold: number; // pixels
  /** Lerp factor applied when within threshold, 0..1. */
  factor: number; // 0..1
}

interface ServerBackedOptions {
  socketUrl: string;
  socket?: Socket;
  playerId: string;
  matchId?: string;
  engineOptions: GameEngineOptions;
  /** Optional visual smoothing for small divergences. */
  smoothing?: Partial<SmoothingConfig>;
  /** How long to delay applying server snapshots (ms) to reduce visible jitter. */
  holdBackMs?: number; // default ~100ms
  /** Callback when the match ends on the server. */
  onMatchEnd?: (payload: { matchId: string; reason: string }) => void;
}

// ---- Helpers -------------------------------------------------------------

const DEFAULT_SMOOTHING: SmoothingConfig = {
  threshold: 12, // pixels
  factor: 0.2,
};

function deepClone<T>(v: T): T {
  // Use structuredClone when available
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (typeof structuredClone === 'function') return structuredClone(v);
  return JSON.parse(JSON.stringify(v));
}

// ---- Implementation ------------------------------------------------------

export class ServerBackedGameInterface implements GameInterface {
  // Networking
  private socket: Socket | null = null;
  private ownsSocket = false;

  // Local game engine used for simulation when server updates are pending
  private readonly engine: GameEngine;

  // the predicted/smoothed local state that is currently rendered
  private localSnapshot: GameStateSnapshot | null = null;
  
  // the last authoritative snapshot received from server
  private serverSnapshot: GameStateSnapshot | null = null;

  // Prediction
  private playerInputBuffer: PlayerInputEntry[] = []; // inputs sent but not yet acknowledged by server
  private currentInputSeq = 0; // client-side sequence counter for inputs
  private lastAcknowledgedInputSeq = 0; // last player input sequence acknowledged by server

  // Listeners (GameScene)
  private listeners = new Set<GameStateListener>();

  // Smoothing / buffering
  private readonly smoothing: SmoothingConfig;
  private readonly holdBackMs: number;

  // Queue of incoming snapshots to be applied after hold-back
  // All snapshots in queue are full snapshots (deltas have been applied already)
  private readonly pendingSnapshotQueue: { 
    pendingSnapshot: GameStateSnapshot; 
    receivedAt: number;
    lastAcknowledgedInputSeq: number;
  }[] = [];

  constructor(private readonly options: ServerBackedOptions, initialSnapshot?: GameStateSnapshot) {
    this.engine = new GameEngine(options.engineOptions);
    this.smoothing = { ...DEFAULT_SMOOTHING, ...options.smoothing } as SmoothingConfig;
    this.holdBackMs = options.holdBackMs ?? 0;  // revisit smoothing

    if (initialSnapshot) {
      this.serverSnapshot = initialSnapshot;
      this.engine.loadSnapshot(initialSnapshot);
      this.localSnapshot = initialSnapshot;
    }

    this.setupSocket();
  }



  // ---- Networking --------------------------------------------------------

  private setupSocket() {
    if (this.options.socket) {
      this.socket = this.options.socket;
    } else {
      this.socket = io(this.options.socketUrl, { transports: ['websocket'] });
      this.ownsSocket = true;
    }

    // Guard if socket creation fails
    if (!this.socket) {
      console.error('Failed to create socket connection');
      return;
    }

    this.socket.on('connect', () => {
      this.socket?.emit('match:join', {
        matchId: this.options.matchId,
        playerId: this.options.playerId,
      });
    });

    this.socket.on('disconnect', () => {
      // Clearing predictions avoids replaying stale inputs after reconnect
      this.playerInputBuffer = [];
    });

    this.socket.on('game:update', (message: GameUpdateMessage) => {
      this.onGameUpdate(message);
    });

    this.socket.on('match:end', (payload: { matchId: string; reason: string }) => {
      if (this.options.matchId && payload.matchId !== this.options.matchId) return;
      this.options.onMatchEnd?.(payload);
    });
  }



  // ---- Incoming server updates ------------------------------------------

  private onGameUpdate(message: GameUpdateMessage) {
    const currInputSeq = message.playerInputSequence[this.options.playerId] || this.lastAcknowledgedInputSeq;
    
    // If the update contains a complete snapshot, enqueue the full snapshot
    if (message.fullSnapshot && message.snapshot) {
      this.pendingSnapshotQueue.push({ 
        pendingSnapshot: message.snapshot, 
        receivedAt: performance.now(),
        lastAcknowledgedInputSeq: currInputSeq
      });
      return;
    }

    // If initial snapshot or delta is missing, nothing to apply
    if (!message.delta) {
      console.warn('[ServerBackedGameInterface.onGameUpdate] Delta is missing.');
      return;
    }

    // Otherwise, apply delta to existing authoritative snapshot if it exists
    const merged = this.applyDeltaSnapshot(message.delta, message.tick, message.timestamp);
    if (!merged) {
      console.warn('[ServerBackedGameInterface.onGameUpdate] No existing server snapshot to apply delta to. Skipping update.');
      return;
    }

    this.pendingSnapshotQueue.push({ 
      pendingSnapshot: merged, 
      receivedAt: performance.now(),
      lastAcknowledgedInputSeq: currInputSeq,
    });
  }

  // Apply the next snapshot from the queue whose receivedAt is older than holdBackMs
  private applyPendingServerSnapshots() {
    if (this.pendingSnapshotQueue.length === 0) return;
    const cutoff = performance.now() - this.holdBackMs;

    // Find the latest snapshot that is older than cutoff
    let index = -1;
    for (let i = 0; i < this.pendingSnapshotQueue.length; i++) {
      if (this.pendingSnapshotQueue[i].receivedAt <= cutoff) index = i;
      else break; // queue is chronological
    }
    if (index < 0) return; // nothing ready yet

    const { pendingSnapshot, lastAcknowledgedInputSeq } = this.pendingSnapshotQueue[index];
    // Drop all older-or-equal queued items
    this.pendingSnapshotQueue.splice(0, index + 1);

    // Only handle this snapshot if it's newer than what we already have
    if (this.serverSnapshot && this.serverSnapshot.tick >= pendingSnapshot.tick) {  
      return;
    }

    // If we have no prior state, or the new tick is 0, apply full snapshot
    if (!this.serverSnapshot || pendingSnapshot.tick === 0) { // todo : handle bug
      this.resetToAuthoritativeState(pendingSnapshot, lastAcknowledgedInputSeq);
      return;
    }

    // Otherwise reconcile local state with the server's state
    this.reconcileWithServerState(pendingSnapshot, lastAcknowledgedInputSeq);
  }

  /** Resets local state to match the server snapshot */
  private resetToAuthoritativeState(snapshot: GameStateSnapshot, lastAcknowledgedInputSeq: number) {
    this.serverSnapshot = snapshot;
    this.lastAcknowledgedInputSeq = lastAcknowledgedInputSeq;
    this.engine.loadSnapshot(snapshot);
    this.playerInputBuffer = [];
    // Replace local snapshot immediately to avoid showing stale state
    this.setLocalSnapshot(snapshot);
  }

  /** Applies a reconciliation step between the local and server state */
  private reconcileWithServerState(snapshot: GameStateSnapshot, lastAcknowledgedInputSeq: number) {
    // Treat as authoritative base, then replay predictions newer than server tick
    this.serverSnapshot = snapshot;
    this.lastAcknowledgedInputSeq = lastAcknowledgedInputSeq;
    this.engine.loadSnapshot(snapshot);
    this.engine.clearInputQueue();

    // Re-simulate any inputs that client sent AFTER the server tick
    this.replayPredictionsSince(this.lastAcknowledgedInputSeq);
  }

  // ---- Prediction & reconciliation --------------------------------------

  private replayPredictionsSince(inputSeq: number) {
    if (!this.serverSnapshot) return;

    // Only replay inputs after the given sequence number
    this.playerInputBuffer = this.playerInputBuffer.filter(
      (p) => p.sequence > inputSeq
    );

    // Re-apply inputs
    for (const entry of this.playerInputBuffer) {
      this.engine.enqueueInput(entry.input);
    }
  }

  /**
   * Smoothly reconciles the locally predicted state with the authoritative server state.
   *
   * This method does not deep clone or allocate new objects.
   * It adjusts the local engine state in place, blending dynamic entities (players, enemies)
   * toward the server's authoritative positions to hide small divergences.
   */
  correctPrediction(server: GameStateSnapshot, local: GameStateSnapshot): GameStateSnapshot {
  
    // --- Reconcile players ---
    for (const id in local.players) {
      const localPlayer = local.players[id];
      const authPlayer = server.players[id];
      if (!authPlayer) continue;

      const dx = authPlayer.worldPosition.x - localPlayer.worldPosition.x;
      const dy = authPlayer.worldPosition.y - localPlayer.worldPosition.y;
      const distSq = dx * dx + dy * dy;

      if (distSq > this.smoothing.threshold * this.smoothing.threshold) {
        // --- Large divergence → snap immediately to authoritative state ---
        localPlayer.worldPosition.x = authPlayer.worldPosition.x;
        localPlayer.worldPosition.y = authPlayer.worldPosition.y;
        localPlayer.velocity.x = authPlayer.velocity.x;
        localPlayer.velocity.y = authPlayer.velocity.y;
        localPlayer.facing = authPlayer.facing;
      } else {
        // --- Small divergence → smooth blend ---
        localPlayer.worldPosition.x += dx * this.smoothing.factor;
        localPlayer.worldPosition.y += dy * this.smoothing.factor;
        localPlayer.velocity.x = authPlayer.velocity.x; // snap velocity
        localPlayer.velocity.y = authPlayer.velocity.y;
        localPlayer.facing = authPlayer.facing;
      }
    }

    // --- Reconcile enemies (optional) ---
    if (local.enemies && server.enemies) {
      for (const id in local.enemies) {
        const localEnemy = local.enemies[id];
        const authEnemy = server.enemies[id];
        if (!authEnemy) continue;

        const dx = authEnemy.worldPosition.x - localEnemy.worldPosition.x;
        const dy = authEnemy.worldPosition.y - localEnemy.worldPosition.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > this.smoothing.threshold * this.smoothing.threshold) {
          // --- Large divergence → snap immediately to authoritative state ---
          localEnemy.worldPosition.x = authEnemy.worldPosition.x;
          localEnemy.worldPosition.y = authEnemy.worldPosition.y;
          localEnemy.facing = authEnemy.facing;
        } else {
          // --- Small divergence → smooth blend ---
          localEnemy.worldPosition.x += dx * this.smoothing.factor;
          localEnemy.worldPosition.y += dy * this.smoothing.factor;
          localEnemy.facing = authEnemy.facing;
        }
      }
    }

    // Bombs, explosions, and static obstacles can be ignored or corrected only when replaced
    // because they are typically spawned/destroyed deterministically via inputs or timers.

    return local; // Return the now-smoothed local snapshot
  }


  
  // ---- Public API (GameInterface) ---------------------------------------

  /**
   * Called by the scene each frame when networking is enabled.
   * If no server update arrived yet, we keep simulating locally.
   */
  advance(delta?: number) {
    this.applyPendingServerSnapshots();   // integrate server updates (if any)
    this.engine.advance(delta);           // simulate the predicted next tick

    // Predict the next state after this tick
    let predictedState = this.engine.getSnapshot();
    if (this.serverSnapshot) {
      predictedState = this.correctPrediction(this.serverSnapshot, predictedState);
    }

    this.setLocalSnapshot(predictedState);
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
    // Assign an input sequence to this input
    const inputSeq = ++this.currentInputSeq;

    // Send to local engine
    this.engine.enqueueInput(input);
    this.playerInputBuffer.push({ sequence: inputSeq, input });

    // Send to server
    if (this.socket && this.socket.connected) {
      const message: PlayerInputMessage = {
        playerId: this.options.playerId,
        input,
        sequence: inputSeq,
        sentAt: Date.now(),
      };
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

  // ---- Internals ---------------------------------------------------------

  private setLocalSnapshot(snapshot: GameStateSnapshot) {
    this.localSnapshot = snapshot;
    this.emitSnapshot(snapshot);
  }

  private emitSnapshot(snapshot: GameStateSnapshot) {
    this.listeners.forEach((l) => l(snapshot));
  }

  /**
   * Apply a delta update received from the server to the last known authoritative snapshot.
   * 
   * This merges partial entity changes, additions, and removals into the
   * existing authoritative snapshot (this.serverSnapshot), without replacing it entirely.
   * 
   * After merging, the authoritative snapshot reflects the most up-to-date world state
   * according to the server, ready to be used in reconciliation.
   */
  private applyDeltaSnapshot(delta: GameDelta, tick: number, timestamp: number) : GameStateSnapshot | null {

    if (this.serverSnapshot === null) {
      console.error('[ServerBackedGameInterface.applyDeltaSnapshot] No existing server snapshot to apply delta to.');
      return null;
    }

    // Clone current authoritative state (to avoid mutating old reference mid-frame)
    const merged: GameStateSnapshot = structuredClone(this.serverSnapshot);

    // Merge changed entities
    if (delta.changed) {
      for (const [collectionKey, changedEntities] of Object.entries(delta.changed)) {
        const targetCollection = (merged as any)[collectionKey] as Record<string, any>;
        if (!targetCollection) continue;

        for (const [id, newState] of Object.entries(changedEntities)) {
          targetCollection[id] = newState;
        }
      }
    }

    // Remove deleted entities
    if (delta.removed) {
      for (const [collectionKey, ids] of Object.entries(delta.removed)) {
        const targetCollection = (merged as any)[collectionKey] as Record<string, any>;
        if (!targetCollection) continue;

        for (const id of ids) {
          delete targetCollection[id];
        }
      }
    }

    // Optionally merge updated config or metadata (if provided)
    // if (delta.configChanged) {
    //   merged.config = { ...merged.config, ...delta.configChanged };
    // }

    // Update tick/timestamp if included in the delta
    merged.tick = tick;
    merged.timestamp = timestamp;

    return merged
  }

}
