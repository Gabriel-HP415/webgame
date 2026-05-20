/**
 * Socket.io match rooms — 2 người / phòng, relay gửi quân.
 * Deploy: Render / Railway / Fly (WebSocket). Client static: Vercel.
 */
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { EnemySendPayload, GameEvent, MatchStartPayload } from '@bto/shared';
import { resolveMapId } from '@bto/shared';

const corsOrigin = process.env.CORS_ORIGIN ?? '*';
const corsOptions =
  corsOrigin === '*'
    ? { origin: true as const }
    : { origin: corsOrigin.split(',').map((o) => o.trim()) };

const app = express();
app.use(cors(corsOptions));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'bto-server' }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions,
  path: '/socket.io',
});

interface RoomPlayer {
  socketId: string;
  name: string;
  index: 0 | 1;
}

interface Room {
  id: string;
  mapId: string;
  hostSocketId: string;
  players: RoomPlayer[];
  started: boolean;
  seq: number;
}

const rooms = new Map<string, Room>();

function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? makeRoomCode() : code;
}

function roomForSocket(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.socketId === socketId)) return room;
  }
  return undefined;
}

function emitToRoom(room: Room, event: string, payload: unknown) {
  for (const p of room.players) {
    io.to(p.socketId).emit(event, payload);
  }
}

function startMatch(room: Room) {
  if (room.started || room.players.length < 2) return;
  room.started = true;

  const start: GameEvent<MatchStartPayload> = {
    seq: room.seq++,
    t: Date.now(),
    playerId: 'server',
    type: 'match.start',
    payload: {
      seed: Math.floor(Math.random() * 1e9),
      mapId: room.mapId,
      players: room.players.map((p) => ({ id: p.socketId, name: p.name })),
    },
  };

  emitToRoom(room, 'match.start', start);
}

io.on('connection', (socket) => {
  socket.on('room.create', (payload: { name?: string; mapId?: string }) => {
    const roomId = makeRoomCode();
    const mapId = resolveMapId(payload?.mapId ?? 'neon_crossroads');
    const name = (payload?.name ?? 'Host').slice(0, 24) || 'Host';

    const room: Room = {
      id: roomId,
      mapId,
      hostSocketId: socket.id,
      players: [{ socketId: socket.id, name, index: 0 }],
      started: false,
      seq: 0,
    };
    rooms.set(roomId, room);
    socket.join(roomId);

    socket.emit('room.created', {
      roomId,
      mapId,
      inviteUrl: null,
      playerIndex: 0,
    });
  });

  socket.on('room.join', (payload: { roomId: string; name?: string }) => {
    const roomId = (payload?.roomId ?? '').trim().toUpperCase();
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('room.error', { message: 'Không tìm thấy phòng. Kiểm tra mã phòng.' });
      return;
    }

    const existing = room.players.find((p) => p.socketId === socket.id);
    if (existing) {
      socket.join(roomId);
      socket.emit('room.joined', {
        roomId,
        mapId: room.mapId,
        playerIndex: existing.index,
        players: room.players.map((p) => ({ name: p.name, id: p.socketId })),
        started: room.started,
      });
      if (room.started) {
        const startEvt: GameEvent<MatchStartPayload> = {
          seq: room.seq,
          t: Date.now(),
          playerId: 'server',
          type: 'match.start',
          payload: {
            seed: 0,
            mapId: room.mapId,
            players: room.players.map((p) => ({ id: p.socketId, name: p.name })),
          },
        };
        socket.emit('match.start', startEvt);
      }
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('room.error', { message: 'Phòng đã đủ 2 người chơi.' });
      return;
    }

    const name = (payload?.name ?? 'Guest').slice(0, 24) || 'Guest';
    room.players.push({ socketId: socket.id, name, index: 1 });
    socket.join(roomId);

    emitToRoom(room, 'room.player_joined', {
      roomId,
      players: room.players.map((p) => ({ name: p.name, id: p.socketId })),
    });

    socket.emit('room.joined', {
      roomId,
      mapId: room.mapId,
      playerIndex: 1,
      players: room.players.map((p) => ({ name: p.name, id: p.socketId })),
      started: false,
    });

    startMatch(room);
  });

  socket.on('enemy.send', (payload: EnemySendPayload) => {
    const room = roomForSocket(socket.id);
    if (!room || !room.started) return;

    const spawnEvt: GameEvent<EnemySendPayload & { ownerId: string; ownerName: string }> = {
      seq: room.seq++,
      t: Date.now(),
      playerId: socket.id,
      type: 'enemy.spawn',
      payload: {
        ...payload,
        ownerId: socket.id,
        ownerName: room.players.find((p) => p.socketId === socket.id)?.name ?? 'Địch',
      },
    };

    for (const p of room.players) {
      if (p.socketId !== socket.id) {
        io.to(p.socketId).emit('enemy.spawn', spawnEvt);
      }
    }
  });

  socket.on('disconnect', () => {
    for (const [id, room] of rooms) {
      const idx = room.players.findIndex((p) => p.socketId === socket.id);
      if (idx === -1) continue;

      const leaving = room.players[idx];
      room.players.splice(idx, 1);

      for (const p of room.players) {
        io.to(p.socketId).emit('room.player_left', {
          roomId: id,
          name: leaving.name,
        });
      }

      if (room.players.length === 0) {
        rooms.delete(id);
      } else {
        room.started = false;
      }
      break;
    }
  });
});

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST ?? '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  console.log(`BTO server listening on ${HOST}:${PORT}`);
});
