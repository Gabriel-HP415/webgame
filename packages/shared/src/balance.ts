/** Core balance constants — see docs/BALANCE_REFERENCE.md */

export const STARTING_GOLD = 400;
export const STARTING_INCOME = 12;
export const INCOME_TICK_MS = 10_000;
export const SELL_REFUND_RATE = 0.6;
export const BASE_HP = 20;
export const LEAK_DAMAGE_DEFAULT = 1;

export type DamageType = 'ballistic' | 'explosive' | 'energy';
export type ArmorType = 'light' | 'heavy' | 'shielded' | 'none';
export type TowerId = 'mortar' | 'machine_gun' | 'laser' | 'barracks';
export type UnitId = 'scout' | 'tanker' | 'flying' | 'support';

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
}

export const TOWERS: Record<TowerId, TowerDef> = {
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
    aoeRadius: 48,
    targetsAir: false,
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
    targetsAir: false,
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
    speed: 70,
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

export function towerUpgradeCost(towerId: TowerId, level: number): number {
  const t = TOWERS[towerId];
  if (level === 1) return t.buildCost;
  if (level === 2) return t.upgradeCosts[0];
  if (level === 3) return t.upgradeCosts[1];
  return t.branchCost;
}
