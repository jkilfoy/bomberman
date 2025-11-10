import { EntityManager } from '../../core/EntityManager';
import { BombEntity } from '../entities/BombEntity';
import { EnemyEntity } from '../entities/EnemyEntity';
import { ExplosionEntity } from '../entities/ExplosionEntity';
import { ObstacleEntity } from '../entities/ObstacleEntity';
import { PlayerEntity } from '../entities/PlayerEntity';
import { PowerUpEntity } from '../entities/PowerUpEntity';
import { rectFromState, rectsIntersect, Rectangle, getNearestNonIntersectingPosition } from '../utils/collision';

interface CollisionDeps {
  players: EntityManager<PlayerEntity>;
  bombs: EntityManager<BombEntity>;
  obstacles: EntityManager<ObstacleEntity>;
  explosions: EntityManager<ExplosionEntity>;
  powerUps: EntityManager<PowerUpEntity>;
  enemies: EntityManager<EnemyEntity>;
  onBombTriggered(bomb: BombEntity): void;
}

export class CollisionSystem {
  constructor(private readonly deps: CollisionDeps) {}

  step() {
    this.resolvePlayerMovement();
    this.handlePowerUps();
    this.handleExplosions();
  }

  private resolvePlayerMovement() {
    const obstacles = this.deps.obstacles.values().map((entity) => ({
      entity,
      rect: rectFromState(entity.getSnapshot().worldPosition, entity.getSnapshot().hitbox),
    }));

    const bombs = this.deps.bombs.values().map((entity) => ({
      entity,
      rect: rectFromState(entity.getSnapshot().worldPosition, entity.getSnapshot().hitbox),
    }));

    this.deps.players.values().forEach((player) => {
      const snapshot = player.getSnapshot();
      let rect = rectFromState(snapshot.worldPosition, snapshot.hitbox);
      let position = { ...snapshot.worldPosition };

      obstacles.forEach(({ rect: obstacleRect }) => {
        if (!rectsIntersect(rect, obstacleRect)) return;
        position = getNearestNonIntersectingPosition(rect, obstacleRect, snapshot.facing);
        rect = { ...rect, x: position.x, y: position.y };
      });

      bombs.forEach(({ entity: bomb, rect: bombRect }) => {
        if (player.isIgnoringBomb(bomb.id)) return;
        if (!rectsIntersect(rect, bombRect)) return;
        position = getNearestNonIntersectingPosition(rect, bombRect, snapshot.facing);
        rect = { ...rect, x: position.x, y: position.y };
      });

      player.setWorldPosition(position);
      const updatedSnapshot = player.getSnapshot();
      const updatedRect = rectFromState(updatedSnapshot.worldPosition, updatedSnapshot.hitbox);
      this.refreshBombPassThrough(player, updatedRect);
    });
  }

  private refreshBombPassThrough(player: PlayerEntity, playerRect: Rectangle) {
    const ignoredId = player.getIgnoredBombId();
    if (!ignoredId) return;
    const bomb = this.deps.bombs.get(ignoredId);
    if (!bomb) {
      player.clearIgnoredBomb();
      return;
    }

    const bombRect = rectFromState(bomb.getSnapshot().worldPosition, bomb.getSnapshot().hitbox);
    if (!rectsIntersect(playerRect, bombRect)) {
      player.clearIgnoredBomb();
    }
  }

  private handlePowerUps() {
    const powerUps = this.deps.powerUps.values();
    if (powerUps.length === 0) return;

    const players = this.deps.players.values().map((player) => ({
      player,
      rect: rectFromState(player.getSnapshot().worldPosition, player.getSnapshot().hitbox),
    }));

    powerUps.forEach((powerUp) => {
      const powerState = powerUp.getSnapshot();
      if (!powerState.available) return;
      const powerRect = rectFromState(powerState.worldPosition, powerState.hitbox);

      players.forEach(({ player, rect }) => {
        if (!player.getSnapshot().alive) return;
        if (!rectsIntersect(rect, powerRect)) return;
        powerUp.consume();
        // TODO: Apply the actual power-up effects to the player entity.
      });
    });
  }

  private handleExplosions() {
    const explosions = this.deps.explosions.values();
    if (explosions.length === 0) return;

    const players = this.deps.players.values().map((player) => ({
      player,
      rect: rectFromState(player.getSnapshot().worldPosition, player.getSnapshot().hitbox),
    }));

    const enemies = this.deps.enemies.values().map((enemy) => ({
      enemy,
      rect: rectFromState(enemy.getSnapshot().worldPosition, enemy.getSnapshot().hitbox),
    }));

    const obstacles = this.deps.obstacles.values().map((obstacle) => ({
      obstacle,
      rect: rectFromState(obstacle.getSnapshot().worldPosition, obstacle.getSnapshot().hitbox),
    }));

    explosions.forEach((explosion) => {
      const rect = rectFromState(explosion.getSnapshot().worldPosition, explosion.getSnapshot().hitbox);

      players.forEach(({ player, rect: playerRect }) => {
        if (!player.getSnapshot().alive) return;
        if (rectsIntersect(rect, playerRect)) {
          player.setAlive(false);
        }
      });

      enemies.forEach(({ enemy, rect: enemyRect }) => {
        if (!enemy.getSnapshot().alive) return;
        if (rectsIntersect(rect, enemyRect)) {
          enemy.setAlive(false);
        }
      });

      obstacles.forEach(({ obstacle, rect: obstacleRect }) => {
        if (!obstacle.getSnapshot().destructible) return;
        if (rectsIntersect(rect, obstacleRect)) {
          this.deps.obstacles.remove(obstacle.id);
        }
      });

      this.chainReactingBombs(rect);
    });
  }

  private chainReactingBombs(explosionRect: Rectangle) {
    this.deps.bombs.values().forEach((bomb) => {
      if (bomb.getSnapshot().detonated) return;
      const bombRect = rectFromState(bomb.getSnapshot().worldPosition, bomb.getSnapshot().hitbox);
      if (rectsIntersect(explosionRect, bombRect)) {
        this.deps.onBombTriggered(bomb);
      }
    });
  }
}
