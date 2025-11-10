import { Character } from '../characters/Characters';
import characters from '../characters/Characters';
import { GameInterface } from '../game/GameInterface';
import { LocalGameInterface } from '../game/interfaces/LocalGameInterface';
import { GameEngineOptions } from '../game/GameEngine';
import { PlayerInput } from '../game/state/PlayerInput';
import { Direction } from '../game/utils/direction';
import KeyboardController from '../input/KeyboardController';
import { GameMode, GameConfig } from '../core/GameConfig';
import { GridSystem } from '../core/GridSystem';
import { GameStateSnapshot } from '../game/state/GameState';

type RenderCollection<T extends Phaser.GameObjects.GameObject> = Map<string, T>;

export default class GameScene extends Phaser.Scene {
  private config!: GameConfig;
  private controller!: KeyboardController;
  private interface!: GameInterface;
  private grid!: GridSystem;
  private localPlayerId = 'player-local';
  private selectedCharacter!: Character;

  private playerSprites: RenderCollection<Phaser.GameObjects.Image> = new Map();
  private bombSprites: RenderCollection<Phaser.GameObjects.Arc> = new Map();
  private obstacleSprites: RenderCollection<Phaser.GameObjects.Rectangle> = new Map();
  private explosionSprites: RenderCollection<Phaser.GameObjects.Rectangle> = new Map();

  constructor() {
    super('GameScene');
  }

  init(data: { selectedCharacter?: Character; mode?: GameMode }) {
    this.selectedCharacter = data?.selectedCharacter ?? characters['eric'];
    this.config = {
      mode: data?.mode ?? GameMode.practise,
      gridWidth: 13,
      gridHeight: 11,
      cellSize: 64,
      tickIntervalMs: 1000 / 60,
    };
  }

  preload() {
    Object.values(characters).forEach((char) => {
      this.load.image(char.key, char.path);
    });
  }

  create() {
    this.grid = new GridSystem(this.config.gridWidth, this.config.gridHeight, this.config.cellSize);
    this.controller = new KeyboardController(this);

    const engineOptions: GameEngineOptions = {
      config: this.config,
      initialPlayers: [
        {
          id: this.localPlayerId,
          characterKey: this.selectedCharacter.key,
          name: this.selectedCharacter.name,
          spawn: { col: 0, row: 0 },
          speed: 220,
        },
      ],
    };

    this.interface = new LocalGameInterface(engineOptions);

    this.drawGrid();
  }

  update(time: number, delta: number) {
    this.sendInputs(time);
    this.interface.advance?.(delta);
    this.syncState();
  }

  private sendInputs(time: number) {
    const direction = this.controller.direction.get();
    const movementInput: PlayerInput = {
      type: 'set_direction',
      playerId: this.localPlayerId,
      direction,
      clientTime: time,
    };
    this.interface.enqueueInput(movementInput);

    if (this.controller.bomb.justPressed()) {
      this.interface.applyInput({
        type: 'drop_bomb',
        playerId: this.localPlayerId,
        clientTime: time,
      });
    }
  }

  private syncState() {
    const snapshot = this.interface.getCurrentState();
    this.syncObstacles(snapshot);
    this.syncPlayers(snapshot);
    this.syncBombs(snapshot);
    this.syncExplosions(snapshot);
  }

  private syncPlayers(snapshot: GameStateSnapshot) {
    Object.values(snapshot.players).forEach((player) => {
      let sprite = this.playerSprites.get(player.id);
      if (!sprite) {
        sprite = this.add.image(player.worldPosition.x, player.worldPosition.y, player.characterKey);
        sprite.setScale(characters[player.characterKey]?.scale ?? 0.4);
        this.playerSprites.set(player.id, sprite);
      }
      sprite.setPosition(player.worldPosition.x, player.worldPosition.y);
      sprite.setAlpha(player.alive ? 1 : 0.3);
    });

    this.pruneSprites(this.playerSprites, snapshot.players);
  }

  private syncBombs(snapshot: GameStateSnapshot) {
    Object.values(snapshot.bombs).forEach((bomb) => {
      let sprite = this.bombSprites.get(bomb.id);
      if (!sprite) {
        sprite = this.add.circle(bomb.worldPosition.x, bomb.worldPosition.y, this.config.cellSize * 0.3, 0x4444ff);
        this.bombSprites.set(bomb.id, sprite);
      }
      sprite.setPosition(bomb.worldPosition.x, bomb.worldPosition.y);
    });
    this.pruneSprites(this.bombSprites, snapshot.bombs);
  }

  private syncObstacles(snapshot: GameStateSnapshot) {
    Object.values(snapshot.obstacles).forEach((obstacle) => {
      let sprite = this.obstacleSprites.get(obstacle.id);
      if (!sprite) {
        sprite = this.add.rectangle(
          obstacle.worldPosition.x,
          obstacle.worldPosition.y,
          this.config.cellSize * 0.9,
          this.config.cellSize * 0.9,
          obstacle.destructible ? 0xcc8844 : 0x777777,
        );
        sprite.setStrokeStyle(2, obstacle.destructible ? 0x553311 : 0x333333);
        this.obstacleSprites.set(obstacle.id, sprite);
      }
    });

    this.pruneSprites(this.obstacleSprites, snapshot.obstacles);
  }

  private syncExplosions(snapshot: GameStateSnapshot) {
    Object.values(snapshot.explosions).forEach((explosion) => {
      let sprite = this.explosionSprites.get(explosion.id);
      if (!sprite) {
        sprite = this.add.rectangle(
          explosion.worldPosition.x,
          explosion.worldPosition.y,
          this.config.cellSize * 0.9,
          this.config.cellSize * 0.9,
          0xffaa00,
        );
        sprite.setAlpha(0.7);
        this.explosionSprites.set(explosion.id, sprite);
      }
      sprite.setPosition(explosion.worldPosition.x, explosion.worldPosition.y);
    });

    this.pruneSprites(this.explosionSprites, snapshot.explosions);
  }

  private pruneSprites(collection: RenderCollection<Phaser.GameObjects.GameObject>, stateRecord: Record<string, unknown>) {
    Array.from(collection.entries()).forEach(([id, sprite]) => {
      if (!stateRecord[id]) {
        sprite.destroy();
        collection.delete(id);
      }
    });
  }

  private drawGrid() {
    const g = this.add.graphics();
    g.lineStyle(1, 0x555555, 1);

    for (let x = 0; x <= this.grid.width; x++) {
      g.moveTo(x * this.config.cellSize, 0);
      g.lineTo(x * this.config.cellSize, this.grid.height * this.config.cellSize);
    }

    for (let y = 0; y <= this.grid.height; y++) {
      g.moveTo(0, y * this.config.cellSize);
      g.lineTo(this.grid.width * this.config.cellSize, y * this.config.cellSize);
    }

    g.strokePath();
  }
}
