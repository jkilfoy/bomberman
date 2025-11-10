import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { LobbyManager, LobbyEntry } from './lobby/LobbyManager';

const PORT = Number(process.env.PORT) || 4000;

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const startStubMatch = (players: LobbyEntry[]) => {
  const matchId = `match-${Date.now()}`;
  console.log(`[Match] Starting stub ${matchId} with: ${players.map((p) => p.playerId).join(', ')}`);
  players.forEach((entry) => {
    entry.socket?.emit('match:start', { matchId, playerId: entry.playerId });
  });
};

const lobby = new LobbyManager(startStubMatch);

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
