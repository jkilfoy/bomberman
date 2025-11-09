import Phaser from 'phaser';
import { GameEvents } from './EventManager';
import { GameContext } from './GameContext';
import { GridCoordinate, WorldCoordinate } from './GridSystem';
import { Rectangle } from '../collision/Rectangle';

/**
 * Properties to be passed to a constructor of an entity
 * Child entities should have their constructor accept an extenion of these properties  
 */
export interface EntityProperties {
    context: GameContext
}

/**
 * A common logical base for all visible game entities.
 * Each entity wraps a Phaser.GameObject
 */
export abstract class BaseEntity<
    T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & {width: number, height: number}
> {
    protected context: GameContext;
    protected gameObject: T;
    protected events = GameEvents


    constructor(props: EntityProperties, gameObject: T) {
        this.context = props.context;
        this.gameObject = gameObject;
    }

    /** Public access to gameObject */
    getGameObject(): T {
        return this.gameObject
    }

    /** Called each frame by managers or the scene */
    update(time: number, delta: number): void {
        // by default, nothing to update
    }

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
    destroy(): void {
        this.gameObject.destroy();
    }


    /**
     * Returns grid coordinates of the entity
     */
    getGridCoordinates(): GridCoordinate {
        return this.context.grid.worldToGrid(this.getWorldCoordinates())
    }

    setGridCoordinates(coords: GridCoordinate) {
        const worldCoords: WorldCoordinate = this.context.grid.gridToWorld(coords)
        this.setWorldCoordinate(worldCoords)
    }

    /**
     * Returns world coordinates of the entity
     */
    getWorldCoordinates(): WorldCoordinate {
        return {x: this.gameObject.x, y: this.gameObject.y}
    }

    setWorldCoordinate(coords: WorldCoordinate) {
        this.gameObject.x = coords.x
        this.gameObject.y = coords.y
    }


    getWidth(): number {
        return this.gameObject.width
    }

    getHeight(): number {
        return this.gameObject.height
    }

    getRect(): Rectangle {
        const {x, y} = this.getWorldCoordinates()
        return {
            x: x,
            y: y,
            width: this.getWidth(),
            height: this.getHeight()
        }
    }

    
}