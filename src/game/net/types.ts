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

export interface PlayerInputMessage {
  playerId: string;
  input: PlayerInput;
  tick: number;
  sentAt: number;
}

export interface GameUpdateMessage {
  tick: number;
  timestamp: number;
  fullSnapshot?: boolean;
  snapshot?: GameStateSnapshot;
  delta?: GameDelta;
}
