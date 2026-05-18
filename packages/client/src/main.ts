import Phaser from 'phaser';
import type { MapDefinition, TowerId, UnitId } from '@bto/shared';
import { TOWERS, UNITS } from '@bto/shared';
import neonGrid from '../../shared/maps/neon_grid.json';
import { BoardScene, type BoardSide } from './game/BoardScene.js';
import type { BoardState } from './game/BoardState.js';

const map = neonGrid as MapDefinition;

export type GameMode = 'ai' | 'pvp';

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
  document.querySelectorAll<HTMLButtonElement>('.dock-btn[data-tower]').forEach((btn) => {
    const id = btn.dataset.tower as TowerId;
    const cost = TOWERS[id].buildCost;
    btn.disabled = state.gold < cost;
  });
  document.querySelectorAll<HTMLButtonElement>('.dock-btn[data-unit]').forEach((btn) => {
    const id = btn.dataset.unit as UnitId;
    const cost = UNITS[id].sendCost;
    btn.disabled = state.gold < cost;
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

function bootBoard(parentId: string, side: BoardSide): BoardScene {
  const readOnly = side === 'opponent';
  const accent = side === 'player' ? 0x8aebff : 0xffb783;
  const key = `board-${side}`;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: parentId,
    backgroundColor: '#0b1326',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [],
  });

  game.scene.add(key, BoardScene, true, {
    map,
    side,
    accent,
    readOnly,
  } satisfies BoardScene['config']);

  const scene = game.scene.getScene(key) as BoardScene;
  scene.onHudUpdate = (s) => updateHud(side, s);
  return scene;
}

const mode = getGameMode();
applyModeToDom(mode);

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

  btn.addEventListener(
    'pointerdown',
    (e) => {
      e.stopPropagation();
      dismiss();
    },
    { capture: true },
  );
  btn.addEventListener(
    'click',
    (e) => {
      e.stopPropagation();
      dismiss();
    },
    { capture: true },
  );
}
setupMatchIntro();

const playerScene = bootBoard('canvas-player', 'player');
let opponentScene: BoardScene | null = null;

if (mode === 'pvp') {
  opponentScene = bootBoard('canvas-opponent', 'opponent');
  const originalTrySend = playerScene.trySend.bind(playerScene);
  playerScene.trySend = (unitId: UnitId, lane = 0) => {
    const ok = originalTrySend(unitId, lane);
    if (ok) {
      opponentScene!.spawnIncoming(unitId, lane);
    }
    return ok;
  };
}

const units: UnitId[] = ['scout', 'tanker', 'flying', 'support'];

function randomLane(): number {
  return Math.floor(Math.random() * map.lanes.length);
}

function runHostileWave() {
  const unit = Phaser.Utils.Array.GetRandom(units);
  playerScene.spawnHostile(unit, randomLane());
}

const aiIntervalMs = mode === 'ai' ? 6000 : 8500;
window.setTimeout(() => {
  runHostileWave();
  window.setInterval(runHostileWave, aiIntervalMs);
}, 3500);

let matchSeconds = 0;
window.setInterval(() => {
  matchSeconds += 1;
  const el = document.getElementById('match-timer');
  if (el) el.textContent = formatTime(matchSeconds);
  const wave = Math.floor(matchSeconds / 45) + 1;
  const wEl = document.getElementById('wave-num');
  if (wEl) wEl.textContent = String(wave);
}, 1000);

document.querySelectorAll<HTMLButtonElement>('.dock-btn[data-tower]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dock-btn[data-tower]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    playerScene.setSelectedTower(btn.dataset.tower as TowerId);
  });
});

document.querySelectorAll<HTMLButtonElement>('.dock-btn[data-unit]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const unit = btn.dataset.unit as UnitId;
    playerScene.trySend(unit, randomLane());
  });
});

initDockPriceLabels();
refreshDockAffordability(playerScene.state);
