import { GameConfig } from '../../core/GameConfig';
import { GridCoordinate, WorldCoordinate } from '../../core/GridSystem';
import { Direction } from '../utils/direction';
import { Hitbox } from '../utils/collision';

export type EntityKind =
  | 'player'
  | 'bomb'
  | 'explosion'
  | 'obstacle'
  | 'powerUp'
  | 'enemy';

export interface EntitySnapshot {
  id: string;
  kind: EntityKind;
  gridPosition: GridCoordinate;
  worldPosition: WorldCoordinate;
  createdAt: number;
  hitbox: Hitbox;
}

export interface PlayerSnapshot extends EntitySnapshot {
  kind: 'player';
  name: string;
  characterKey: string;
  alive: boolean;
  velocity: { x: number; y: number };
  facing: Direction;
  speed: number;
  bombLimit: number;
  activeBombs: number;
  explosionRange: number;
  status: {
    shielded: boolean;
    invincible: boolean;
  };
}

export interface BombSnapshot extends EntitySnapshot {
  kind: 'bomb';
  ownerId: string;
  fuse: number;
  duration: number;
  explosionRange: number;
  detonated: boolean;
}

export interface ExplosionSnapshot extends EntitySnapshot {
  kind: 'explosion';
  expiresAt: number;
  ownerId: string;
  lethal: boolean;
}

export interface ObstacleSnapshot extends EntitySnapshot {
  kind: 'obstacle';
  destructible: boolean;
}

export interface PowerUpSnapshot extends EntitySnapshot {
  kind: 'powerUp';
  powerUpType: 'speed' | 'bomb' | 'range' | 'shield';
  available: boolean;
}

export interface EnemySnapshot extends EntitySnapshot {
  kind: 'enemy';
  alive: boolean;
  speed: number;
  facing: Direction;
}

export interface GameStateSnapshot {
  tick: number;
  timestamp: number;
  config: GameConfig & { tickIntervalMs: number };
  players: Record<string, PlayerSnapshot>;
  bombs: Record<string, BombSnapshot>;
  explosions: Record<string, ExplosionSnapshot>;
  obstacles: Record<string, ObstacleSnapshot>;
  powerUps: Record<string, PowerUpSnapshot>;
  enemies: Record<string, EnemySnapshot>;
}
