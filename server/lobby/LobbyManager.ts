import type { Socket } from 'socket.io';

export interface LobbyEntry {
  socket?: Socket;
  socketId?: string;
  playerId: string;
  characterKey: string;
}

export interface MatchStarter {
  (players: LobbyEntry[]): void;
}

export class LobbyManager {
  private queue: LobbyEntry[] = [];
  private matchCount = 0;

  constructor(private onMatchReady: MatchStarter) {}

  enqueue(entry: LobbyEntry) {
    this.queue.push(entry);
    console.log(`[Lobby.enqueue] ${entry.playerId} joined queue. size=${this.queue.length}`);
    this.maybeStartMatch();
    return this.queue.length;
  }

  removeBySocket(socketId: string) {
    const before = this.queue.length;
    this.queue = this.queue.filter((entry) => entry.socketId !== socketId);
    if (before !== this.queue.length) {
      console.log(`[Lobby.removeBySocket] Socket ${socketId} disconnected; queue size now ${this.queue.length}`);
    }
  }

  private maybeStartMatch() {
    while (this.queue.length >= 4) {
      const players = this.queue.splice(0, 4);
      this.startMatch(players);
    }
  }

  private startMatch(players: LobbyEntry[]) {
    this.matchCount += 1;
    const matchId = `match-${this.matchCount}`;
    console.log(`[Lobby.startMatch] Starting match ${matchId} with: ${players.map((p) => p.playerId).join(', ')}`);
    this.onMatchReady(players);
  }
}
