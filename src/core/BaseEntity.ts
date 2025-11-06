import Phaser from 'phaser';
import { GameEvents } from './EventManager';

/**
 * A common logical base for all visible game entities.
 * Each entity wraps a Phaser.GameObject
 */
export abstract class BaseEntity {
    protected scene: Phaser.Scene;
    protected gameObject: Phaser.GameObjects.GameObject;
    protected events = GameEvents
    
    protected alive = true;

    constructor(scene: Phaser.Scene, gameObject: Phaser.GameObjects.GameObject) {
        this.scene = scene;
        this.gameObject = gameObject;
    }

    /** Called each frame by managers or the scene */
    abstract updateEntity(time: number, delta: number): void;

    /** Emit an event globally */
    emit(event: string, ...args: any[]): void {
        this.events.emit(event, ...args);
    }

    /** Subscribe to a global event */
    on(event: string, callback: (...args: any[]) => void, context?: any): void {
        this.events.on(event, callback, context) ?? this;
    }

    /** Unsubscribe from an event */
    off(event: string, callback: (...args: any[]) => void, context?: any): void {
        this.events.off(event, callback, context ?? this);
    }

    /** Marks this entity as destroyed and removes its game object from the scene */
    destroyEntity(): void {
        if (!this.alive) return;
        this.alive = false;
        this.gameObject.destroy();
    }

    /** Whether this entity is still active/alive */
    isAlive(): boolean {
        return this.alive;
    }

    /** Position helpers (useful abstraction layer) */
    setPosition(x: number, y: number): void {
        (this.gameObject as any).setPosition?.(x, y);
    }

    getPosition(): Phaser.Math.Vector2 {
        const go = this.gameObject as any;
        return new Phaser.Math.Vector2(go.x ?? 0, go.y ?? 0);
    }
}