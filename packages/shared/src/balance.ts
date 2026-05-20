/** Core balance constants — see docs/BALANCE_REFERENCE.md */

export const STARTING_GOLD = 400;
export const STARTING_INCOME = 12;
export const INCOME_TICK_MS = 10_000;
export const SELL_REFUND_RATE = 0.6;
export const BASE_HP = 20;
export const LEAK_DAMAGE_DEFAULT = 1;

export type DamageType = 'ballistic' | 'explosive' | 'energy';
export type ArmorType = 'light' | 'heavy' | 'shielded' | 'none';
export type TowerId = 'flak' | 'mortar' | 'machine_gun' | 'laser' | 'barracks';
export type UnitId = 'scout' | 'tanker' | 'flying' | 'support';
export type TowerBranchId = 'fire' | 'ice' | 'poison' | 'electric';

export const MAX_TOWER_LEVEL = 3;
export const ALL_BRANCHES: TowerBranchId[] = ['fire', 'ice', 'poison', 'electric'];

export const BRANCH_INFO: Record<
  TowerBranchId,
  { name: string; summary: string; color: string }
> = {
  fire: { name: 'Lửa', summary: '+35% sát thương mỗi viên', color: '#f97316' },
  ice: { name: 'Băng', summary: 'Làm chậm 50% trong 2.5s', color: '#67e8f9' },
  poison: { name: 'Độc', summary: 'Rút máu 4 HP/giây trong 4s', color: '#a3e635' },
  electric: {
    name: 'Điện',
    summary: 'Lan sang 2 mục tiêu gần (65% sát thương)',
    color: '#fde047',
  },
};

/** Mỗi level: damage + fireRate bonus (cộng dồn) */
export const TOWER_LEVEL_SCALE: Record<
  TowerId,
  { damagePerLevel: number; fireRatePerLevel: number }
> = {
  flak: { damagePerLevel: 0.1, fireRatePerLevel: 0.1 },
  mortar: { damagePerLevel: 0.14, fireRatePerLevel: 0.04 },
  machine_gun: { damagePerLevel: 0.09, fireRatePerLevel: 0.12 },
  laser: { damagePerLevel: 0.11, fireRatePerLevel: 0.08 },
  barracks: { damagePerLevel: 0, fireRatePerLevel: 0 },
};

export const WAVE_DURATION_SEC = 45;

export const BOSS_EVERY_WAVES = 5;

export const BOSS_BASE_HP = 900;
export const BOSS_HP_PER_WAVE = 220;
/** Nhân thêm HP boss (tổng = computeBossHp × hệ số này) */
export const BOSS_HP_MULTIPLIER = 3;
export const BOSS_SPEED_MULT = 0.32;
export const BOSS_BOUNTY = 120;

/** Đợt UI (mỗi ~45s) — dùng chung client + server */
export function getMatchWave(matchTimeSec: number): number {
  return Math.floor(Math.max(0, matchTimeSec) / WAVE_DURATION_SEC) + 1;
}

/** HP quái spawn: càng cuối càng trâu (đợt 1 = 100%) */
export function getEnemyHpMultiplier(wave: number, unitId?: UnitId): number {
  const w = Math.max(1, wave);
  let mult = 1 + (w - 1) * 0.14 + Math.max(0, w - 8) * 0.1;
  if (unitId === 'tanker') {
    mult *= 1 + (w - 1) * 0.06 + Math.max(0, w - 6) * 0.05;
  } else if (unitId === 'flying') {
    mult *= 1 + (w - 1) * 0.08;
  }
  return mult;
}

/** Boss: HP tăng mạnh ở cuối game (× BOSS_HP_MULTIPLIER) */
export function computeBossHp(wave: number): number {
  const w = Math.max(1, wave);
  const linear = BOSS_BASE_HP + w * BOSS_HP_PER_WAVE;
  const curve = 1 + Math.max(0, w - 2) * 0.2 + Math.max(0, w - 10) * 0.15 + Math.max(0, w - 18) * 0.1;
  return Math.floor(linear * curve * BOSS_HP_MULTIPLIER);
}

export function isBossWave(wave: number): boolean {
  const w = Math.max(1, wave);
  return w % BOSS_EVERY_WAVES === 0;
}

/** Sát thương mọi tháp (đợt 1 = 100%, giảm dần, sàn ~42%) */
export function getTowerDamageMultiplier(wave: number): number {
  const w = Math.max(1, wave);
  return Math.max(0.42, 1 - (w - 1) * 0.032 - Math.max(0, w - 12) * 0.012);
}

/** Thu nhập /10s (giảm theo đợt, sàn ~48%) */
export function getIncomeMultiplier(wave: number): number {
  const w = Math.max(1, wave);
  return Math.max(0.48, 1 - (w - 1) * 0.026 - Math.max(0, w - 15) * 0.01);
}

/** Vàng khi giết quái (giảm theo đợt, sàn ~38%) */
export function getBountyMultiplier(wave: number): number {
  const w = Math.max(1, wave);
  return Math.max(0.38, 1 - (w - 1) * 0.03 - Math.max(0, w - 10) * 0.015);
}

export function getBossBounty(wave: number): number {
  return Math.max(8, Math.floor(BOSS_BOUNTY * getBountyMultiplier(wave)));
}
export const MORTAR_BOMB_RADIUS = 72;
export const MORTAR_AOE_EDGE_MULT = 0.35;

export const DAMAGE_MATRIX: Record<DamageType, Record<ArmorType, number>> = {
  ballistic: { light: 1, heavy: 0.7, shielded: 0.5, none: 1 },
  explosive: { light: 0.8, heavy: 1, shielded: 0.9, none: 1 },
  energy: { light: 1, heavy: 0.85, shielded: 1.2, none: 1 },
};

export interface TowerDef {
  id: TowerId;
  name: string;
  buildCost: number;
  upgradeCosts: [number, number];
  branchCost: number;
  damageType: DamageType;
  baseDamage: number;
  range: number;
  fireRate: number;
  aoeRadius?: number;
  targetsAir: boolean;
  /** Mô tả ngắn cho bảng thông tin dock */
  summary: string;
  /** Nhãn: Bắn bay, AOE, Sớm game… */
  traits: string[];
}

export const TOWERS: Record<TowerId, TowerDef> = {
  flak: {
    id: 'flak',
    name: 'Flak',
    buildCost: 85,
    upgradeCosts: [60, 90],
    branchCost: 80,
    damageType: 'ballistic',
    baseDamage: 7,
    range: 158,
    fireRate: 5.5,
    targetsAir: true,
    summary: 'Phòng không giá rẻ — chuyên trị quân bay, bắn rất nhanh.',
    traits: ['Bắn bay', 'Sớm game', 'Hồi nhanh'],
  },
  mortar: {
    id: 'mortar',
    name: 'Mortar',
    buildCost: 120,
    upgradeCosts: [80, 120],
    branchCost: 100,
    damageType: 'explosive',
    baseDamage: 36,
    range: 160,
    fireRate: 0.5,
    aoeRadius: MORTAR_BOMB_RADIUS,
    targetsAir: false,
    summary: 'Sát thương diện rộng, mạnh với đám đông bộ binh.',
    traits: ['AOE', 'Chậm', 'Mặt đất'],
  },
  machine_gun: {
    id: 'machine_gun',
    name: 'Machine Gun',
    buildCost: 100,
    upgradeCosts: [70, 100],
    branchCost: 100,
    damageType: 'ballistic',
    baseDamage: 5.5,
    range: 140,
    fireRate: 4,
    targetsAir: true,
    summary: 'Đa năng đầu game — bắn được cả bay (sát thương bay vừa).',
    traits: ['Bắn bay (nhẹ)', 'Nhanh', 'Sớm game'],
  },
  laser: {
    id: 'laser',
    name: 'Laser',
    buildCost: 150,
    upgradeCosts: [100, 150],
    branchCost: 120,
    damageType: 'energy',
    baseDamage: 8,
    range: 180,
    fireRate: 10,
    targetsAir: true,
    summary: 'Tầm xa, tốc độ cao — counter quân bay và khiên năng lượng.',
    traits: ['Bắn bay', 'Tầm xa', 'Năng lượng'],
  },
  barracks: {
    id: 'barracks',
    name: 'Barracks',
    buildCost: 110,
    upgradeCosts: [75, 110],
    branchCost: 90,
    damageType: 'ballistic',
    baseDamage: 0,
    range: 0,
    fireRate: 0,
    targetsAir: false,
    summary: 'Tăng thu nhập / hỗ trợ (chưa bắn — dùng để mở rộng kinh tế).',
    traits: ['Kinh tế', 'Không bắn'],
  },
};

export interface UnitDef {
  id: UnitId;
  name: string;
  sendCost: number;
  incomeBoost: number;
  bounty: number;
  hp: number;
  speed: number;
  armor: ArmorType;
  flying: boolean;
  leakDamage: number;
}

export const UNITS: Record<UnitId, UnitDef> = {
  scout: {
    id: 'scout',
    name: 'Scout',
    sendCost: 80,
    incomeBoost: 2,
    bounty: 12,
    hp: 45,
    speed: 95,
    armor: 'light',
    flying: false,
    leakDamage: 1,
  },
  tanker: {
    id: 'tanker',
    name: 'Tanker',
    sendCost: 140,
    incomeBoost: 4,
    bounty: 28,
    hp: 220,
    speed: 42,
    armor: 'heavy',
    flying: false,
    leakDamage: 2,
  },
  flying: {
    id: 'flying',
    name: 'Flying',
    sendCost: 120,
    incomeBoost: 3,
    bounty: 18,
    hp: 80,
    speed: 52,
    armor: 'light',
    flying: true,
    leakDamage: 1,
  },
  support: {
    id: 'support',
    name: 'Support',
    sendCost: 100,
    incomeBoost: 3,
    bounty: 22,
    hp: 90,
    speed: 50,
    armor: 'none',
    flying: false,
    leakDamage: 1,
  },
};

export function applyDamage(
  raw: number,
  damageType: DamageType,
  armor: ArmorType,
): number {
  return Math.max(1, Math.floor(raw * DAMAGE_MATRIX[damageType][armor]));
}

export function towerUpgradeCost(tower: { towerId: TowerId; level: number }): number | null {
  if (tower.level >= MAX_TOWER_LEVEL) return null;
  const t = TOWERS[tower.towerId];
  if (tower.level === 1) return t.upgradeCosts[0];
  if (tower.level === 2) return t.upgradeCosts[1];
  return null;
}

/** Mật độ quái theo đợt — chỉnh ở đây */
export const WAVE_GRUNT_BASE = 20;
export const WAVE_GRUNT_MAX = 56;
export const WAVE_SPAWN_INTERVAL_MIN_MS = 45;

/** Mật độ quái theo đợt (đợt = wave UI, mỗi ~45s) */
export function getWaveSpawnPlan(wave: number): {
  isBossWave: boolean;
  gruntCount: number;
  spawnIntervalMs: number;
  bossHp: number;
  /** Quái thêm khi số đợt UI tăng (mỗi ~45s) */
  waveAdvanceBonus: number;
} {
  const w = Math.max(1, wave);
  const bossWave = isBossWave(w);
  /** Mỗi lần bắn đợt: tối thiểu 20 con, tăng dần theo đợt UI */
  const gruntCount = bossWave
    ? 22 + Math.floor(w / 6)
    : Math.min(WAVE_GRUNT_MAX, WAVE_GRUNT_BASE + Math.floor((w - 1) * 1.35));
  const spawnIntervalMs = Math.max(WAVE_SPAWN_INTERVAL_MIN_MS, 420 - w * 22);
  const bossHp = computeBossHp(w);
  const waveAdvanceBonus = Math.min(20, 8 + Math.floor(w * 0.9));
  return { isBossWave: bossWave, gruntCount, spawnIntervalMs, bossHp, waveAdvanceBonus };
}
