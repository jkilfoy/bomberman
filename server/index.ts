import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { LobbyManager, LobbyEntry } from './lobby/LobbyManager';
import { Match } from './match/Match';
import { getSpawnForIndex } from './match/spawnPositions';
import type { MatchPlayerInfo } from './match/types';

const PORT = Number(process.env.PORT) || 4000;

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const activeMatches = new Map<string, Match>();
let matchCounter = 0;
let playerCounter = 0;

const generatePlayerId = () => `player-${++playerCounter}`;

const startMatch = (players: LobbyEntry[]) => {
  matchCounter += 1;
  const matchId = `match-${matchCounter}`;
  console.log(`[Match] Starting ${matchId} with: ${players.map((p) => p.playerId).join(', ')}`);
  const roster: MatchPlayerInfo[] = players.map((entry, idx) => ({
    playerId: entry.playerId,
    characterKey: entry.characterKey,
    name: entry.playerId,
    spawn: getSpawnForIndex(idx),
  }));
  players.forEach((entry) => entry.socket?.emit('match:start', { matchId, playerId: entry.playerId, roster }));
  const match = new Match(io, matchId, players, roster, (finishedId) => {
    activeMatches.delete(finishedId);
    console.log(`[Match] ${finishedId} cleaned up.`);
  });
  activeMatches.set(matchId, match);
};

const lobby = new LobbyManager(startMatch);

app.post('/lobby/join', (req, res) => {
  const { characterKey } = req.body ?? {};
  if (!characterKey) {
    return res.status(400).json({ error: 'characterKey is required' });
  }
  const playerId = generatePlayerId();
  const position = lobby.enqueue({ playerId, characterKey });
  res.json({ position, playerId });
  lobby.processMatches();
});

io.on('connection', (socket) => {
  socket.on('lobby:join', (payload: { characterKey?: string }) => {
    if (!payload?.characterKey) {
      socket.emit('lobby:error', { error: 'characterKey required' });
      return;
    }
    const playerId = generatePlayerId();
    const position = lobby.enqueue({
      socket,
      socketId: socket.id,
      playerId,
      characterKey: payload.characterKey,
    });
    socket.emit('lobby:queued', { position, playerId });
    lobby.processMatches();
  });

  socket.on('disconnect', () => {
    lobby.removeBySocket(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Game server listening on port ${PORT}`);
});
