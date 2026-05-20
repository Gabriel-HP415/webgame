import {
  BASE_HP,
  BOSS_SPEED_MULT,
  DAMAGE_MATRIX,
  getBossBounty,
  getBountyMultiplier,
  getEnemyHpMultiplier,
  getIncomeMultiplier,
  getMatchWave,
  getTowerDamageMultiplier,
  INCOME_TICK_MS,
  MAX_TOWER_LEVEL,
  MORTAR_AOE_EDGE_MULT,
  MORTAR_BOMB_RADIUS,
  SELL_REFUND_RATE,
  STARTING_GOLD,
  STARTING_INCOME,
  TOWER_LEVEL_SCALE,
  TOWERS,
  UNITS,
  type ArmorType,
  type DamageType,
  type TowerBranchId,
  type TowerId,
  type UnitId,
} from '@bto/shared';
import type { MapDefinition } from '@bto/shared';
import { pathLength, positionOnPath } from './pathUtils.js';

/** Dung sai tầm bắn (px map) */
export const RANGE_SLACK = 14;

export interface TowerInstance {
  slotId: string;
  towerId: TowerId;
  level: number;
  invested: number;
  fireCooldown: number;
  branch?: TowerBranchId;
}

export interface EnemyDebuff {
  slowUntil: number;
  burnUntil: number;
  poisonUntil: number;
}

export interface EnemyInstance {
  id: number;
  unitId: UnitId;
  lane: number;
  progress: number;
  hp: number;
  maxHp: number;
  flying: boolean;
  isBoss: boolean;
  debuff: EnemyDebuff;
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

export interface CombatShot {
  slotId: string;
  towerId: TowerId;
  enemyId: number;
  aoe?: { x: number; y: number; radius: number };
  chainEnemyIds?: number[];
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

function shuffleBranches(): TowerBranchId[] {
  const arr: TowerBranchId[] = ['fire', 'ice', 'poison', 'electric'];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 2);
}

export function rollBranchOptions(): TowerBranchId[] {
  return shuffleBranches();
}

export function getTowerDamageMult(tower: TowerInstance): number {
  const scale = TOWER_LEVEL_SCALE[tower.towerId];
  let mult = 1 + (tower.level - 1) * scale.damagePerLevel;
  if (tower.level >= MAX_TOWER_LEVEL && tower.branch === 'fire') {
    mult *= 1.35;
  }
  return mult;
}

export function getTowerFireRateMult(tower: TowerInstance): number {
  const scale = TOWER_LEVEL_SCALE[tower.towerId];
  return 1 + (tower.level - 1) * scale.fireRatePerLevel;
}

export function getUpgradeCost(tower: TowerInstance): number | null {
  if (tower.towerId === 'barracks' || tower.level >= MAX_TOWER_LEVEL) return null;
  const t = TOWERS[tower.towerId];
  if (tower.level === 1) return t.upgradeCosts[0];
  if (tower.level === 2) return t.upgradeCosts[1];
  return null;
}

/** @returns 'ok' | 'pick_branch' | false */
export function upgradeTower(
  state: BoardState,
  slotId: string,
): 'ok' | 'pick_branch' | false {
  if (state.gameOver) return false;
  const tower = state.towers.get(slotId);
  if (!tower) return false;
  const cost = getUpgradeCost(tower);
  if (cost === null || state.gold < cost) return false;
  state.gold -= cost;
  tower.invested += cost;
  tower.level += 1;
  if (tower.level >= MAX_TOWER_LEVEL) {
    return 'pick_branch';
  }
  return 'ok';
}

export function applyTowerBranch(tower: TowerInstance, branch: TowerBranchId): void {
  tower.branch = branch;
}

export function tickEconomy(state: BoardState, dt: number): void {
  if (state.gameOver) return;
  state.matchTime += dt;
  state.incomeTimer += dt * 1000;
  while (state.incomeTimer >= INCOME_TICK_MS) {
    state.incomeTimer -= INCOME_TICK_MS;
    const wave = getMatchWave(state.matchTime);
    const tickGold = Math.max(1, Math.floor(state.income * getIncomeMultiplier(wave)));
    state.gold += tickGold;
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
    fireCooldown: 0,
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

function emptyDebuff(): EnemyDebuff {
  return { slowUntil: 0, burnUntil: 0, poisonUntil: 0 };
}

export function spawnEnemy(state: BoardState, unitId: UnitId, lane: number): void {
  if (state.gameOver) return;
  const def = UNITS[unitId];
  const wave = getMatchWave(state.matchTime);
  const hp = Math.max(1, Math.floor(def.hp * getEnemyHpMultiplier(wave, unitId)));
  state.enemies.push({
    id: state.nextEnemyId++,
    unitId,
    lane,
    progress: 0,
    hp,
    maxHp: hp,
    flying: def.flying,
    isBoss: false,
    debuff: emptyDebuff(),
  });
}

export function spawnBoss(state: BoardState, lane: number, bossHp: number): void {
  if (state.gameOver) return;
  state.enemies.push({
    id: state.nextEnemyId++,
    unitId: 'tanker',
    lane,
    progress: 0,
    hp: bossHp,
    maxHp: bossHp,
    flying: false,
    isBoss: true,
    debuff: emptyDebuff(),
  });
}

function enemySpeedMult(e: EnemyInstance, state: BoardState): number {
  let mult = e.isBoss ? BOSS_SPEED_MULT : 1;
  if (state.matchTime < e.debuff.slowUntil) {
    mult *= 0.5;
  }
  return mult;
}

function tickEnemyDebuffs(state: BoardState, dt: number): void {
  const now = state.matchTime;
  const dotMult = getTowerDamageMultiplier(getMatchWave(state.matchTime));
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    if (now < e.debuff.burnUntil) {
      e.hp -= 3 * dotMult * dt;
    }
    if (now < e.debuff.poisonUntil) {
      e.hp -= 4 * dotMult * dt;
    }
  }
}

export function tickEnemies(state: BoardState, dt: number): number {
  if (state.gameOver) return 0;
  tickEnemyDebuffs(state, dt);
  let leaks = 0;
  const toRemove: number[] = [];

  for (const e of state.enemies) {
    const def = UNITS[e.unitId];
    const lane = state.map.lanes[e.lane] ?? state.map.lanes[0];
    const len = Math.max(1, pathLength(lane.waypoints));
    const speed = def.speed * enemySpeedMult(e, state);
    e.progress += (speed / len) * dt;

    if (e.progress >= 1) {
      const leak = e.isBoss ? 3 : def.leakDamage;
      state.baseHp = Math.max(0, state.baseHp - leak);
      leaks += leak;
      toRemove.push(e.id);
    }
  }

  state.enemies = state.enemies.filter((e) => !toRemove.includes(e.id));

  if (state.baseHp <= 0) {
    state.gameOver = true;
  }

  return leaks;
}

export function getTowerCombatRange(tower: TowerInstance): number {
  const def = TOWERS[tower.towerId];
  const levelBonus = 1 + (tower.level - 1) * 0.05;
  return def.range * levelBonus + RANGE_SLACK;
}

export function getTowerRangePx(tower: TowerInstance): number {
  return getTowerCombatRange(tower);
}

export function getTowerFireInterval(tower: TowerInstance): number {
  const def = TOWERS[tower.towerId];
  const rate = def.fireRate * getTowerFireRateMult(tower);
  return 1 / Math.max(0.25, rate);
}

export function isEnemyInTowerRange(
  slotX: number,
  slotY: number,
  enemyX: number,
  enemyY: number,
  range: number,
): boolean {
  return Math.hypot(enemyX - slotX, enemyY - slotY) <= range;
}

function getEnemyPos(state: BoardState, e: EnemyInstance): { x: number; y: number } {
  const lane = state.map.lanes[e.lane] ?? state.map.lanes[0];
  return positionOnPath(lane.waypoints, e.progress);
}

export function getEnemyMapPosition(
  state: BoardState,
  enemy: EnemyInstance,
): { x: number; y: number } {
  return getEnemyPos(state, enemy);
}

export function pickTowerTarget(
  state: BoardState,
  tower: TowerInstance,
  range: number,
  exclude: Set<number> = new Set(),
): EnemyInstance | null {
  const def = TOWERS[tower.towerId];
  const slot = state.map.slots.find((s) => s.id === tower.slotId);
  if (!slot) return null;

  let best: EnemyInstance | null = null;
  let bestProg = -1;
  let bestDist = Infinity;

  for (const e of state.enemies) {
    if (e.hp <= 0 || exclude.has(e.id)) continue;
    if (e.flying && !def.targetsAir) continue;
    const pos = getEnemyPos(state, e);
    if (!isEnemyInTowerRange(slot.x, slot.y, pos.x, pos.y, range)) continue;
    const dist = Math.hypot(pos.x - slot.x, pos.y - slot.y);
    if (e.progress > bestProg || (e.progress === bestProg && dist < bestDist)) {
      bestProg = e.progress;
      bestDist = dist;
      best = e;
    }
  }

  return best;
}

function applyBranchOnHit(
  state: BoardState,
  tower: TowerInstance,
  enemy: EnemyInstance,
  now: number,
): number[] {
  const branch = tower.level >= MAX_TOWER_LEVEL ? tower.branch : undefined;
  if (!branch) return [];

  if (branch === 'ice') {
    enemy.debuff.slowUntil = Math.max(enemy.debuff.slowUntil, now + 2.5);
    return [];
  }
  if (branch === 'poison') {
    enemy.debuff.poisonUntil = Math.max(enemy.debuff.poisonUntil, now + 4);
    return [];
  }
  if (branch !== 'electric') return [];

  const pos = getEnemyPos(state, enemy);
  const chain: number[] = [];
  const candidates = state.enemies
    .filter((e) => e.id !== enemy.id && e.hp > 0)
    .map((e) => ({ e, pos: getEnemyPos(state, e), d: Math.hypot(getEnemyPos(state, e).x - pos.x, getEnemyPos(state, e).y - pos.y) }))
    .sort((a, b) => a.d - b.d);

  for (let i = 0; i < Math.min(2, candidates.length); i++) {
    if (candidates[i].d <= 90) chain.push(candidates[i].e.id);
  }
  return chain;
}

function grantKillBounty(state: BoardState, enemy: EnemyInstance): void {
  const wave = getMatchWave(state.matchTime);
  if (enemy.isBoss) {
    state.gold += getBossBounty(wave);
    return;
  }
  const mult = getBountyMultiplier(wave);
  state.gold += Math.max(1, Math.floor(UNITS[enemy.unitId].bounty * mult));
}

function damageEnemy(
  state: BoardState,
  enemy: EnemyInstance,
  raw: number,
  damageType: DamageType,
  killed: Set<number>,
): CombatShot | null {
  const udef = UNITS[enemy.unitId];
  const dmg = Math.max(1, Math.floor(mitigatedDamage(raw, damageType, udef.armor)));
  enemy.hp -= dmg;
  if (enemy.hp <= 0 && !killed.has(enemy.id)) {
    killed.add(enemy.id);
    grantKillBounty(state, enemy);
  }
  return { slotId: '', towerId: 'mortar', enemyId: enemy.id };
}

function applyAoeBomb(
  state: BoardState,
  tower: TowerInstance,
  centerX: number,
  centerY: number,
  baseRaw: number,
  damageType: DamageType,
  killed: Set<number>,
): { primaryId: number; chainIds: number[] } {
  const radius = MORTAR_BOMB_RADIUS;
  let primaryId = -1;
  let bestProg = -1;

  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const pos = getEnemyPos(state, e);
    const dist = Math.hypot(pos.x - centerX, pos.y - centerY);
    if (dist > radius) continue;
    const falloff = 1 - (dist / radius) * (1 - MORTAR_AOE_EDGE_MULT);
    const raw = baseRaw * falloff;
    damageEnemy(state, e, raw, damageType, killed);
    if (e.progress > bestProg) {
      bestProg = e.progress;
      primaryId = e.id;
    }
  }

  return { primaryId: primaryId >= 0 ? primaryId : 0, chainIds: [] };
}

export function tickCombat(state: BoardState, dt: number): CombatShot[] {
  const shots: CombatShot[] = [];
  if (state.gameOver) return shots;

  const killedThisTick = new Set<number>();
  const now = state.matchTime;
  const wave = getMatchWave(state.matchTime);
  const waveDmgMult = getTowerDamageMultiplier(wave);

  for (const [, tower] of state.towers) {
    if (tower.towerId === 'barracks') continue;
    const def = TOWERS[tower.towerId];
    const dmgMult = getTowerDamageMult(tower);
    const rateMult = getTowerFireRateMult(tower);
    const range = getTowerCombatRange(tower);

    tower.fireCooldown = Math.max(0, tower.fireCooldown - dt);

    const best = pickTowerTarget(state, tower, range, killedThisTick);
    if (!best) continue;
    if (tower.fireCooldown > 0) continue;

    const fireRate = def.fireRate * rateMult;
    tower.fireCooldown = 1 / Math.max(0.25, fireRate);

    const baseRaw = def.baseDamage * dmgMult * waveDmgMult * (def.aoeRadius ? 1.15 : 1);

    if (def.aoeRadius && def.aoeRadius > 0) {
      const impact = getEnemyPos(state, best);
      const { primaryId } = applyAoeBomb(
        state,
        tower,
        impact.x,
        impact.y,
        baseRaw,
        def.damageType,
        killedThisTick,
      );
      shots.push({
        slotId: tower.slotId,
        towerId: tower.towerId,
        enemyId: primaryId,
        aoe: { x: impact.x, y: impact.y, radius: MORTAR_BOMB_RADIUS },
      });
    } else {
      const udef = UNITS[best.unitId];
      const dmg = Math.max(
        1,
        Math.floor(mitigatedDamage(baseRaw, def.damageType, udef.armor)),
      );
      best.hp -= dmg;
      const chainIds = applyBranchOnHit(state, tower, best, now);

      if (best.hp <= 0 && !killedThisTick.has(best.id)) {
        killedThisTick.add(best.id);
        grantKillBounty(state, best);
      }

      if (tower.branch === 'electric' && chainIds.length > 0) {
        for (const cid of chainIds) {
          const ce = state.enemies.find((x) => x.id === cid);
          if (!ce || ce.hp <= 0) continue;
          const chainRaw = baseRaw * 0.65;
          const cdmg = Math.max(
            1,
            Math.floor(mitigatedDamage(chainRaw, def.damageType, UNITS[ce.unitId].armor)),
          );
          ce.hp -= cdmg;
          if (ce.hp <= 0 && !killedThisTick.has(ce.id)) {
            killedThisTick.add(ce.id);
            grantKillBounty(state, ce);
          }
        }
      }

      shots.push({
        slotId: tower.slotId,
        towerId: tower.towerId,
        enemyId: best.id,
        chainEnemyIds: chainIds.length > 0 ? chainIds : undefined,
      });
    }
  }

  if (killedThisTick.size > 0) {
    state.enemies = state.enemies.filter((e) => e.hp > 0);
  }

  return shots;
}
