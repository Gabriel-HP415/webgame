import Phaser from 'phaser';
import type { TowerId } from '@bto/shared';
import type { CombatShot } from './BoardState.js';

const VFX_DEPTH = 30;

export function playCombatShot(
  scene: Phaser.Scene,
  shot: CombatShot,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  scale: number,
  aoeRadiusPx?: number,
): void {
  switch (shot.towerId) {
    case 'flak':
      playBullet(scene, fromX, fromY, toX, toY, 0xfbbf24);
      break;
    case 'machine_gun':
      playBullet(scene, fromX, fromY, toX, toY, 0x8aebff);
      break;
    case 'laser':
      playLaserBeam(scene, fromX, fromY, toX, toY);
      break;
    case 'mortar':
      playMortarArc(scene, fromX, fromY, toX, toY, scale, aoeRadiusPx ?? 48 * scale);
      break;
    default:
      break;
  }
}

export function playElectricChain(
  scene: Phaser.Scene,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(8, Math.hypot(dx, dy));
  const angle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  const bolt = scene.add.rectangle(mx, my, len, 4, 0xfde047, 0.95);
  bolt.setAngle(angle);
  bolt.setDepth(VFX_DEPTH);
  scene.tweens.add({
    targets: bolt,
    alpha: 0,
    duration: 100,
    onComplete: () => bolt.destroy(),
  });
}

function playBullet(
  scene: Phaser.Scene,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = 0x8aebff,
): void {
  const bullet = scene.add.circle(x1, y1, 5, color, 1);
  bullet.setStrokeStyle(2, 0xffffff, 1);
  bullet.setDepth(VFX_DEPTH);

  scene.tweens.add({
    targets: bullet,
    x: x2,
    y: y2,
    duration: 90,
    ease: 'Linear',
    onComplete: () => bullet.destroy(),
  });

  const trail = scene.add.circle(x1, y1, 3, 0xffffff, 0.5);
  trail.setDepth(VFX_DEPTH - 1);
  scene.tweens.add({
    targets: trail,
    x: x2,
    y: y2,
    alpha: 0,
    duration: 90,
    onComplete: () => trail.destroy(),
  });
}

function playLaserBeam(
  scene: Phaser.Scene,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(8, Math.hypot(dx, dy));
  const angle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  const glow = scene.add.rectangle(mx, my, len + 8, 10, 0xb6bcff, 0.35);
  glow.setAngle(angle);
  glow.setDepth(VFX_DEPTH - 1);

  const core = scene.add.rectangle(mx, my, len, 3, 0xffffff, 1);
  core.setAngle(angle);
  core.setDepth(VFX_DEPTH);

  scene.tweens.add({
    targets: [glow, core],
    alpha: 0,
    duration: 120,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      glow.destroy();
      core.destroy();
    },
  });
}

function playMortarArc(
  scene: Phaser.Scene,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  scale: number,
  blastRadius: number,
): void {
  const shell = scene.add.circle(x1, y1, 6, 0xff6b35, 1);
  shell.setStrokeStyle(2, 0xffffff, 0.9);
  shell.setDepth(VFX_DEPTH);

  const midX = (x1 + x2) / 2;
  const midY = Math.min(y1, y2) - 48 * scale;

  const curve = new Phaser.Curves.QuadraticBezier(
    new Phaser.Math.Vector2(x1, y1),
    new Phaser.Math.Vector2(midX, midY),
    new Phaser.Math.Vector2(x2, y2),
  );

  const follower = { t: 0 };
  scene.tweens.add({
    targets: follower,
    t: 1,
    duration: 260,
    ease: 'Quad.easeIn',
    onUpdate: () => {
      const p = curve.getPoint(follower.t);
      shell.setPosition(p.x, p.y);
    },
    onComplete: () => {
      shell.destroy();
      playMortarExplosion(scene, x2, y2, blastRadius);
    },
  });
}

export function playMortarExplosion(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  radius: number,
): void {
  const core = scene.add.circle(cx, cy, 10, 0xff6b35, 0.95);
  core.setStrokeStyle(3, 0xffffff, 1);
  core.setDepth(VFX_DEPTH);

  const ring = scene.add.circle(cx, cy, 12, 0xff6b35, 0.25);
  ring.setStrokeStyle(4, 0xffaa66, 0.9);
  ring.setDepth(VFX_DEPTH - 1);

  const targetScale = Math.max(1.2, radius / 12);
  scene.tweens.add({
    targets: [core, ring],
    scaleX: targetScale,
    scaleY: targetScale,
    alpha: 0,
    duration: 320,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      core.destroy();
      ring.destroy();
    },
  });
}
