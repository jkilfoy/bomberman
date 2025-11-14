import { Character } from '../characters/Characters';
import characters from '../characters/Characters';
import { GameInterface } from '../game/GameInterface';
import { LocalGameInterface } from '../game/interfaces/LocalGameInterface';
import { ServerBackedGameInterface } from '../game/interfaces/ServerBackedGameInterface';
import { GameEngineOptions } from '../game/GameEngine';
import type { Socket } from 'socket.io-client';
import { GridCoordinate } from '../core/GridSystem';

interface NetworkRosterEntry {
  playerId: string;
  characterKey: string;
  spawn: GridCoordinate;
  name?: string;
}
import { PlayerInput } from '../game/state/PlayerInput';
import { Direction } from '../game/utils/direction';
import KeyboardController from '../input/KeyboardController';
import { GameMode, GameConfig } from '../core/GameConfig';
import { GridSystem } from '../core/GridSystem';
import { GameStateSnapshot } from '../game/state/GameState';
import { getPowerUpDefinition } from '../game/powerups/definitions';

type RenderCollection<T extends Phaser.GameObjects.GameObject> = Map<string, T>;

export default class GameScene extends Phaser.Scene {
  private config!: GameConfig;
  private controller!: KeyboardController;
  private interface!: GameInterface;
  private grid!: GridSystem;
  private localPlayerId = 'player-local';
  private useServer = false;
  private debugText?: Phaser.GameObjects.Text;
  private lastPing = 0;
  private lastUpdateTick = 0;
  private lastSentInput: PlayerInput | null = null;
  private selectedCharacter!: Character;
  private matchId: string | undefined;
  private networkSocket: Socket | undefined;
  private matchConcluded = false;
  private matchOverlay?: Phaser.GameObjects.Text;
  private networkRoster: NetworkRosterEntry[] | undefined;
  private initialSnapshot: GameStateSnapshot | undefined;

  private playerSprites: RenderCollection<Phaser.GameObjects.Image> = new Map();
  private bombSprites: RenderCollection<Phaser.GameObjects.Arc> = new Map();
  private obstacleSprites: RenderCollection<Phaser.GameObjects.Rectangle> = new Map();
  private explosionSprites: RenderCollection<Phaser.GameObjects.Rectangle> = new Map();
  private powerUpSprites: RenderCollection<Phaser.GameObjects.Arc> = new Map();
  private shieldSprites: RenderCollection<Phaser.GameObjects.Arc> = new Map();
  private invincibilityTweens = new Map<string, Phaser.Tweens.Tween>();

  constructor() {
    super('GameScene');
  }

  init(data: { 
      selectedCharacter?: Character; 
      mode?: GameMode; 
      networked?: boolean; 
      playerId?: string; 
      matchId?: string; 
      socket?: Socket; 
      roster?: NetworkRosterEntry[];
      initialSnapshot?: GameStateSnapshot;
    } = {}) {
    this.selectedCharacter = data?.selectedCharacter ?? characters['eric'];
    this.config = {
      mode: data?.mode ?? GameMode.practise,
      gridWidth: 13,
      gridHeight: 11,
      cellSize: 64,
      tickIntervalMs: 1000 / 60,
    };
    this.useServer = Boolean(data?.networked);
    if (data?.playerId) this.localPlayerId = data.playerId;
    this.matchId = data?.matchId;
    this.networkSocket = data?.socket;
    this.networkRoster = data?.roster;
    this.initialSnapshot = data?.initialSnapshot;
    if (this.useServer && this.networkRoster) {
      const localInfo = this.networkRoster.find((entry) => entry.playerId === this.localPlayerId);
      if (localInfo) {
        this.selectedCharacter = characters[localInfo.characterKey] ?? this.selectedCharacter;
      }
    }
    this.matchConcluded = false;
  }

  preload() {
    Object.values(characters).forEach((char) => {
      this.load.image(char.key, char.path);
    });
  }

  create() {
    this.grid = new GridSystem(this.config.gridWidth, this.config.gridHeight, this.config.cellSize);
    this.controller = new KeyboardController(this);

    const initialPlayers = this.networkRoster
      ? this.networkRoster.map((player) => ({
          id: player.playerId,
          characterKey: player.characterKey,
          name: player.name ?? player.playerId,
          spawn: player.spawn,
          speed: 220,
        }))
      : [
          {
            id: this.localPlayerId,
            characterKey: this.selectedCharacter.key,
            name: this.selectedCharacter.name,
            spawn: { col: 0, row: 0 },
            speed: 220,
          },
        ];

    const engineOptions: GameEngineOptions = {
      config: this.config,
      initialPlayers,
    };

    if (this.useServer) {
      const serverOptions: ConstructorParameters<typeof ServerBackedGameInterface>[0] = {
        // socketUrl: 'http://localhost:9653',
        socketUrl: 'http://:9653',
        playerId: this.localPlayerId,
        engineOptions,
        onMatchEnd: (payload: { matchId: string; reason: string }) => this.handleMatchEnd(payload),
      };
      if (this.matchId) serverOptions.matchId = this.matchId;
      if (this.networkSocket) serverOptions.socket = this.networkSocket;
      this.interface = new ServerBackedGameInterface(serverOptions, this.initialSnapshot);
    } else {
      this.interface = new LocalGameInterface(engineOptions);
    }

    this.drawGrid();
    this.debugText = this.add.text(10, 10, '', {
      fontSize: '14px',
      color: '#00ff00',
    }).setDepth(1000);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanupNetwork();
    });
  }

  update(time: number, delta: number) {
    this.sendInputs(time);
    this.interface.advance?.(delta);
    this.syncState();
  }

  private sendInputs(time: number) {

    const input = this.controller.getInput();

    // only send input if it has changed
    if (this.lastSentInput && this.inputsEqual(input, this.lastSentInput)) {
      return;
    }

    input.playerId = this.localPlayerId;
    this.interface.enqueueInput(input);
    this.lastSentInput = input;
  }

  private inputsEqual(a: PlayerInput | null, b: PlayerInput | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
      a.direction === b.direction &&
      a.bomb === b.bomb
    );
  }

  private syncState() {
    const snapshot = this.interface.getCurrentState();
    this.syncObstacles(snapshot);
    this.syncPlayers(snapshot);
    this.syncBombs(snapshot);
    this.syncExplosions(snapshot);
    this.syncPowerUps(snapshot);
    this.updateDebugInfo(snapshot);
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

      const baseAlpha = player.alive ? 1 : 0.3;
      if (player.status.invincible) {
        this.ensureInvincibilityTween(player.id, sprite, baseAlpha);
      } else {
        this.stopInvincibilityTween(player.id, sprite, baseAlpha);
        sprite.setAlpha(baseAlpha);
      }

      this.syncShieldSprite(player, sprite);
    });

    this.pruneSprites(this.playerSprites, snapshot.players);
    this.cleanupPlayerAttachments(snapshot.players);
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
          0xff4444,
        );
        sprite.setAlpha(0.7);
        this.explosionSprites.set(explosion.id, sprite);
      }
      sprite.setPosition(explosion.worldPosition.x, explosion.worldPosition.y);
    });

    this.pruneSprites(this.explosionSprites, snapshot.explosions);
  }

  private syncPowerUps(snapshot: GameStateSnapshot) {
    Object.values(snapshot.powerUps).forEach((powerUp) => {
      const definition = getPowerUpDefinition(powerUp.powerUpType);
      if (!powerUp.available) {
        const existing = this.powerUpSprites.get(powerUp.id);
        if (existing) {
          existing.destroy();
          this.powerUpSprites.delete(powerUp.id);
          this.showPowerUpPopup(powerUp.worldPosition.x, powerUp.worldPosition.y, definition.label, definition.color);
        }
        return;
      }

      let sprite = this.powerUpSprites.get(powerUp.id);
      if (!sprite) {
        sprite = this.add.circle(
          powerUp.worldPosition.x,
          powerUp.worldPosition.y,
          this.config.cellSize * 0.25,
          definition.color,
        );
        this.powerUpSprites.set(powerUp.id, sprite);
      }
      sprite.setPosition(powerUp.worldPosition.x, powerUp.worldPosition.y);
    });

    const availableRecord: Record<string, GameStateSnapshot['powerUps'][string]> = {};
    Object.entries(snapshot.powerUps).forEach(([id, powerUp]) => {
      if (powerUp.available) {
        availableRecord[id] = powerUp;
      }
    });
    this.pruneSprites(this.powerUpSprites, availableRecord);
  }

  private showPowerUpPopup(x: number, y: number, label: string, color: number) {
    const text = this.add.text(x, y - this.config.cellSize * 0.4, label, {
      fontSize: '20px',
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: text.y - this.config.cellSize * 0.5,
      alpha: 0,
      duration: 1200,
      delay: 200,
      ease: 'Quadratic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private pruneSprites(collection: RenderCollection<Phaser.GameObjects.GameObject>, stateRecord: Record<string, unknown>) {
    Array.from(collection.entries()).forEach(([id, sprite]) => {

      if (!stateRecord[id]) {
        // console.log(`Pruning sprite with id: ${id}`); // todo remove
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

  private updateDebugInfo(snapshot: GameStateSnapshot) {
    if (!this.debugText) return;
    this.lastUpdateTick = snapshot.tick;
    const ping = this.useServer ? (window.performance?.now() ?? 0) - snapshot.timestamp : undefined;
    const predictionSize = (this.interface as any).predictionBuffer?.length ?? 0;
    const lines = [
      `Tick: ${snapshot.tick}`,
      `Mode: ${this.useServer ? 'Networked' : 'Local'}`,
    ];
    if (this.useServer) {
      const clampedPing = ping != null ? Math.max(0, Math.round(ping)) : 'N/A';
      lines.push(`Ping(ms): ${clampedPing}`);
      lines.push(`Predicted Inputs: ${predictionSize}`);
    }
    this.debugText.setText(lines);
  }

  private syncShieldSprite(player: GameStateSnapshot['players'][string], sprite: Phaser.GameObjects.Image) {
    const radius = this.config.cellSize * 0.4;
    if (player.status.shielded) {
      let shield = this.shieldSprites.get(player.id);
      if (!shield) {
        shield = this.add.circle(player.worldPosition.x, player.worldPosition.y, radius, 0x66ff00, 0.25);
        shield.setStrokeStyle(2, 0x99ff99, 0.6);
        this.shieldSprites.set(player.id, shield);
      }
      shield.setPosition(player.worldPosition.x, player.worldPosition.y);
      shield.setDepth(sprite.depth + 1);
    } else {
      this.destroyShieldSprite(player.id);
    }
  }

  private destroyShieldSprite(playerId: string) {
    const shield = this.shieldSprites.get(playerId);
    shield?.destroy();
    this.shieldSprites.delete(playerId);
  }

  private ensureInvincibilityTween(playerId: string, sprite: Phaser.GameObjects.Image, baseAlpha: number) {
    if (this.invincibilityTweens.has(playerId)) return;
    sprite.setAlpha(baseAlpha);
    const tween = this.tweens.add({
      targets: sprite,
      alpha: { from: baseAlpha, to: 0.2 },
      duration: 300,
      yoyo: true,
      repeat: -1,
    });
    this.invincibilityTweens.set(playerId, tween);
  }

  private stopInvincibilityTween(playerId: string, sprite?: Phaser.GameObjects.Image, baseAlpha = 1) {
    const tween = this.invincibilityTweens.get(playerId);
    if (tween) {
      tween.stop();
      this.invincibilityTweens.delete(playerId);
    }
    if (sprite) {
      sprite.setAlpha(baseAlpha);
    }
  }

  private cleanupPlayerAttachments(players: Record<string, GameStateSnapshot['players'][string]>) {
    Array.from(this.shieldSprites.keys()).forEach((id) => {
      if (!players[id]) {
        this.destroyShieldSprite(id);
      }
    });

    Array.from(this.invincibilityTweens.keys()).forEach((id) => {
      if (!players[id]) {
        this.stopInvincibilityTween(id);
      }
    });
  }

  private handleMatchEnd(payload: { matchId: string; reason: string }) {
    if (this.matchConcluded) return;
    this.matchConcluded = true;
    this.showMatchOverlay(`Match ended: ${payload.reason}`);
    this.time.delayedCall(2000, () => {
      this.scene.start('MenuScene', { resultMessage: `Match ended: ${payload.reason}` });
    });
  }

  private showMatchOverlay(message: string) {
    if (!this.matchOverlay) {
      this.matchOverlay = this.add.text(this.scale.width / 2, this.scale.height / 2, message, {
        fontSize: '32px',
        color: '#ffdd55',
        backgroundColor: '#000000aa',
        padding: { left: 20, right: 20, top: 10, bottom: 10 },
      }).setOrigin(0.5).setDepth(2000);
    } else {
      this.matchOverlay.setText(message);
      this.matchOverlay.setVisible(true);
    }
  }

  private cleanupNetwork() {
    (this.interface as any)?.destroy?.();
    this.networkSocket?.disconnect();
  }
}
