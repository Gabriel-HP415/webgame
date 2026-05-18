/**
 * Phase 2 stub — authoritative match room with event-driven sync.
 * Run: npm run dev:server
 */
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { EnemySendPayload, GameEvent, MatchStartPayload } from '@bto/shared';

const corsOrigin = process.env.CORS_ORIGIN ?? '*';
const corsOptions =
  corsOrigin === '*'
    ? { origin: true as const }
    : { origin: corsOrigin.split(',').map((o) => o.trim()) };

const app = express();
app.use(cors(corsOptions));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'bto-server' }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: corsOptions });

interface Room {
  id: string;
  seq: number;
  players: Set<string>;
  events: GameEvent[];
}

const rooms = new Map<string, Room>();

function nextRoomId(): string {
  return `room_${Math.random().toString(36).slice(2, 9)}`;
}

io.on('connection', (socket) => {
  socket.on('queue.join', (payload: { mode: string }) => {
    const roomId = nextRoomId();
    const room: Room = { id: roomId, seq: 0, players: new Set([socket.id]), events: [] };
    rooms.set(roomId, room);
    socket.join(roomId);

    const start: GameEvent<MatchStartPayload> = {
      seq: room.seq++,
      t: Date.now(),
      playerId: 'server',
      type: 'match.start',
      payload: {
        seed: Math.floor(Math.random() * 1e9),
        mapId: 'neon_grid',
        players: [{ id: socket.id, name: 'Player' }],
      },
    };
    room.events.push(start);
    socket.emit('match.found', { roomId, mode: payload.mode });
    socket.emit('game.event', start);
  });

  socket.on('enemy.send', (payload: EnemySendPayload) => {
    const roomId = [...socket.rooms].find((r) => r.startsWith('room_'));
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const evt: GameEvent<EnemySendPayload> = {
      seq: room.seq++,
      t: Date.now(),
      playerId: socket.id,
      type: 'enemy.send',
      payload,
    };
    room.events.push(evt);

    const spawnEvt: GameEvent<EnemySendPayload & { ownerId: string }> = {
      seq: room.seq++,
      t: Date.now(),
      playerId: socket.id,
      type: 'enemy.spawn',
      payload: { ...payload, ownerId: socket.id },
    };
    room.events.push(spawnEvt);
    io.to(roomId).emit('game.event', spawnEvt);
  });

  socket.on('disconnect', () => {
    for (const [id, room] of rooms) {
      room.players.delete(socket.id);
      if (room.players.size === 0) rooms.delete(id);
    }
  });
});

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST ?? '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  console.log(`BTO server listening on ${HOST}:${PORT}`);
});
