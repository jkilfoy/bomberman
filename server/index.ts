import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { GameEngine, GameEngineOptions } from '../src/game/GameEngine';
import { GameMode } from '../src/core/GameConfig';
import { PlayerInputMessage, GameUpdateMessage } from '../src/game/net/types';

const PORT = Number(process.env.PORT) || 4000;
const TICK_INTERVAL = 1000 / 60;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const gameOptions: GameEngineOptions = {
  config: {
    mode: GameMode.arena,
    gridWidth: 13,
    gridHeight: 11,
    cellSize: 64,
    tickIntervalMs: TICK_INTERVAL,
  },
};

const engine = new GameEngine(gameOptions);
const connectedPlayers = new Map<string, string>(); // socketId -> playerId

io.on('connection', (socket) => {
  const playerId = engine.spawnPlayer({
    characterKey: 'eric',
    name: `Player-${socket.id.substring(0, 4)}`,
    spawn: { col: 0, row: 0 },
  });
  connectedPlayers.set(socket.id, playerId);

  const snapshot = engine.getSnapshot();
  const update: GameUpdateMessage = {
    tick: snapshot.tick,
    timestamp: snapshot.timestamp,
    fullSnapshot: true,
    snapshot,
  };
  socket.emit('game:update', update);

  socket.on('player:input', (message: PlayerInputMessage) => {
    if (message.playerId !== playerId) return;
    engine.enqueueInput(message.input);
  });

  socket.on('disconnect', () => {
    connectedPlayers.delete(socket.id);
    engine.removePlayer(playerId);
  });
});

setInterval(() => {
  engine.advance();
  const delta = engine.getSnapshotDelta();
  if (!delta) return;

  const snapshot = engine.getSnapshot();
  const update: GameUpdateMessage = {
    tick: snapshot.tick,
    timestamp: snapshot.timestamp,
    delta,
  };
  io.emit('game:update', update);
}, TICK_INTERVAL);

server.listen(PORT, () => {
  console.log(`Game server listening on port ${PORT}`);
});
