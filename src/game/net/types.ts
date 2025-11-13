import {
  GameStateSnapshot,
  PlayerSnapshot,
  BombSnapshot,
  ExplosionSnapshot,
  ObstacleSnapshot,
  PowerUpSnapshot,
  EnemySnapshot,
} from '../state/GameState';
import { PlayerInput } from '../state/PlayerInput';

export type EntityCollections = {
  players: PlayerSnapshot;
  bombs: BombSnapshot;
  explosions: ExplosionSnapshot;
  obstacles: ObstacleSnapshot;
  powerUps: PowerUpSnapshot;
  enemies: EnemySnapshot;
};

export type EntityCollectionKey = keyof EntityCollections;

type EntityPatch = {
  [K in EntityCollectionKey]?: Partial<Record<string, EntityCollections[K]>>;
};

export interface GameDelta {
  changed: EntityPatch;
  removed: {
    [K in EntityCollectionKey]?: string[];
  };
  configChanged?: Partial<Record<keyof GameStateSnapshot['config'], GameStateSnapshot['config'][keyof GameStateSnapshot['config']]>>;
}

/** Message sent from client to server containing player input */
export interface PlayerInputMessage {
  playerId: string;
  input: PlayerInput;
  sequence: number;     // sequence number of this input for ordering
  sentAt: number;
}

export interface GameUpdateMessage {
  tick: number;
  timestamp: number;
  playerInputSequence: Record<string, number>;  // tells player's the sequence number of their last input acknowledged by server
  fullSnapshot?: boolean;
  snapshot?: GameStateSnapshot;
  delta?: GameDelta;
}
