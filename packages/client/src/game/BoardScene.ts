import Phaser from 'phaser';
import type { MapDefinition, TowerBranchId, TowerId, UnitId } from '@bto/shared';
import { BRANCH_INFO, TOWERS, UNITS } from '@bto/shared';
import {
  applyTowerBranch,
  buildTower,
  createBoardState,
  getEnemyMapPosition,
  getTowerCombatRange,
  getTowerFireInterval,
  getUpgradeCost,
  RANGE_SLACK,
  rollBranchOptions,
  sellTower,
  sendEnemy,
  spawnBoss,
  spawnEnemy,
  tickCombat,
  tickEconomy,
  tickEnemies,
  upgradeTower,
  type BoardState,
  type CombatShot,
} from './BoardState.js';
import { playCombatShot, playElectricChain } from './combatVfx.js';

const TOWER_COLORS: Record<TowerId, number> = {
  flak: 0xfbbf24,
  mortar: 0xff6b35,
  machine_gun: 0x8aebff,
  laser: 0xb6bcff,
  barracks: 0x4ade80,
};

const UNIT_LABELS: Record<UnitId, string> = {
  scout: 'Trinh sát',
  tanker: 'Xe tăng',
  flying: 'Bay',
  support: 'Hỗ trợ',
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
  selectedTower: TowerId = 'flak';
  slotGraphics!: Phaser.GameObjects.Graphics;
  pathGraphics!: Phaser.GameObjects.Graphics;
  gridGraphics?: Phaser.GameObjects.Graphics;
  towerSprites = new Map<string, Phaser.GameObjects.Container>();
  enemySprites = new Map<number, Phaser.GameObjects.Container>();
  onHudUpdate?: (s: BoardState) => void;
  onGameOver?: () => void;
  onBranchPickRequest?: (slotId: string, options: TowerBranchId[]) => void;
  private gameOverNotified = false;
  private rangeRing?: Phaser.GameObjects.Arc;
  private rangeHoverSlotId: string | null = null;
  private rangePreviewSlotId: string | null = null;

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
    this.pathGraphics.setDepth(1);
    this.slotGraphics.setDepth(2);
    this.input.setTopOnly(false);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutBattlefield, this);
    this.layoutBattlefield();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutBattlefield, this);
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.config.readOnly || this.state.gameOver) return;
      if (p.rightButtonDown()) {
        this.trySellAt(p.worldX, p.worldY);
        return;
      }
      this.tryBuildAt(p.worldX, p.worldY);
    });

    this.input.on('gameout', () => {
      this.rangeHoverSlotId = null;
      this.rangePreviewSlotId = null;
      this.syncRangeRing();
    });

    const canvas = this.game.canvas;
    if (canvas) {
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  /** Vẽ lại map (FIT scale — kích thước game cố định theo map JSON) */
  relayout() {
    this.scale.refresh();
    this.layoutBattlefield();
  }

  /** Vẽ lại lưới / path / slot khi scale thay đổi; cập nhật vị trí tháp */
  private layoutBattlefield = () => {
    const width = this.scale.width || this.config.map.width;
    const height = this.scale.height || this.config.map.height;
    if (width < 8 || height < 8) return;
    this.drawGrid(width, height);
    this.gridGraphics?.setDepth(-10);
    this.drawPaths();
    this.drawSlots();
    this.drawBase();
    this.repositionTowerSprites();
    this.syncRangeRing();
  };

  setSelectedTower(id: TowerId) {
    this.selectedTower = id;
    this.drawSlots();
    this.syncRangeRing();
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
    if (this.state.gameOver) return;
    spawnEnemy(this.state, unitId, lane);
    this.emitHud();
  }

  spawnBoss(lane: number, bossHp: number) {
    if (this.state.gameOver) return;
    spawnBoss(this.state, lane, bossHp);
    this.emitHud();
  }

  applyBranch(slotId: string, branch: TowerBranchId) {
    const tower = this.state.towers.get(slotId);
    if (!tower) return;
    applyTowerBranch(tower, branch);
    this.addTowerVisual(slotId);
    this.emitHud();
  }

  /** Phaser gửi `delta` theo ms; logic bàn cờ dùng giây */
  update(_t: number, deltaMs: number) {
    if (this.state.gameOver) {
      this.maybeNotifyGameOver();
      return;
    }
    const dt = deltaMs / 1000;
    tickEconomy(this.state, dt);
    tickEnemies(this.state, dt);
    const shots = tickCombat(this.state, dt);
    this.playCombatShots(shots);
    this.updateTowerCooldownBars();
    this.syncEnemies();
    this.updateRangeFromPointer();
    this.emitHud();
    this.maybeNotifyGameOver();
  }

  private maybeNotifyGameOver() {
    if (!this.state.isPlayer || !this.state.gameOver || this.gameOverNotified) return;
    this.gameOverNotified = true;
    this.onGameOver?.();
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
    if (this.state.towers.has(slot.id)) {
      this.tryUpgradeAt(slot.id);
      return;
    }
    if (buildTower(this.state, slot.id, this.selectedTower)) {
      this.addTowerVisual(slot.id);
      this.drawSlots();
      this.emitHud();
    }
  }

  private tryUpgradeAt(slotId: string) {
    const tower = this.state.towers.get(slotId);
    if (!tower || tower.towerId === 'barracks') return;
    const cost = getUpgradeCost(tower);
    if (cost === null || this.state.gold < cost) return;

    const result = upgradeTower(this.state, slotId);
    if (result === false) return;

    if (result === 'pick_branch') {
      this.onBranchPickRequest?.(slotId, rollBranchOptions());
    }
    this.refreshTowerVisual(slotId);
    this.drawSlots();
    this.emitHud();
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
    g.lineStyle(1, 0x4a5a80, 0.85);
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
      g.lineStyle(4, color, 0.75);
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
    const selectedColor = TOWER_COLORS[this.selectedTower];
    for (const s of this.config.map.slots) {
      const occupied = this.state.towers.has(s.id);
      const x = s.x * sx;
      const y = s.y * sy;
      const isSel = !occupied;
      g.lineStyle(2, occupied ? 0x4ade80 : isSel ? selectedColor : this.config.accent, occupied ? 0.9 : 0.65);
      g.strokeCircle(x, y, 18);
      if (!occupied) {
        g.fillStyle(isSel ? selectedColor : this.config.accent, isSel ? 0.15 : 0.08);
        g.fillCircle(x, y, 16);
      }
    }
  }

  private baseMarker?: Phaser.GameObjects.Arc;
  private spawnMarker?: Phaser.GameObjects.Arc;

  private drawBase() {
    this.baseMarker?.destroy();
    this.spawnMarker?.destroy();
    const { sx, sy } = this.getScale();
    const b = this.config.map.basePosition;
    const sp = this.config.map.spawnPosition;
    const c = this.add.circle(b.x * sx, b.y * sy, 22, this.config.accent, 0.25);
    c.setStrokeStyle(2, this.config.accent, 0.9);
    c.setDepth(3);
    this.baseMarker = c;
    const spawn = this.add.circle(sp.x * sx, sp.y * sy, 10, 0xff6b6b, 0.5);
    spawn.setStrokeStyle(2, 0xff6b6b, 0.9);
    spawn.setDepth(3);
    this.spawnMarker = spawn;
  }

  private addTowerVisual(slotId: string) {
    this.towerSprites.get(slotId)?.destroy();
    this.towerSprites.delete(slotId);
    const slot = this.config.map.slots.find((s) => s.id === slotId);
    const tower = this.state.towers.get(slotId);
    if (!slot || !tower) return;
    const { sx, sy } = this.getScale();
    const container = this.add.container(slot.x * sx, slot.y * sy);
    const def = TOWERS[tower.towerId];
    const branchColor = tower.branch ? parseInt(BRANCH_INFO[tower.branch].color.slice(1), 16) : 0xffffff;

    const body = this.add.rectangle(0, 0, 28, 28, TOWER_COLORS[tower.towerId], 0.9);
    body.setStrokeStyle(2, branchColor, tower.branch ? 0.95 : 0.4);

    const nameText = this.add.text(0, -20, def.name, {
      fontSize: '9px',
      color: '#dae2fd',
      fontFamily: 'JetBrains Mono, monospace',
      stroke: '#0b1326',
      strokeThickness: 2,
    });
    nameText.setOrigin(0.5);

    const lvText = this.add.text(0, 0, `Lv${tower.level}`, {
      fontSize: '11px',
      color: '#0b1326',
      fontStyle: 'bold',
      fontFamily: 'JetBrains Mono, monospace',
    });
    lvText.setOrigin(0.5);

    const cdBarW = 30;
    const cdBarH = 4;
    const cdY = 20;
    const cdBg = this.add.rectangle(0, cdY, cdBarW, cdBarH, 0x1a2030, 0.85);
    const cdFill = this.add.rectangle(-cdBarW / 2, cdY, 0, cdBarH, TOWER_COLORS[tower.towerId], 1);
    cdFill.setOrigin(0, 0.5);

    const isBarracks = tower.towerId === 'barracks';
    cdBg.setVisible(!isBarracks);
    cdFill.setVisible(!isBarracks);

    container.add([body, nameText, lvText, cdBg, cdFill]);
    container.setDepth(15);
    container.setData('body', body);
    container.setData('lvText', lvText);
    container.setData('cdFill', cdFill);
    container.setData('cdBg', cdBg);
    container.setData('cdBarW', cdBarW);
    container.setData('cdY', cdY);
    this.towerSprites.set(slotId, container);
    this.refreshTowerCooldownBar(slotId);
  }

  refreshTowerVisual(slotId: string) {
    if (!this.towerSprites.has(slotId)) {
      this.addTowerVisual(slotId);
      return;
    }
    const tower = this.state.towers.get(slotId);
    const container = this.towerSprites.get(slotId);
    if (!tower || !container) return;

    const lvText = container.getData('lvText') as Phaser.GameObjects.Text;
    const body = container.getData('body') as Phaser.GameObjects.Rectangle;
    if (lvText) lvText.setText(`Lv${tower.level}`);
    if (body && tower.branch) {
      const c = parseInt(BRANCH_INFO[tower.branch].color.slice(1), 16);
      body.setStrokeStyle(3, c, 1);
    }
  }

  private updateTowerCooldownBars() {
    for (const slotId of this.towerSprites.keys()) {
      this.refreshTowerCooldownBar(slotId);
    }
  }

  private refreshTowerCooldownBar(slotId: string) {
    const container = this.towerSprites.get(slotId);
    const tower = this.state.towers.get(slotId);
    if (!container || !tower) return;

    const cdFill = container.getData('cdFill') as Phaser.GameObjects.Rectangle | undefined;
    const cdBg = container.getData('cdBg') as Phaser.GameObjects.Rectangle | undefined;
    const cdBarW = container.getData('cdBarW') as number;
    const cdY = container.getData('cdY') as number;
    if (!cdFill || !cdBg || !cdBarW) return;

    if (tower.towerId === 'barracks') {
      cdBg.setVisible(false);
      cdFill.setVisible(false);
      return;
    }

    const interval = getTowerFireInterval(tower);
    const ready = interval > 0 ? 1 - tower.fireCooldown / interval : 1;
    const ratio = Phaser.Math.Clamp(ready, 0, 1);

    cdBg.setVisible(true);
    cdFill.setVisible(true);
    cdFill.setSize(cdBarW * ratio, cdFill.height);
    cdFill.setPosition(-cdBarW / 2, cdY);
    cdFill.setFillStyle(ratio >= 0.98 ? 0x4ade80 : TOWER_COLORS[tower.towerId]);
  }

  /** Hover tháp đã xây hoặc slot trống → xem tầm tháp đang chọn */
  private updateRangeFromPointer() {
    if (this.config.readOnly) return;
    const ptr = this.input.activePointer;
    if (!ptr) return;
    this.updateTowerRangeHover(ptr.worldX, ptr.worldY);
  }

  private updateTowerRangeHover(worldX: number, worldY: number) {
    const { sx, sy } = this.getScale();
    const towerHitR = 36;
    let hoverTower: string | null = null;

    for (const [slotId, container] of this.towerSprites) {
      const dx = worldX - container.x;
      const dy = worldY - container.y;
      if (dx * dx + dy * dy <= towerHitR * towerHitR) {
        hoverTower = slotId;
        break;
      }
    }

    let previewSlot: string | null = null;
    if (!hoverTower && this.selectedTower !== 'barracks') {
      const slotHit = 28 * Math.min(sx, sy);
      let bestD = slotHit * slotHit;
      for (const s of this.config.map.slots) {
        if (this.state.towers.has(s.id)) continue;
        const sx2 = s.x * sx;
        const sy2 = s.y * sy;
        const dd = (worldX - sx2) ** 2 + (worldY - sy2) ** 2;
        if (dd < bestD) {
          bestD = dd;
          previewSlot = s.id;
        }
      }
    }

    const changed =
      hoverTower !== this.rangeHoverSlotId || previewSlot !== this.rangePreviewSlotId;
    this.rangeHoverSlotId = hoverTower;
    this.rangePreviewSlotId = previewSlot;
    if (changed) this.syncRangeRing();
  }

  private syncRangeRing() {
    this.rangeRing?.destroy();
    this.rangeRing = undefined;

    const { sx, sy } = this.getScale();
    const unit = Math.min(sx, sy);

    let slotId = this.rangeHoverSlotId;
    let towerId: TowerId | null = null;

    if (slotId) {
      const t = this.state.towers.get(slotId);
      if (t && t.towerId !== 'barracks') towerId = t.towerId;
      else slotId = null;
    }

    if (!slotId && this.rangePreviewSlotId && this.selectedTower !== 'barracks') {
      slotId = this.rangePreviewSlotId;
      towerId = this.selectedTower;
    }

    if (!slotId || !towerId) return;

    const slot = this.config.map.slots.find((s) => s.id === slotId);
    if (!slot) return;

    const tower = this.state.towers.get(slotId);
    const rangeMap = tower
      ? getTowerCombatRange(tower)
      : TOWERS[towerId].range + RANGE_SLACK;
    const rangePx = rangeMap * unit;
    const cx = slot.x * sx;
    const cy = slot.y * sy;
    const color = TOWER_COLORS[towerId];

    const ring = this.add.circle(cx, cy, rangePx, color, 0.1);
    ring.setStrokeStyle(3, color, 0.9);
    ring.setDepth(12);
    this.rangeRing = ring;
  }

  private playCombatShots(shots: CombatShot[]) {
    const { sx, sy } = this.getScale();
    const scale = Math.min(sx, sy);

    for (const shot of shots) {
      const slot = this.config.map.slots.find((s) => s.id === shot.slotId);
      if (!slot) continue;

      const fromX = slot.x * sx;
      const fromY = slot.y * sy;

      if (shot.aoe) {
        const tx = shot.aoe.x * sx;
        const ty = shot.aoe.y * sy;
        playCombatShot(this, shot, fromX, fromY, tx, ty, scale, shot.aoe.radius * scale);
        continue;
      }

      const enemy = this.state.enemies.find((e) => e.id === shot.enemyId);
      if (!enemy) continue;

      const pos = getEnemyMapPosition(this.state, enemy);
      playCombatShot(this, shot, fromX, fromY, pos.x * sx, pos.y * sy, scale);

      if (shot.chainEnemyIds?.length) {
        for (const cid of shot.chainEnemyIds) {
          const ce = this.state.enemies.find((e) => e.id === cid);
          if (!ce) continue;
          const cpos = getEnemyMapPosition(this.state, ce);
          playElectricChain(this, pos.x * sx, pos.y * sy, cpos.x * sx, cpos.y * sy);
        }
      }
    }
  }

  private createEnemyVisual(
    e: {
      id: number;
      unitId: UnitId;
      hp: number;
      maxHp: number;
      flying: boolean;
      isBoss: boolean;
    },
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const udef = UNITS[e.unitId];
    const isBoss = e.isBoss;
    const bodyColor = isBoss ? 0xdc2626 : e.flying ? 0xd8daff : 0xffb783;
    const radius = isBoss ? 18 : e.flying ? 9 : 11;

    const container = this.add.container(x, y);
    const body = this.add.circle(0, 0, radius, bodyColor, 0.95);
    body.setStrokeStyle(isBoss ? 3 : 1, isBoss ? 0xff4444 : 0xffffff, isBoss ? 1 : 0.55);

    const barW = isBoss ? 72 : 44;
    const barH = isBoss ? 6 : 4;
    const hpBg = this.add.rectangle(0, -radius - 12, barW, barH, 0x1a2030, 0.9);
    const ratio = e.hp / e.maxHp;
    const hpFill = this.add.rectangle(
      -barW / 2,
      -radius - 12,
      barW * ratio,
      barH,
      ratio > 0.35 ? 0x4ade80 : 0xf87171,
      1,
    );
    hpFill.setOrigin(0, 0.5);
    hpFill.setData('barW', barW);

    const label = isBoss ? 'BOSS' : (UNIT_LABELS[e.unitId] ?? udef.name);
    const nameText = this.add.text(0, -radius - (isBoss ? 28 : 22), label, {
      fontSize: isBoss ? '18px' : '10px',
      fontFamily: 'JetBrains Mono, monospace',
      color: isBoss ? '#ff3333' : '#dae2fd',
      fontStyle: isBoss ? 'bold' : 'normal',
      stroke: '#0b1326',
      strokeThickness: isBoss ? 4 : 2,
    });
    nameText.setOrigin(0.5, 0.5);

    container.add([body, hpBg, hpFill, nameText]);
    container.setDepth(isBoss ? 22 : 20);
    container.setData('hpFill', hpFill);
    container.setData('barW', barW);
    container.setData('radius', radius);
    container.setData('hpYOffset', -radius - 12);
    return container;
  }

  private updateEnemyHpBar(container: Phaser.GameObjects.Container, hp: number, maxHp: number) {
    const hpFill = container.getData('hpFill') as Phaser.GameObjects.Rectangle;
    const barW = container.getData('barW') as number;
    const yOff = container.getData('hpYOffset') as number;
    if (!hpFill || !barW) return;
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    hpFill.setSize(barW * ratio, hpFill.height);
    hpFill.setPosition(-barW / 2, yOff);
    hpFill.setFillStyle(ratio > 0.35 ? 0x4ade80 : 0xf87171);
  }

  private syncEnemies() {
    const { sx, sy } = this.getScale();
    const alive = new Set(this.state.enemies.map((en) => en.id));

    for (const [id, container] of this.enemySprites) {
      if (!alive.has(id)) {
        container.destroy();
        this.enemySprites.delete(id);
      }
    }

    for (const e of this.state.enemies) {
      const pos = getEnemyMapPosition(this.state, e);
      const x = pos.x * sx;
      const y = pos.y * sy;
      let container = this.enemySprites.get(e.id);
      if (!container) {
        container = this.createEnemyVisual(e, x, y);
        this.enemySprites.set(e.id, container);
      } else {
        container.setPosition(x, y);
        this.updateEnemyHpBar(container, e.hp, e.maxHp);
      }
    }
  }
}
