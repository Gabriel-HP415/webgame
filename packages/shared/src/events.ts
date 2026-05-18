import type { TowerId, UnitId } from './balance.js';

export type GameEventType =
  | 'match.start'
  | 'tower.build'
  | 'tower.upgrade'
  | 'tower.sell'
  | 'enemy.send'
  | 'enemy.spawn'
  | 'spell.cast'
  | 'base.damage'
  | 'income.tick'
  | 'match.end';

export interface GameEvent<T = unknown> {
  seq: number;
  t: number;
  playerId: string;
  type: GameEventType;
  payload: T;
}

export interface MatchStartPayload {
  seed: number;
  mapId: string;
  players: { id: string; name: string }[];
}

export interface TowerBuildPayload {
  slotId: string;
  towerId: TowerId;
}

export interface EnemySendPayload {
  unitId: UnitId;
  lane: number;
}

export interface EnemySpawnPayload extends EnemySendPayload {
  ownerId: string;
}

export interface SpellCastPayload {
  spellId: string;
  x: number;
  y: number;
}
