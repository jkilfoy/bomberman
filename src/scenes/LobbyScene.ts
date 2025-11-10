// client/src/scenes/MenuScene.ts
import Phaser from "phaser";
import { createNetwork } from "../client/network";

export default class LobbyScene extends Phaser.Scene {
  network = createNetwork();

  constructor() { super({ key: "LobbyScene" }); }

  create() {
    const btn = this.add.text(100, 100, "Play (Join Lobby)").setInteractive();
    btn.on("pointerup", () => {
      this.network.joinLobby("Player-" + Math.floor(Math.random()*1000));
    });

    this.network.socket.on("lobby_count", (data: { count: number }) => {
      console.log("Lobby count:", data.count);
    });

    this.network.socket.on("match_start", (payload: any) => {
      console.log("Match starting:", payload);
      // Save match data and switch to GameScene
      this.scene.start("MenuScene", { match: payload, network: this.network });
    });
  }
}
