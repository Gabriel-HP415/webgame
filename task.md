# Sửa lỗi Battle Towers Online

## Bug Fixes
- [x] Bug #1: Race condition `bootBoard` — async + Promise (main.ts)
- [x] Bug #2: Laser hardcode bypass `targetsAir` (BoardState.ts)
- [x] Bug #3: DPS frame-rate dependent (BoardState.ts)
- [x] Bug #4: Double-kill bounty (BoardState.ts)
- [x] Bug #5: PvP monkey-patch race (main.ts)
- [x] Bug #6: Context menu on right-click (BoardScene.ts)
- [x] Bug #7: No game-over check (BoardState.ts + BoardScene.ts + main.ts)
- [x] Bug #8: AI wave never stops (main.ts)

## UI Additions
- [x] Game Over overlay (game.html + hud.css)
- [x] Game Over animation styles (hud.css)

## Hoàn thiện bổ sung (map + dock + PvP)
- [x] Phaser FIT 640×480 — map luôn vẽ đúng tỉ lệ
- [x] bootBoard dùng `Phaser.Core.Events.READY` + timeout fallback
- [x] Dock event delegation — chọn tháp không phụ thuộc await
- [x] Timer chạy ngay khi load trang
- [x] PvP boot song song, không treo sau board 1
- [x] Highlight slot theo tháp đang chọn

## Verification
- [x] `npm run build` builds successfully
- [ ] Test AI mode — game loads, play through, game over works
- [ ] Test PvP mode — send units, game over works
- [ ] Test right-click context menu blocked
