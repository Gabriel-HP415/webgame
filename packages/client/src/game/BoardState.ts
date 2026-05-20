import {
  BASE_HP,
  DAMAGE_MATRIX,
  INCOME_TICK_MS,
  STARTING_GOLD,
  STARTING_INCOME,
  SELL_REFUND_RATE,
  TOWERS,
  UNITS,
  type ArmorType,
  type DamageType,
  type TowerId,
  type UnitId,
} from '@bto/shared';
import type { MapDefinition } from '@bto/shared';
import { pathLength, positionOnPath } from './pathUtils.js';

export interface TowerInstance {
  slotId: string;
  towerId: TowerId;
  level: number;
  invested: number;
  /** Tích lũy sát thương theo frame — tránh floor(0) khi FPS cao */
  damageAccum: number;
}

export interface EnemyInstance {
  id: number;
  unitId: UnitId;
  lane: number;
  progress: number;
  hp: number;
  maxHp: number;
  flying: boolean;
}

export interface BoardState {
  map: MapDefinition;
  gold: number;
  income: number;
  baseHp: number;
  maxBaseHp: number;
  towers: Map<string, TowerInstance>;
  enemies: EnemyInstance[];
  nextEnemyId: number;
  incomeTimer: number;
  matchTime: number;
  isPlayer: boolean;
  gameOver: boolean;
}

export function createBoardState(map: MapDefinition, isPlayer: boolean): BoardState {
  return {
    map,
    gold: STARTING_GOLD,
    income: STARTING_INCOME,
    baseHp: BASE_HP,
    maxBaseHp: BASE_HP,
    towers: new Map(),
    enemies: [],
    nextEnemyId: 1,
    incomeTimer: 0,
    matchTime: 0,
    isPlayer,
    gameOver: false,
  };
}

function mitigatedDamage(raw: number, damageType: DamageType, armor: ArmorType): number {
  return raw * DAMAGE_MATRIX[damageType][armor];
}

export function tickEconomy(state: BoardState, dt: number): void {
  if (state.gameOver) return;
  state.matchTime += dt;
  state.incomeTimer += dt * 1000;
  while (state.incomeTimer >= INCOME_TICK_MS) {
    state.incomeTimer -= INCOME_TICK_MS;
    state.gold += state.income;
  }
}

export function buildTower(
  state: BoardState,
  slotId: string,
  towerId: TowerId,
): boolean {
  if (state.gameOver) return false;
  if (state.towers.has(slotId)) return false;
  const slot = state.map.slots.find((s) => s.id === slotId);
  if (!slot) return false;
  const cost = TOWERS[towerId].buildCost;
  if (state.gold < cost) return false;
  state.gold -= cost;
  state.towers.set(slotId, {
    slotId,
    towerId,
    level: 1,
    invested: cost,
    damageAccum: 0,
  });
  return true;
}

export function sellTower(state: BoardState, slotId: string): boolean {
  if (state.gameOver) return false;
  const t = state.towers.get(slotId);
  if (!t) return false;
  state.gold += Math.floor(t.invested * SELL_REFUND_RATE);
  state.towers.delete(slotId);
  return true;
}

export function sendEnemy(
  state: BoardState,
  unitId: UnitId,
  lane: number,
): boolean {
  if (state.gameOver) return false;
  const def = UNITS[unitId];
  if (state.gold < def.sendCost) return false;
  state.gold -= def.sendCost;
  state.income += def.incomeBoost;
  spawnEnemy(state, unitId, lane);
  return true;
}

export function spawnEnemy(state: BoardState, unitId: UnitId, lane: number): void {
  if (state.gameOver) return;
  const def = UNITS[unitId];
  state.enemies.push({
    id: state.nextEnemyId++,
    unitId,
    lane,
    progress: 0,
    hp: def.hp,
    maxHp: def.hp,
    flying: def.flying,
  });
}

export function tickEnemies(state: BoardState, dt: number): number {
  if (state.gameOver) return 0;
  let leaks = 0;
  const toRemove: number[] = [];

  for (const e of state.enemies) {
    const def = UNITS[e.unitId];
    const lane = state.map.lanes[e.lane] ?? state.map.lanes[0];
    const len = Math.max(1, pathLength(lane.waypoints));
    e.progress += (def.speed / len) * dt;

    if (e.progress >= 1) {
      state.baseHp = Math.max(0, state.baseHp - def.leakDamage);
      leaks += def.leakDamage;
      toRemove.push(e.id);
    }
  }

  state.enemies = state.enemies.filter((e) => !toRemove.includes(e.id));

  if (state.baseHp <= 0) {
    state.gameOver = true;
  }

  return leaks;
}

export function tickCombat(state: BoardState, dt: number): void {
  if (state.gameOver) return;

  const killedThisTick = new Set<number>();

  for (const [, tower] of state.towers) {
    if (tower.towerId === 'barracks') continue;
    const def = TOWERS[tower.towerId];
    const dmgMult = 1 + (tower.level - 1) * 0.12;
    const range = def.range * (1 + (tower.level - 1) * 0.05);

    let best: EnemyInstance | null = null;
    let bestProg = -1;
    for (const e of state.enemies) {
      if (e.hp <= 0 || killedThisTick.has(e.id)) continue;
      if (e.flying && !def.targetsAir) continue;
      const lane = state.map.lanes[e.lane];
      if (!lane) continue;
      const pos = getEnemyPos(state, e);
      const slot = state.map.slots.find((s) => s.id === tower.slotId);
      if (!slot) continue;
      const dist = Math.hypot(pos.x - slot.x, pos.y - slot.y);
      if (dist > range) continue;
      if (e.progress > bestProg) {
        bestProg = e.progress;
        best = e;
      }
    }

    if (!best || killedThisTick.has(best.id)) continue;
    const udef = UNITS[best.unitId];
    const raw =
      def.baseDamage * dmgMult * def.fireRate * dt * (def.aoeRadius ? 1.2 : 1);
    tower.damageAccum += mitigatedDamage(raw, def.damageType, udef.armor);
    const hits = Math.floor(tower.damageAccum);
    if (hits > 0) {
      tower.damageAccum -= hits;
      best.hp -= hits;
    }

    if (best.hp <= 0 && !killedThisTick.has(best.id)) {
      killedThisTick.add(best.id);
      state.gold += udef.bounty;
    }
  }

  if (killedThisTick.size > 0) {
    state.enemies = state.enemies.filter((e) => e.hp > 0);
  }
}

function getEnemyPos(state: BoardState, e: EnemyInstance): { x: number; y: number } {
  const lane = state.map.lanes[e.lane] ?? state.map.lanes[0];
  return positionOnPath(lane.waypoints, e.progress);
}
