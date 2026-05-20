import { io, type Socket } from 'socket.io-client';
import type { EnemySendPayload, GameEvent, MatchStartPayload } from '@bto/shared';

export const SOCKET_URL_KEY = 'bto_socket_url';

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

export function getSavedSocketUrl(): string {
  try {
    return localStorage.getItem(SOCKET_URL_KEY)?.trim().replace(/\/$/, '') ?? '';
  } catch {
    return '';
  }
}

export function setSavedSocketUrl(url: string): void {
  const u = url.trim().replace(/\/$/, '');
  try {
    if (u) localStorage.setItem(SOCKET_URL_KEY, u);
    else localStorage.removeItem(SOCKET_URL_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Thứ tự: build env → localStorage (GitHub Pages) → ?server= → cùng origin (Docker/dev).
 */
export function getSocketServerUrl(): string {
  const env = import.meta.env.VITE_SOCKET_URL as string | undefined;
  if (env?.trim()) return env.trim().replace(/\/$/, '');

  const saved = getSavedSocketUrl();
  if (saved) return saved;

  const q = new URLSearchParams(window.location.search).get('server')?.trim();
  if (q) return q.replace(/\/$/, '');

  if (import.meta.env.PROD && import.meta.env.BASE_URL !== '/') {
    return '';
  }
  return window.location.origin;
}

export function isSocketConfigured(): boolean {
  return getSocketServerUrl().length > 0;
}

export function socketConfigHint(): string {
  if (isSocketConfigured()) return `Đang dùng server: ${getSocketServerUrl()}`;
  if (import.meta.env.PROD && import.meta.env.BASE_URL !== '/') {
    return 'GitHub Pages: dán URL server Render vào ô bên dưới rồi bấm «Lưu» (xem docs/GITHUB_PAGES.md).';
  }
  return 'Docker/dev: chạy docker compose hoặc npm run dev:server — không cần nhập URL.';
}

/** Kiểm tra REST /health (CORS phải bật trên server). */
export async function testSocketServerHealth(baseUrl: string): Promise<{ ok: boolean; message: string }> {
  const url = baseUrl.trim().replace(/\/$/, '');
  if (!url) return { ok: false, message: 'Chưa nhập URL server.' };
  try {
    const res = await fetch(`${url}/health`, { mode: 'cors' });
    if (!res.ok) return { ok: false, message: `Server trả lỗi HTTP ${res.status}` };
    const data = (await res.json()) as { ok?: boolean; service?: string };
    if (data.ok) return { ok: true, message: 'Kết nối server OK — có thể tạo phòng.' };
    return { ok: false, message: 'Phản hồi /health không hợp lệ.' };
  } catch {
    return {
      ok: false,
      message:
        'Không gọi được /health. Kiểm tra URL, server Render đang chạy, và CORS_ORIGIN có domain GitHub Pages của bạn.',
    };
  }
}

export class MatchSocket {
  private socket: Socket | null = null;
  private handlers: MatchSocketHandlers = {};
  private _connected = false;
  private _myId = '';
  private lastUrl = '';

  get connected(): boolean {
    return this._connected;
  }

  get myId(): string {
    return this._myId;
  }

  connect(handlers: MatchSocketHandlers): void {
    const url = getSocketServerUrl();
    if (!url) {
      handlers.onError?.(
        'Chưa có máy chủ game. Nhập URL Render (https://...) ở trang chủ → Lưu → Kiểm tra kết nối.',
      );
      return;
    }

    this.handlers = handlers;

    if (this.socket && this.lastUrl !== url) {
      this.socket.disconnect();
      this.socket = null;
      this._connected = false;
    }
    this.lastUrl = url;

    if (this.socket?.connected) {
      handlers.onConnect?.();
      return;
    }

    this.socket = io(url, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      timeout: 12_000,
    });

    this.socket.on('connect', () => {
      this._connected = true;
      this._myId = this.socket?.id ?? '';
      handlers.onConnect?.();
    });

    this.socket.on('disconnect', () => {
      this._connected = false;
    });

    this.socket.on('connect_error', (err: Error) => {
      this._connected = false;
      handlers.onError?.(
        `Không kết nối Socket (${url}): ${err.message || 'lỗi mạng'}. Server Render có đang wake-up?`,
      );
    });

    this.socket.on('room.error', (data: { message?: string }) => {
      handlers.onError?.(data?.message ?? 'Lỗi phòng');
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
    this.lastUrl = '';
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
