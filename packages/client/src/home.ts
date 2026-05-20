import {
  getSavedSocketUrl,
  getSocketServerUrl,
  isSocketConfigured,
  matchSocket,
  setSavedSocketUrl,
  socketConfigHint,
  testSocketServerHealth,
} from './net/matchSocket.js';

const KEY = 'bto_pilot_name';
const MAP_KEY = 'bto_map_id';

const input = document.getElementById('pilot-name') as HTMLInputElement | null;
const mapSelect = document.getElementById('map-select') as HTMLSelectElement | null;
const btnAi = document.getElementById('btn-ai') as HTMLAnchorElement | null;
const btnPvp = document.getElementById('btn-pvp') as HTMLAnchorElement | null;

const socketUrlInput = document.getElementById('socket-server-url') as HTMLInputElement | null;
const btnSaveServer = document.getElementById('btn-save-server') as HTMLButtonElement | null;
const btnTestServer = document.getElementById('btn-test-server') as HTMLButtonElement | null;
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

if (socketUrlInput) {
  socketUrlInput.value = getSavedSocketUrl();
}

function refreshServerHint() {
  if (serverHint) serverHint.textContent = socketConfigHint();
}

function pilotName(): string {
  return input?.value.trim().slice(0, 24) || 'Pilot';
}

function selectedMap(): string {
  return mapSelect?.value ?? 'neon_crossroads';
}

function appBase(): string {
  const b = import.meta.env.BASE_URL || '/';
  return b.endsWith('/') ? b : `${b}/`;
}

function buildGameHref(mode: 'ai' | 'pvp' | 'online', roomId?: string): string {
  const u = new URL(`${appBase()}game.html`, window.location.origin);
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

function waitForSocketConnect(): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    };

    const timer = window.setTimeout(
      () => finish(new Error('Hết thời gian chờ Socket. Render free có thể ngủ ~30s — thử «Kiểm tra kết nối» lại.')),
      25_000,
    );

    matchSocket.connect({
      onConnect: () => finish(),
      onError: (msg) => finish(new Error(msg)),
    });
  });
}

refreshServerHint();
syncGameLinks();

if (btnSaveServer && socketUrlInput) {
  btnSaveServer.addEventListener('click', () => {
    setSavedSocketUrl(socketUrlInput.value);
    matchSocket.disconnect();
    refreshServerHint();
    setOnlineStatus('Đã lưu URL server trên trình duyệt này.', false);
  });
}

if (btnTestServer && socketUrlInput) {
  btnTestServer.addEventListener('click', async () => {
    setSavedSocketUrl(socketUrlInput.value);
    refreshServerHint();
    setOnlineStatus('Đang kiểm tra /health…');
    btnTestServer.disabled = true;
    const result = await testSocketServerHealth(getSocketServerUrl() || socketUrlInput.value);
    setOnlineStatus(result.message, !result.ok);
    btnTestServer.disabled = false;
  });
}

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
    if (socketUrlInput?.value.trim()) {
      setSavedSocketUrl(socketUrlInput.value);
      refreshServerHint();
    }

    if (!isSocketConfigured()) {
      setOnlineStatus(
        'Chưa có URL máy chủ. Deploy server lên Render (miễn phí), dán URL vào ô trên → Lưu → Kiểm tra kết nối.',
        true,
      );
      return;
    }

    btnCreateRoom.disabled = true;
    setOnlineStatus('Đang kết nối Socket… (lần đầu Render có thể chậm)');
    try {
      matchSocket.disconnect();
      await waitForSocketConnect();
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
    if (socketUrlInput?.value.trim()) setSavedSocketUrl(socketUrlInput.value);

    const code = roomCodeInput.value.trim().toUpperCase();
    if (code.length < 4) {
      setOnlineStatus('Nhập mã phòng (6 ký tự).', true);
      return;
    }
    if (!isSocketConfigured()) {
      setOnlineStatus('Lưu URL server Render trước khi tham gia phòng.', true);
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
