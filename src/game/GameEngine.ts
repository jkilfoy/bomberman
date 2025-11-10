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
  EnemySnapshot,
  ExplosionSnapshot,
  GameStateSnapshot,
  ObstacleSnapshot,
  PlayerSnapshot,
  PowerUpSnapshot,
} from './state/GameState';
import { PlayerInput } from './state/PlayerInput';
import { Direction } from './utils/direction';
import { createEntityId } from './utils/id';
import { Hitbox } from './utils/collision';
import { CollisionSystem } from './systems/CollisionSystem';

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
  private grid: GridSystem;
  private map: GameMap;
  private readonly tickDuration: number;
  private tick = 0;
  private timestamp = 0;
  private readonly powerUpDropChance = 0.8;

  private players = new EntityManager<PlayerEntity>();
  private bombs = new EntityManager<BombEntity>();
  private explosions = new EntityManager<ExplosionEntity>();
  private obstacles = new EntityManager<ObstacleEntity>();
  private powerUps = new EntityManager<PowerUpEntity>();
  private enemies = new EntityManager<EnemyEntity>();

  private inputQueue: PlayerInput[] = [];
  private collisionSystem: CollisionSystem;

  constructor(private readonly options: GameEngineOptions) {
    const tickInterval = options.config.tickIntervalMs ?? DEFAULT_TICK_INTERVAL;
    this.tickDuration = tickInterval;
    this.grid = new GridSystem(
      options.config.gridWidth,
      options.config.gridHeight,
      options.config.cellSize,
    );
    this.map = options.map ?? new BasicMap(options.config.gridHeight, options.config.gridWidth);

    this.seedObstaclesFromMap();
    this.seedBoundaryWalls();
    options.initialPlayers?.forEach((player) => this.spawnPlayer(player));

    this.collisionSystem = new CollisionSystem({
      players: this.players,
      bombs: this.bombs,
      obstacles: this.obstacles,
      explosions: this.explosions,
      powerUps: this.powerUps,
      enemies: this.enemies,
      onBombTriggered: (bomb) => this.detonateBomb(bomb),
      onObstacleDestroyed: (obstacle) => this.handleObstacleDestruction(obstacle),
      onPowerupCollected: (powerUp, player) => this.collectPowerup(powerUp, player)
    });
  }

  enqueueInput(input: PlayerInput) {
    this.inputQueue.push(input);
  }

  spawnPlayer(options: PlayerSpawnOptions) {
    const id = options.id ?? createEntityId('player');
    const gridPosition = { ...options.spawn };
    const worldPosition = this.grid.gridToWorld(gridPosition);

    const snapshot: PlayerSnapshot = {
      id,
      kind: 'player',
      gridPosition,
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
    return id;
  }

  advance(deltaMs?: number) {
    const delta = deltaMs ?? this.tickDuration;
    this.timestamp += delta;
    this.tick += 1;

    this.processInputs();

    this.players.update(delta);
    this.bombs.update(delta);
    this.explosions.update(delta);
    this.powerUps.update(delta);
    this.enemies.update(delta);

    this.handleBombs();
    this.collisionSystem.step();
    this.cleanupExplosions();
  }

  getSnapshot(): GameStateSnapshot {
    return {
      tick: this.tick,
      timestamp: this.timestamp,
      config: {
        ...this.options.config,
        tickIntervalMs: this.tickDuration,
      },
      players: this.players.toRecord<PlayerSnapshot>(),
      bombs: this.bombs.toRecord<BombSnapshot>(),
      explosions: this.explosions.toRecord<ExplosionSnapshot>(),
      obstacles: this.obstacles.toRecord<ObstacleSnapshot>(),
      powerUps: this.powerUps.toRecord<PowerUpSnapshot>(),
      enemies: this.enemies.toRecord<EnemySnapshot>(),
    };
  }

  private processInputs() {
    if (this.inputQueue.length === 0) return;

    const queue = [...this.inputQueue];
    this.inputQueue = [];

    queue.forEach((input) => {
      const player = this.players.get(input.playerId);
      if (!player) return;
      switch (input.type) {
        case 'set_direction':
          player.setMovementIntent(input.direction);
          return;
        case 'drop_bomb':
          this.tryDropBomb(player);
          return;
      }
    });
  }

  private tryDropBomb(player: PlayerEntity) {
    if (!player.canDropBomb()) return;
    const playerState = player.getSnapshot();
    if (this.isBombOnCell(playerState.gridPosition)) return;

    const id = createEntityId('bomb');
    const worldPosition = this.grid.gridToWorld(playerState.gridPosition);
    const snapshot: BombSnapshot = {
      id,
      kind: 'bomb',
      ownerId: playerState.id,
      gridPosition: { ...playerState.gridPosition },
      worldPosition,
      createdAt: this.timestamp,
      fuse: 2000,
      duration: 2000,
      explosionRange: playerState.explosionRange,
      detonated: false,
      hitbox: this.buildHitbox(0.4),
    };

    const entity = this.bombs.add(new BombEntity({ state: snapshot }));
    player.onBombPlaced(entity.id);
  }

  private handleBombs() {
    this.bombs.values().forEach((bomb) => {
      if (bomb.shouldDetonate()) {
        this.detonateBomb(bomb);
      }
    });
  }

  private spawnExplosions(bomb: BombEntity) {
    const snapshot = bomb.getSnapshot();
    this.spawnExplosionAt(snapshot.gridPosition, snapshot.ownerId);

    EXPLOSION_DIRECTIONS.forEach((offset) => {
      for (let step = 1; step <= snapshot.explosionRange; step++) {
        const target: GridCoordinate = {
          col: snapshot.gridPosition.col + offset.col * step,
          row: snapshot.gridPosition.row + offset.row * step,
        };

        if (!this.grid.isValidCell(target)) break;
        const obstacle = this.getObstacleAtCell(target);

        if (obstacle) {
          if (obstacle.getSnapshot().destructible) {
            this.spawnExplosionAt(target, snapshot.ownerId);
          }
          break;
        }

        this.spawnExplosionAt(target, snapshot.ownerId);
      }
    });
  }

  private cleanupExplosions() {
    this.explosions
      .values()
      .filter((explosion) => explosion.isExpired())
      .forEach((explosion) => this.explosions.remove(explosion.id));
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

    this.createBoundaryObstacle(
      { x: halfWidth, y: -offset },
      horizontalHitbox,
    );
    this.createBoundaryObstacle(
      { x: halfWidth, y: height + offset },
      horizontalHitbox,
    );
    this.createBoundaryObstacle(
      { x: -offset, y: halfHeight },
      verticalHitbox,
    );
    this.createBoundaryObstacle(
      { x: width + offset, y: halfHeight },
      verticalHitbox,
    );
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

  private isBombOnCell(position: GridCoordinate) {
    return this.bombs
      .values()
      .some((bomb) => this.sameCell(bomb.getSnapshot().gridPosition, position));
  }

  private sameCell(a: GridCoordinate, b: GridCoordinate) {
    return a.col === b.col && a.row === b.row;
  }

  private buildHitbox(scale: number, override?: Hitbox): Hitbox {
    if (override) {
      return override;
    }
    const dimension = this.grid.cellSize * scale;
    return {
      width: dimension,
      height: dimension,
    };
  }

  private detonateBomb(bomb: BombEntity) {
    if (bomb.getSnapshot().detonated) return;
    bomb.markDetonated();
    const owner = this.players.get(bomb.getSnapshot().ownerId);
    owner?.onBombDetonated(bomb.id);
    this.spawnExplosions(bomb);
    this.bombs.remove(bomb.id);
  }

  private spawnExplosionAt(gridPosition: GridCoordinate, ownerId: string) {
    const id = createEntityId('explosion');
    const worldPosition = this.grid.gridToWorld(gridPosition);
    const explosion: ExplosionSnapshot = {
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

    this.explosions.add(new ExplosionEntity({ state: explosion }));
  }

  private getObstacleAtCell(position: GridCoordinate) {
    return this.obstacles
      .values()
      .find((obstacle) => this.sameCell(obstacle.getSnapshot().gridPosition, position));
  }

  private handleObstacleDestruction(obstacle: ObstacleEntity) {
    const snapshot = obstacle.getSnapshot();
    this.maybeSpawnPowerUp(snapshot.gridPosition);
  }

  private maybeSpawnPowerUp(gridPosition: GridCoordinate) {
    if (Math.random() > this.powerUpDropChance) {
      return;
    }

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
    const index = Math.floor(Math.random() * types.length);
    return types[index];
  }

  private collectPowerup(powerUp: PowerUpEntity, player: PlayerEntity) {
    const powerUpState = powerUp.getSnapshot();
    if (!powerUpState.available) return;

    powerUp.consume();

    switch (powerUpState.powerUpType) {
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
}
