import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { LobbyManager, LobbyEntry } from './lobby/LobbyManager';
import { Match } from './match/Match';

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

const startMatch = (players: LobbyEntry[]) => {
  matchCounter += 1;
  const matchId = `match-${matchCounter}`;
  console.log(`[Match] Starting ${matchId} with: ${players.map((p) => p.playerId).join(', ')}`);
  players.forEach((entry) => entry.socket?.emit('match:start', { matchId, playerId: entry.playerId }));
  const match = new Match(io, matchId, players, (finishedId) => {
    activeMatches.delete(finishedId);
    console.log(`[Match] ${finishedId} cleaned up.`);
  });
  activeMatches.set(matchId, match);
};

const lobby = new LobbyManager(startMatch);

app.post('/lobby/join', (req, res) => {
  const { playerId, characterKey } = req.body ?? {};
  if (!playerId || !characterKey) {
    return res.status(400).json({ error: 'playerId and characterKey are required' });
  }
  const position = lobby.enqueue({ playerId, characterKey });
  res.json({ position });
});

io.on('connection', (socket) => {
  socket.on('lobby:join', (payload: { playerId?: string; characterKey?: string }) => {
    if (!payload?.playerId || !payload.characterKey) {
      socket.emit('lobby:error', { error: 'playerId and characterKey required' });
      return;
    }
    const position = lobby.enqueue({
      socket,
      socketId: socket.id,
      playerId: payload.playerId,
      characterKey: payload.characterKey,
    });
    socket.emit('lobby:queued', { position });
  });

  socket.on('disconnect', () => {
    lobby.removeBySocket(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Game server listening on port ${PORT}`);
});
