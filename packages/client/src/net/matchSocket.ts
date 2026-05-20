import { io, type Socket } from 'socket.io-client';
import type { EnemySendPayload, GameEvent, MatchStartPayload } from '@bto/shared';

export interface RoomCreatedInfo {
  roomId: string;
  mapId: string;
  playerIndex: number;
}

export interface MatchSocketHandlers {
  onMatchStart?: (evt: GameEvent<MatchStartPayload>, mySocketId: string) => void;
  onEnemySpawn?: (evt: GameEvent<EnemySendPayload & { ownerId: string; ownerName: string }>) => void;
  onPlayerJoined?: (players: { name: string; id: string }[]) => void;
  onPlayerLeft?: (name: string) => void;
  onError?: (message: string) => void;
  onConnect?: () => void;
}

/** URL server Socket.io — CI: secret VITE_SOCKET_URL. Dev/Docker: cùng origin + proxy. */
export function getSocketServerUrl(): string {
  const env = import.meta.env.VITE_SOCKET_URL as string | undefined;
  if (env && env.trim()) return env.trim().replace(/\/$/, '');
  // GitHub Pages chỉ host static — không có Socket trên cùng origin
  if (import.meta.env.PROD && import.meta.env.BASE_URL !== '/') {
    return '';
  }
  return window.location.origin;
}

export class MatchSocket {
  private socket: Socket | null = null;
  private handlers: MatchSocketHandlers = {};
  private _connected = false;
  private _myId = '';

  get connected(): boolean {
    return this._connected;
  }

  get myId(): string {
    return this._myId;
  }

  connect(handlers: MatchSocketHandlers): void {
    this.handlers = handlers;
    if (this.socket?.connected) return;

    this.socket = io(getSocketServerUrl(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      this._connected = true;
      this._myId = this.socket?.id ?? '';
      handlers.onConnect?.();
    });

    this.socket.on('disconnect', () => {
      this._connected = false;
    });

    this.socket.on('room.error', (data: { message?: string }) => {
      handlers.onError?.(data?.message ?? 'Lỗi phòng');
    });

    this.socket.on('room.created', (_data: RoomCreatedInfo) => {
      /* handled by createRoom caller */
    });

    this.socket.on('room.joined', (data: { players: { name: string; id: string }[] }) => {
      handlers.onPlayerJoined?.(data.players);
    });

    this.socket.on('room.player_joined', (data: { players: { name: string; id: string }[] }) => {
      handlers.onPlayerJoined?.(data.players);
    });

    this.socket.on('room.player_left', (data: { name?: string }) => {
      handlers.onPlayerLeft?.(data.name ?? 'Đối thủ');
    });

    this.socket.on('match.start', (evt: GameEvent<MatchStartPayload>) => {
      handlers.onMatchStart?.(evt, this._myId);
    });

    this.socket.on('enemy.spawn', (evt: GameEvent<EnemySendPayload & { ownerId: string; ownerName: string }>) => {
      handlers.onEnemySpawn?.(evt);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this._connected = false;
  }

  createRoom(name: string, mapId: string): Promise<RoomCreatedInfo> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Chưa kết nối server'));
        return;
      }

      const onCreated = (data: RoomCreatedInfo) => {
        this.socket?.off('room.error', onErr);
        resolve(data);
      };
      const onErr = (data: { message?: string }) => {
        this.socket?.off('room.created', onCreated);
        reject(new Error(data?.message ?? 'Không tạo được phòng'));
      };

      this.socket.once('room.created', onCreated);
      this.socket.once('room.error', onErr);
      this.socket.emit('room.create', { name, mapId });
    });
  }

  joinRoom(roomId: string, name: string): void {
    this.socket?.emit('room.join', { roomId: roomId.trim().toUpperCase(), name });
  }

  sendEnemy(payload: EnemySendPayload): void {
    this.socket?.emit('enemy.send', payload);
  }
}

export const matchSocket = new MatchSocket();
