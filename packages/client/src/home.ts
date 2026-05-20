import { matchSocket, getSocketServerUrl } from './net/matchSocket.js';

const KEY = 'bto_pilot_name';
const MAP_KEY = 'bto_map_id';

const input = document.getElementById('pilot-name') as HTMLInputElement | null;
const mapSelect = document.getElementById('map-select') as HTMLSelectElement | null;
const btnAi = document.getElementById('btn-ai') as HTMLAnchorElement | null;
const btnPvp = document.getElementById('btn-pvp') as HTMLAnchorElement | null;

const btnCreateRoom = document.getElementById('btn-create-room') as HTMLButtonElement | null;
const btnJoinRoom = document.getElementById('btn-join-room') as HTMLButtonElement | null;
const roomCodeInput = document.getElementById('room-code') as HTMLInputElement | null;
const onlineStatus = document.getElementById('online-status') as HTMLElement | null;
const onlineRoomBox = document.getElementById('online-room-box') as HTMLElement | null;
const onlineRoomCode = document.getElementById('online-room-code') as HTMLElement | null;
const onlineInviteLink = document.getElementById('online-invite-link') as HTMLAnchorElement | null;
const btnEnterRoom = document.getElementById('btn-enter-room') as HTMLAnchorElement | null;
const serverHint = document.getElementById('server-hint') as HTMLElement | null;

if (input) {
  input.value = localStorage.getItem(KEY) ?? '';
  input.addEventListener('change', () => {
    const v = input.value.trim().slice(0, 24);
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  });
}

if (mapSelect) {
  const saved = localStorage.getItem(MAP_KEY);
  if (saved && Array.from(mapSelect.options).some((o) => o.value === saved)) {
    mapSelect.value = saved;
  }
  mapSelect.addEventListener('change', () => {
    localStorage.setItem(MAP_KEY, mapSelect.value);
    syncGameLinks();
  });
}

function pilotName(): string {
  return input?.value.trim().slice(0, 24) || 'Pilot';
}

function selectedMap(): string {
  return mapSelect?.value ?? 'neon_crossroads';
}

function buildGameHref(mode: 'ai' | 'pvp' | 'online', roomId?: string): string {
  const u = new URL('game.html', window.location.origin);
  u.searchParams.set('mode', mode);
  u.searchParams.set('map', selectedMap());
  const name = pilotName();
  if (name) u.searchParams.set('name', name);
  if (roomId) u.searchParams.set('room', roomId.toUpperCase());
  return u.pathname + u.search;
}

function syncGameLinks() {
  if (btnAi) btnAi.href = buildGameHref('ai');
  if (btnPvp) btnPvp.href = buildGameHref('pvp');
}

function setOnlineStatus(text: string, isError = false) {
  if (!onlineStatus) return;
  onlineStatus.textContent = text;
  onlineStatus.classList.toggle('is-error', isError);
}

function showRoomCreated(roomId: string) {
  const href = buildGameHref('online', roomId);
  if (onlineRoomBox) onlineRoomBox.hidden = false;
  if (onlineRoomCode) onlineRoomCode.textContent = roomId;
  if (onlineInviteLink) {
    onlineInviteLink.href = href;
    onlineInviteLink.textContent = href;
  }
  if (btnEnterRoom) btnEnterRoom.href = href;
  setOnlineStatus('Phòng đã tạo — gửi mã hoặc link cho bạn bè, rồi bấm «Vào trận».');
}

if (serverHint) {
  const url = getSocketServerUrl();
  serverHint.textContent =
    url === window.location.origin
      ? 'Dev: chạy npm run dev:server. Production: đặt VITE_SOCKET_URL trỏ máy chủ Render.'
      : `Server: ${url}`;
}

syncGameLinks();

if (btnAi) {
  btnAi.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = buildGameHref('ai');
  });
}

if (btnPvp) {
  btnPvp.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = buildGameHref('pvp');
  });
}

if (btnCreateRoom) {
  btnCreateRoom.addEventListener('click', async () => {
    btnCreateRoom.disabled = true;
    setOnlineStatus('Đang kết nối máy chủ…');
    try {
      await new Promise<void>((resolve, reject) => {
        const t = window.setTimeout(() => reject(new Error('Không kết nối được máy chủ game')), 12_000);
        matchSocket.connect({
          onConnect: () => {
            window.clearTimeout(t);
            resolve();
          },
          onError: (msg) => {
            window.clearTimeout(t);
            reject(new Error(msg));
          },
        });
      });
      const info = await matchSocket.createRoom(pilotName(), selectedMap());
      showRoomCreated(info.roomId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi tạo phòng';
      setOnlineStatus(msg, true);
    } finally {
      btnCreateRoom.disabled = false;
    }
  });
}

if (btnJoinRoom && roomCodeInput) {
  btnJoinRoom.addEventListener('click', () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (code.length < 4) {
      setOnlineStatus('Nhập mã phòng (6 ký tự).', true);
      return;
    }
    window.location.href = buildGameHref('online', code);
  });
}

document.querySelectorAll<HTMLAnchorElement>('a.home-btn-secondary[href*="game"]').forEach((a) => {
  if (a.id === 'btn-pvp' || a.id === 'btn-enter-room') return;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = buildGameHref('pvp');
  });
});
