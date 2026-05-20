import Phaser from 'phaser';
import type { MapDefinition, TowerId, UnitId } from '@bto/shared';
import { TOWERS, UNITS } from '@bto/shared';
import neonGrid from '../../shared/maps/neon_grid.json';
import { BoardScene, type BoardSceneConfig, type BoardSide } from './game/BoardScene.js';
import type { BoardState } from './game/BoardState.js';

const map = neonGrid as MapDefinition;

export type GameMode = 'ai' | 'pvp';

/** Scene player — gán sau khi Phaser boot xong */
let playerScene: BoardScene | null = null;
let opponentScene: BoardScene | null = null;

function getGameMode(): GameMode {
  const m = new URLSearchParams(window.location.search).get('mode');
  return m === 'pvp' ? 'pvp' : 'ai';
}

function applyModeToDom(mode: GameMode) {
  document.body.classList.add(`game-mode-${mode}`);
  const battleMain = document.getElementById('battle-main');
  const dockSends = document.getElementById('dock-sends');
  const hint = document.getElementById('dock-hint');
  const label = document.getElementById('hud-mode-label');

  if (mode === 'ai') {
    battleMain?.classList.add('battle-main--solo');
    dockSends?.classList.add('is-hidden');
    if (hint) {
      hint.textContent =
        'Chế độ AI: quân địch xuất hiện theo đợt — xây tháp để bảo vệ căn cứ. Chuột phải để bán tháp.';
    }
    if (label) label.textContent = 'CHẾ ĐỘ AI — NEON GRID';
  } else {
    if (label) label.textContent = 'LUYỆN PvP — NEON GRID';
    if (hint) {
      hint.textContent =
        'Hai bàn: gửi quân (tốn vàng) sang đối thủ; AI cũng tấn công bàn của bạn. Chuột phải để bán tháp.';
    }
  }

  const pilot = new URLSearchParams(window.location.search).get('name');
  if (pilot && label) {
    label.textContent += ` · ${pilot}`;
  }
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
      playerScene.setSelectedTower(towerBtn.dataset.tower as TowerId);
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

function startMatchTimer() {
  let matchSeconds = 0;
  const tick = () => {
    if (playerScene?.state.gameOver) return;
    matchSeconds += 1;
    const el = document.getElementById('match-timer');
    if (el) el.textContent = formatTime(matchSeconds);
    const wEl = document.getElementById('wave-num');
    if (wEl) wEl.textContent = String(Math.floor(matchSeconds / 45) + 1);
  };
  window.setInterval(tick, 1000);
  tick();
}

const units: UnitId[] = ['scout', 'tanker', 'flying', 'support'];

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
  setupDockControls();
  startMatchTimer();

  document.getElementById('battle-main')?.setAttribute('data-loading', 'true');

  try {
    const playerPromise = bootBoard('canvas-player', 'player');
    const opponentPromise =
      mode === 'pvp' ? bootBoard('canvas-opponent', 'opponent') : Promise.resolve(null);

    playerScene = await playerPromise;
    opponentScene = await opponentPromise;

    if (mode === 'pvp' && opponentScene) {
      const originalTrySend = playerScene.trySend.bind(playerScene);
      playerScene.trySend = (unitId: UnitId, lane = 0) => {
        const ok = originalTrySend(unitId, lane);
        if (ok) opponentScene!.spawnIncoming(unitId, lane);
        return ok;
      };
    }

    let aiWaveTimeout: number | null = null;
    let aiWaveInterval: number | null = null;

    const stopAiWaves = () => {
      if (aiWaveTimeout !== null) clearTimeout(aiWaveTimeout);
      if (aiWaveInterval !== null) clearInterval(aiWaveInterval);
      aiWaveTimeout = null;
      aiWaveInterval = null;
    };

    const runHostileWave = () => {
      if (!playerScene || playerScene.state.gameOver) {
        stopAiWaves();
        return;
      }
      const unit = Phaser.Utils.Array.GetRandom(units);
      playerScene.spawnHostile(unit, randomLane());
    };

    const aiIntervalMs = mode === 'ai' ? 6000 : 8500;
    const aiFirstDelayMs = mode === 'ai' ? 2000 : 3500;
    aiWaveTimeout = window.setTimeout(() => {
      runHostileWave();
      aiWaveInterval = window.setInterval(runHostileWave, aiIntervalMs);
    }, aiFirstDelayMs);

    playerScene.onGameOver = () => {
      stopAiWaves();
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
