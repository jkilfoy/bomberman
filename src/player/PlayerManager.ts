import { Character } from "../characters/Characters";
import { EntityManager } from "../core/EntityManager";
import { GridCoordinate } from "../core/GridSystem";
import { Controller } from "../input/Controller";
import { Player, PlayerProperties } from "./Player";


export class PlayerManager extends EntityManager<Player> {

    subscribeToEvents(): void {
        this.context.events.on('player:death', this.handlePlayerDeath)
    }
    
    spawn(coords: GridCoordinate, character: Character, controller: Controller): Player {
        const props: PlayerProperties = {
            context: this.context,
            gridCoordinates: coords,
            character: character,
            controller: controller
        }

        const player = new Player(props);
        this.entities.push(player);

        console.log(player)
        return player;
    }

    getAlivePlayers() {
        return this.entities.filter(p => p.alive);
    }

    handlePlayerDeath(player: Player) {
        this.remove(player)
    }

    destroy() {
        this.context.events.off('enemy:death', this.handlePlayerDeath, this)
        this.destroyAll()
    }
}