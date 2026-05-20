import Phaser from 'phaser';
import type { MapDefinition, TowerId, UnitId } from '@bto/shared';
import {
  BRANCH_INFO,
  getMatchWave,
  getWaveSpawnPlan,
  MAP_CATALOG,
  resolveMapId,
  TOWERS,
  UNITS,
  type TowerBranchId,
} from '@bto/shared';
import { BoardScene, type BoardSceneConfig, type BoardSide } from './game/BoardScene.js';
import type { BoardState } from './game/BoardState.js';
import { isSocketConfigured, matchSocket } from './net/matchSocket.js';

const mapId = resolveMapId(new URLSearchParams(window.location.search).get('map'));
const mapEntry = MAP_CATALOG[mapId] ?? MAP_CATALOG.neon_crossroads;
const map = mapEntry.def as MapDefinition;

export type GameMode = 'ai' | 'pvp' | 'online';

/** Scene player — gán sau khi Phaser boot xong */
let playerScene: BoardScene | null = null;
let opponentScene: BoardScene | null = null;

function getGameMode(): GameMode {
  const m = new URLSearchParams(window.location.search).get('mode');
  if (m === 'online') return 'online';
  if (m === 'pvp') return 'pvp';
  return 'ai';
}

function getOnlineRoomId(): string | null {
  const room = new URLSearchParams(window.location.search).get('room');
  return room?.trim() ? room.trim().toUpperCase() : null;
}

function getPilotName(): string {
  return new URLSearchParams(window.location.search).get('name')?.trim().slice(0, 24) ?? 'Pilot';
}

function applyModeToDom(mode: GameMode) {
  document.body.classList.add(`game-mode-${mode}`);
  const battleMain = document.getElementById('battle-main');
  const dockSends = document.getElementById('dock-sends');
  const hint = document.getElementById('dock-hint');
  const label = document.getElementById('hud-mode-label');
  const mapLabel = mapEntry.label.toUpperCase();

  if (mode === 'ai') {
    battleMain?.classList.add('battle-main--solo');
    dockSends?.classList.add('is-hidden');
    if (hint) {
      hint.textContent =
        'Click slot trống xây tháp · Click tháp để nâng cấp (Lv3 chọn hiệu ứng) · Mortar nổ AOE · Boss mỗi 10 đợt · Chuột phải bán.';
    }
    if (label) label.textContent = `CHẾ ĐỘ AI — ${mapLabel}`;
  } else if (mode === 'online') {
    battleMain?.classList.add('battle-main--solo');
    document.querySelector('.board-wrap.opponent')?.classList.add('is-hidden');
    dockSends?.classList.remove('is-hidden');
    const room = getOnlineRoomId();
    if (label) {
      label.textContent = room
        ? `ONLINE 1v1 — Phòng ${room}`
        : `ONLINE — thiếu mã phòng`;
    }
    if (hint) {
      hint.textContent =
        'Gửi quân tốn vàng → quân xuất hiện trên bàn đối thủ · Không có AI · Chuột phải bán tháp.';
    }
  } else {
    if (label) label.textContent = `LUYỆN PvP — ${mapLabel}`;
    if (hint) {
      hint.textContent =
        'Hai bàn · gửi quân sang đối thủ · Flak/Laser chống bay · Chuột phải bán tháp.';
    }
  }

  const pilot = new URLSearchParams(window.location.search).get('name');
  if (pilot && label) {
    label.textContent += ` · ${pilot}`;
  }
}

function applyWideMapEconomy(state: BoardState) {
  if (map.slots.length >= 18) {
    state.gold = 520;
    state.income = 14;
  }
}

function renderDockTowerInfo(id: TowerId) {
  const t = TOWERS[id];
  const title = document.getElementById('dock-info-title');
  const summary = document.getElementById('dock-info-summary');
  const stats = document.getElementById('dock-info-stats');
  const traits = document.getElementById('dock-info-traits');
  if (!title || !summary || !stats || !traits) return;

  title.textContent = t.name;
  summary.textContent = t.summary;
  stats.innerHTML = `
    <li><span>Giá xây</span><strong>${t.buildCost} vàng</strong></li>
    <li><span>Sát thương</span><strong>${t.baseDamage}</strong></li>
    <li><span>Tầm</span><strong>${t.range} px</strong></li>
    <li><span>Hồi chiêu</span><strong>${t.fireRate > 0 ? `${(1 / t.fireRate).toFixed(2)}s` : '—'}</strong></li>
    <li><span>Bắn quân bay</span><strong>${t.targetsAir ? 'Có' : 'Không'}</strong></li>
    <li><span>AOE</span><strong>${t.aoeRadius ? 'Có' : 'Không'}</strong></li>
    <li><span>Loại sát thương</span><strong>${t.damageType}</strong></li>
  `;
  traits.innerHTML = t.traits.map((tr) => `<span class="dock-trait">${tr}</span>`).join('');
}

function setupDockTowerInfo() {
  document.querySelectorAll<HTMLButtonElement>('.dock-btn[data-tower]').forEach((btn) => {
    const id = btn.dataset.tower as TowerId;
    btn.addEventListener('mouseenter', () => renderDockTowerInfo(id));
    btn.addEventListener('focus', () => renderDockTowerInfo(id));
  });
  const active = document.querySelector<HTMLButtonElement>('.dock-btn[data-tower].active');
  renderDockTowerInfo((active?.dataset.tower as TowerId) ?? 'flak');
}

function initDockPriceLabels() {
  document.querySelectorAll<HTMLElement>('[data-cost-for]').forEach((el) => {
    const key = el.dataset.costFor;
    if (!key) return;
    if (key in TOWERS) {
      const c = TOWERS[key as TowerId].buildCost;
      el.textContent = `· ${c} vàng`;
    } else if (key in UNITS) {
      const c = UNITS[key as UnitId].sendCost;
      el.textContent = `· ${c} vàng`;
    }
  });
}

function refreshDockAffordability(state: BoardState) {
  const over = state.gameOver;
  document.querySelectorAll<HTMLButtonElement>('.dock-btn[data-tower]').forEach((btn) => {
    const id = btn.dataset.tower as TowerId;
    const cost = TOWERS[id].buildCost;
    btn.disabled = over;
    btn.classList.toggle('cannot-afford', !over && state.gold < cost);
  });
  document.querySelectorAll<HTMLButtonElement>('.dock-btn[data-unit]').forEach((btn) => {
    const id = btn.dataset.unit as UnitId;
    const cost = UNITS[id].sendCost;
    btn.disabled = over || state.gold < cost;
  });
}

function updateHud(side: BoardSide, state: BoardState) {
  const prefix = side === 'player' ? 'player' : 'opponent';
  const hpEl = document.getElementById(`hp-${prefix}`);
  const hpBar = document.getElementById(`hp-bar-${prefix}`);
  const goldEl = document.getElementById(`gold-${prefix}`);
  const incomeEl = document.getElementById(`income-${prefix}`);
  if (hpEl) hpEl.textContent = `${state.baseHp}/${state.maxBaseHp}`;
  if (hpBar) {
    const pct = state.maxBaseHp > 0 ? (state.baseHp / state.maxBaseHp) * 100 : 0;
    hpBar.style.width = `${pct}%`;
  }
  if (goldEl) goldEl.textContent = String(Math.floor(state.gold));
  if (incomeEl) incomeEl.textContent = `+${state.income}/10s`;
  if (side === 'player') {
    refreshDockAffordability(state);
  }
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function bootBoard(parentId: string, side: BoardSide): Promise<BoardScene> {
  const readOnly = side === 'opponent';
  const accent = side === 'player' ? 0x8aebff : 0xffb783;
  const key = `board-${side}`;
  const sceneData: BoardSceneConfig = { map, side, accent, readOnly };

  return new Promise((resolve, reject) => {
    let settled = false;
    const complete = (scene: BoardScene) => {
      if (settled) return;
      settled = true;
      scene.onHudUpdate = (s) => updateHud(side, s);
      requestAnimationFrame(() => {
        scene.relayout();
        resolve(scene);
      });
    };

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parentId,
      width: map.width,
      height: map.height,
      backgroundColor: '#0b1326',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [],
    });

    game.scene.add(key, BoardScene, true, sceneData);

    const tryComplete = (): boolean => {
      const scene = game.scene.getScene(key) as BoardScene | undefined;
      if (scene?.state && scene.sys?.isActive()) {
        complete(scene);
        return true;
      }
      return false;
    };

    game.events.once(Phaser.Core.Events.READY, () => {
      if (!tryComplete()) {
        const scene = game.scene.getScene(key) as BoardScene;
        scene?.events.once(Phaser.Scenes.Events.CREATE, () => tryComplete());
      }
    });

    window.setTimeout(() => {
      if (!settled && !tryComplete()) {
        reject(new Error(`Không khởi tạo được bàn cờ (${side})`));
      }
    }, 5000);
  });
}

const INTRO_KEY = 'bto_skip_match_intro';
const INTRO_BODY_CLASS = 'match-intro-open';

function setupMatchIntro() {
  const el = document.getElementById('match-intro');
  const btn = document.getElementById('btn-start-match');
  if (!el || !btn) return;
  if (sessionStorage.getItem(INTRO_KEY) === '1') {
    el.remove();
    return;
  }
  document.body.classList.add(INTRO_BODY_CLASS);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    sessionStorage.setItem(INTRO_KEY, '1');
    document.body.classList.remove(INTRO_BODY_CLASS);
    el.remove();
  };

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    dismiss();
  });
}

function showOnlineWaiting(message: string) {
  const el = document.getElementById('online-wait');
  const msg = document.getElementById('online-wait-msg');
  if (el) {
    el.classList.add('is-visible');
    el.setAttribute('aria-hidden', 'false');
  }
  if (msg) msg.textContent = message;
}

function hideOnlineWaiting() {
  const el = document.getElementById('online-wait');
  if (el) {
    el.classList.remove('is-visible');
    el.setAttribute('aria-hidden', 'true');
  }
}

function initOnlineMatch(roomId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (ok: boolean, err?: Error) => {
      if (settled) return;
      settled = true;
      if (ok) resolve();
      else reject(err ?? new Error('Kết nối online thất bại'));
    };

    const timeout = window.setTimeout(() => {
      finish(false, new Error('Hết thời gian chờ đối thủ — gửi lại link phòng cho bạn.'));
    }, 120_000);

    showOnlineWaiting('Đang kết nối máy chủ...');

    matchSocket.connect({
      onConnect: () => {
        showOnlineWaiting('Đang vào phòng… Chờ người chơi thứ 2.');
        matchSocket.joinRoom(roomId, getPilotName());
      },
      onPlayerJoined: (players) => {
        if (players.length < 2) {
          showOnlineWaiting('Đã vào phòng — gửi link/mã phòng cho bạn bè…');
        } else {
          showOnlineWaiting('Đủ 2 người — bắt đầu trận…');
        }
      },
      onMatchStart: () => {
        window.clearTimeout(timeout);
        hideOnlineWaiting();
        finish(true);
      },
      onEnemySpawn: (evt) => {
        const p = evt.payload;
        playerScene?.spawnHostile(p.unitId, p.lane);
      },
      onPlayerLeft: (name) => {
        showOnlineWaiting(`${name} đã rời phòng. Chờ người mới…`);
      },
      onError: (message) => {
        window.clearTimeout(timeout);
        setBattleStatus(message, true);
        finish(false, new Error(message));
      },
    });
  });
}

function wireOnlineSend() {
  if (!playerScene) return;
  const originalTrySend = playerScene.trySend.bind(playerScene);
  playerScene.trySend = (unitId: UnitId, lane = 0) => {
    const ok = originalTrySend(unitId, lane);
    if (ok && matchSocket.connected) {
      matchSocket.sendEnemy({ unitId, lane });
    }
    return ok;
  };
}

function showGameOverOverlay() {
  const overlay = document.getElementById('game-over');
  if (overlay) {
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
  }
  document.body.classList.add('game-over-active');
}

/** Dock: event delegation — hoạt động ngay, không phụ thuộc await Phaser */
function setupDockControls() {
  const dock = document.getElementById('tower-dock');
  if (!dock) return;

  dock.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement;
    const towerBtn = target.closest<HTMLButtonElement>('.dock-btn[data-tower]');
    if (towerBtn) {
      ev.preventDefault();
      if (!playerScene || playerScene.state.gameOver || towerBtn.disabled) return;
      document.querySelectorAll('.dock-btn[data-tower]').forEach((b) => b.classList.remove('active'));
      towerBtn.classList.add('active');
      const tid = towerBtn.dataset.tower as TowerId;
      playerScene.setSelectedTower(tid);
      renderDockTowerInfo(tid);
      return;
    }

    const unitBtn = target.closest<HTMLButtonElement>('.dock-btn[data-unit]');
    if (unitBtn) {
      ev.preventDefault();
      if (!playerScene || playerScene.state.gameOver || unitBtn.disabled) return;
      const unit = unitBtn.dataset.unit as UnitId;
      playerScene.trySend(unit, randomLane());
    }
  });
}

let matchSeconds = 0;

function getCurrentWave(): number {
  return getMatchWave(matchSeconds);
}

function startMatchTimer(onWaveChange?: (wave: number) => void) {
  let lastWave = 1;
  const tick = () => {
    if (playerScene?.state.gameOver) return;
    matchSeconds += 1;
    const el = document.getElementById('match-timer');
    if (el) el.textContent = formatTime(matchSeconds);
    const wave = getCurrentWave();
    const wEl = document.getElementById('wave-num');
    if (wEl) wEl.textContent = String(wave);
    if (wave !== lastWave) {
      lastWave = wave;
      onWaveChange?.(wave);
    }
  };
  window.setInterval(tick, 1000);
  tick();
}

/** Ưu tiên quái trâu (tanker) — đổ liên tục, ít scout */
function pickUnitForWave(wave: number): UnitId {
  const r = Math.random();
  const flyChance = wave >= 5 ? 0.1 : wave >= 3 ? 0.06 : 0;
  const tankChance = wave >= 10 ? 0.72 : wave >= 6 ? 0.68 : 0.62;

  if (r < flyChance) return 'flying';
  if (r < flyChance + tankChance) return 'tanker';
  if (r < flyChance + tankChance + 0.22) return 'scout';
  return 'support';
}

/** Đợt UI vừa tăng → thêm một loạt quái (độ khó theo thời gian) */
function spawnWaveAdvanceBurst(wave: number) {
  if (!playerScene || playerScene.state.gameOver) return;
  const plan = getWaveSpawnPlan(wave);
  let spawned = 0;
  const spawnNext = () => {
    if (!playerScene || playerScene.state.gameOver || spawned >= plan.waveAdvanceBonus) return;
    playerScene.spawnHostile(pickUnitForWave(wave), randomLane());
    spawned += 1;
    window.setTimeout(spawnNext, Math.max(80, plan.spawnIntervalMs * 0.85));
  };
  spawnNext();
}

let pendingBranchSlot: string | null = null;

function setupBranchModal() {
  const modal = document.getElementById('branch-modal');
  const optionsEl = document.getElementById('branch-options');
  if (!modal || !optionsEl) return;

  const close = () => {
    modal.classList.remove('is-visible');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('branch-modal-open');
    pendingBranchSlot = null;
    optionsEl.innerHTML = '';
  };

  const open = (slotId: string, options: TowerBranchId[]) => {
    pendingBranchSlot = slotId;
    optionsEl.innerHTML = '';
    for (const id of options) {
      const info = BRANCH_INFO[id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'branch-option-btn';
      btn.style.setProperty('--branch-color', info.color);
      btn.innerHTML = `<strong>${info.name}</strong><span>${info.summary}</span>`;
      btn.addEventListener('click', () => {
        playerScene?.applyBranch(slotId, id);
        close();
      });
      optionsEl.appendChild(btn);
    }
    modal.classList.add('is-visible');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('branch-modal-open');
  };

  return { open, close };
}

function randomLane(): number {
  return Math.floor(Math.random() * map.lanes.length);
}

function setBattleStatus(message: string, isError = false) {
  const el = document.getElementById('hud-mode-label');
  if (el && isError) el.textContent = message;
}

async function initGame() {
  const mode = getGameMode();
  applyModeToDom(mode);
  setupMatchIntro();
  initDockPriceLabels();
  setupDockTowerInfo();
  setupDockControls();
  const branchModal = setupBranchModal();

  document.getElementById('battle-main')?.setAttribute('data-loading', 'true');

  try {
    const playerPromise = bootBoard('canvas-player', 'player');
    const opponentPromise =
      mode === 'pvp' ? bootBoard('canvas-opponent', 'opponent') : Promise.resolve(null);

    playerScene = await playerPromise;
    opponentScene = await opponentPromise;

    if (mode === 'online') {
      const roomId = getOnlineRoomId();
      if (!roomId) {
        setBattleStatus('Thiếu mã phòng — quay Trang chủ → Chơi Online', true);
        document.getElementById('battle-main')?.setAttribute('data-loading', 'error');
        return;
      }
      if (!isSocketConfigured()) {
        setBattleStatus('Chưa có URL server — quay Trang chủ, dán URL Render → Lưu', true);
        showOnlineWaiting('Thiếu URL máy chủ. Quay Trang chủ → nhập URL Render → Lưu → Kiểm tra kết nối.');
        document.getElementById('online-wait')?.classList.add('is-visible');
        document.getElementById('battle-main')?.setAttribute('data-loading', 'error');
        return;
      }
      await initOnlineMatch(roomId);
      wireOnlineSend();
    }

    applyWideMapEconomy(playerScene.state);
    updateHud('player', playerScene.state);

    if (mode === 'pvp' && opponentScene) {
      applyWideMapEconomy(opponentScene.state);
      updateHud('opponent', opponentScene.state);
      const originalTrySend = playerScene.trySend.bind(playerScene);
      playerScene.trySend = (unitId: UnitId, lane = 0) => {
        const ok = originalTrySend(unitId, lane);
        if (ok) opponentScene!.spawnIncoming(unitId, lane);
        return ok;
      };
    }

    playerScene.onBranchPickRequest = (slotId, options) => {
      branchModal?.open(slotId, options);
    };

    let aiWaveTimeout: number | null = null;
    let bossSpawnedForWave = 0;

    const stopAiWaves = () => {
      if (aiWaveTimeout !== null) clearTimeout(aiWaveTimeout);
      aiWaveTimeout = null;
    };

    const spawnBossIfNeeded = (wave: number) => {
      const plan = getWaveSpawnPlan(wave);
      if (!plan.isBossWave || bossSpawnedForWave === wave) return;
      bossSpawnedForWave = wave;
      playerScene?.spawnBoss(randomLane(), plan.bossHp);
    };

    const runHostileBurst = () => {
      if (!playerScene || playerScene.state.gameOver) {
        stopAiWaves();
        return;
      }
      const wave = getCurrentWave();
      const plan = getWaveSpawnPlan(wave);
      spawnBossIfNeeded(wave);

      let spawned = 0;
      const spawnNext = () => {
        if (!playerScene || playerScene.state.gameOver) {
          scheduleNextBurst();
          return;
        }
        if (spawned >= plan.gruntCount) {
          scheduleNextBurst();
          return;
        }
        playerScene.spawnHostile(pickUnitForWave(wave), randomLane());
        spawned += 1;
        aiWaveTimeout = window.setTimeout(spawnNext, plan.spawnIntervalMs);
      };
      spawnNext();
    };

    const scheduleNextBurst = () => {
      if (!playerScene || playerScene.state.gameOver) return;
      const wave = getCurrentWave();
      const base = mode === 'ai' ? 2600 : 3400;
      const delay = Math.max(650, base - wave * 280);
      aiWaveTimeout = window.setTimeout(runHostileBurst, delay);
    };

    startMatchTimer((wave) => {
      spawnBossIfNeeded(wave);
      spawnWaveAdvanceBurst(wave);
    });

    if (mode === 'ai' || mode === 'pvp') {
      const aiFirstDelayMs = mode === 'ai' ? 400 : 2000;
      aiWaveTimeout = window.setTimeout(runHostileBurst, aiFirstDelayMs);
    }

    playerScene.onGameOver = () => {
      stopAiWaves();
      if (mode === 'online') matchSocket.disconnect();
      refreshDockAffordability(playerScene!.state);
      showGameOverOverlay();
    };

    const onResize = () => {
      playerScene?.relayout();
      opponentScene?.relayout();
    };
    window.addEventListener('resize', onResize);
    requestAnimationFrame(onResize);

    refreshDockAffordability(playerScene.state);
    document.getElementById('battle-main')?.removeAttribute('data-loading');
  } catch (err) {
    console.error('[BTO] initGame failed:', err);
    setBattleStatus('Lỗi tải bản đồ — F5 thử lại', true);
    document.getElementById('battle-main')?.setAttribute('data-loading', 'error');
  }
}

initGame();
