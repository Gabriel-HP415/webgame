/** Bản sao tối thiểu từ @bto/shared — để Render build chỉ trong packages/server */

export type UnitId = 'scout' | 'tanker' | 'flying' | 'support';

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

export interface EnemySendPayload {
  unitId: UnitId;
  lane: number;
}
