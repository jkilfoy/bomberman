/**
 * GameEngine.ts
 * ------------------------------------------------------
 * The core deterministic simulation of the Bomberman world.
 * This class is completely independent from rendering and networking.
 * It is used by both the server (for authoritative simulation)
 * and the client (for local prediction in ServerBackedGameInterface).
 *
 * Major Responsibilities:
 *  - Process player inputs deterministically each tick.
 *  - Update all game entities (players, bombs, enemies, etc.).
 *  - Resolve collisions and handle gameplay rules.
 *  - Produce and load full game state snapshots for synchronization.
 *  - Generate snapshot deltas for efficient network sync.
 * ------------------------------------------------------
 */

import { EntityManager } from '../core/EntityManager';
import { DEFAULT_TICK_INTERVAL, GameConfig } from '../core/GameConfig';
import { GridCoordinate, GridSystem, WorldCoordinate } from '../core/GridSystem';
import { BombEntity } from './entities/BombEntity';
import { EnemyEntity } from './entities/EnemyEntity';
import { ExplosionEntity } from './entities/ExplosionEntity';
import { ObstacleEntity } from './entities/ObstacleEntity';
import { PlayerEntity } from './entities/PlayerEntity';
import { PowerUpEntity } from './entities/PowerUpEntity';
import { BasicMap } from './map/BasicMap';
import { CellType, GameMap } from './map/Map';
import {
  BombSnapshot,
  ExplosionSnapshot,
  GameStateSnapshot,
  ObstacleSnapshot,
  PlayerSnapshot,
  PowerUpSnapshot,
} from './state/GameState';
import { PlayerInput } from './state/PlayerInput';
import { createEntityId } from './utils/id';
import { Hitbox } from './utils/collision';
import { CollisionSystem } from './systems/CollisionSystem';
import { GameDelta, EntityCollectionKey } from './net/types';
import { Direction } from './utils/direction';

const COLLECTION_KEYS: EntityCollectionKey[] = ['players', 'bombs', 'explosions', 'obstacles', 'powerUps', 'enemies'];
const CONFIG_KEYS: (keyof GameConfig)[] = ['mode', 'gridWidth', 'gridHeight', 'cellSize', 'tickIntervalMs'];

export interface PlayerSpawnOptions {
  id?: string;
  characterKey: string;
  name: string;
  spawn: GridCoordinate;
  speed?: number;
}

export interface GameEngineOptions {
  config: GameConfig;
  map?: GameMap;
  initialPlayers?: PlayerSpawnOptions[];
}

const EXPLOSION_DIRECTIONS: GridCoordinate[] = [
  { col: 0, row: -1 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
  { col: 1, row: 0 },
];

export class GameEngine {
  
  private readonly tickDuration: number;
  private tick = 0;
  private timestamp = 0;  // timestamp of the game in milliseconds

  private grid: GridSystem;
  private map: GameMap;
  private collisionSystem: CollisionSystem;

  private players = new EntityManager<PlayerEntity>();
  private bombs = new EntityManager<BombEntity>();
  private explosions = new EntityManager<ExplosionEntity>();
  private obstacles = new EntityManager<ObstacleEntity>();
  private powerUps = new EntityManager<PowerUpEntity>();
  private enemies = new EntityManager<EnemyEntity>();

  private inputQueue: PlayerInput[] = [];
  private currentSnapshot: GameStateSnapshot | null = null;
  private previousSnapshot: GameStateSnapshot | null = null;

  constructor(private readonly options: {
    config: GameConfig;
    map?: GameMap;
    initialPlayers?: Array<{
      id?: string;
      characterKey: string;
      name: string;
      spawn: GridCoordinate;
      speed?: number;
    }>;
  }) {
    const { config } = options;
    this.tickDuration = config.tickIntervalMs ?? DEFAULT_TICK_INTERVAL;

    this.grid = new GridSystem(config.gridWidth, config.gridHeight, config.cellSize);
    this.map = options.map ?? new BasicMap(config.gridHeight, config.gridWidth);

    this.initializeEntities();

    this.collisionSystem = new CollisionSystem({
      players: this.players,
      bombs: this.bombs,
      obstacles: this.obstacles,
      explosions: this.explosions,
      powerUps: this.powerUps,
      enemies: this.enemies,
      onBombTriggered: (bomb) => this.detonateBomb(bomb),
      onObstacleDestroyed: (obstacle) => this.handleObstacleDestruction(obstacle),
      onPowerupCollected: (powerUp, player) => this.collectPowerup(powerUp, player),
    });
  }

  // =============================================================
  // === PUBLIC INTERFACE =========================================
  // =============================================================

  enqueueInput(input: PlayerInput) {
    this.inputQueue.push(input);
  }

  advance(deltaMs?: number) {
    const delta = deltaMs ?? this.tickDuration;
    this.timestamp += delta;
    this.tick++;

    this.processInputs();

    this.players.update(delta);
    this.bombs.update(delta);
    this.explosions.update(delta);
    this.powerUps.update(delta);
    this.enemies.update(delta);

    this.handleBombs();
    this.collisionSystem.step();
    this.cleanupExplosions();

    this.previousSnapshot = this.currentSnapshot;
    this.currentSnapshot = this.buildSnapshot();
  }

  getSnapshot(): GameStateSnapshot {
    return (this.currentSnapshot ??= this.buildSnapshot());
  }

  loadSnapshot(snapshot: GameStateSnapshot) {
    this.tick = snapshot.tick;
    this.timestamp = snapshot.timestamp;

    this.players.clear();
    this.bombs.clear();
    this.explosions.clear();
    this.obstacles.clear();
    this.powerUps.clear();
    this.enemies.clear();

    Object.values(snapshot.players).forEach((s) => this.players.add(new PlayerEntity({ state: s, grid: this.grid })));
    Object.values(snapshot.bombs).forEach((s) => this.bombs.add(new BombEntity({ state: s })));
    Object.values(snapshot.explosions).forEach((s) => this.explosions.add(new ExplosionEntity({ state: s })));
    Object.values(snapshot.obstacles).forEach((s) => this.obstacles.add(new ObstacleEntity({ state: s })));
    Object.values(snapshot.powerUps).forEach((s) => this.powerUps.add(new PowerUpEntity({ state: s })));
    Object.values(snapshot.enemies).forEach((s) => this.enemies.add(new EnemyEntity({ state: s, grid: this.grid })));

    this.currentSnapshot = snapshot;
    this.previousSnapshot = null;
  }

  getSnapshotDelta(previous: GameStateSnapshot | null = this.previousSnapshot): GameDelta | null {
    if (!previous) return null;

    const current = this.getSnapshot();
    const delta: GameDelta = { changed: {}, removed: {} };
    let hasChanges = false;

    const collections: EntityCollectionKey[] = ['players', 'bombs', 'explosions', 'obstacles', 'powerUps', 'enemies'];
    for (const key of collections) {
      const curr = current[key] as Record<string, any>;
      const prev = previous[key] as Record<string, any>;

      for (const id of Object.keys(curr)) {
        if (curr[id] !== prev[id]) {
          (delta.changed[key] ??= {})[id] = curr[id];
          hasChanges = true;
        }
      }

      for (const id of Object.keys(prev)) {
        if (!curr[id]) {
          (delta.removed[key] ??= []).push(id);
          hasChanges = true;
        }
      }
    }

    return hasChanges ? delta : null;
  }

  clearInputQueue() {
    this.inputQueue = [];
  }

  // =============================================================
  // === INPUT HANDLING ===========================================
  // =============================================================

  private processInputs() {
    if (this.inputQueue.length === 0) return;
    const queue = [...this.inputQueue];
    this.inputQueue = [];

    for (const input of queue) {
      if (input === null) continue; // ignore no-ops

      const player = this.players.get(input.playerId);
      if (!player) continue;

      // movement state
      player.setMovementIntent(input.direction);

      if (input.bomb) {
        this.tryDropBomb(player);
      }
    }
  }

  private tryDropBomb(player: PlayerEntity) {
    if (!player.canDropBomb()) return;
    const playerState = player.getSnapshot();
    if (this.bombs.values().some((b) => this.sameCell(b.getSnapshot().gridPosition, playerState.gridPosition))) return;

    const id = createEntityId('bomb');
    const worldPosition = this.grid.gridToWorld(playerState.gridPosition);
    const snapshot: BombSnapshot = {
      id,
      kind: 'bomb',
      ownerId: playerState.id,
      gridPosition: { ...playerState.gridPosition },
      worldPosition,
      createdAt: this.timestamp,
      fuse: 2000,     //  todo magic constants
      duration: 2000,
      explosionRange: playerState.explosionRange,
      detonated: false,
      hitbox: this.buildHitbox(0.4),
    };

    const entity = this.bombs.add(new BombEntity({ state: snapshot }));
    player.onBombPlaced(entity.id);
  }

  // =============================================================
  // === GAMEPLAY LOGIC ===========================================
  // =============================================================

  private handleBombs() {
    for (const bomb of this.bombs.values()) {
      if (bomb.shouldDetonate()) {
        this.detonateBomb(bomb);
      }
    }
  }

  private detonateBomb(bomb: BombEntity) {
    if (bomb.getSnapshot().detonated) return;
    bomb.markDetonated();

    const owner = this.players.get(bomb.getSnapshot().ownerId);
    owner?.onBombDetonated(bomb.id);

    this.spawnExplosions(bomb);
    this.bombs.remove(bomb.id);
  }

  private spawnExplosions(bomb: BombEntity) {
    const snapshot = bomb.getSnapshot();
    const directions: GridCoordinate[] = [
      { col: 0, row: -1 },
      { col: 0, row: 1 },
      { col: -1, row: 0 },
      { col: 1, row: 0 },
    ];

    this.spawnExplosionAt(snapshot.gridPosition, snapshot.ownerId);

    for (const offset of directions) {
      for (let step = 1; step <= snapshot.explosionRange; step++) {
        const target = {
          col: snapshot.gridPosition.col + offset.col * step,
          row: snapshot.gridPosition.row + offset.row * step,
        };

        if (!this.grid.isValidCell(target)) break;

        const obstacle = this.obstacles.values().find((o) => this.sameCell(o.getSnapshot().gridPosition, target));
        if (obstacle) {
          if (obstacle.getSnapshot().destructible) this.spawnExplosionAt(target, snapshot.ownerId);
          break;
        }

        this.spawnExplosionAt(target, snapshot.ownerId);
      }
    }
  }

  private spawnExplosionAt(gridPosition: GridCoordinate, ownerId: string) {
    const id = createEntityId('explosion');
    const worldPosition = this.grid.gridToWorld(gridPosition);
    const snapshot: ExplosionSnapshot = {
      id,
      kind: 'explosion',
      gridPosition: { ...gridPosition },
      worldPosition,
      createdAt: this.timestamp,
      expiresAt: 400,
      ownerId,
      hitbox: this.buildHitbox(0.9),
      lethal: true,
    };

    this.explosions.add(new ExplosionEntity({ state: snapshot }));
  }

  private cleanupExplosions() {
    for (const explosion of this.explosions.values()) {
      if (explosion.isExpired()) this.explosions.remove(explosion.id);
    }
  }

  removePlayer(playerId: string) {
    if (!this.players.get(playerId)) return;
    this.players.remove(playerId);
  }

  // =============================================================
  // === WORLD SETUP =============================================
  // =============================================================

  private initializeEntities() {
    this.seedObstaclesFromMap();
    this.seedBoundaryWalls();
    this.options.initialPlayers?.forEach((player) => this.spawnPlayer(player));
  }

  private spawnPlayer(options: { id?: string; characterKey: string; name: string; spawn: GridCoordinate; speed?: number }) {
    const id = options.id ?? createEntityId('player');
    const worldPosition = this.grid.gridToWorld(options.spawn);

    const snapshot: PlayerSnapshot = {
      id,
      kind: 'player',
      gridPosition: options.spawn,
      worldPosition,
      createdAt: this.timestamp,
      name: options.name,
      characterKey: options.characterKey,
      alive: true,
      velocity: { x: 0, y: 0 },
      facing: Direction.DOWN,
      speed: options.speed ?? 180,
      bombLimit: 1,
      activeBombs: 0,
      explosionRange: 1,
      status: { shielded: false, invincible: false },
      hitbox: this.buildHitbox(0.7),
    };

    this.players.add(new PlayerEntity({ state: snapshot, grid: this.grid }));
  }

  private seedObstaclesFromMap() {
    for (let row = 0; row < this.map.rows; row++) {
      for (let col = 0; col < this.map.cols; col++) {
        const type = this.map.get(row, col);
        if (type === CellType.EMPTY) continue;

        const id = createEntityId('obstacle');
        const gridPosition = { row, col };
        const obstacle: ObstacleSnapshot = {
          id,
          kind: 'obstacle',
          gridPosition,
          worldPosition: this.grid.gridToWorld(gridPosition),
          createdAt: this.timestamp,
          destructible: type === CellType.BOX,
          hitbox: this.buildHitbox(type === CellType.BOX ? 0.85 : 0.95),
        };
        this.obstacles.add(new ObstacleEntity({ state: obstacle }));
      }
    }
  }

  private seedBoundaryWalls() {
    const width = this.grid.width * this.grid.cellSize;
    const height = this.grid.height * this.grid.cellSize;
    const thickness = this.grid.cellSize * 0.9;

    const horizontalHitbox: Hitbox = { width, height: thickness };
    const verticalHitbox: Hitbox = { width: thickness, height };

    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const offset = thickness / 2;

    this.createBoundaryObstacle({ x: halfWidth, y: -offset }, horizontalHitbox);
    this.createBoundaryObstacle({ x: halfWidth, y: height + offset }, horizontalHitbox);
    this.createBoundaryObstacle({ x: -offset, y: halfHeight }, verticalHitbox);
    this.createBoundaryObstacle({ x: width + offset, y: halfHeight }, verticalHitbox);
  }

  private createBoundaryObstacle(worldPosition: WorldCoordinate, hitbox: Hitbox) {
    const id = createEntityId('boundary');
    const obstacle: ObstacleSnapshot = {
      id,
      kind: 'obstacle',
      gridPosition: this.grid.worldToGrid(worldPosition),
      worldPosition,
      createdAt: this.timestamp,
      destructible: false,
      hitbox,
    };

    this.obstacles.add(new ObstacleEntity({ state: obstacle }));
  }

  // =============================================================
  // === POWERUPS & UTILITIES ====================================
  // =============================================================

  private handleObstacleDestruction(obstacle: ObstacleEntity) {
    const snapshot = obstacle.getSnapshot();
    this.maybeSpawnPowerUp(snapshot.gridPosition);
  }

  private maybeSpawnPowerUp(gridPosition: GridCoordinate) {
    if (Math.random() > 0.8) return;
    const id = createEntityId('powerup');
    const worldPosition = this.grid.gridToWorld(gridPosition);
    const snapshot: PowerUpSnapshot = {
      id,
      kind: 'powerUp',
      gridPosition: { ...gridPosition },
      worldPosition,
      createdAt: this.timestamp,
      powerUpType: this.getRandomPowerUpType(),
      available: true,
      hitbox: this.buildHitbox(0.5),
    };

    this.powerUps.add(new PowerUpEntity({ state: snapshot }));
  }

  private getRandomPowerUpType(): PowerUpSnapshot['powerUpType'] {
    const types: PowerUpSnapshot['powerUpType'][] = ['speed', 'bomb', 'range', 'shield'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private collectPowerup(powerUp: PowerUpEntity, player: PlayerEntity) {
    const state = powerUp.getSnapshot();
    if (!state.available) return;

    powerUp.consume();
    // remove powerup
    this.powerUps.remove(powerUp.id);

    switch (state.powerUpType) {
      case 'speed':
        player.applySpeedBoost(5);
        break;
      case 'bomb':
        player.applyBombLimitIncrease(1);
        break;
      case 'range':
        player.applyExplosionRangeIncrease(1);
        break;
      case 'shield':
        player.grantShield();
        break;
    }
  }

  private sameCell(a: GridCoordinate, b: GridCoordinate) {
    return a.row === b.row && a.col === b.col;
  }

  private buildHitbox(scale: number): Hitbox {
    const size = this.grid.cellSize * scale;
    return { width: size, height: size };
  }

  /**
   * Build a full GameStateSnapshot from all current entities.
   * This snapshot represents the complete authoritative state of the world.
   * It is used both for rendering (locally) and network sync (server).
   */
  private buildSnapshot(): GameStateSnapshot {
    return {
      tick: this.tick,
      timestamp: this.timestamp,
      config: this.options.config,

      // Entity snapshots: each manager converts its internal entities into plain state objects
      players: this.players.toRecord(),
      bombs: this.bombs.toRecord(),
      explosions: this.explosions.toRecord(),
      obstacles: this.obstacles.toRecord(),
      powerUps: this.powerUps.toRecord(),
      enemies: this.enemies.toRecord(),
    };
  }

  // =============================================================
  // === CLEANUP & UTILITIES =====================================
  // =============================================================

  /** Destroy the engine and all managed entities. */
  destroy() {
    this.players.clear();
    this.bombs.clear();
    this.explosions.clear();
    this.obstacles.clear();
    this.powerUps.clear();
    this.enemies.clear();
    this.inputQueue = [];
    this.currentSnapshot = null;
    this.previousSnapshot = null;
  }
}