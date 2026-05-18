import Phaser from 'phaser';
import type { MapDefinition, TowerId, UnitId } from '@bto/shared';
import {
  buildTower,
  createBoardState,
  sellTower,
  sendEnemy,
  spawnEnemy,
  tickCombat,
  tickEconomy,
  tickEnemies,
  type BoardState,
} from './BoardState.js';
import { positionOnPath } from './pathUtils.js';

const TOWER_COLORS: Record<TowerId, number> = {
  mortar: 0xff6b35,
  machine_gun: 0x8aebff,
  laser: 0xb6bcff,
  barracks: 0x4ade80,
};

export type BoardSide = 'player' | 'opponent';

export interface BoardSceneConfig {
  map: MapDefinition;
  side: BoardSide;
  accent: number;
  readOnly: boolean;
}

export class BoardScene extends Phaser.Scene {
  declare state: BoardState;
  config!: BoardSceneConfig;
  selectedTower: TowerId = 'mortar';
  slotGraphics!: Phaser.GameObjects.Graphics;
  pathGraphics!: Phaser.GameObjects.Graphics;
  gridGraphics?: Phaser.GameObjects.Graphics;
  towerSprites = new Map<string, Phaser.GameObjects.Container>();
  enemySprites = new Map<number, Phaser.GameObjects.Arc>();
  onHudUpdate?: (s: BoardState) => void;

  constructor(key: string) {
    super(key);
  }

  init(data: BoardSceneConfig) {
    this.config = data;
    this.state = createBoardState(data.map, data.side === 'player');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b1326);

    this.pathGraphics = this.add.graphics();
    this.slotGraphics = this.add.graphics();
    this.layoutBattlefield();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutBattlefield, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutBattlefield, this);
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.config.readOnly) return;
      if (p.rightButtonDown()) {
        this.trySellAt(p.worldX, p.worldY);
        return;
      }
      this.tryBuildAt(p.worldX, p.worldY);
    });
  }

    /** Vẽ lại lưới / path / slot khi scale thay đổi; cập nhật vị trí tháp */
  private layoutBattlefield = () => {
    const { width, height } = this.scale;
    this.drawGrid(width, height);
    this.gridGraphics?.setDepth(-10);
    this.drawPaths();
    this.drawSlots();
    this.drawBase();
    this.repositionTowerSprites();
  };

  setSelectedTower(id: TowerId) {
    this.selectedTower = id;
    this.drawSlots();
  }

  trySend(unitId: UnitId, lane = 0): boolean {
    if (this.config.readOnly) return false;
    const ok = sendEnemy(this.state, unitId, lane);
    if (ok) this.emitHud();
    return ok;
  }

  /** Spawn on opponent board when player sends */
  spawnIncoming(unitId: UnitId, lane: number) {
    spawnEnemy(this.state, unitId, lane);
  }

  /** Hostile wave (AI): no gold cost, no income change */
  spawnHostile(unitId: UnitId, lane: number) {
    spawnEnemy(this.state, unitId, lane);
    this.emitHud();
  }

  /** Phaser gửi `delta` theo ms; logic bàn cờ dùng giây */
  update(_t: number, deltaMs: number) {
    const dt = deltaMs / 1000;
    tickEconomy(this.state, dt);
    tickEnemies(this.state, dt);
    tickCombat(this.state, dt);
    this.syncEnemies();
    this.emitHud();
  }

  emitHud() {
    this.onHudUpdate?.(this.state);
  }

  private slotHitRadiusWorld(): number {
    const { sx, sy } = this.getScale();
    /** Bán kính click (px thế giới), tương ứng vòng slot ~18px map */
    return Math.max(24, 28 * Math.min(sx, sy));
  }

  private tryBuildAt(x: number, y: number) {
    const scale = this.getScale();
    const slot = this.nearestSlot(x, y);
    if (!slot) return;
    const wx = slot.x * scale.sx;
    const wy = slot.y * scale.sy;
    if (this.dist(x, y, wx, wy) > this.slotHitRadiusWorld()) return;
    if (buildTower(this.state, slot.id, this.selectedTower)) {
      this.addTowerVisual(slot.id);
      this.drawSlots();
      this.emitHud();
    }
  }

  private trySellAt(x: number, y: number) {
    const scale = this.getScale();
    const slot = this.nearestSlot(x, y);
    if (!slot) return;
    const wx = slot.x * scale.sx;
    const wy = slot.y * scale.sy;
    if (this.dist(x, y, wx, wy) > this.slotHitRadiusWorld()) return;
    const t = this.state.towers.get(slot.id);
    if (!t) return;
    if (sellTower(this.state, slot.id)) {
      this.towerSprites.get(slot.id)?.destroy();
      this.towerSprites.delete(slot.id);
      this.drawSlots();
      this.emitHud();
    }
  }

  private nearestSlot(x: number, y: number) {
    const scale = this.getScale();
    let best = this.config.map.slots[0];
    let d = Infinity;
    for (const s of this.config.map.slots) {
      const sx = s.x * scale.sx;
      const sy = s.y * scale.sy;
      const dd = this.dist(x, y, sx, sy);
      if (dd < d) {
        d = dd;
        best = s;
      }
    }
    return best;
  }

  private getScale() {
    const { width, height } = this.scale;
    const mw = this.config.map.width;
    const mh = this.config.map.height;
    return { sx: width / mw, sy: height / mh };
  }

  private dist(x1: number, y1: number, x2: number, y2: number) {
    return Math.hypot(x1 - x2, y1 - y2);
  }

  private drawGrid(w: number, h: number) {
    this.gridGraphics?.destroy();
    const g = this.add.graphics();
    this.gridGraphics = g;
    g.lineStyle(1, 0x2d3449, 0.5);
    for (let x = 0; x < w; x += 32) {
      g.lineBetween(x, 0, x, h);
    }
    for (let y = 0; y < h; y += 32) {
      g.lineBetween(0, y, w, y);
    }
  }

  private repositionTowerSprites() {
    const { sx, sy } = this.getScale();
    for (const [slotId, container] of this.towerSprites) {
      const slot = this.config.map.slots.find((s) => s.id === slotId);
      if (!slot) continue;
      container.setPosition(slot.x * sx, slot.y * sy);
    }
  }

  private drawPaths() {
    const g = this.pathGraphics;
    g.clear();
    const { sx, sy } = this.getScale();
    const color = this.config.accent;
    for (const lane of this.config.map.lanes) {
      g.lineStyle(3, color, 0.35);
      const wp = lane.waypoints;
      for (let i = 0; i < wp.length - 1; i++) {
        g.lineBetween(wp[i].x * sx, wp[i].y * sy, wp[i + 1].x * sx, wp[i + 1].y * sy);
      }
    }
  }

  private drawSlots() {
    const g = this.slotGraphics;
    g.clear();
    const { sx, sy } = this.getScale();
    for (const s of this.config.map.slots) {
      const occupied = this.state.towers.has(s.id);
      const x = s.x * sx;
      const y = s.y * sy;
      g.lineStyle(2, occupied ? 0x4ade80 : this.config.accent, occupied ? 0.9 : 0.5);
      g.strokeCircle(x, y, 18);
      if (!occupied) {
        g.fillStyle(this.config.accent, 0.08);
        g.fillCircle(x, y, 16);
      }
    }
  }

  private baseMarker?: Phaser.GameObjects.Arc;

  private drawBase() {
    this.baseMarker?.destroy();
    const { sx, sy } = this.getScale();
    const b = this.config.map.basePosition;
    const c = this.add.circle(b.x * sx, b.y * sy, 22, this.config.accent, 0.25);
    c.setStrokeStyle(2, this.config.accent, 0.9);
    this.baseMarker = c;
  }

  private addTowerVisual(slotId: string) {
    const slot = this.config.map.slots.find((s) => s.id === slotId);
    const tower = this.state.towers.get(slotId);
    if (!slot || !tower) return;
    const { sx, sy } = this.getScale();
    const container = this.add.container(slot.x * sx, slot.y * sy);
    const body = this.add.rectangle(0, 0, 28, 28, TOWER_COLORS[tower.towerId], 0.9);
    body.setStrokeStyle(2, 0xffffff, 0.4);
    const label = this.add.text(0, 0, tower.level.toString(), {
      fontSize: '12px',
      color: '#0b1326',
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    container.add([body, label]);
    this.towerSprites.set(slotId, container);
  }

  private syncEnemies() {
    const { sx, sy } = this.getScale();
    const alive = new Set(this.state.enemies.map((e) => e.id));

    for (const [id, sprite] of this.enemySprites) {
      if (!alive.has(id)) {
        sprite.destroy();
        this.enemySprites.delete(id);
      }
    }

    for (const e of this.state.enemies) {
      const lane = this.config.map.lanes[e.lane] ?? this.config.map.lanes[0];
      const pos = positionOnPath(lane.waypoints, e.progress);
      const x = pos.x * sx;
      const y = pos.y * sy;
      let sprite = this.enemySprites.get(e.id);
      if (!sprite) {
        const color = e.flying ? 0xd8daff : 0xffb783;
        sprite = this.add.circle(x, y, e.flying ? 8 : 10, color, 0.95);
        sprite.setStrokeStyle(1, 0xffffff, 0.5);
        this.enemySprites.set(e.id, sprite);
      } else {
        sprite.setPosition(x, y);
      }
    }
  }
}
